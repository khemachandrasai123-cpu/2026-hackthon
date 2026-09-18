import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';
import { auth, db } from '../firebase/config';
import {
  DEMO_ELDER,
  DEMO_KNOWLEDGE_CHUNKS,
  DEMO_MEMORIES,
  getLocalCustomMemories,
  saveLocalCustomMemory,
  getLocalCustomAiContents,
  getLocalCustomKnowledgeChunks
} from './demoData';
import {
  AppUser,
  ElderProfile,
  ChildProfile,
  FamilyConnection,
  Memory,
  KnowledgeChunk,
  AIContent,
  QuestionAnswer,
  WisdomModule,
  ActivityEvent
} from '../types';

/**
 * Sign in with Google (Primary supported Firebase provider)
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/**
 * Create or Update Elder Profile for authenticated user
 */
export async function createElderProfileForUser(
  uid: string,
  name: string,
  email: string,
  bio?: string
): Promise<{ user: AppUser; elderProfile: ElderProfile }> {
  const elderId = generateElderId();

  const userDoc: AppUser = {
    uid,
    name,
    email,
    role: 'elder',
    createdAt: new Date().toISOString()
  };

  const elderProf: ElderProfile = {
    uid,
    elderId,
    name,
    bio: bio || 'Preserving family memories and wisdom for future generations.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'users', uid), userDoc);
  await setDoc(doc(db, 'elderProfiles', uid), elderProf);

  await logActivity({
    type: 'story_added',
    title: 'Elder Profile Created',
    description: `${name} joined with Elder ID: ${elderId}`,
    elderUid: uid
  });

  return { user: userDoc, elderProfile: elderProf };
}

/**
 * Create or Update Child Profile for authenticated user
 */
export async function createChildProfileForUser(
  uid: string,
  name: string,
  email: string,
  age: number,
  learningStyle: ChildProfile['learningStyle'] = 'Storytelling',
  communicationStyle: ChildProfile['communicationStyle'] = 'Friendly',
  interests: string[] = ['Life advice', 'Family history', 'Career lessons']
): Promise<{ user: AppUser; childProfile: ChildProfile }> {
  const userDoc: AppUser = {
    uid,
    name,
    email,
    role: 'child',
    createdAt: new Date().toISOString()
  };

  const childProf: ChildProfile = {
    uid,
    name,
    age,
    interests,
    learningStyle,
    communicationStyle,
    goals: 'Learn from elder experiences and carry forward family values.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'users', uid), userDoc);
  await setDoc(doc(db, 'childProfiles', uid), childProf);

  return { user: userDoc, childProfile: childProf };
}

/**
 * Generate unique IDs
 */
export function generateElderId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'ELD-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateReferenceId(type: 'MEM' | 'STORY' | 'ADV' | 'AUDIO' | 'VIDEO' = 'MEM'): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${type}-${num}`;
}

export function generateAiContentId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `AI-${num}`;
}

/**
 * Register Elder with Email/Password (falls back with guidance if provider disabled)
 */
export async function registerElder(name: string, email: string, pass: string, bio?: string): Promise<{ user: AppUser; elderProfile: ElderProfile }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    return await createElderProfileForUser(cred.user.uid, name, email, bio);
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed') {
      throw new Error('Email/Password registration is not enabled on this Firebase project. Please use "Sign in with Google" or "1-Click Demo Account".');
    }
    throw err;
  }
}

/**
 * Register Child with Email/Password (falls back with guidance if provider disabled)
 */
export async function registerChild(
  name: string,
  email: string,
  pass: string,
  age: number,
  learningStyle: ChildProfile['learningStyle'] = 'Storytelling',
  communicationStyle: ChildProfile['communicationStyle'] = 'Friendly',
  interests: string[] = ['Life advice', 'Family history', 'Career lessons']
): Promise<{ user: AppUser; childProfile: ChildProfile }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    return await createChildProfileForUser(cred.user.uid, name, email, age, learningStyle, communicationStyle, interests);
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed') {
      throw new Error('Email/Password registration is not enabled on this Firebase project. Please use "Sign in with Google" or "1-Click Demo Account".');
    }
    throw err;
  }
}

/**
 * Fetch Current App User Profile
 */
