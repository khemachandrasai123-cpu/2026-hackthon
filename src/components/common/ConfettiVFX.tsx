import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  opacity: number;
  shape: 'circle' | 'square' | 'sparkle';
}

const COLORS = [
  '#f59e0b', // amber
  '#d97706', // dark amber
  '#fbbf24', // bright gold
  '#10b981', // emerald
  '#059669', // deep emerald
  '#f43f5e', // rose
  '#8b5cf6', // purple
  '#ec4899'  // pink
];

export const ConfettiVFX: React.FC<{ active: boolean; onComplete?: () => void }> = ({
  active,
  onComplete
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    // Spawn 50 particles from center/bottom
    const newParticles: Particle[] = [];
    for (let i = 0; i < 60; i++) {
      const angle = (Math.random() * Math.PI * 0.8) + (Math.PI * 0.1); // upwards cone
      const speed = Math.random() * 8 + 4;
      newParticles.push({
        id: i,
        x: window.innerWidth / 2 + (Math.random() * 120 - 60),
        y: window.innerHeight * 0.65,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.sin(angle) * speed,
        size: Math.random() * 8 + 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 15,
        opacity: 1,
        shape: Math.random() > 0.6 ? 'sparkle' : Math.random() > 0.3 ? 'circle' : 'square'
      });
    }
    setParticles(newParticles);

    let animationFrame: number;
    const startTime = Date.now();
    const duration = 2400;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        setParticles([]);
        if (onComplete) onComplete();
        return;
      }

      setParticles(prev =>
        prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.18, // gravity
          rotation: p.rotation + p.vRot,
          opacity: Math.max(0, 1 - elapsed / duration)
        }))
      );

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrame);
  }, [active, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}px`,
            top: `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.shape === 'sparkle' ? 'transparent' : p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 1.5}px ${p.color}`
          }}
        >
          {p.shape === 'sparkle' && (
            <svg viewBox="0 0 24 24" fill={p.color} className="w-full h-full">
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
};
