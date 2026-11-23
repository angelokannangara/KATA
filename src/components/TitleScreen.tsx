import React from 'react';
import { Orbit, SlidersHorizontal, Swords, Target, UserCheck, Users } from 'lucide-react';
import { getCharacterConfig } from '../game/characters';
import { CHAPTERS } from '../game/config';
import { describeEchoProfile } from '../game/echo';
import { GameMode, SaveData } from '../game/types';

interface TitleScreenProps {
  save: SaveData;
  onStartMode: (mode: GameMode) => void;
  onOpenRoster: () => void;
  onOpenSkillTree: () => void;
  onOpenSettings: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  save,
  onStartMode,
  onOpenRoster,
  onOpenSkillTree,
  onOpenSettings,
}) => {
  const chapter = CHAPTERS[save.currentChapter] ?? CHAPTERS[0];
  const activeChar = getCharacterConfig(save.selectedCharacterId);
  const duelLabel =
    save.currentChapter > 0
      ? `Ch. ${save.currentChapter + 1} · Duel ${save.currentDuel + 1}`
      : `Duel ${save.currentDuel + 1}`;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 md:p-10 pointer-events-none">
      {/* Top Row: Compact progress line & icon utility buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs md:text-sm text-[var(--ink-muted)] tracking-wide pointer-events-auto">
          <span>{chapter.subtitle}</span>
          <span className="mx-2 opacity-60" aria-hidden="true">
            ·
          </span>
          <span className="font-semibold text-[var(--ink)]">{activeChar.name}</span>
          <span className="mx-2 opacity-60" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums">{save.spiritPoints} SP</span>
          <span className="mx-2 opacity-60" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums">
            {save.unlockedCharacters.length}/10 Fighters
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenRoster}
            aria-label="Fighter Roster"
            className="kata-btn inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
            <span>Fighters</span>
          </button>
          <button
            type="button"
            onClick={onOpenSkillTree}
            aria-label="Skill Constellation"
            className="kata-btn inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Orbit className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
            <span>Skills</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            className="kata-btn inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Main Focal Lockup: Left-aligned logo block */}
      <div className="flex flex-col items-start max-w-xl my-auto pb-14 sm:pb-16 pointer-events-auto">
        <div className="relative flex items-start gap-3.5 sm:gap-4 mb-4">
          {/* Red Hanko Seal with stylized katana/kata calligraphy */}
          <div
            className="mt-3 sm:mt-4 w-9 h-10 sm:w-10 sm:h-11 rounded-[2px] bg-[var(--crimson)] flex items-center justify-center shrink-0 shadow-sm"
            aria-hidden="true"
          >
            <svg viewBox="0 0 36 42" className="w-6 h-7" fill="none">
              <path
                d="M10 13 H26 C26 24 24 29 21 31 L18 28 M18 13 C17 21 14 27 9 31"
                stroke="#F4EFE4"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="relative flex flex-col items-start">
            {/* Thick grey arcing brush stroke above KATA */}
            <svg
              viewBox="0 0 320 26"
              className="w-56 sm:w-72 h-5 -mb-2 pointer-events-none overflow-visible"
              aria-hidden="true"
            >
              <path
                d="M4 20 C 78 2, 205 2, 314 17"
                stroke="var(--ink)"
                strokeOpacity="0.18"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            <h1 className="font-display font-extrabold text-6xl sm:text-7xl md:text-[5rem] leading-[0.88] tracking-[0.08em] text-[var(--ink)] select-none">
              KATA
            </h1>

            {/* Red brush underline beneath KATA */}
            <svg
              viewBox="0 0 320 14"
              className="w-56 sm:w-72 h-3 mt-1 pointer-events-none overflow-visible"
              aria-hidden="true"
            >
              <path
                d="M2 7 Q 112 2 215 8 T 316 5"
                stroke="var(--crimson)"
                strokeWidth="3.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            <div className="mt-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.42em] text-[var(--ink-muted)]">
              INK &amp; ECHO
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[var(--ink-muted)] tracking-wide mb-6">
          {save.echoProfile.totalEvents >= 18
            ? `Echo · ${describeEchoProfile(save.echoProfile)}`
            : 'Echo · Fight to awaken'}
        </p>

        {/* Action Row with Crisp Icons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={() => onStartMode('chapter')}
            className="kata-btn inline-flex items-center gap-2 px-6 sm:px-7 py-3 text-sm sm:text-base font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] border border-transparent whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Swords className="w-4 h-4 stroke-[2]" aria-hidden="true" />
            <span>{duelLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => onStartMode('dojo')}
            className="kata-btn inline-flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-medium border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Target className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
            <span>Dojo</span>
          </button>

          <button
            type="button"
            onClick={() => onStartMode('versus')}
            className="kata-btn inline-flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-medium border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Users className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
            <span>Versus</span>
          </button>
        </div>
      </div>

      {/* Bottom Safe Margin: Compact control hint */}
      <div className="text-[11px] sm:text-xs font-mono text-[var(--ground-text)]/80 tracking-wide truncate">
        WASD Move · J/K Strike · L Parry · Space Dash · Q/E Stance · U/I/O Skills · P Ult
      </div>
    </div>
  );
};