export async function fetchCurrentUserData(uid: string): Promise<{
  user: AppUser | null;
  elderProfile: ElderProfile | null;
  childProfile: ChildProfile | null;
}> {
  try {
    const uSnap = await getDoc(doc(db, 'users', uid));
    if (!uSnap.exists()) return { user: null, elderProfile: null, childProfile: null };

    const user = uSnap.data() as AppUser;
    let elderProfile: ElderProfile | null = null;
    let childProfile: ChildProfile | null = null;

    if (user.role === 'elder') {
      const eSnap = await getDoc(doc(db, 'elderProfiles', uid));
      if (eSnap.exists()) elderProfile = eSnap.data() as ElderProfile;
    } else if (user.role === 'child') {
      const cSnap = await getDoc(doc(db, 'childProfiles', uid));
      if (cSnap.exists()) childProfile = cSnap.data() as ChildProfile;
    }

    return { user, elderProfile, childProfile };
  } catch (err) {
    console.error('Error fetching user data:', err);
    return { user: null, elderProfile: null, childProfile: null };
  }
}

/**
 * Child Requests Connection with Elder ID
 */
export async function requestElderConnection(childUid: string, childName: string, childAge: number, elderIdInput: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = elderIdInput.trim().toUpperCase();

    // Check if connecting to Demo Grandfather Robert
    let elderUid = '';
    let elderName = '';
    let elderId = cleanId;

    const eldersRef = collection(db, 'elderProfiles');
    const q = query(eldersRef, where('elderId', '==', cleanId));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const elderDoc = snap.docs[0];
      const elderData = elderDoc.data() as ElderProfile;
      elderUid = elderData.uid;
      elderName = elderData.name;
      elderId = elderData.elderId;
    } else if (cleanId === DEMO_ELDER.elderId) {
      elderUid = DEMO_ELDER.uid;
      elderName = DEMO_ELDER.name;
      elderId = DEMO_ELDER.elderId;
    } else {
      return { success: false, message: 'That Elder ID does not exist.' };
    }

    // Check existing connection
    const connRef = collection(db, 'connections');
    const existingQ = query(
      connRef,
      where('childUid', '==', childUid),
      where('elderUid', '==', elderUid)
    );
    const existingSnap = await getDocs(existingQ);

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data() as FamilyConnection;
      if (existing.status === 'accepted') {
        return { success: false, message: 'You are already connected to this elder.' };
      }
      if (existing.status === 'pending') {
        return { success: false, message: 'Your connection request is waiting for approval.' };
      }
    }

    const isDemoElder = elderUid === DEMO_ELDER.uid;
    const newConnection: Omit<FamilyConnection, 'id'> = {
      connectionId: `CONN-${Date.now()}`,
      elderUid,
      childUid,
      elderName,
      elderId,
      childName,
      childAge,
      // Auto-accept connection for demo elder so user can start testing instantly
      status: isDemoElder ? 'accepted' : 'pending',
      permissions: {
        stories: true,
        memories: true,
        advice: true,
        lessons: true,
        audio: true,
        video: true
      },
      createdAt: new Date().toISOString(),
      ...(isDemoElder ? { approvedAt: new Date().toISOString() } : {})
    };

    await addDoc(collection(db, 'connections'), newConnection);

    await logActivity({
      type: 'connection_requested',
      title: isDemoElder ? 'Connected with Elder' : 'New Connection Request',
      description: isDemoElder
        ? `${childName} connected with ${elderName}.`
        : `${childName} (Age ${childAge}) sent a connection request.`,
      elderUid,
      childUid
    });

    return {
      success: true,
      message: isDemoElder
        ? `Connected to ${elderName}! You can now ask questions and explore stories.`
        : `Connection request sent to ${elderName}!`
    };
  } catch (err: any) {
    console.error('Error connecting to elder:', err);
    return { success: false, message: err?.message || 'Failed to send request' };
  }
}

/**
 * Elder Accepts/Rejects Connection
 */
export async function updateConnectionStatus(connectionDocId: string, status: 'accepted' | 'rejected' | 'revoked') {
  const ref = doc(db, 'connections', connectionDocId);
  await updateDoc(ref, {
    status,
    approvedAt: status === 'accepted' ? new Date().toISOString() : null
  });
}

