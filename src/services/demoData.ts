import { db } from '../firebase/config';
import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc } from 'firebase/firestore';
import { Memory, KnowledgeChunk, AIContent, ElderProfile, ChildProfile, FamilyConnection } from '../types';

export const DEMO_ELDER = {
  uid: 'demo-elder-grandpa-01',
  elderId: 'ELD-DEMO01',
  name: 'Grandfather Robert',
  bio: 'Retired electrical engineer and lifelong gardener. Preserving 70 years of life lessons, failures, and values for Rahul and family.'
};

export const DEMO_MEMORIES: Array<Omit<Memory, 'id'>> = [
  {
    memoryId: 'MEM-DEMO-01',
    referenceId: 'MEM-000127',
    elderUid: DEMO_ELDER.uid,
    title: 'My First Business Failure & What It Taught Me',
    category: 'Career & Money',
    tags: ['business', 'failure', 'money', 'learning', 'resilience'],
    sourceType: 'text',
    content: 'When I was 25 in 1978, I started a small electronic repair shop with my cousin. We were full of enthusiasm, but within 14 months we went completely broke. I failed because I didn’t understand cash flow, inventory overhead, and accounting. I was too proud to ask for mentorship. That painful failure taught me that passion alone without disciplined financial management is like a sailboat without a rudder. Later in life, before every major undertaking, I always mapped out worst-case risk scenarios.',
    version: 1,
    processingStatus: 'completed',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString()
  },
  {
    memoryId: 'MEM-DEMO-02',
    referenceId: 'STORY-000245',
    elderUid: DEMO_ELDER.uid,
    title: 'How I Met Your Grandmother at the Railway Station',
    category: 'Relationships & Family',
    tags: ['love', 'grandmother', 'family', 'patience', 'tradition'],
    sourceType: 'text',
    content: 'It was a rainy afternoon in September 1968. The train from Mumbai was delayed by three hours. Eleanor was reading a book of poetry under a leaky platform awning, holding an umbrella that was missing one spoke. I offered to share my dry bench and tea. We spoke for four hours straight without feeling the time slip away. In marriage, what sustained us across 52 years was not grand gestures, but mutual respect during small delays, listening actively, and laughing together when life does not go according to the timetable.',
    version: 1,
    processingStatus: 'completed',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString()
  },
  {
    memoryId: 'MEM-DEMO-03',
    referenceId: 'ADV-000083',
    elderUid: DEMO_ELDER.uid,
    title: 'Advice on Choosing a Career: Integrity Over Impressiveness',
    category: 'Life Advice',
    tags: ['career', 'integrity', 'purpose', 'work', 'values'],
    sourceType: 'text',
    content: 'In your twenties, everyone will pressure you to chase prestigious job titles and high salaries. While earning a living is essential, never take a job where you must compromise your personal ethics or compromise your peace of mind to climb the ladder. Choose work where you can look in the mirror every evening with self-respect. Technical skills can be acquired in months; your reputation for honesty takes decades to build and seconds to lose.',
    version: 1,
    processingStatus: 'completed',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString()
  }
];

