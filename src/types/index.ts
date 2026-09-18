export type UserRole = 'elder' | 'child';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface ElderProfile {
  uid: string;
  elderId: string; // e.g. "ELD-8F29KX"
  name: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type LearningStyle = 'Storytelling' | 'Visual' | 'Practical' | 'Analytical' | 'Conversational';
export type CommunicationStyle = 'Simple' | 'Friendly' | 'Detailed' | 'Motivational' | 'Story-based';

export interface ChildProfile {
  uid: string;
  name: string;
  age: number;
  interests?: string[];
  learningStyle: LearningStyle;
  communicationStyle: CommunicationStyle;
  goals?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'revoked';

export interface ConnectionPermissions {
  stories: boolean;
  memories: boolean;
  advice: boolean;
  lessons: boolean;
  audio: boolean;
  video: boolean;
}

export interface FamilyConnection {
  id: string;
  connectionId: string;
  elderUid: string;
  childUid: string;
  elderName?: string;
  elderId?: string;
  childName?: string;
  childAge?: number;
  status: ConnectionStatus;
  permissions: ConnectionPermissions;
  createdAt: string;
  approvedAt?: string;
}

export type MemorySourceType = 'text' | 'audio' | 'video';

export interface Memory {
  id: string;
  memoryId: string;
  referenceId: string; // e.g. "MEM-000127", "STORY-000245", "ADV-000083"
  elderUid: string;
  title: string;
  content: string; // original text or transcript
  category: string;
  tags: string[];
  sourceType: MemorySourceType;
  audioUrl?: string;
  videoUrl?: string;
  transcript?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
}

export interface KnowledgeChunk {
  id: string;
  chunkId: string;
  elderUid: string;
  sourceReferenceId: string;
  content: string;
  category: string;
  contentType: string;
  ageRelevance?: string[];
  keywords: string[];
  createdAt: string;
}

export interface AIContent {
  id: string;
  aiContentId: string; // e.g. "AI-000812"
  sourceReferenceIds: string[];
  elderUid: string;
  title: string;
  summary: string;
  topics: string[];
  values: string[];
  keyLessons: string[];
  ageAdaptations?: {
    age8_12?: string;
    age13_17?: string;
    age18_plus?: string;
  };
  followUpQuestions?: string[];
  createdAt: string;
}

export interface SourceReference {
  referenceId: string;
  title: string;
  category?: string;
  excerpt?: string;
}

export interface QuestionAnswer {
  id: string;
  questionId: string;
  childUid: string;
  elderUid: string;
  question: string;
  answer: string;
  confidence: 'grounded' | 'insufficient';
  references: SourceReference[];
  insufficientSource?: boolean;
  generated: boolean;
  createdAt: string;
}

export interface WisdomModule {
  id: string;
  title: string;
  category: string;
  introduction: string;
  elderStoryExcerpt: string;
  keyLesson: string;
  practicalActivity: string;
  reflectionQuestion: string;
  sourceReferences: SourceReference[];
}

export interface ActivityEvent {
  id: string;
  type: 'story_added' | 'memory_processed' | 'connection_requested' | 'connection_accepted' | 'question_asked' | 'content_saved';
  title: string;
  description: string;
  elderUid?: string;
  childUid?: string;
  referenceId?: string;
  createdAt: string;
}
