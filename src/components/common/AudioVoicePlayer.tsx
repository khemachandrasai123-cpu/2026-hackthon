import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Square } from 'lucide-react';
import { resolveMediaUrl } from '../../services/mediaStorage';

interface AudioVoicePlayerProps {
  text: string;
  label?: string;
  audioUrl?: string;
  referenceId?: string;
}

export const AudioVoicePlayer: React.FC<AudioVoicePlayerProps> = ({
  text,
  label = 'Listen to Wisdom',
  audioUrl,
  referenceId
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);

  // Resolve audio URL safely across sessions
  useEffect(() => {
    let isMounted = true;
    resolveMediaUrl(audioUrl, referenceId).then(resolved => {
      if (isMounted) {
        setActiveAudioUrl(resolved);
      }
    }).catch(() => {
      if (isMounted) {
        setActiveAudioUrl(null);
      }
    });

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [audioUrl, referenceId]);

  const speakWithTTS = () => {
    if (!isSupported) {
      setIsPlaying(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(
        v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
      );
      if (naturalVoice) utterance.voice = naturalVoice;

      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleTogglePlay = async () => {
    // If currently playing, stop everything
    if (isPlaying) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch {
          // Safe ignore
        }
      }
      if (isSupported) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Safe ignore
        }
      }
      setIsPlaying(false);
      return;
    }

    // Try playing the elder's original voice recording if available
    if (activeAudioUrl) {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio(activeAudioUrl);
          audioRef.current.onended = () => setIsPlaying(false);
          audioRef.current.onerror = () => {
            setIsPlaying(false);
            speakWithTTS();
          };
        }

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
        }
        return;
      } catch {
        // Source not supported or cannot be played, seamlessly fall back to narration
        setIsPlaying(false);
        speakWithTTS();
        return;
      }
    }

    // Default narration with SpeechSynthesis
    speakWithTTS();
  };

  return (
    <button
      id="btn-voice-playback"
      type="button"
      onClick={handleTogglePlay}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
        isPlaying
          ? 'bg-amber-600 text-white border-amber-700 shadow-sm animate-pulse'
          : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
      }`}
      title={activeAudioUrl ? "Play elder's original voice recording" : "Listen to narration"}
    >
      {isPlaying ? (
        <>
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>{activeAudioUrl ? 'Stop Audio' : 'Stop Narration'}</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 text-amber-700" />
          <span>{activeAudioUrl ? 'Play Voice Recording' : label}</span>
        </>
      )}
    </button>
  );
};