/**
 * Elder Updates Connection Permissions
 */
export async function updateConnectionPermissions(connectionDocId: string, permissions: FamilyConnection['permissions']) {
  const ref = doc(db, 'connections', connectionDocId);
  await updateDoc(ref, { permissions });
}

/**
 * Add Memory / Story / Advice & Trigger Gemini Processing
 */
export async function addElderMemory(
  elderUid: string,
  title: string,
  content: string,
  category: string,
  tags: string[],
  sourceType: Memory['sourceType'],
  refType: 'MEM' | 'STORY' | 'ADV' | 'AUDIO' | 'VIDEO' = 'MEM',
  mediaOptions?: {
    audioUrl?: string;
    videoUrl?: string;
    transcript?: string;
  }
): Promise<{ memoryId: string; referenceId: string; memory: Memory }> {
  const referenceId = generateReferenceId(refType);
  const memoryId = `M-${Date.now()}`;

  const memoryDoc: Memory = {
    id: memoryId,
    memoryId,
    referenceId,
    elderUid,
    title,
    content,
    category,
    tags,
    sourceType,
    audioUrl: mediaOptions?.audioUrl,
    videoUrl: mediaOptions?.videoUrl,
    transcript: mediaOptions?.transcript || content,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingStatus: 'completed'
  };

  let isFirestoreSaved = false;
  let docRef: any = null;

  if (auth.currentUser) {
    try {
      docRef = await addDoc(collection(db, 'memories'), { ...memoryDoc });
      isFirestoreSaved = true;
    } catch (dbErr) {
      console.warn('Firestore addDoc warning, falling back to local persistence:', dbErr);
    }
  }

  // Trigger Gemini Processing via server endpoint
  let generatedAiContent: AIContent | null = null;
  let generatedChunks: KnowledgeChunk[] = [];

  try {
    const res = await fetch('/api/ai/process-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content: content || title,
        category,
        sourceType
      })
    });

    if (res.ok) {
      const { data } = await res.json();

      const aiContentDoc: AIContent = {
        id: generateAiContentId(),
        aiContentId: generateAiContentId(),
        sourceReferenceIds: [referenceId],
        elderUid,
        title,
        summary: data.summary || '',
        topics: data.topics || [],
        values: data.values || [],
        keyLessons: data.keyLessons || [],
        ageAdaptations: data.ageAdaptations || {},
        followUpQuestions: data.followUpQuestions || [],
        createdAt: new Date().toISOString()
      };
      generatedAiContent = aiContentDoc;

      if (isFirestoreSaved && auth.currentUser) {
        try {
          await addDoc(collection(db, 'aiContent'), aiContentDoc);
        } catch (e) {
          console.warn('Failed to add aiContent to firestore:', e);
        }
      }

      // Store Knowledge Chunks
      if (data.knowledgeChunks && Array.isArray(data.knowledgeChunks)) {
        for (let i = 0; i < data.knowledgeChunks.length; i++) {
          const chunk = data.knowledgeChunks[i];
          const chunkDoc: KnowledgeChunk = {
            id: `KC-${referenceId}-${i + 1}`,
            chunkId: `KC-${referenceId}-${i + 1}`,
            elderUid,
            sourceReferenceId: referenceId,
            content: chunk.content,
            category,
            contentType: sourceType,
            keywords: chunk.keywords || [],
            createdAt: new Date().toISOString()
          };
          generatedChunks.push(chunkDoc);
          if (isFirestoreSaved && auth.currentUser) {
            try {
              await addDoc(collection(db, 'knowledgeChunks'), chunkDoc);
            } catch (e) {}
          }
        }
      } else {
        const fallbackChunk: KnowledgeChunk = {
          id: `KC-${referenceId}-1`,
          chunkId: `KC-${referenceId}-1`,
          elderUid,
          sourceReferenceId: referenceId,
          content,
          category,
          contentType: sourceType,
          keywords: tags,
          createdAt: new Date().toISOString()
        };
        generatedChunks.push(fallbackChunk);
        if (isFirestoreSaved && auth.currentUser) {
          try {
            await addDoc(collection(db, 'knowledgeChunks'), fallbackChunk);
          } catch (e) {}
        }
      }

      if (docRef) {
        await updateDoc(docRef, { processingStatus: 'completed' });
      }
    } else {
      throw new Error(`AI processing returned status ${res.status}`);
    }
  } catch (aiErr: any) {
    console.warn('Gemini memory processing fallback activated:', aiErr);

    // Provide robust local AIContent and KnowledgeChunk fallback
    const fallbackSummary = content.slice(0, 260) + (content.length > 260 ? '...' : '');
    const fallbackAiContent: AIContent = {
      id: generateAiContentId(),
      aiContentId: generateAiContentId(),
      sourceReferenceIds: [referenceId],
      elderUid,
      title,
      summary: fallbackSummary,
      topics: [category, ...tags.slice(0, 3)],
      values: ['Family Wisdom', 'Heritage', 'Resilience'],
      keyLessons: [`Key reflection from ${title || 'this memory'}.`],
      ageAdaptations: {
        age8_12: `A family story about ${category.toLowerCase()}: "${fallbackSummary}"`,
        age13_17: `A real-life lesson on ${category.toLowerCase()}: "${fallbackSummary}"`,
        age18_plus: `Lived perspective on ${category.toLowerCase()}: "${fallbackSummary}"`
      },
      followUpQuestions: [
        'What was the most important takeaway from that experience?',
        'How did that moment shape your choices later on?'
      ],
      createdAt: new Date().toISOString()
    };
    generatedAiContent = fallbackAiContent;

    if (generatedChunks.length === 0) {
      const fallbackChunk: KnowledgeChunk = {
        id: `KC-${referenceId}-1`,
        chunkId: `KC-${referenceId}-1`,
        elderUid,
        sourceReferenceId: referenceId,
        content,
        category,
        contentType: sourceType,
        keywords: tags.length > 0 ? tags : [category],
        createdAt: new Date().toISOString()
      };
      generatedChunks.push(fallbackChunk);
    }
  }

  // Always save in local custom storage so it persists for demo and instant UI responsiveness
  saveLocalCustomMemory(memoryDoc, generatedAiContent || undefined, generatedChunks);

  if (auth.currentUser) {
    await logActivity({
      type: 'story_added',
      title: 'New Memory Recorded',
      description: `Added "${title}" (${sourceType.toUpperCase()} - Reference: ${referenceId})`,
      elderUid,
      referenceId
    });
  }

  return { memoryId, referenceId, memory: memoryDoc };
}

