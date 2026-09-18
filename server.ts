import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

// Lazy GoogleGenAI client initialization
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

// System grounding prompt from specifications
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

// Supported models with fallbacks for high-demand spikes
const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.1-flash-lite'];

/**
 * Robust Gemini model invoker with retry & fallback handling for 503 high demand / 429 rate limit
 */
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

        console.warn(`[Gemini API] Error calling model ${model} (attempt ${attempt + 1}):`, errMsg);

        if (isTransient && attempt === 0) {
          // Wait briefly with jitter before retry on same model
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
          continue;
        }
        break; // Break out of retry loop to try next model
      }
    }
  }

  throw lastError;
}

/**
 * Fallback memory extraction when AI service is experiencing high demand (503)
 */
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

/**
 * 1. Process Elder Memory / Story / Audio transcript
 * Extracts summary, topics, values, key lessons, age adaptations, follow-up questions
 */
app.post('/api/ai/process-memory', async (req: Request, res: Response) => {
  const { title, content, category, sourceType } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required for processing' });
  }

  try {
    const ai = getGenAI();
    const prompt = `Analyze this original recording/memory by an elder for the family archive:
Title: "${title || 'Untitled'}"
Category: "${category || 'General'}"
Source Type: "${sourceType || 'text'}"
Original Content:
"${content}"

Provide an accurate, grounded structured extraction. Never distort the elder's true message. Return JSON.`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_GROUNDING_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'A faithful 2-3 sentence AI summary of the elder’s story' },
            topics: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-6 relevant topics' },
            values: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Core family values exemplified' },
            keyLessons: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-3 key practical life lessons' },
            ageAdaptations: {
              type: Type.OBJECT,
              properties: {
                age8_12: { type: Type.STRING, description: 'Simpler narrative for young children emphasizing moral and warmth' },
                age13_17: { type: Type.STRING, description: 'Relatable lesson for teenagers dealing with school/peer challenges' },
                age18_plus: { type: Type.STRING, description: 'Deeper nuanced perspective for young adults making life choices' }
              }
            },
            followUpQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 warm interview follow-up questions to ask the elder next to enrich this memory'
            },
            knowledgeChunks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  content: { type: Type.STRING, description: 'Self-contained factual snippet from the text' },
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
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.warn('Process memory error encountered, activating graceful extraction fallback:', error?.message);
    // Graceful fallback prevents blocking the elder's story preservation when model experiences high demand
    const fallbackData = createFallbackMemoryExtraction(title || 'Memory', content, category || 'Life Lessons');
    return res.json({
      success: true,
      data: fallbackData,
      notice: 'Extracted with local analyzer due to temporary high AI service demand'
    });
  }
});

/**
 * 2. Ask My Elder (Grounded RAG)
 * Combines retrieved knowledge chunks belonging to the selected elder
 * Strictly prohibits hallucination if knowledge is missing
 */
app.post('/api/ai/ask-elder', async (req: Request, res: Response) => {
  const {
    question,
    elderName,
    elderId,
    childProfile,
    retrievedChunks
  } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (!retrievedChunks || retrievedChunks.length === 0) {
    return res.json({
      answer: `I don't have enough recorded information from ${elderName || 'your elder'} to answer that question. You can ask them to record a memory or story about this!`,
      confidence: 'insufficient',
      references: [],
      generated: true,
      insufficientSource: true
    });
  }

  // Prepare context from authorized chunks
  const contextText = retrievedChunks.map((chunk: any, index: number) => {
    return `[Source ID: ${chunk.sourceReferenceId || 'SRC-' + index}] (${chunk.category || 'Memory'}: "${chunk.title || 'Entry'}"):\n${chunk.content}`;
  }).join('\n\n---\n\n');

  try {
    const ai = getGenAI();

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
            elderQuoteIfDirect: { type: Type.STRING, description: 'Direct verbatim quote if present in text' },
            encouragement: { type: Type.STRING, description: 'Brief warm family closing remark' }
          },
          required: ['answer', 'confidence', 'usedReferenceIds', 'insufficientSource']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');

    // Build verified references list
    const matchedReferences = (parsed.usedReferenceIds || []).map((refId: string) => {
      const found = retrievedChunks.find((c: any) => c.sourceReferenceId === refId);
      return {
        referenceId: refId,
        title: found?.title || `Recorded Entry ${refId}`,
        category: found?.category || 'Memory'
      };
    });

    return res.json({
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
  } catch (error: any) {
    console.warn('Ask-elder error encountered, activating grounded knowledge fallback:', error?.message);

    // If AI service is unavailable (e.g. 503 high demand), ground directly in elder's actual retrieved chunks
    const primaryChunk = retrievedChunks[0];
    const matchedReferences = retrievedChunks.slice(0, 2).map((c: any) => ({
      referenceId: c.sourceReferenceId,
      title: c.title || 'Recorded Entry',
      category: c.category || 'Memory'
    }));

    const cleanSnippet = primaryChunk.content.length > 300
      ? primaryChunk.content.slice(0, 300) + '...'
      : primaryChunk.content;

    return res.json({
      answer: `Based directly on ${elderName || 'your elder'}'s recorded memories on ${primaryChunk.category || 'this topic'}: "${cleanSnippet}"`,
      confidence: 'grounded',
      insufficientSource: false,
      elderQuoteIfDirect: cleanSnippet.slice(0, 160),
      references: matchedReferences,
      generated: true,
      notice: 'Answered directly from verified archive records while AI service experiences high demand.'
    });
  }
});

/**
 * Curated fallback prompts for guided elder interview
 */
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

/**
 * 3. Guided Elder Interview Prompt Generator
 */
app.post('/api/ai/interview-prompt', async (req: Request, res: Response) => {
  const { category, previousTopics } = req.body;
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
    return res.json({ success: true, prompts: parsed.prompts || [] });
  } catch (error: any) {
    console.warn('Interview prompt generation fallback triggered:', error?.message);
    const fallbackPrompts = CURATED_INTERVIEW_PROMPTS[targetCategory] || CURATED_INTERVIEW_PROMPTS['General'];
    return res.json({ success: true, prompts: fallbackPrompts });
  }
});

// Production static file serving
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Living Family Mentor backend server running on port ${PORT}`);
});

export default app;