export const DEMO_AI_CONTENTS: Array<Omit<AIContent, 'id'>> = [
  {
    aiContentId: 'AI-000812',
    sourceReferenceIds: ['MEM-000127'],
    elderUid: DEMO_ELDER.uid,
    title: 'My First Business Failure & What It Taught Me',
    summary: 'Grandpa reflects on starting an electronics repair business at age 25 that collapsed after 14 months due to neglect of financial fundamentals and pride. The setback transformed his perspective on planning, risk, and humility.',
    topics: ['Financial Literacy', 'Resilience', 'Entrepreneurship', 'Humility'],
    values: ['Financial Discipline', 'Humility', 'Thorough Preparation'],
    keyLessons: [
      'Passion without accounting is a sailboat without a rudder.',
      'Always prepare for worst-case risk scenarios before committing resources.',
      'Never let pride stop you from seeking experienced mentors.'
    ],
    ageAdaptations: {
      age8_12: 'Grandpa once built a little shop with his cousin, but they spent all their pennies too fast and had to close. He learned that taking good care of your toys and coins matters before starting big adventures!',
      age13_17: 'Grandpa failed at his first business because he did not plan his budget or ask for help. When you face an exam or project failure, realize it is just a signpost showing you what skill to practice next.',
      age18_plus: 'A masterclass in early career hubris: Grandpa highlights that operational cash flow and mentorship trump pure ambition. Calculate downside vulnerability before taking calculated risks.'
    },
    followUpQuestions: [
      'What was the hardest conversation you had to have after the shop closed?',
      'How did you earn back the money and rebuild your confidence?',
      'What financial habit do you still practice today because of that failure?'
    ],
    createdAt: new Date().toISOString()
  },
  {
    aiContentId: 'AI-000813',
    sourceReferenceIds: ['STORY-000245'],
    elderUid: DEMO_ELDER.uid,
    title: 'How I Met Your Grandmother at the Railway Station',
    summary: 'A recount of meeting Eleanor during a train delay in 1968, underscoring that enduring companionship is built on kindness during inconvenient moments, active listening, and shared humor.',
    topics: ['Enduring Love', 'Patience', 'Kindness', 'Marriage'],
    values: ['Mutual Respect', 'Patience in adversity', 'Attentive listening'],
    keyLessons: [
      'Life’s delays and detours often bring our greatest encounters.',
      'A great partnership is founded on patience during small daily inconveniences.'
    ],
    ageAdaptations: {
      age8_12: 'Grandpa met Grandma on a rainy train platform and shared his umbrella and warm tea. Being kind to people on rainy days can make lifelong friends!',
      age13_17: 'Real relationships are not like movies with fireworks; they grow out of genuinely listening to each other when plans get delayed.',
      age18_plus: 'Grandpa’s 52-year relationship advice: evaluate a partner by how they treat you when the timetable falls apart and things go wrong.'
    },
    followUpQuestions: [
      'What book of poems was Grandma reading that day?',
      'What was the first family dinner you two hosted together?'
    ],
    createdAt: new Date().toISOString()
  }
];

export const DEMO_CHILD: ChildProfile = {
  uid: 'demo-child-rahul-01',
  name: 'Rahul',
  age: 16,
  learningStyle: 'Storytelling',
  communicationStyle: 'Friendly',
  interests: ['Career resilience', 'Life lessons', 'Family heritage'],
  goals: 'Learn from Grandpa Robert’s life lessons and preserve our family story.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const DEMO_CONNECTION: FamilyConnection = {
  id: 'conn-demo-robert-rahul',
  connectionId: 'CONN-DEMO-01',
  elderUid: DEMO_ELDER.uid,
  childUid: DEMO_CHILD.uid,
  elderName: DEMO_ELDER.name,
  elderId: DEMO_ELDER.elderId,
  childName: DEMO_CHILD.name,
  childAge: DEMO_CHILD.age,
  status: 'accepted',
  permissions: {
    stories: true,
    memories: true,
    advice: true,
    lessons: true,
    audio: true,
    video: true
  },
  createdAt: new Date().toISOString(),
  approvedAt: new Date().toISOString()
};