/**
 * Log Family Activity Event
 */
export async function logActivity(event: Omit<ActivityEvent, 'id' | 'createdAt'>) {
  try {
    await addDoc(collection(db, 'activity'), {
      ...event,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to log activity', e);
  }
}

/**
 * RAG Knowledge Retrieval for a Specific Elder
 * Matches question keywords against elder's knowledge chunks and memories
 * CRITICAL: Strictly scopes query by elderUid to prevent cross-elder leak
 */
export async function retrieveElderKnowledge(
  elderUid: string,
  questionText: string,
  maxResults = 5
): Promise<Array<{ sourceReferenceId: string; title: string; category: string; content: string }>> {
  try {
    // 1. Fetch chunks belonging ONLY to this elder
    const chunksRef = collection(db, 'knowledgeChunks');
    const qChunks = query(chunksRef, where('elderUid', '==', elderUid));
    const chunkSnap = await getDocs(qChunks);

    // 2. Fetch original memories belonging ONLY to this elder
    const memRef = collection(db, 'memories');
    const qMem = query(memRef, where('elderUid', '==', elderUid));
    const memSnap = await getDocs(qMem);

    const memoriesMap = new Map<string, Memory>();
    memSnap.docs.forEach(d => {
      const m = { id: d.id, ...(d.data() as Omit<Memory, 'id'>) };
      memoriesMap.set(m.referenceId, m);
    });

    const words = questionText
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    const scored: Array<{
      sourceReferenceId: string;
      title: string;
      category: string;
      content: string;
      score: number;
    }> = [];

    // Score knowledge chunks
    chunkSnap.docs.forEach(docSnap => {
      const chunk = docSnap.data() as KnowledgeChunk;
      const mem = memoriesMap.get(chunk.sourceReferenceId);
      const textToSearch = `${chunk.content} ${(chunk.keywords || []).join(' ')} ${chunk.category} ${mem?.title || ''}`.toLowerCase();

      let score = 0;
      for (const w of words) {
        if (textToSearch.includes(w)) score += 2;
      }

      if (score > 0 || words.length === 0) {
        scored.push({
          sourceReferenceId: chunk.sourceReferenceId,
          title: mem?.title || `Recorded Entry ${chunk.sourceReferenceId}`,
          category: chunk.category || 'Wisdom',
          content: chunk.content,
          score
        });
      }
    });

    // If chunks didn't yield enough, check entire memory bodies
    if (scored.length === 0 && memSnap.docs.length > 0) {
      memSnap.docs.forEach(docSnap => {
        const mem = docSnap.data() as Memory;
        const textToSearch = `${mem.title} ${mem.content} ${mem.category} ${(mem.tags || []).join(' ')}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (textToSearch.includes(w)) score += 1;
        }
        if (score > 0) {
          scored.push({
            sourceReferenceId: mem.referenceId,
            title: mem.title,
            category: mem.category,
            content: mem.content,
            score
          });
        }
      });
    }

    // If querying Demo Elder Robert and nothing found from Firestore, query built-in demo knowledge chunks
    if (scored.length === 0 && elderUid === DEMO_ELDER.uid) {
      DEMO_KNOWLEDGE_CHUNKS.forEach(chunk => {
        const textToSearch = `${chunk.content} ${(chunk.keywords || []).join(' ')} ${chunk.category}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (textToSearch.includes(w)) score += 2;
        }
        if (score > 0 || words.length === 0) {
          const matchingMem = DEMO_MEMORIES.find(m => m.referenceId === chunk.sourceReferenceId);
          scored.push({
            sourceReferenceId: chunk.sourceReferenceId,
            title: matchingMem?.title || `Recorded Entry ${chunk.sourceReferenceId}`,
            category: chunk.category,
            content: chunk.content,
            score: score || 1
          });
        }
      });
    }

    // Also include custom local knowledge chunks and memories
    const localChunks = getLocalCustomKnowledgeChunks(elderUid);
    const localMems = getLocalCustomMemories(elderUid);
    const localMemMap = new Map(localMems.map(m => [m.referenceId, m]));

    localChunks.forEach(chunk => {
      const mem = localMemMap.get(chunk.sourceReferenceId);
      const textToSearch = `${chunk.content} ${(chunk.keywords || []).join(' ')} ${chunk.category} ${mem?.title || ''}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (textToSearch.includes(w)) score += 2;
      }
      if (score > 0 || words.length === 0) {
        scored.push({
          sourceReferenceId: chunk.sourceReferenceId,
          title: mem?.title || `Recorded Entry ${chunk.sourceReferenceId}`,
          category: chunk.category || 'Wisdom',
          content: chunk.content,
          score: score || 1
        });
      }
    });

    localMems.forEach(mem => {
      if (!scored.some(s => s.sourceReferenceId === mem.referenceId)) {
        const textToSearch = `${mem.title} ${mem.content} ${mem.category} ${(mem.tags || []).join(' ')}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (textToSearch.includes(w)) score += 1;
        }
        if (score > 0) {
          scored.push({
            sourceReferenceId: mem.referenceId,
            title: mem.title,
            category: mem.category,
            content: mem.content,
            score
          });
        }
      }
    });

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);

    // If still empty but elder has records, provide top recent records for broad questions
    if (scored.length === 0 && memSnap.docs.length > 0) {
      return memSnap.docs.slice(0, 2).map(d => {
        const m = d.data() as Memory;
        return {
          sourceReferenceId: m.referenceId,
          title: m.title,
          category: m.category,
          content: m.content
        };
      });
    }

    // Fallback for Demo Elder if no words matched
    if (scored.length === 0 && (elderUid === DEMO_ELDER.uid || localMems.length > 0)) {
      const combined = [...localMems, ...DEMO_MEMORIES];
      return combined.slice(0, 2).map(m => ({
        sourceReferenceId: m.referenceId,
        title: m.title,
        category: m.category,
        content: m.content
      }));
    }

    return scored.slice(0, maxResults);
  } catch (err) {
    console.error('Error retrieving knowledge:', err);
    return [];
  }
}
