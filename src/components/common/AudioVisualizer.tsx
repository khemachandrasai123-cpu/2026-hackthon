import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
  stream: MediaStream | null;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  stream,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let dataArray: Uint8Array | null = null;

    if (isRecording && stream) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          const bufferLength = analyser.frequencyBinCount;
          dataArray = new Uint8Array(bufferLength);
        }
      } catch (err) {
        console.warn('AudioContext visualization not available:', err);
      }
    }

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 28;
      const barWidth = Math.max(3, (width / numBars) - 3);

      if (isRecording) {
        if (analyser && dataArray) {
          analyser.getByteFrequencyData(dataArray as any);
        }

        phase += 0.08;

        for (let i = 0; i < numBars; i++) {
          let value = 0;
          if (dataArray && dataArray.length > 0) {
            const dataIndex = Math.floor((i / numBars) * (dataArray.length * 0.75));
            value = dataArray[dataIndex] / 255;
          } else {
            // Simulated soothing wave if audio analysis is not direct
            value = (Math.sin(phase + i * 0.4) * 0.3 + 0.5) * (0.4 + Math.sin(phase * 1.5) * 0.3);
          }

          // Smooth floor so it's always responsive
          const barHeight = Math.max(6, value * (height * 0.85));
          const x = i * (barWidth + 3) + (width - (numBars * (barWidth + 3))) / 2;
          const y = (height - barHeight) / 2;

          // Warm amber to gold gradient with glow
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, '#f59e0b');
          grad.addColorStop(1, '#d97706');

          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
          ctx.shadowBlur = 8;

          // Draw rounded bar
          ctx.beginPath();
          const radius = barWidth / 2;
          ctx.roundRect(x, y, barWidth, barHeight, radius);
          ctx.fill();
        }
      } else {
        // Idle gentle waveform
        for (let i = 0; i < numBars; i++) {
          const x = i * (barWidth + 3) + (width - (numBars * (barWidth + 3))) / 2;
          const y = (height - 4) / 2;
          ctx.fillStyle = '#e7e5e4';
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, 4, 2);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [isRecording, stream]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={380}
        height={64}
        className="w-full max-w-[380px] h-16 rounded-xl"
      />
    </div>
  );
};
