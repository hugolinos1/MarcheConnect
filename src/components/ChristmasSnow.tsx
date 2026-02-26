"use client"
import React, { useEffect, useState } from 'react';

interface Snowflake {
  id: number;
  left: string;
  duration: string;
  size: string;
  opacity: number;
  delay: string;
}

/**
 * Composant de neige sécurisé pour éviter les erreurs d'hydratation.
 */
export const ChristmasSnow = () => {
  const [mounted, setMounted] = useState(false);
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    // Génération uniquement sur le client
    const flakes = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${10 + Math.random() * 15}s`,
      size: `${Math.random() * 10 + 5}px`,
      opacity: Math.random() * 0.7 + 0.3,
      delay: `${Math.random() * 5}s`,
    }));
    setSnowflakes(flakes);
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: flake.left,
            animationDuration: flake.duration,
            fontSize: flake.size,
            opacity: flake.opacity,
            animationDelay: flake.delay,
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
};
