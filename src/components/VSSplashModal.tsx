import React, { useEffect } from 'react';
import { Swords } from 'lucide-react';
import { getCharacterConfig } from '../game/characters';
import { CHAPTERS } from '../game/config';
import { GameMode } from '../game/types';
import { CharacterPortraitCanvas } from './CharacterPortraitCanvas';

interface VSSplashModalProps {
  p1CharacterId: string;
  p2CharacterId: string;
  p2DisplayName?: string;
  p2Title?: string;
  isEchoDuel?: boolean;
  mode: GameMode;
  chapterIndex: number;
  duelIndex: number;
  darkMode: boolean;
  onStartFight: () => void;
}

export const VSSplashModal: React.FC<VSSplashModalProps> = ({
  p1CharacterId,
  p2CharacterId,
  p2DisplayName,
  p2Title,
  isEchoDuel = false,
  mode,
  chapterIndex,
  duelIndex,
  darkMode,
  onStartFight,
}) => {
  const p1Char = getCharacterConfig(p1CharacterId);
  const p2Char = getCharacterConfig(p2CharacterId);
  const chapter = CHAPTERS[chapterIndex] ?? CHAPTERS[0];
  const rightAccent = isEchoDuel ? '#B8861E' : p2Char.accentColor;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartFight();
      }
    };
    window.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => {
      onStartFight();
    }, 2400);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [onStartFight]);

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[var(--paper)] flex flex-col justify-between">
      {/* Top Stage Header (cleanly above diagonal divider) */}
      <div className="relative z-20 pt-5 pb-2 px-6 text-center bg-[var(--paper)] border-b border-[var(--ink-border)]/40">
        <div className="text-[11px] font-mono uppercase tracking-[0.28em] text-[var(--ink-muted)]">
          {mode === 'dojo'
            ? 'Training Dojo'
            : mode === 'versus'
              ? 'Local Versus'
              : `${chapter.title} · Duel ${duelIndex + 1}`}
        </div>
      </div>

      {/* Main Split Fighter Showcase with Diagonal Ink Divider */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <polygon points="56,0 100,0 100,100 44,100" fill="var(--ink)" fillOpacity="0.055" />
          <line
            x1="56"
            y1="0"
            x2="44"
            y2="100"
            stroke="var(--crimson)"
            strokeWidth="0.55"
          />
        </svg>

        <div className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 grid grid-cols-2 items-center gap-2 sm:gap-6">
          {/* Left Fighter (P1) */}
          <div className="flex flex-col items-center sm:items-start">
            <div className="w-full max-w-[260px] h-52 sm:h-72">
              <CharacterPortraitCanvas
                characterId={p1Char.id}
                darkMode={darkMode}
                animated={true}
                facing={1}
                zoom={1.08}
                className="w-full h-full block"
              />
            </div>
            <div className="mt-2 text-center sm:text-left">
              <div
                className="text-xs font-mono font-bold uppercase tracking-widest"
                style={{ color: p1Char.accentColor }}
              >
                {p1Char.role}
              </div>
              <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-[var(--ink)] leading-none mt-1">
                {p1Char.name}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--ink-muted)] mt-1">{p1Char.title}</p>
            </div>
          </div>

          {/* Right Fighter (P2) */}
          <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
            <div className="w-full max-w-[260px] h-52 sm:h-72">
              <CharacterPortraitCanvas
                characterId={p2Char.id}
                darkMode={darkMode}
                animated={true}
                facing={-1}
                zoom={1.08}
                className="w-full h-full block"
              />
            </div>
            <div className="mt-2">
              <div
                className="text-xs font-mono font-bold uppercase tracking-widest"
                style={{ color: rightAccent }}
              >
                {isEchoDuel ? 'Echo Mirror' : p2Char.role}
              </div>
              <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-[var(--ink)] leading-none mt-1">
                {p2DisplayName ?? p2Char.name}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--ink-muted)] mt-1">
                {p2Title ?? p2Char.title}
              </p>
            </div>
          </div>

          {/* Center VS Emblem */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-[var(--ink)] text-[var(--paper)] border-2 border-[var(--crimson)] flex items-center justify-center shadow-xl rotate-3">
              <span className="font-display font-extrabold text-2xl sm:text-3xl tracking-wider -rotate-3">
                VS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Enter Duel Button (cleanly below divider) */}
      <div className="relative z-20 pt-3 pb-6 sm:pb-8 flex justify-center bg-[var(--paper)] border-t border-[var(--ink-border)]/40">
        <button
          type="button"
          data-enter-fight="true"
          onClick={onStartFight}
          className="kata-btn inline-flex items-center gap-2 px-7 py-3 text-sm sm:text-base font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer shadow-lg"
        >
          <Swords className="w-4 h-4 stroke-[2]" aria-hidden="true" />
          <span>Enter Duel</span>
        </button>
      </div>
    </div>
  );
};
