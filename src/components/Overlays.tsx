import React, { useState } from 'react';
import { ArrowRight, Check, Coins, Home, Keyboard, Moon, Orbit, Play, RotateCcw, Sun, Sword } from 'lucide-react';
import { ControlsPanel } from './ControlsPanel';
import { CHAPTERS } from '../game/config';
import { describeEchoProfile } from '../game/echo';
import { GameSettings, MatchStats, SaveData } from '../game/types';

interface PauseModalProps {
  save: SaveData;
  isSettingsOnly?: boolean;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onResume: () => void;
  onRestart?: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  save,
  isSettingsOnly = false,
  onUpdateSettings,
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  const [view, setView] = useState<'main' | 'controls'>('main');

  if (view === 'controls') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/65">
        <div className="w-full max-w-md max-h-[94vh] overflow-y-auto bg-[var(--paper)] border-2 border-[var(--ink)] p-4 sm:p-6 shadow-xl">
          <ControlsPanel onBack={() => setView('main')} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/65">
      <div className="w-full max-w-md max-h-[94vh] overflow-y-auto bg-[var(--paper)] border-2 border-[var(--ink)] p-5 sm:p-6 shadow-xl">
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[var(--ink)]">
          {isSettingsOnly ? 'Settings' : 'Paused'}
        </h2>

