import React, { useState, useEffect, useRef } from 'react';
import {
  ElderProfile,
  Memory,
  FamilyConnection,
  AIContent
} from '../../types';
import {
  addElderMemory,
  updateConnectionStatus
} from '../../services/familyService';
import { db, auth } from '../../firebase/config';
import {
  DEMO_ELDER,
  DEMO_MEMORIES,
  DEMO_AI_CONTENTS,
  DEMO_CONNECTION,
  getLocalCustomMemories,
  getLocalCustomAiContents
} from '../../services/demoData';
import { saveMediaBlob } from '../../services/mediaStorage';
import {
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import {
  ReferenceBadge,
  OriginalContentBadge
} from '../common/Badges';
import { GuidedInterviewModal } from './GuidedInterviewModal';
import { AudioVoicePlayer } from '../common/AudioVoicePlayer';
import { AudioVisualizer } from '../common/AudioVisualizer';
import { VideoPlayerCard } from '../common/VideoPlayerCard';
import { ConfettiVFX } from '../common/ConfettiVFX';
import {
  BookOpen,
  Mic,
  MicOff,
  FileText,
  Video,
  VideoOff,
  Camera,
  Users,
  Sparkles,
  CheckCircle2,
  LogOut,
  Loader2,
  Plus,
  RotateCcw,
  Play,
  Square,
  Film
} from 'lucide-react';

interface ElderDashboardProps {
  elderProfile: ElderProfile;
  onLogout: () => void;
}

export const ElderDashboard: React.FC<ElderDashboardProps> = ({ elderProfile, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'stories' | 'record' | 'family'>('stories');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [aiContents, setAiContents] = useState<AIContent[]>([]);
  const [connections, setConnections] = useState<FamilyConnection[]>([]);
  const [copiedElderId, setCopiedElderId] = useState(false);

  // New Memory Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Life Lessons');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [sourceType, setSourceType] = useState<Memory['sourceType']>('text');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // VFX State
  const [showConfetti, setShowConfetti] = useState(false);

  // Audio Recording State
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordedAudioTime, setRecordedAudioTime] = useState(0);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudioPreview, setIsPlayingAudioPreview] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Video Recording State
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [recordedVideoTime, setRecordedVideoTime] = useState(0);
  const [videoRecorder, setVideoRecorder] = useState<MediaRecorder | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoLiveRef = useRef<HTMLVideoElement | null>(null);

  // Speech Recognition state
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isSpeechListening, setIsSpeechListening] = useState(false);
  const speechRecognitionRef = useRef<any>(null);

  // Guided Interview State
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);

  // Check speech recognition support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSpeechSupported(true);
      }
    }
  }, []);

  // Realtime Listeners for Elder's Data + Local Storage Memories
  useEffect(() => {
    if (!elderProfile.uid) return;

    const loadCombinedLocalMemories = () => {
      const localCustomMems = getLocalCustomMemories(elderProfile.uid);
      const localCustomAi = getLocalCustomAiContents(elderProfile.uid);
      if (elderProfile.uid === DEMO_ELDER.uid && !auth.currentUser) {
        const demoDefaults: Memory[] = DEMO_MEMORIES.map(m => ({ id: m.memoryId, ...m }));
        const allMems = [...localCustomMems, ...demoDefaults.filter(d => !localCustomMems.some(l => l.memoryId === d.memoryId))];
        setMemories(allMems);

        const demoAiDefaults: AIContent[] = DEMO_AI_CONTENTS.map(a => ({ id: a.aiContentId, ...a }));
        const allAi = [...localCustomAi, ...demoAiDefaults.filter(d => !localCustomAi.some(l => l.aiContentId === d.aiContentId))];
        setAiContents(allAi);
        setConnections([DEMO_CONNECTION]);
        return true;
      }
      return false;
    };

    if (loadCombinedLocalMemories()) {
      return;
    }

    const memQuery = query(collection(db, 'memories'), where('elderUid', '==', elderProfile.uid));
    const unsubMem = onSnapshot(memQuery, snap => {
      const list: Memory[] = [];
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as Omit<Memory, 'id'>) }));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Merge with any local custom memories
      const localCustomMems = getLocalCustomMemories(elderProfile.uid);
      const merged = [...list];
      localCustomMems.forEach(lm => {
        if (!merged.some(m => m.referenceId === lm.referenceId || m.memoryId === lm.memoryId)) {
          merged.unshift(lm);
        }
      });
      setMemories(merged);
    }, err => {
      console.warn('Elder memories listener warning:', err);
      loadCombinedLocalMemories();
    });

    const aiQuery = query(collection(db, 'aiContent'), where('elderUid', '==', elderProfile.uid));
    const unsubAi = onSnapshot(aiQuery, snap => {
      const list: AIContent[] = [];
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as Omit<AIContent, 'id'>) }));
      setAiContents(list);
    }, err => {
      console.warn('Elder AI content listener warning:', err);
    });

    const connQuery = query(collection(db, 'connections'), where('elderUid', '==', elderProfile.uid));
    const unsubConn = onSnapshot(connQuery, snap => {
      const list: FamilyConnection[] = [];
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as Omit<FamilyConnection, 'id'>) }));
      setConnections(list);
    }, err => {
      console.warn('Elder connections listener warning:', err);
    });

    return () => {
      unsubMem();
      unsubAi();
      unsubConn();
    };
  }, [elderProfile.uid]);

  // Handle Speech Recognition helper
  const startSpeechRecognition = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        if (fullTranscript.trim()) {
          setContent(prev => {
            // If previous content was empty or very short, update directly
            if (!prev.trim()) return fullTranscript.trim();
            return fullTranscript.trim();
          });
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition warning:', e);
      };

      recognition.onend = () => {
        setIsSpeechListening(false);
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
      setIsSpeechListening(true);
    } catch (err) {
      console.warn('Could not start speech recognition:', err);
    }
  };

  const stopSpeechRecognition = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    setIsSpeechListening(false);
  };

  // Audio Recording Handlers
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      const chunks: BlobPart[] = [];
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : undefined;

      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        const tempMediaId = `AUD-${Date.now()}`;
        const savedUrl = await saveMediaBlob(tempMediaId, blob, 'audio/webm');
        setAudioUrl(savedUrl);
        stream.getTracks().forEach(t => t.stop());
        setAudioStream(null);
      };

      recorder.start(500);
      setAudioRecorder(recorder);
      setIsAudioRecording(true);
      setRecordedAudioTime(0);

      // Start live speech-to-text simultaneously
      startSpeechRecognition();
    } catch (err) {
      console.error('Audio capture error:', err);
      alert('Microphone access is required to record your voice. Please allow microphone permission.');
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorder && isAudioRecording) {
      audioRecorder.stop();
      setIsAudioRecording(false);
      stopSpeechRecognition();
    }
  };

  // Video Recording Handlers
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      });
      setVideoStream(stream);

      if (videoLiveRef.current) {
        videoLiveRef.current.srcObject = stream;
        videoLiveRef.current.play().catch(() => {});
      }

      const chunks: BlobPart[] = [];
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        setVideoBlob(blob);
        const tempMediaId = `VID-${Date.now()}`;
        const savedUrl = await saveMediaBlob(tempMediaId, blob, mimeType);
        setVideoUrl(savedUrl);

        stream.getTracks().forEach(t => t.stop());
        setVideoStream(null);
      };

      recorder.start(500);
      setVideoRecorder(recorder);
      setIsVideoRecording(true);
      setRecordedVideoTime(0);

      // Start speech recognition during video as well
      startSpeechRecognition();
    } catch (err) {
      console.error('Video capture error:', err);
      alert('Camera and microphone access are required to record video. Please allow permissions.');
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorder && isVideoRecording) {
      videoRecorder.stop();
      setIsVideoRecording(false);
      stopSpeechRecognition();
    }
  };

  // Recording Timers
  useEffect(() => {
    let interval: any;
    if (isAudioRecording) {
      interval = setInterval(() => setRecordedAudioTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isAudioRecording]);

  useEffect(() => {
    let interval: any;
    if (isVideoRecording) {
      interval = setInterval(() => setRecordedVideoTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isVideoRecording]);

  // Connect live video stream to viewfinder element when stream updates
  useEffect(() => {
    if (videoStream && videoLiveRef.current) {
      videoLiveRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Cleanup media tracks on unmount
  useEffect(() => {
    return () => {
      if (audioStream) audioStream.getTracks().forEach(t => t.stop());
      if (videoStream) videoStream.getTracks().forEach(t => t.stop());
      stopSpeechRecognition();
    };
  }, []);

  const handleCopyElderId = () => {
    navigator.clipboard.writeText(elderProfile.elderId);
    setCopiedElderId(true);
    setTimeout(() => setCopiedElderId(false), 2500);
  };

  // Submit and Preserve Memory
  const handleSubmitMemory = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-generate title if elder left it blank
    const resolvedTitle = title.trim() || (
      sourceType === 'video'
        ? `Video Story: ${category}`
        : sourceType === 'audio'
        ? `Voice Story: ${category}`
        : `Reflections on ${category}`
    );

    // Auto-generate content if elder recorded audio or video without typing
    let resolvedContent = content.trim();
    if (!resolvedContent) {
      if (sourceType === 'video') {
        resolvedContent = `Video memory recorded by ${elderProfile.name} discussing ${category} on ${new Date().toLocaleDateString()}.`;
      } else if (sourceType === 'audio') {
        resolvedContent = `Voice recording shared by ${elderProfile.name} on ${new Date().toLocaleDateString()} regarding ${category}.`;
      } else {
        alert('Please write your story or reflections before preserving.');
        return;
      }
    }

    setSubmitting(true);
    setSubmitSuccess(null);

    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);

      const refType = sourceType === 'video' ? 'VIDEO' : sourceType === 'audio' ? 'AUDIO' : 'MEM';

      const result = await addElderMemory(
        elderProfile.uid,
        resolvedTitle,
        resolvedContent,
        category,
        tags,
        sourceType,
        refType,
        {
          audioUrl: audioUrl || undefined,
          videoUrl: videoUrl || undefined,
          transcript: resolvedContent
        }
      );

      // Also persist recorded blobs under the permanent referenceId
      if (videoBlob) {
        await saveMediaBlob(result.referenceId, videoBlob, 'video/webm');
      }
      if (audioBlob) {
        await saveMediaBlob(result.referenceId, audioBlob, 'audio/webm');
      }

      // Trigger Confetti & Sparkles VFX!
      setShowConfetti(true);
      setSubmitSuccess(`Wisdom safely preserved (${result.referenceId})!`);

      // Optimistically insert into memories
      setMemories(prev => [result.memory, ...prev.filter(m => m.id !== result.memory.id)]);

      // Reset form
      setTitle('');
      setContent('');
      setTagsInput('');
      setAudioBlob(null);
      setAudioUrl(null);
      setVideoBlob(null);
      setVideoUrl(null);

      // Transition to stories after a brief joyful moment
      setTimeout(() => {
        setSubmitSuccess(null);
        setActiveTab('stories');
      }, 1600);
    } catch (err: any) {
      console.error(err);
      alert('Failed to save memory: ' + (err?.message || 'Error occurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const pendingRequests = connections.filter(c => c.status === 'pending');
  const activeChildren = connections.filter(c => c.status === 'accepted');

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-16 relative">
      {/* Celebration Sparkles VFX */}
      <ConfettiVFX active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Elder Top Header */}
      <header className="bg-white border-b border-stone-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800 text-white flex items-center justify-center font-serif font-bold text-lg shadow-xs ring-2 ring-amber-700/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-base text-stone-900 leading-tight">
                  {elderProfile.name}
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/60">
                  Elder Archive
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Preserving life lessons & guidance for your grandchildren
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-elder-logout"
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
            id="tab-elder-stories"
            onClick={() => setActiveTab('stories')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'stories'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>My Stories ({memories.length})</span>
          </button>

          <button
            id="tab-elder-record"
            onClick={() => setActiveTab('record')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors relative ${
              activeTab === 'record'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Record Story / Note</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </button>

          <button
            id="tab-elder-family"
            onClick={() => setActiveTab('family')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors relative ${
              activeTab === 'family'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Family Access ({activeChildren.length})</span>
            {pendingRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-700 text-white">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Pending Requests Alert */}
        {pendingRequests.length > 0 && activeTab !== 'family' && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-amber-800" />
              <span className="font-semibold text-stone-900">
                {pendingRequests[0].childName} (Age {pendingRequests[0].childAge}) wants to connect.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('family')}
              className="px-3 py-1.5 rounded-lg bg-amber-800 text-white font-semibold hover:bg-amber-900"
            >
              Review
            </button>
          </div>
        )}

        {/* TAB 1: STORIES */}
        {activeTab === 'stories' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900">
                  Preserved Stories & Wisdom
                </h2>
                <p className="text-xs text-stone-500">
                  Your memories, audio notes, and video stories safely stored for family.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('record')}
                className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-transform hover:scale-102"
              >
                <Plus className="w-4 h-4" />
                <span>Record New Story</span>
              </button>
            </div>

            {memories.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl border border-stone-200 text-center shadow-2xs">
                <BookOpen className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <h3 className="font-serif font-bold text-base text-stone-800">No stories recorded yet</h3>
                <p className="text-xs text-stone-500 mt-1 mb-4">
                  Share your first memory, voice note, or video story with your family.
                </p>
                <button
                  onClick={() => setActiveTab('record')}
                  className="px-5 py-2.5 rounded-xl bg-amber-800 text-white font-semibold text-xs shadow-xs"
                >
                  Record Your First Story
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {memories.map(mem => {
                  const linkedAi = aiContents.find(a => a.sourceReferenceIds?.includes(mem.referenceId));
                  return (
                    <div
                      key={mem.id || mem.memoryId}
                      className="bg-white rounded-2xl border border-stone-200 shadow-2xs p-5 space-y-4 hover:border-amber-200/80 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ReferenceBadge referenceId={mem.referenceId} />
                          <OriginalContentBadge sourceType={mem.sourceType} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-stone-500">
                          <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <AudioVoicePlayer
                            text={mem.content}
                            audioUrl={mem.audioUrl}
                            referenceId={mem.referenceId}
                            label="Listen to Story"
                          />
                        </div>
                      </div>

                      <h3 className="text-lg font-serif font-bold text-stone-900">
                        {mem.title}
                      </h3>

                      {/* Video Player Display if Video Note */}
                      {mem.videoUrl && (
                        <div className="my-3">
                          <VideoPlayerCard videoUrl={mem.videoUrl} referenceId={mem.referenceId} title={mem.title} />
                        </div>
                      )}

                      {/* Audio Note player bar if Audio was recorded */}
                      {mem.audioUrl && (
                        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                            <Mic className="w-4 h-4 text-amber-700" />
                            <span>Original Voice Recording</span>
                          </div>
                          <AudioVoicePlayer
                            text={mem.content}
                            audioUrl={mem.audioUrl}
                            referenceId={mem.referenceId}
                            label="Play Recording"
                          />
                        </div>
                      )}

                      <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line bg-stone-50/70 p-4 rounded-xl border border-stone-100">
                        {mem.content}
                      </p>

                      {/* AI Key Lessons Summary */}
                      {linkedAi?.keyLessons && linkedAi.keyLessons.length > 0 && (
                        <div className="pt-3 border-t border-stone-100">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Key Wisdom Extracted for Family:</span>
                          </span>
                          <ul className="space-y-1">
                            {linkedAi.keyLessons.slice(0, 2).map((lesson, idx) => (
                              <li key={idx} className="text-xs text-stone-600 flex items-start gap-1.5">
                                <span className="text-amber-700 font-bold">•</span>
                                <span>{lesson}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RECORD */}
        {activeTab === 'record' && (
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs relative">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900">
                  Record a New Memory
                </h2>
                <p className="text-xs text-stone-500">
                  Speak, record video, or write a story. Your wisdom is safely preserved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInterviewOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-200 flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Need Inspiration?</span>
              </button>
            </div>

            {submitSuccess && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-bounce">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{submitSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitMemory} className="space-y-5">
              {/* 3 Format Selector Tabs */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Choose Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceType('text');
                      if (isAudioRecording) stopAudioRecording();
                      if (isVideoRecording) stopVideoRecording();
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      sourceType === 'text'
                        ? 'border-amber-800 bg-amber-50/90 text-amber-900 shadow-xs ring-1 ring-amber-700/20 font-bold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Written Story</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSourceType('audio');
                      if (isVideoRecording) stopVideoRecording();
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      sourceType === 'audio'
                        ? 'border-amber-800 bg-amber-50/90 text-amber-900 shadow-xs ring-1 ring-amber-700/20 font-bold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    <span>Voice Recording</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSourceType('video');
                      if (isAudioRecording) stopAudioRecording();
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      sourceType === 'video'
                        ? 'border-amber-800 bg-amber-50/90 text-amber-900 shadow-xs ring-1 ring-amber-700/20 font-bold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>Video Story</span>
                  </button>
                </div>
              </div>

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Story Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={
                      sourceType === 'video'
                        ? 'e.g. Grandma on Camera, Lessons from 1975'
                        : sourceType === 'audio'
                        ? 'e.g. My Childhood Memories in the Village'
                        : 'e.g. My First Job, Marriage Advice, Learning From Failure'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-amber-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none"
                  >
                    <option value="Life Lessons">Life Lessons</option>
                    <option value="Career & Work">Career & Work</option>
                    <option value="Relationships & Family">Family</option>
                    <option value="Childhood & Heritage">Childhood</option>
                    <option value="Failures & Resilience">Resilience</option>
                    <option value="Money & Finance">Money</option>
                  </select>
                </div>
              </div>

              {/* 1. AUDIO RECORDING BLOCK WITH VFX */}
              {sourceType === 'audio' && (
                <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-center relative overflow-hidden shadow-2xs">
                  {/* Glowing Pulse VFX Aura when recording */}
                  {isAudioRecording && (
                    <div className="absolute inset-0 bg-radial from-amber-400/20 to-transparent pointer-events-none animate-pulse" />
                  )}

                  <div className="relative z-10 space-y-4">
                    <p className="text-xs text-stone-600 font-medium">
                      {isAudioRecording
                        ? 'Recording your voice... Speak comfortably. Your words will be preserved.'
                        : audioUrl
                        ? 'Voice recorded! You can listen back or record again.'
                        : 'Click the microphone button to start speaking.'}
                    </p>

                    {/* Audio Waveform VFX Visualizer */}
                    <div className="py-1">
                      <AudioVisualizer
                        isRecording={isAudioRecording}
                        stream={audioStream}
                      />
                    </div>

                    {/* Recording Controls */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {!isAudioRecording && !audioUrl && (
                        <button
                          type="button"
                          onClick={startAudioRecording}
                          className="px-6 py-3 rounded-full bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-transform hover:scale-105"
                        >
                          <Mic className="w-4 h-4" />
                          <span>Start Voice Recording</span>
                        </button>
                      )}

                      {isAudioRecording && (
                        <button
                          type="button"
                          onClick={stopAudioRecording}
                          className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2.5 shadow-md animate-pulse ring-4 ring-red-300/50"
                        >
                          <Square className="w-4 h-4 fill-current" />
                          <span>Stop Recording ({formatSecs(recordedAudioTime)})</span>
                        </button>
                      )}

                      {!isAudioRecording && audioUrl && (
                        <div className="flex items-center gap-3">
                          {/* Audio Player Preview */}
                          <audio
                            ref={audioPreviewRef}
                            src={audioUrl}
                            onEnded={() => setIsPlayingAudioPreview(false)}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!audioPreviewRef.current) return;
                              if (isPlayingAudioPreview) {
                                audioPreviewRef.current.pause();
                                setIsPlayingAudioPreview(false);
                              } else {
                                const playPromise = audioPreviewRef.current.play();
                                if (playPromise !== undefined) {
                                  playPromise
                                    .then(() => setIsPlayingAudioPreview(true))
                                    .catch(() => setIsPlayingAudioPreview(false));
                                }
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold flex items-center gap-2 shadow-xs"
                          >
                            {isPlayingAudioPreview ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>Pause Audio</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Listen to Recording</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAudioBlob(null);
                              setAudioUrl(null);
                              startAudioRecording();
                            }}
                            className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                            <span>Record Again</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isSpeechListening && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold border border-amber-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                        <span>Live speech-to-text is active</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. VIDEO RECORDING BLOCK WITH LIVE VIEWFINDER & VFX */}
              {sourceType === 'video' && (
                <div className="p-5 rounded-2xl bg-stone-900 text-white border border-stone-800 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-amber-400" />
                      <span className="font-serif font-bold text-sm text-stone-200">
                        Camera Viewfinder
                      </span>
                    </div>
                    {isVideoRecording && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-bold tracking-wider animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        <span>REC {formatSecs(recordedVideoTime)}</span>
                      </div>
                    )}
                  </div>

                  {/* Viewfinder Canvas / Playback */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-stone-800 shadow-inner">
                    {/* Live Video while recording or setting up */}
                    {videoStream && (
                      <video
                        ref={videoLiveRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    )}

                    {/* Recorded Video Preview if stopped */}
                    {!videoStream && videoUrl && (
                      <video
                        src={videoUrl}
                        controls
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Idle Camera Placeholder */}
                    {!videoStream && !videoUrl && (
                      <div className="text-center p-6 text-stone-400 space-y-2">
                        <Camera className="w-12 h-12 mx-auto text-stone-600 stroke-1" />
                        <p className="text-xs">Camera is ready. Click Start Recording to begin.</p>
                      </div>
                    )}
                  </div>

                  {/* Video Recording Controls */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    {!isVideoRecording && !videoUrl && (
                      <button
                        type="button"
                        onClick={startVideoRecording}
                        className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-transform hover:scale-105"
                      >
                        <Video className="w-4 h-4" />
                        <span>Start Video Recording</span>
                      </button>
                    )}

                    {isVideoRecording && (
                      <button
                        type="button"
                        onClick={stopVideoRecording}
                        className="px-6 py-2.5 rounded-full bg-stone-100 hover:bg-white text-stone-900 font-bold text-xs flex items-center gap-2 shadow-md animate-pulse ring-4 ring-red-500/50"
                      >
                        <Square className="w-4 h-4 fill-current text-red-600" />
                        <span>Finish & Save Video ({formatSecs(recordedVideoTime)})</span>
                      </button>
                    )}

                    {!isVideoRecording && videoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setVideoBlob(null);
                          setVideoUrl(null);
                          startVideoRecording();
                        }}
                        className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 border border-stone-700"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
                        <span>Retake Video</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Story Notes / Transcript Text Box */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {sourceType === 'video'
                    ? 'Video Notes / Auto-Transcript'
                    : sourceType === 'audio'
                    ? 'Voice Notes / Spoken Transcript'
                    : 'Story, Reflections & Advice'}
                </label>
                <textarea
                  rows={sourceType === 'text' ? 6 : 4}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={
                    sourceType === 'video' || sourceType === 'audio'
                      ? 'Spoken words appear here automatically, or type additional reflections...'
                      : 'Share what happened, how you handled it, and the life lesson you want your family to remember...'
                  }
                  className="w-full p-3.5 rounded-xl border border-stone-200 text-sm leading-relaxed focus:ring-2 focus:ring-amber-800 focus:outline-none"
                />
              </div>

              {/* Tags Input */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Keywords / Tags (Optional)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  placeholder="e.g. resilience, career, marriage, honest work"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-800 focus:outline-none"
                />
              </div>

              {/* Submit & Preserve Button */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">
                  {sourceType === 'video' && videoUrl
                    ? '✓ Video recorded and ready to preserve'
                    : sourceType === 'audio' && audioUrl
                    ? '✓ Audio recorded and ready to preserve'
                    : ''}
                </span>

                <button
                  type="submit"
                  disabled={submitting || isAudioRecording || isVideoRecording}
                  className="px-6 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs shadow-xs flex items-center gap-2 disabled:opacity-60 transition-transform hover:scale-102"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Preserving Wisdom...' : 'Preserve Memory Note'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: FAMILY & ACCESS */}
        {activeTab === 'family' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Share Elder ID Card */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Your Family Share Code
                </h3>
                <p className="text-xs text-stone-500">
                  Give this code to your children or grandchildren to connect.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-900 text-base bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  {elderProfile.elderId}
                </span>
                <button
                  onClick={handleCopyElderId}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-black transition-colors"
                >
                  {copiedElderId ? 'Copied' : 'Copy Code'}
                </button>
              </div>
            </div>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 space-y-3">
                <h4 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-800" />
                  <span>Pending Connection Requests ({pendingRequests.length})</span>
                </h4>
                {pendingRequests.map(req => (
                  <div
                    key={req.id}
                    className="bg-white p-4 rounded-xl border border-stone-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900">{req.childName}</span>
                      <span className="text-stone-500 ml-1.5">(Age {req.childAge})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateConnectionStatus(req.id, 'accepted')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => updateConnectionStatus(req.id, 'rejected')}
                        className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Connected Children */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
              <h4 className="font-serif font-bold text-sm text-stone-900">
                Connected Family Members ({activeChildren.length})
              </h4>

              {activeChildren.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">
                  No family members connected yet. Share your Elder ID code above!
                </p>
              ) : (
                <div className="space-y-2">
                  {activeChildren.map(conn => (
                    <div
                      key={conn.id}
                      className="p-3.5 rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{conn.childName}</span>
                        <span className="text-stone-500">• Age {conn.childAge}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                          Connected
                        </span>
                      </div>
                      <button
                        onClick={() => updateConnectionStatus(conn.id, 'revoked')}
                        className="text-stone-400 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Guided Interview Modal */}
      <GuidedInterviewModal
        isOpen={isInterviewOpen}
        onClose={() => setIsInterviewOpen(false)}
        onSelectPrompt={(promptQuestion, promptCat) => {
          setTitle(promptQuestion);
          setCategory(promptCat);
          setActiveTab('record');
        }}
      />
    </div>
  );
};
