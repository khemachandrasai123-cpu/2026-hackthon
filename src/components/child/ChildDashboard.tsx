import React, { useState, useEffect } from 'react';
import {
  ChildProfile,
  FamilyConnection,
  Memory,
  AIContent,
  SourceReference
} from '../../types';
import {
  requestElderConnection,
  retrieveElderKnowledge,
  logActivity
} from '../../services/familyService';
import { db, auth } from '../../firebase/config';
import { DEMO_ELDER, DEMO_CHILD, DEMO_MEMORIES, DEMO_AI_CONTENTS, DEMO_CONNECTION, getLocalCustomMemories, getLocalCustomAiContents } from '../../services/demoData';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc
} from 'firebase/firestore';
import {
  ReferenceBadge,
  AIContentBadge,
  OriginalContentBadge
} from '../common/Badges';
import { AudioVoicePlayer } from '../common/AudioVoicePlayer';
import { VideoPlayerCard } from '../common/VideoPlayerCard';
import {
  Compass,
  MessageSquare,
  BookOpen,
  Users,
  Search,
  Bookmark,
  BookmarkCheck,
  LogOut,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Sparkles,
  Send
} from 'lucide-react';

interface ChildDashboardProps {
  childProfile: ChildProfile;
  onLogout: () => void;
}

