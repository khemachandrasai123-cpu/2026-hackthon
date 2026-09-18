import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Film, AlertCircle } from 'lucide-react';
import { resolveMediaUrl } from '../../services/mediaStorage';

interface VideoPlayerCardProps {
  videoUrl?: string;
  referenceId?: string;
  title?: string;
  poster?: string;
  className?: string;
}

export const VideoPlayerCard: React.FC<VideoPlayerCardProps> = ({
  videoUrl,
  referenceId,
  title,
  poster,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Safely resolve the video source (reviving IndexedDB storage if needed)
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);

    resolveMediaUrl(videoUrl, referenceId).then(resolved => {
      if (!isMounted) return;
      if (resolved) {
        setActiveUrl(resolved);
        setHasError(false);
      } else {
        setActiveUrl(null);
        setHasError(true);
      }
      setIsLoading(false);
    }).catch(() => {
      if (isMounted) {
        setHasError(true);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [videoUrl, referenceId]);

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTogglePlay = async () => {
    if (!videoRef.current || !activeUrl || hasError) return;

    if (isPlaying) {
      try {
        videoRef.current.pause();
      } catch {
        // Safe ignore
      }
      setIsPlaying(false);
    } else {
      try {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setHasError(false);
        }
      } catch (err: any) {
        // Handled gracefully without triggering unhandled warnings
        setIsPlaying(false);
        setHasError(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 1;
    setProgress((curr / dur) * 100);
    setCurrentTime(formatTime(curr));
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(formatTime(videoRef.current.duration));
    setHasError(false);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !activeUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * (videoRef.current.duration || 0);
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleVideoError = () => {
    setIsPlaying(false);
    setHasError(true);
  };

  return (
    <div className={`rounded-2xl overflow-hidden bg-stone-900 border border-stone-800 shadow-md relative group ${className}`}>
      {/* Top Header Badge */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold border border-white/10">
        <Film className="w-3 h-3 text-amber-400" />
        <span>Family Video Memory</span>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video w-full flex items-center justify-center bg-black">
        {activeUrl && !hasError ? (
          <>
            <video
              ref={videoRef}
              src={activeUrl}
              poster={poster}
              playsInline
              preload="metadata"
              onError={handleVideoError}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-cover cursor-pointer"
              onClick={handleTogglePlay}
            />

            {/* Center Play Overlay Button */}
            {!isPlaying && (
              <button
                type="button"
                onClick={handleTogglePlay}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-amber-600/90 hover:bg-amber-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 backdrop-blur-xs border border-amber-300/40 z-10"
                title="Play Video"
              >
                <Play className="w-6 h-6 fill-current translate-x-0.5" />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-stone-400">
            <AlertCircle className="w-8 h-8 text-amber-500/80 mb-2" />
            <p className="text-xs font-medium text-stone-300">
              {isLoading ? 'Loading video recording...' : 'Video recorded in family archive'}
            </p>
            <p className="text-[11px] text-stone-500 max-w-xs mt-1">
              Full spoken narrative is preserved in the story text and searchable transcripts.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      {activeUrl && !hasError && (
        <div className="bg-stone-900/95 px-4 py-3 border-t border-stone-800/80 flex flex-col gap-2">
          {/* Progress scrub bar */}
          <div
            onClick={handleSeek}
            className="h-1.5 w-full bg-stone-800 rounded-full cursor-pointer overflow-hidden relative"
          >
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-stone-300">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="text-stone-200 hover:text-white transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                className="text-stone-300 hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <span className="font-mono text-[11px] text-stone-400">
                {currentTime} / {duration}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {title && (
                <span className="text-[11px] text-stone-400 truncate max-w-[150px] sm:max-w-[200px]">
                  {title}
                </span>
              )}
              <button
                type="button"
                onClick={handleFullscreen}
                className="text-stone-400 hover:text-white transition-colors p-1"
                title="Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
