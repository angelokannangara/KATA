import React from 'react';
import { Home, Orbit, Swords } from 'lucide-react';
import { CHAPTERS } from '../game/config';
import { describeEchoProfile } from '../game/echo';
import { SaveData } from '../game/types';

interface StoryCardModalProps {
  save: SaveData;
  chapterIndex: number;
  duelIndex: number;
  onEnterDuel: () => void;
  onOpenSkillTree: () => void;
  onBackToTitle: () => void;
}

export const StoryCardModal: React.FC<StoryCardModalProps> = ({
  save,
  chapterIndex,
  duelIndex,
  onEnterDuel,
  onOpenSkillTree,
  onBackToTitle,
}) => {
  const chapter = CHAPTERS[chapterIndex] ?? CHAPTERS[0];
  const duel = chapter.duels[duelIndex] ?? chapter.duels[0];
  const stage = chapter.stage;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 md:p-8 bg-black/50">
      <div className="w-full max-w-xl bg-[var(--paper)] border-2 border-[var(--ink)] p-6 md:p-8 shadow-2xl">
        {/* Ink-Painted Chapter Illustration Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--ink-border)]">
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: stage.accent }}
            >
              {chapter.subtitle} · Duel {duelIndex + 1}/4
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-[var(--ink)] mt-1">
              {duel.isEcho ? `${duel.name} — ${duel.title}` : duel.name}
            </h2>
          </div>

          <svg viewBox="0 0 80 80" className="w-16 h-16 shrink-0" aria-hidden="true">
            <circle cx="40" cy="40" r="30" fill={stage.accent} fillOpacity="0.18" />
            <path
              d="M14 58 Q40 28 66 58"
              stroke="var(--ink)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <circle
              cx="40"
              cy="32"
              r="9"
              fill={duel.isEcho ? stage.accent : 'var(--ink)'}
            />
          </svg>
        </div>

        <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed mt-4">
          {duel.quote}
        </p>

        {/* Opponent / Echo Insight */}
        <div className="mt-4 p-3.5 bg-[var(--paper-dim)] border border-[var(--ink-border)] text-xs md:text-sm text-[var(--ink-muted)]">
          {duel.isEcho ? (
            <div>
              <span className="font-semibold text-[var(--ink)]">Echo · </span>
              {describeEchoProfile(save.echoProfile)}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-[var(--ink)]">{duel.title}</span>
              <span aria-hidden="true">·</span>
              <span>
                {duel.personality.charAt(0).toUpperCase() + duel.personality.slice(1)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">HP {duel.maxHp}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-[var(--ink-border)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToTitle}
              className="kata-btn inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
              <span>Title</span>
            </button>
            <button
              type="button"
              onClick={onOpenSkillTree}
              className="kata-btn inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium font-mono border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
            >
              <Orbit className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
              <span>{save.spiritPoints} SP</span>
            </button>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={onEnterDuel}
            className="kata-btn inline-flex items-center gap-2 px-7 py-3 text-sm md:text-base font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer"
          >
            <Swords className="w-4 h-4 stroke-[2]" aria-hidden="true" />
            <span>Begin</span>
          </button>
        </div>
      </div>
    </div>
  );
};