export const ChildDashboard: React.FC<ChildDashboardProps> = ({ childProfile, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'ask' | 'stories' | 'elders'>('ask');
  const [connections, setConnections] = useState<FamilyConnection[]>([]);
  const [selectedElder, setSelectedElder] = useState<FamilyConnection | null>(null);

  // Elder ID Connect input
  const [elderIdInput, setElderIdInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Memory & Wisdom state
  const [elderMemories, setElderMemories] = useState<Memory[]>([]);
  const [elderAiContent, setElderAiContent] = useState<AIContent[]>([]);
  const [savedReferenceIds, setSavedReferenceIds] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);

  // Ask My Elder state
  const [question, setQuestion] = useState('');
  const [answering, setAnswering] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<{
    answer: string;
    confidence: 'grounded' | 'insufficient';
    references: SourceReference[];
    elderQuoteIfDirect?: string;
    insufficientSource?: boolean;
    elderName?: string;
  } | null>(null);

  // Stories filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Listen for Connections for this child
  useEffect(() => {
    if (!childProfile.uid) return;

    if (childProfile.uid === DEMO_CHILD.uid && !auth.currentUser) {
      setConnections([DEMO_CONNECTION]);
      setSelectedElder(DEMO_CONNECTION);
      return;
    }

    const connQuery = query(collection(db, 'connections'), where('childUid', '==', childProfile.uid));
    const unsub = onSnapshot(connQuery, snap => {
      const list: FamilyConnection[] = [];
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as Omit<FamilyConnection, 'id'>) }));
      if (list.length === 0 && childProfile.uid === DEMO_CHILD.uid) {
        list.push(DEMO_CONNECTION);
      }
      setConnections(list);

      const accepted = list.filter(c => c.status === 'accepted');
      if (accepted.length > 0 && !selectedElder) {
        setSelectedElder(accepted[0]);
      }
    }, err => {
      console.warn('Connections snapshot warning:', err);
      if (childProfile.uid === DEMO_CHILD.uid) {
        setConnections([DEMO_CONNECTION]);
        setSelectedElder(DEMO_CONNECTION);
      }
    });

    const savedQuery = query(collection(db, 'savedContent'), where('childUid', '==', childProfile.uid));
    const unsubSaved = onSnapshot(savedQuery, snap => {
      const ids: string[] = [];
      snap.forEach(d => ids.push(d.data().referenceId));
      setSavedReferenceIds(ids);
    }, err => {
      console.warn('Saved content listener warning:', err);
    });

    return () => {
      unsub();
      unsubSaved();
    };
  }, [childProfile.uid]);

  // 2. Fetch Memories strictly belonging to the currently selected Elder
  useEffect(() => {
    if (!selectedElder || selectedElder.status !== 'accepted') {
      setElderMemories([]);
      setElderAiContent([]);
      return;
    }

    const localCustomMems = getLocalCustomMemories(selectedElder.elderUid);
    const localCustomAi = getLocalCustomAiContents(selectedElder.elderUid);

    if (selectedElder.elderUid === DEMO_ELDER.uid && !auth.currentUser) {
      const demoDefaults: Memory[] = DEMO_MEMORIES.map(m => ({ id: m.memoryId, ...m }));
      const allMems = [...localCustomMems, ...demoDefaults.filter(d => !localCustomMems.some(l => l.memoryId === d.memoryId))];
      setElderMemories(allMems);

      const demoAiDefaults: AIContent[] = DEMO_AI_CONTENTS.map(a => ({ id: a.aiContentId, ...a }));
      const allAi = [...localCustomAi, ...demoAiDefaults.filter(d => !localCustomAi.some(l => l.aiContentId === d.aiContentId))];
      setElderAiContent(allAi);
      return;
    }

    const memQuery = query(collection(db, 'memories'), where('elderUid', '==', selectedElder.elderUid));
    const unsubMem = onSnapshot(memQuery, snap => {
      const list: Memory[] = [];
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as Omit<Memory, 'id'>) }));
      const merged = [...list];
      localCustomMems.forEach(lm => {
        if (!merged.some(m => m.referenceId === lm.referenceId || m.memoryId === lm.memoryId)) {
          merged.unshift(lm);
        }
      });
      if (merged.length === 0 && selectedElder.elderUid === DEMO_ELDER.uid) {
        setElderMemories(DEMO_MEMORIES.map(m => ({ id: m.memoryId, ...m })));
      } else {
        setElderMemories(merged);
      }
    }, err => {
      console.warn('Memories snapshot warning:', err);
      const demoDefaults: Memory[] = DEMO_MEMORIES.map(m => ({ id: m.memoryId, ...m }));
      setElderMemories([...localCustomMems, ...demoDefaults.filter(d => !localCustomMems.some(l => l.memoryId === d.memoryId))]);
    });

    const aiQuery = query(collection(db, 'aiContent'), where('elderUid', '==', selectedElder.elderUid));
    const unsubAi = onSnapshot(aiQuery, snap => {
      const list: AIContent[] = [];
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as Omit<AIContent, 'id'>) }));
      if (list.length === 0 && selectedElder.elderUid === DEMO_ELDER.uid) {
        setElderAiContent(DEMO_AI_CONTENTS.map(a => ({ id: a.aiContentId, ...a })));
      } else {
        setElderAiContent(list);
      }
    }, err => {
      console.warn('AI Content snapshot warning:', err);
      if (selectedElder.elderUid === DEMO_ELDER.uid) {
        setElderAiContent(DEMO_AI_CONTENTS.map(a => ({ id: a.aiContentId, ...a })));
      }
    });

    return () => {
      unsubMem();
      unsubAi();
    };
  }, [selectedElder]);

  const handleConnectElder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elderIdInput.trim()) return;

    setConnecting(true);
    setConnectMessage(null);

    if (elderIdInput.trim().toUpperCase() === DEMO_ELDER.elderId && !auth.currentUser) {
      setConnections(prev => {
        if (prev.some(c => c.elderUid === DEMO_ELDER.uid)) return prev;
        return [DEMO_CONNECTION, ...prev];
      });
      setSelectedElder(DEMO_CONNECTION);
      setConnectMessage({ text: 'Connected to Grandfather Robert! You can now explore his wisdom.', isError: false });
      setElderIdInput('');
      setConnecting(false);
      return;
    }

    const res = await requestElderConnection(
      childProfile.uid,
      childProfile.name,
      childProfile.age,
      elderIdInput
    );

    setConnectMessage({ text: res.message, isError: !res.success });
    if (res.success) setElderIdInput('');
    setConnecting(false);
  };

  const handleAskElder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedElder) return;

    setAnswering(true);
    setCurrentAnswer(null);

    try {
      const retrieved = await retrieveElderKnowledge(selectedElder.elderUid, question, 4);

      const res = await fetch('/api/ai/ask-elder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          elderName: selectedElder.elderName,
          elderId: selectedElder.elderId,
          childProfile,
          retrievedChunks: retrieved
        })
      });

      if (!res.ok) throw new Error('Failed to obtain AI answer');
      const data = await res.json();

      const answerData = {
        answer: data.answer,
        confidence: data.confidence,
        references: data.references || [],
        elderQuoteIfDirect: data.elderQuoteIfDirect,
        insufficientSource: data.insufficientSource,
        elderName: selectedElder.elderName
      };

      setCurrentAnswer(answerData);

      if (auth.currentUser) {
        await addDoc(collection(db, 'questions'), {
          questionId: `Q-${Date.now()}`,
          childUid: childProfile.uid,
          elderUid: selectedElder.elderUid,
          question,
          answer: data.answer,
          confidence: data.confidence,
          references: data.references || [],
          insufficientSource: data.insufficientSource || false,
          generated: true,
          createdAt: new Date().toISOString()
        });

        await logActivity({
          type: 'question_asked',
          title: 'Child Asked Question',
          description: `${childProfile.name} asked: "${question}"`,
          childUid: childProfile.uid,
          elderUid: selectedElder.elderUid
        });
      }
    } catch (err: any) {
      console.error(err);
      setCurrentAnswer({
        answer: 'I could not find memories related to this question. Try asking about work, life lessons, or family.',
        confidence: 'insufficient',
        references: [],
        insufficientSource: true
      });
    } finally {
      setAnswering(false);
    }
  };

  const toggleSaveReference = async (refId: string) => {
    const isSaved = savedReferenceIds.includes(refId);
    if (isSaved) {
      setSavedReferenceIds(s => s.filter(id => id !== refId));
    } else {
      setSavedReferenceIds(s => [...s, refId]);
      if (auth.currentUser) {
        await addDoc(collection(db, 'savedContent'), {
          childUid: childProfile.uid,
          referenceId: refId,
          createdAt: new Date().toISOString()
        });
      }
    }
  };

  const acceptedElders = connections.filter(c => c.status === 'accepted');

  // Filtered stories in library
  const filteredMemories = elderMemories.filter(m => {
    const matchesCategory = selectedCategory === 'all' || m.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch = searchQuery === '' || m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSaved = !onlySaved || savedReferenceIds.includes(m.referenceId);
    return matchesCategory && matchesSearch && matchesSaved;
  });

  // Daily Wisdom selection
  const todayWisdom = elderMemories.length > 0 ? elderMemories[0] : null;
  const todayAi = todayWisdom ? elderAiContent.find(a => a.sourceReferenceIds?.includes(todayWisdom.referenceId)) : null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-16">
      {/* Clean Navbar */}
      <header className="bg-white border-b border-stone-200/80 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-stone-900">{childProfile.name}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-medium">
                  Age {childProfile.age}
                </span>
              </div>
              {selectedElder && (
                <span className="text-xs text-stone-500 block">
                  Listening to <strong className="text-stone-700">{selectedElder.elderName}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-child-logout"
              onClick={onLogout}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3 Simple Tabs */}
        <div className="max-w-4xl mx-auto px-6 flex border-t border-stone-100 gap-6 text-sm font-semibold">
          <button
            id="tab-child-ask"
            onClick={() => setActiveTab('ask')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'ask'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Ask {selectedElder?.elderName ? selectedElder.elderName.split(' ')[0] : 'Elder'}</span>
          </button>

          <button
            id="tab-child-stories"
            onClick={() => setActiveTab('stories')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'stories'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Stories & Wisdom ({elderMemories.length})</span>
          </button>

          <button
            id="tab-child-elders"
            onClick={() => setActiveTab('elders')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'elders'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>My Elders ({acceptedElders.length})</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* If no elders connected, prompt to connect immediately */}
        {acceptedElders.length === 0 && (
          <div className="mb-6 p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center max-w-lg mx-auto">
            <Users className="w-10 h-10 text-amber-800 mx-auto mb-2" />
            <h3 className="text-lg font-serif font-bold text-stone-900 mb-1">
              Connect With Your Family Elder
            </h3>
            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Enter your elder's ID (e.g. <span className="font-mono font-bold">ELD-DEMO01</span>) to read their stories and ask questions.
            </p>

            <form onSubmit={handleConnectElder} className="flex gap-2 max-w-sm mx-auto">
              <input
                id="input-child-connect-elder-hero"
                type="text"
                placeholder="Enter Elder ID"
                value={elderIdInput}
                onChange={e => setElderIdInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-stone-300 font-mono text-xs uppercase bg-white focus:outline-none focus:ring-2 focus:ring-amber-800"
              />
              <button
                type="submit"
                disabled={connecting}
                className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs shadow-xs"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 1: ASK ELDER */}
        {activeTab === 'ask' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-stone-900">
                    Ask {selectedElder ? selectedElder.elderName : 'Your Elder'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Grounded in their real life memories. Nothing is invented.
                  </p>
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleAskElder} className="space-y-3">
                <textarea
                  id="input-child-question"
                  rows={3}
                  required
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder={`What would ${selectedElder?.elderName ? selectedElder.elderName.split(' ')[0] : 'Grandpa'} say about handling failure or choosing a career?`}
                  className="w-full p-3.5 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-amber-800 focus:outline-none bg-stone-50/50"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-stone-400">Try:</span>
                    <button
                      type="button"
                      onClick={() => setQuestion("What would Grandpa say about handling failure or mistakes?")}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors"
                    >
                      Handling failure
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestion("What advice does Grandpa have about choosing a career?")}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors"
                    >
                      Choosing a career
                    </button>
                  </div>

                  <button
                    id="btn-ask-elder-submit"
                    type="submit"
                    disabled={answering || !selectedElder}
                    className={`px-5 py-2 rounded-xl font-semibold text-xs text-white shadow-xs flex items-center gap-2 transition-all ${
                      answering ? 'bg-stone-700 opacity-80 cursor-not-allowed' : 'bg-amber-800 hover:bg-amber-900'
                    }`}
                  >
                    {answering ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching wisdom...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Ask Question</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Answer Display */}
            {currentAnswer && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <span className="text-xs font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Adapted from {selectedElder?.elderName}'s wisdom
                  </span>
                  <AudioVoicePlayer text={currentAnswer.answer} label="Listen" />
                </div>

                {/* Direct Elder Quote */}
                {currentAnswer.elderQuoteIfDirect && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 font-serif italic text-sm">
                    "{currentAnswer.elderQuoteIfDirect}"
                    <span className="block not-italic text-[11px] font-sans text-amber-800 font-semibold mt-1">
                      — Direct words from {selectedElder?.elderName}
                    </span>
                  </div>
                )}

                {/* Main Grounded Answer */}
                <div className="text-stone-800 text-sm leading-relaxed whitespace-pre-line">
                  {currentAnswer.answer}
                </div>

                {/* Source References */}
                {currentAnswer.references.length > 0 && (
                  <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-stone-400">Based on:</span>
                    {currentAnswer.references.map((ref, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium"
                      >
                        <ReferenceBadge referenceId={ref.referenceId} />
                        <span className="truncate max-w-[140px]">{ref.title}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STORIES & WISDOM */}
        {activeTab === 'stories' && (
          <div className="space-y-6">
            {/* Daily Story Spotlight (Compact & Beautiful) */}
            {todayWisdom && selectedElder && (
              <div className="bg-amber-900 text-white rounded-2xl p-6 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Today's Story Spotlight
                  </span>
                  <ReferenceBadge referenceId={todayWisdom.referenceId} />
                </div>

                <h3 className="text-xl font-serif font-bold text-white mb-2">
                  {todayWisdom.title}
                </h3>
                <p className="text-xs text-amber-100/90 leading-relaxed mb-4 line-clamp-3">
                  {todayAi?.ageAdaptations?.age13_17 || todayAi?.summary || todayWisdom.content}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-amber-800/80">
                  <button
                    onClick={() => {
                      setQuestion(`What advice do you have related to "${todayWisdom.title}"?`);
                      setActiveTab('ask');
                    }}
                    className="text-xs font-semibold text-amber-200 hover:text-white flex items-center gap-1"
                  >
                    <span>Ask about this story</span>
                  </button>
                  <AudioVoicePlayer
                    text={todayAi?.ageAdaptations?.age13_17 || todayWisdom.content}
                    label="Listen to Story"
                  />
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search stories..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="py-1 px-2.5 rounded-lg border border-stone-200 bg-stone-50 text-xs font-medium text-stone-700 focus:outline-none"
                >
                  <option value="all">All Topics</option>
                  <option value="Career">Career & Work</option>
                  <option value="Lessons">Life Lessons</option>
                  <option value="Family">Family & Relationships</option>
                  <option value="Money">Money & Finance</option>
                </select>

                <button
                  onClick={() => setOnlySaved(!onlySaved)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                    onlySaved
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-stone-50 text-stone-600 border-stone-200'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Saved ({savedReferenceIds.length})</span>
                </button>
              </div>
            </div>

            {/* Stories Grid */}
            {filteredMemories.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center text-xs text-stone-500">
                No stories found matching your filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredMemories.map(mem => (
                  <div
                    key={mem.id}
                    className="p-5 bg-white rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <ReferenceBadge referenceId={mem.referenceId} />
                          <OriginalContentBadge sourceType={mem.sourceType} />
                        </div>
                        <button
                          onClick={() => toggleSaveReference(mem.referenceId)}
                          className="text-stone-400 hover:text-amber-800"
                        >
                          {savedReferenceIds.includes(mem.referenceId) ? (
                            <BookmarkCheck className="w-4 h-4 text-amber-700 fill-amber-700" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <h4 className="font-serif font-bold text-base text-stone-900 mb-1.5">
                        {mem.title}
                      </h4>

                      {mem.videoUrl && (
                        <div className="my-2.5">
                          <VideoPlayerCard videoUrl={mem.videoUrl} referenceId={mem.referenceId} title={mem.title} />
                        </div>
                      )}

                      <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed mb-3">
                        {mem.content}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                      <span className="bg-stone-100 px-2 py-0.5 rounded text-[11px] text-stone-700">
                        {mem.category}
                      </span>
                      <AudioVoicePlayer
                        text={mem.content}
                        audioUrl={mem.audioUrl}
                        referenceId={mem.referenceId}
                        label={mem.audioUrl ? 'Listen to Voice' : 'Listen'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY ELDERS */}
        {activeTab === 'elders' && (
          <div className="space-y-6 max-w-lg mx-auto">
            {/* Connect Form */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
              <h3 className="font-serif font-bold text-base text-stone-900 mb-1">
                Connect With An Elder
              </h3>
              <p className="text-xs text-stone-500 mb-3">
                Enter your family elder's unique Elder ID.
              </p>

              <form onSubmit={handleConnectElder} className="flex gap-2">
                <input
                  id="input-child-connect-elder"
                  type="text"
                  placeholder="e.g. ELD-DEMO01"
                  value={elderIdInput}
                  onChange={e => setElderIdInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300 font-mono text-xs uppercase focus:ring-2 focus:ring-amber-800 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs shadow-xs"
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              </form>

              {connectMessage && (
                <p className={`text-xs font-semibold mt-2.5 ${connectMessage.isError ? 'text-red-700' : 'text-emerald-700'}`}>
                  {connectMessage.text}
                </p>
              )}
            </div>

            {/* Elders List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Connected Elders ({acceptedElders.length})
              </h3>

              {acceptedElders.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border border-stone-200 text-center text-xs text-stone-500">
                  No elders connected yet. Enter an ID above.
                </div>
              ) : (
                acceptedElders.map(el => (
                  <div
                    key={el.id}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between bg-white ${
                      selectedElder?.id === el.id ? 'border-amber-700 ring-2 ring-amber-100 shadow-2xs' : 'border-stone-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900">{el.elderName}</span>
                        <span className="font-mono text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                          {el.elderId}
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-medium">Active Connection</span>
                    </div>

                    <button
                      onClick={() => setSelectedElder(el)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selectedElder?.id === el.id
                          ? 'bg-amber-800 text-white'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                      }`}
                    >
                      {selectedElder?.id === el.id ? 'Selected' : 'Select'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