        <div className="mt-5 space-y-4 text-sm">
          <div>
            <div className="flex justify-between mb-1">
              <label htmlFor="master-volume" className="font-medium text-[var(--ink)]">
                Volume
              </label>
              <span className="font-mono tabular-nums text-[var(--ink-muted)]">
                {Math.round(save.settings.volume * 100)}%
              </span>
            </div>
            <input
              id="master-volume"
              type="range"
              min={0}
              max={100}
              value={Math.round(save.settings.volume * 100)}
              onChange={(e) => onUpdateSettings({ volume: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--crimson)] cursor-pointer"
            />
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="font-medium text-[var(--ink)]">Audio Loop</span>
            <input
              type="checkbox"
              checked={save.settings.musicEnabled}
              onChange={(e) => onUpdateSettings({ musicEnabled: e.target.checked })}
              className="w-4 h-4 accent-[var(--crimson)] cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={() => setView('controls')}
            className="kata-btn w-full inline-flex items-center justify-between gap-2 px-4 py-2.5 text-sm cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Keyboard className="w-4 h-4" aria-hidden="true" />
              Controls &amp; Key Bindings
            </span>
            <span className="text-[var(--ink-muted)] text-xs">Keyboard · Mouse</span>
          </button>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="font-medium text-[var(--ink)]">Screen Shake</span>
            <input
              type="checkbox"
              checked={save.settings.screenShake}
              onChange={(e) => onUpdateSettings({ screenShake: e.target.checked })}
              className="w-4 h-4 accent-[var(--crimson)] cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="inline-flex items-center gap-2 font-medium text-[var(--ink)]">
              {save.settings.darkMode ? (
                <Moon className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              )}
              <span>Night Stage</span>
            </span>
            <input
              type="checkbox"
              data-testid="dark-mode-toggle"
              checked={save.settings.darkMode}
              onChange={(e) => onUpdateSettings({ darkMode: e.target.checked })}
              className="w-4 h-4 accent-[var(--crimson)] cursor-pointer"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="touch-mode" className="font-medium text-[var(--ink)]">
              Touch UI
            </label>
            <select
              id="touch-mode"
              value={save.settings.touchControls}
              onChange={(e) =>
                onUpdateSettings({
                  touchControls: e.target.value as GameSettings['touchControls'],
                })
              }
              className="px-2.5 py-1 border border-[var(--ink-border)] bg-[var(--paper)] text-[var(--ink)] text-xs font-medium rounded-[2px]"
            >
              <option value="auto">Auto</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--ink-border)] flex flex-wrap items-center justify-end gap-2">
          {!isSettingsOnly && (
            <>
              <button
                type="button"
                onClick={onReturnTitle}
                className="kata-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
                <span>Title</span>
              </button>
              {onRestart && (
                <button
                  type="button"
                  onClick={onRestart}
                  className="kata-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
                  <span>Restart</span>
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onResume}
            className="kata-btn inline-flex items-center gap-1.5 px-6 py-2 text-sm font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer"
          >
            {isSettingsOnly ? (
              <Check className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
            )}
            <span>{isSettingsOnly ? 'Done' : 'Resume'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface MatchOverModalProps {
  stats: MatchStats;
  save: SaveData;
  chapterIndex: number;
  isVersus: boolean;
  onContinue: () => void;
  onOpenArmory?: () => void;
  onOpenSkillTree: () => void;
  onReturnTitle: () => void;
}

export const MatchOverModal: React.FC<MatchOverModalProps> = ({
  stats,
  save,
  chapterIndex,
  isVersus,
  onContinue,
  onOpenArmory,
  onOpenSkillTree,
  onReturnTitle,
}) => {
  const chapter = CHAPTERS[chapterIndex] ?? CHAPTERS[0];
  const won = stats.winner === 1;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/70">
      <div className="w-full max-w-lg max-h-[94vh] overflow-y-auto bg-[var(--paper)] border-2 border-[var(--ink)] p-5 md:p-7 shadow-xl">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)]">
          {isVersus ? 'Versus' : chapter.subtitle}
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl text-[var(--ink)] mt-1">
          {isVersus
            ? `P${stats.winner} Wins`
            : stats.isCampaignComplete
              ? 'Master of Echo'
              : won
                ? stats.isChapterClear
                  ? 'Echo Cleared'
                  : 'Victory'
                : 'Defeated'}
        </h2>
        {stats.victoryQuote && (
          <p className="mt-1.5 font-display italic text-sm text-[var(--ink-muted)]">
            {stats.victoryQuote}
          </p>
        )}

        {/* Mastery Stat Tiles */}
        <div className="grid grid-cols-3 gap-3 mt-5 py-3 border-y border-[var(--ink-border)] tabular-nums">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
              Rounds
            </div>
            <div className="font-mono font-bold text-xl text-[var(--ink)] mt-0.5">
              {stats.p1Rounds} – {stats.p2Rounds}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
              Max Combo
            </div>
            <div className="font-mono font-bold text-xl text-[var(--ink)] mt-0.5">
              {stats.maxCombo}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
              Parries
            </div>
            <div className="font-mono font-bold text-xl text-[var(--ink)] mt-0.5">
              {stats.perfectParries}
            </div>
          </div>
        </div>

        {/* Spirit Points & Coins Breakdown + Concise Echo Habit */}
        {!isVersus && (
          <div className="mt-4 space-y-2 text-xs text-[var(--ink-muted)]">
            <div className="flex items-center justify-between font-semibold text-sm text-[var(--ink)]">
              <span>Rewards</span>
              <div className="flex items-center gap-3 font-mono tabular-nums">
                <span className="inline-flex items-center gap-1 text-[var(--gold)]">
                  <Coins className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>+{stats.coinsEarned.total} Coins</span>
                </span>
                <span>+{stats.spEarned.total} SP</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono tabular-nums">
              <span>Win +{stats.spEarned.win}</span>
              {stats.spEarned.parries > 0 && <span>Parry +{stats.spEarned.parries}</span>}
              {stats.spEarned.noDamage > 0 && <span>Perfect +{stats.spEarned.noDamage}</span>}
              {stats.spEarned.comboBonus > 0 && <span>Combo +{stats.spEarned.comboBonus}</span>}
            </div>
            <div className="pt-1.5 text-xs text-[var(--ink-muted)]">
              <strong className="text-[var(--ink)]">Echo · </strong>
              {describeEchoProfile(save.echoProfile)}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-[var(--ink-border)] flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onReturnTitle}
              className="kata-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
              <span>Title</span>
            </button>
            {!isVersus && onOpenArmory && (
              <button
                type="button"
                onClick={onOpenArmory}
                className="kata-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium font-mono border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
              >
                <Sword className="w-3.5 h-3.5 text-[var(--gold)] stroke-[1.9]" aria-hidden="true" />
                <span>{save.coins}</span>
              </button>
            )}
            {!isVersus && (
              <button
                type="button"
                onClick={onOpenSkillTree}
                className="kata-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium font-mono border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
              >
                <Orbit className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
                <span>{save.spiritPoints} SP</span>
              </button>
            )}
          </div>

          <button
            type="button"
            data-start="true"
            onClick={onContinue}
            className="kata-btn w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-6 py-3 text-base sm:text-sm font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer"
          >
            {isVersus || !won ? (
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.1]" aria-hidden="true" />
            ) : (
              <ArrowRight className="w-4 h-4 stroke-[2.1]" aria-hidden="true" />
            )}
            <span>{isVersus ? 'Rematch' : won ? 'Next Level' : 'Retry'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