export const DEMO_KNOWLEDGE_CHUNKS: Array<Omit<KnowledgeChunk, 'id'>> = [
  {
    chunkId: 'KC-MEM-000127-1',
    elderUid: DEMO_ELDER.uid,
    sourceReferenceId: 'MEM-000127',
    content: 'At age 25 in 1978, Robert started a small electronic repair shop with his cousin. They went completely broke after 14 months due to neglecting cash flow, inventory overhead, and pride in refusing to seek experienced mentorship. He learned that passion without disciplined financial management is like a sailboat without a rudder, and always maps worst-case risk scenarios.',
    category: 'Career & Money',
    contentType: 'text',
    keywords: ['business', 'failure', 'accounting', 'mentor', 'cash flow', 'mistakes', 'risk', 'money', 'career'],
    createdAt: new Date().toISOString()
  },
  {
    chunkId: 'KC-STORY-000245-1',
    elderUid: DEMO_ELDER.uid,
    sourceReferenceId: 'STORY-000245',
    content: 'In September 1968, Robert met Eleanor on a rainy afternoon when the train from Mumbai was delayed by three hours. Eleanor was reading poetry with an umbrella missing a spoke. Robert offered warm tea and a dry bench. Across 52 years of marriage, they learned that mutual respect during unexpected delays, attentive listening, and shared humor sustain true partnership.',
    category: 'Relationships & Family',
    contentType: 'text',
    keywords: ['grandmother', 'marriage', 'train', 'relationship', 'patience', 'listening', 'family', 'love'],
    createdAt: new Date().toISOString()
  },
  {
    chunkId: 'KC-ADV-000083-1',
    elderUid: DEMO_ELDER.uid,
    sourceReferenceId: 'ADV-000083',
    content: 'Never sacrifice your personal ethics or compromise your peace of mind to climb a career ladder. A prestigious title is temporary; your reputation for honesty takes decades to build and seconds to lose. Choose work where you can look in the mirror every evening with self-respect.',
    category: 'Life Advice',
    contentType: 'text',
    keywords: ['career', 'integrity', 'ethics', 'reputation', 'honesty', 'work', 'job', 'values'],
    createdAt: new Date().toISOString()
  }
];

export async function seedDemoDataIfEmpty(): Promise<boolean> {
  // Built-in demo memory objects are provided in-memory to prevent unauthenticated Firestore permission errors.
  return true;
}

const LOCAL_MEMORIES_KEY = 'living_family_demo_memories_v2';
const LOCAL_AI_KEY = 'living_family_demo_ai_v2';
const LOCAL_CHUNKS_KEY = 'living_family_demo_chunks_v2';

export function getLocalCustomMemories(elderUid?: string): Memory[] {
  try {
    const raw = localStorage.getItem(LOCAL_MEMORIES_KEY);
    if (!raw) return [];
    const list: Memory[] = JSON.parse(raw);
    if (!elderUid) return list;
    return list.filter(m => m.elderUid === elderUid);
  } catch (e) {
    return [];
  }
}

export function saveLocalCustomMemory(
  memory: Memory,
  aiContent?: AIContent,
  knowledgeChunks?: KnowledgeChunk[]
) {
  try {
    const existing = getLocalCustomMemories();
    const updated = [memory, ...existing.filter(m => m.id !== memory.id && m.memoryId !== memory.memoryId)];
    localStorage.setItem(LOCAL_MEMORIES_KEY, JSON.stringify(updated));

    if (aiContent) {
      const rawAi = localStorage.getItem(LOCAL_AI_KEY);
      const existingAi: AIContent[] = rawAi ? JSON.parse(rawAi) : [];
      const updatedAi = [aiContent, ...existingAi.filter(a => a.id !== aiContent.id && a.aiContentId !== aiContent.aiContentId)];
      localStorage.setItem(LOCAL_AI_KEY, JSON.stringify(updatedAi));
    }

    if (knowledgeChunks && knowledgeChunks.length > 0) {
      const rawChunks = localStorage.getItem(LOCAL_CHUNKS_KEY);
      const existingChunks: KnowledgeChunk[] = rawChunks ? JSON.parse(rawChunks) : [];
      const updatedChunks = [...knowledgeChunks, ...existingChunks];
      localStorage.setItem(LOCAL_CHUNKS_KEY, JSON.stringify(updatedChunks));
    }
  } catch (e) {
    console.error('Error saving local custom memory:', e);
  }
}

export function getLocalCustomAiContents(elderUid?: string): AIContent[] {
  try {
    const raw = localStorage.getItem(LOCAL_AI_KEY);
    if (!raw) return [];
    const list: AIContent[] = JSON.parse(raw);
    if (!elderUid) return list;
    return list.filter(a => a.elderUid === elderUid);
  } catch (e) {
    return [];
  }
}

export function getLocalCustomKnowledgeChunks(elderUid?: string): KnowledgeChunk[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHUNKS_KEY);
    if (!raw) return [];
    const list: KnowledgeChunk[] = JSON.parse(raw);
    if (!elderUid) return list;
    return list.filter(c => c.elderUid === elderUid);
  } catch (e) {
    return [];
  }
}

