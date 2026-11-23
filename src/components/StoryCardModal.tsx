import React, { useState } from 'react';
import { ArrowRight, BookOpen, Coins, Home, Orbit, Sword, Swords } from 'lucide-react';
import { CHAPTERS, STORY_PROLOGUE } from '../game/config';
import { describeEchoProfile } from '../game/echo';
import { SaveData } from '../game/types';

interface StoryCardModalProps {
  save: SaveData;
  chapterIndex: number;
  duelIndex: number;
  isPrologue?: boolean;
  onFinishPrologue?: () => void;
  onEnterDuel: () => void;
  onOpenArmory: () => void;
  onOpenSkillTree: () => void;
  onBackToTitle: () => void;
}

export const StoryCardModal: React.FC<StoryCardModalProps> = ({
  save,
  chapterIndex,
  duelIndex,
  isPrologue = false,
  onFinishPrologue,
  onEnterDuel,
  onOpenArmory,
  onOpenSkillTree,
  onBackToTitle,
}) => {
  const [prologueStep, setPrologueStep] = useState(0);

  if (isPrologue) {
    const beat = STORY_PROLOGUE[prologueStep] ?? STORY_PROLOGUE[0];
    const isLastBeat = prologueStep >= STORY_PROLOGUE.length - 1;

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 md:p-8 bg-black/55">
        <div className="w-full max-w-2xl bg-[var(--paper)] border-2 border-[var(--ink)] p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--ink-border)]">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-widest text-[var(--crimson)]">
                <BookOpen className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
                <span>Prologue · Scroll {prologueStep + 1} / {STORY_PROLOGUE.length}</span>
              </div>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-[var(--ink)] mt-1">
                {beat.title}
              </h2>
            </div>

            <svg viewBox="0 0 80 80" className="w-16 h-16 shrink-0" aria-hidden="true">
              <circle cx="40" cy="40" r="30" fill="var(--crimson)" fillOpacity="0.14" />
              <path
                d="M14 58 Q40 28 66 58"
                stroke="var(--ink)"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="40" cy="32" r="9" fill="var(--crimson)" />
            </svg>
          </div>

          <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed mt-5">
            {beat.line}
          </p>

          {/* Step progress bars */}
          <div className="mt-5 flex items-center gap-2">
            {STORY_PROLOGUE.map((b, idx) => (
              <button
                key={b.title}
                type="button"
                aria-label={`Read Scroll ${idx + 1}`}
                onClick={() => setPrologueStep(idx)}
                className={`h-1.5 flex-1 transition-colors cursor-pointer ${
                  idx === prologueStep
                    ? 'bg-[var(--crimson)]'
                    : idx < prologueStep
                      ? 'bg-[var(--ink)]'
                      : 'bg-[var(--ink-track)]'
                }`}
              />
            ))}
          </div>

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
              {!isLastBeat && onFinishPrologue && (
                <button
                  type="button"
                  onClick={onFinishPrologue}
                  className="kata-btn px-3.5 py-2.5 text-xs sm:text-sm font-medium border border-[var(--ink-border)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
                >
                  Skip
                </button>
              )}
            </div>

            {isLastBeat ? (
              <button
                type="button"
                data-start="true"
                onClick={onFinishPrologue}
                className="kata-btn inline-flex items-center gap-2 px-7 py-3 text-sm md:text-base font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer"
              >
                <Swords className="w-4 h-4 stroke-[2]" aria-hidden="true" />
                <span>Begin Journey</span>
              </button>
            ) : (
              <button
                type="button"
                data-next-scroll="true"
                onClick={() => setPrologueStep((prev) => Math.min(STORY_PROLOGUE.length - 1, prev + 1))}
                className="kata-btn inline-flex items-center gap-2 px-7 py-3 text-sm md:text-base font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer"
              >
                <span>Next Scroll</span>
                <ArrowRight className="w-4 h-4 stroke-[2]" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const chapter = CHAPTERS[chapterIndex] ?? CHAPTERS[0];
  const duel = chapter.duels[duelIndex] ?? chapter.duels[0];
  const stage = chapter.stage;
  const levelNumber = chapterIndex * 4 + duelIndex + 1;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 md:p-8 bg-black/50">
      <div className="w-full max-w-2xl bg-[var(--paper)] border-2 border-[var(--ink)] p-6 md:p-8 shadow-2xl">
        {/* Ink-Painted Level & Chapter Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--ink-border)]">
          <div>
            <div
              className="text-xs font-mono font-semibold uppercase tracking-widest"
              style={{ color: stage.accent }}
            >
              Level {levelNumber} / 20 · {chapter.subtitle} · Duel {duelIndex + 1}/4
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-[var(--ink)] mt-1">
              {duel.storyBeat?.title || (duel.isEcho ? `${duel.name} — ${duel.title}` : duel.name)}
            </h2>
            <div className="text-xs sm:text-sm font-medium text-[var(--ink-muted)] mt-0.5">
              Opponent: {duel.name} · {duel.title}
            </div>
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

        {/* Continuing Narrative Line */}
        {duel.storyBeat && (
          <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed mt-4">
            {duel.storyBeat.line}
          </p>
        )}

        <p className="font-display italic text-sm text-[var(--ink-muted)] leading-relaxed mt-3">
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
              {duelIndex === 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{chapter.storyIntro}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-[var(--ink-border)]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBackToTitle}
              className="kata-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
              <span>Title</span>
            </button>
            <button
              type="button"
              onClick={onOpenArmory}
              className="kata-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium font-mono border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
            >
              <Sword className="w-3.5 h-3.5 text-[var(--gold)] stroke-[1.9]" aria-hidden="true" />
              <Coins className="w-3 h-3 text-[var(--gold)]" aria-hidden="true" />
              <span>{save.coins}</span>
            </button>
            <button
              type="button"
              onClick={onOpenSkillTree}
              className="kata-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium font-mono border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
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
            <span>Begin Duel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
