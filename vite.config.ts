import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

function apiPlugin(): Plugin {
  let genaiClient: GoogleGenAI | null = null;
  function getGenAI(): GoogleGenAI {
    if (!genaiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not configured');
      }
      genaiClient = new GoogleGenAI({ apiKey });
    }
    return genaiClient;
  }

  const SYSTEM_GROUNDING_INSTRUCTION = `You are an AI assistant preserving and adapting family knowledge in the "Living Family Mentor" platform.
The retrieved information comes from an elder's actual recorded memories, stories, advice, and experiences.
Use the retrieved information as the source of truth.
Do not invent memories.
Do not invent statements.
Do not claim an elder said something unless the source contains the statement.
Clearly distinguish direct quotes, paraphrases, summaries, and AI-generated interpretations.
If the retrieved information does not contain enough information to answer a question, say so honestly.
Adapt the response according to the child's age and learning profile while preserving the underlying meaning.
Never reveal information outside the child's permissions.
Do not mix information from different elders unless explicitly instructed.`;

  const PRIMARY_MODEL = 'gemini-3.8-flash';
  const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.1-flash-lite'];

  async function callGeminiWithFallback(
    ai: GoogleGenAI,
    requestConfig: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
    preferredModel: string = PRIMARY_MODEL
  ) {
    const modelsToTry = [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)];
    let lastError: any = null;

    for (const model of modelsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            ...requestConfig,
            model
          });
          return response;
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          const isTransient =
            err?.status === 'UNAVAILABLE' ||
            err?.code === 503 ||
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('Resource has been exhausted') ||
            err?.code === 429;

          console.warn(`[Vite Dev Gemini API] Error calling model ${model} (attempt ${attempt + 1}):`, errMsg);

          if (isTransient && attempt === 0) {
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
            continue;
          }
          break;
        }
      }
    }

    throw lastError;
  }

  function createFallbackMemoryExtraction(title: string, content: string, category: string) {
    const sentences = content
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    const summary = sentences.slice(0, 3).join(' ') || content.slice(0, 240);
    const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const freq: Record<string, number> = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const sortedWords = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 5);

    return {
      summary,
      topics: [category, ...sortedWords.slice(0, 3)],
      values: ['Resilience', 'Family Heritage', 'Wisdom'],
      keyLessons: [
        sentences[0] || `Reflections on ${title || 'this memory'}.`,
        sentences[1] || 'Cherishing experiences and passing on hard-learned lessons.'
      ],
      ageAdaptations: {
        age8_12: `A story about ${category.toLowerCase()} from family history: "${summary}"`,
        age13_17: `A real-life lesson on ${category.toLowerCase()}: "${summary}"`,
        age18_plus: `Lived perspective on ${category.toLowerCase()}: "${summary}"`
      },
      followUpQuestions: [
        `What was the most challenging part of that experience?`,
        `How did this memory influence your values over time?`,
        `What advice would you give your younger self today?`
      ],
      knowledgeChunks: [
        {
          content,
          keywords: [category, ...sortedWords.slice(0, 4)]
        }
      ]
    };
  }

  const CURATED_INTERVIEW_PROMPTS: Record<string, Array<{ question: string; category: string; whyItMatters: string }>> = {
    'Life Lessons': [
      { question: 'What was one of the toughest challenges you faced growing up, and how did you get through it?', category: 'Life Lessons', whyItMatters: 'Inspires resilience in your family.' },
      { question: 'What is a life truth or principle you only came to understand as you got older?', category: 'Life Lessons', whyItMatters: 'Passes down timeless clarity.' },
      { question: 'What mistake or detour in life taught you something that changed you for the better?', category: 'Life Lessons', whyItMatters: 'Normalizes growth and perseverance.' }
    ],
    'Career & Work': [
      { question: 'What was your very first job, and what do you remember feeling about earning your own money?', category: 'Career & Work', whyItMatters: 'Shows the value of honest labor.' },
      { question: 'What work accomplishment or project brought you the deepest personal satisfaction?', category: 'Career & Work', whyItMatters: 'Models dedication and pride in craftsmanship.' },
      { question: 'How did you handle unfairness or setbacks in your working life?', category: 'Career & Work', whyItMatters: 'Gives guidance for modern career hurdles.' }
    ],
    'Family & Heritage': [
      { question: 'What family tradition or holiday celebration meant the most to you when you were young?', category: 'Family & Heritage', whyItMatters: 'Keeps ancestral customs alive.' },
      { question: 'What was home like when you were a child, and who had the biggest influence on your character?', category: 'Family & Heritage', whyItMatters: 'Connects children to family roots.' },
      { question: 'What advice on marriage, love, or deep friendships would you offer to the next generation?', category: 'Family & Heritage', whyItMatters: 'Strengthens future family bonds.' }
    ],
    'General': [
      { question: 'What are you most grateful for when you look back on your life journey?', category: 'General', whyItMatters: 'Instills a spirit of gratitude.' },
      { question: 'What do you hope your children and grandchildren remember most about you?', category: 'General', whyItMatters: 'Preserves personal legacy.' },
      { question: 'What advice would you give to a family member who is feeling uncertain about their future?', category: 'General', whyItMatters: 'Offers warm comfort and perspective.' }
    ]
  };

  return {
    name: 'api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const getBody = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch (e) {
                reject(e);
              }
            });
            req.on('error', reject);
          });
        };

        const sendJson = (data: any, status = 200) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        try {
          if (req.url === '/api/ai/process-memory' && req.method === 'POST') {
            const body = await getBody();
            const { title, content, category, sourceType } = body;
            if (!content || !content.trim()) {
              return sendJson({ error: 'Content is required' }, 400);
            }

            try {
              const ai = getGenAI();
              const prompt = `Analyze this original recording/memory by an elder for the family archive:
Title: "${title || 'Untitled'}"
Category: "${category || 'General'}"
Source Type: "${sourceType || 'text'}"
Original Content:
"${content}"

Provide an accurate, grounded structured extraction. Never distort the elder’s true message. Return JSON.`;

              const response = await callGeminiWithFallback(ai, {
                contents: prompt,
                config: {
                  systemInstruction: SYSTEM_GROUNDING_INSTRUCTION,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      summary: { type: Type.STRING, description: 'A faithful 2-3 sentence AI summary' },
                      topics: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-6 relevant topics' },
                      values: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Core family values exemplified' },
                      keyLessons: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-3 key practical life lessons' },
                      ageAdaptations: {
                        type: Type.OBJECT,
                        properties: {
                          age8_12: { type: Type.STRING, description: 'Simpler narrative for young children' },
                          age13_17: { type: Type.STRING, description: 'Relatable lesson for teenagers' },
                          age18_plus: { type: Type.STRING, description: 'Nuanced perspective for young adults' }
                        }
                      },
                      followUpQuestions: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: '3 warm interview follow-up questions to ask the elder next'
                      },
                      knowledgeChunks: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            content: { type: Type.STRING, description: 'Self-contained factual snippet' },
                            keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                          },
                          required: ['content', 'keywords']
                        }
                      }
                    },
                    required: ['summary', 'topics', 'values', 'keyLessons', 'followUpQuestions']
                  }
                }
              });

              const parsed = JSON.parse(response.text || '{}');
              return sendJson({ success: true, data: parsed });
            } catch (err: any) {
              console.warn('[Vite Dev] Gracefully falling back for process-memory due to API error:', err?.message);
              const fallback = createFallbackMemoryExtraction(title || 'Memory', content, category || 'General');
              return sendJson({ success: true, data: fallback, notice: 'Extracted with local analyzer' });
            }
          }

          if (req.url === '/api/ai/ask-elder' && req.method === 'POST') {
            const body = await getBody();
            const { question, elderName, elderId, childProfile, retrievedChunks } = body;

            if (!question || !question.trim()) {
              return sendJson({ error: 'Question is required' }, 400);
            }

            if (!retrievedChunks || retrievedChunks.length === 0) {
              return sendJson({
                answer: `I don't have enough recorded information from ${elderName || 'your elder'} to answer that question. You can ask them to record a memory or story about this!`,
                confidence: 'insufficient',
                references: [],
                generated: true,
                insufficientSource: true
              });
            }

            try {
              const ai = getGenAI();
              const contextText = retrievedChunks.map((chunk: any, index: number) => {
                return `[Source ID: ${chunk.sourceReferenceId || 'SRC-' + index}] (${chunk.category || 'Memory'}: "${chunk.title || 'Entry'}"):\n${chunk.content}`;
              }).join('\n\n---\n\n');

              const prompt = `A young family member is asking their elder (${elderName || 'Elder'} - ID: ${elderId || ''}) for advice or life experience.

CHILD PROFILE:
- Name: ${childProfile?.name || 'Grandchild'}
- Age: ${childProfile?.age || 15}
- Learning Style: ${childProfile?.learningStyle || 'Storytelling'}
- Communication Style: ${childProfile?.communicationStyle || 'Friendly'}
- Interests: ${(childProfile?.interests || []).join(', ') || 'General'}

CHILD'S QUESTION:
"${question}"

VERIFIED RETRIEVED SOURCE KNOWLEDGE RECORDED BY ${elderName?.toUpperCase() || 'THE ELDER'}:
${contextText}

CRITICAL RULES:
1. Base the answer STRICTLY on the retrieved sources above.
2. If the retrieved records do NOT contain relevant information to answer the question, do NOT invent or fabricate memories. Return insufficientSource: true.
3. Adapt the tone and vocabulary to the child's age (${childProfile?.age || 15}) and communication style.
4. List every sourceReferenceId that was directly used to formulate the answer.
5. Clearly distinguish what the elder directly experienced or said versus your framing.`;

              const response = await callGeminiWithFallback(ai, {
                contents: prompt,
                config: {
                  systemInstruction: SYSTEM_GROUNDING_INSTRUCTION,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      answer: { type: Type.STRING, description: 'The grounded answer addressed to the child' },
                      confidence: { type: Type.STRING, enum: ['grounded', 'insufficient'] },
                      insufficientSource: { type: Type.BOOLEAN },
                      usedReferenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      elderQuoteIfDirect: { type: Type.STRING, description: 'Direct verbatim quote if present' },
                      encouragement: { type: Type.STRING, description: 'Brief warm family closing remark' }
                    },
                    required: ['answer', 'confidence', 'usedReferenceIds', 'insufficientSource']
                  }
                }
              });

              const parsed = JSON.parse(response.text || '{}');
              const matchedReferences = (parsed.usedReferenceIds || []).map((refId: string) => {
                const found = retrievedChunks.find((c: any) => c.sourceReferenceId === refId);
                return {
                  referenceId: refId,
                  title: found?.title || `Recorded Entry ${refId}`,
                  category: found?.category || 'Memory'
                };
              });

              return sendJson({
                answer: parsed.answer,
                confidence: parsed.confidence,
                insufficientSource: parsed.insufficientSource,
                elderQuoteIfDirect: parsed.elderQuoteIfDirect,
                references: matchedReferences.length > 0 ? matchedReferences : (parsed.insufficientSource ? [] : retrievedChunks.slice(0, 2).map((c: any) => ({
                  referenceId: c.sourceReferenceId,
                  title: c.title || 'Recorded Entry',
                  category: c.category
                }))),
                generated: true
              });
            } catch (err: any) {
              console.warn('[Vite Dev] Gracefully falling back for ask-elder due to API error:', err?.message);
              const primaryChunk = retrievedChunks[0];
              const cleanSnippet = primaryChunk.content.length > 300
                ? primaryChunk.content.slice(0, 300) + '...'
                : primaryChunk.content;
              return sendJson({
                answer: `Based directly on ${elderName || 'your elder'}'s recorded memories on ${primaryChunk.category || 'this topic'}: "${cleanSnippet}"`,
                confidence: 'grounded',
                insufficientSource: false,
                elderQuoteIfDirect: cleanSnippet.slice(0, 160),
                references: retrievedChunks.slice(0, 2).map((c: any) => ({
                  referenceId: c.sourceReferenceId,
                  title: c.title || 'Recorded Entry',
                  category: c.category || 'Memory'
                })),
                generated: true,
                notice: 'Grounded directly in archive records'
              });
            }
          }

          if (req.url === '/api/ai/interview-prompt' && req.method === 'POST') {
            const body = await getBody();
            const { category, previousTopics } = body;
            const targetCategory = category || 'Life Lessons';

            try {
              const ai = getGenAI();
              const prompt = `Suggest 3 thoughtful, heartwarming interview questions for an elder who is recording their life story for their grandchildren.
Category: ${targetCategory}
Previously covered topics: ${(previousTopics || []).join(', ') || 'None yet'}
Make the questions open-ended, emotional, and easy to speak about.`;

              const response = await callGeminiWithFallback(ai, {
                contents: prompt,
                config: {
                  systemInstruction: SYSTEM_GROUNDING_INSTRUCTION,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      prompts: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            question: { type: Type.STRING },
                            category: { type: Type.STRING },
                            whyItMatters: { type: Type.STRING }
                          },
                          required: ['question', 'category']
                        }
                      }
                    },
                    required: ['prompts']
                  }
                }
              });

              const parsed = JSON.parse(response.text || '{}');
              return sendJson({ success: true, prompts: parsed.prompts || [] });
            } catch (err: any) {
              console.warn('[Vite Dev] Fallback interview prompts triggered:', err?.message);
              const fallbackPrompts = CURATED_INTERVIEW_PROMPTS[targetCategory] || CURATED_INTERVIEW_PROMPTS['General'];
              return sendJson({ success: true, prompts: fallbackPrompts });
            }
          }

          sendJson({ error: 'Endpoint not found' }, 404);
        } catch (err: any) {
          console.error('API Error:', err);
          sendJson({ error: err?.message || 'Server error' }, 500);
        }
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
