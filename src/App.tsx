/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleHUD } from './components/BattleHUD';
import { CharacterSelectModal } from './components/CharacterSelectModal';
import { MatchOverModal, PauseModal } from './components/Overlays';
import { SkillTreeModal } from './components/SkillTreeModal';
import { StoryCardModal } from './components/StoryCardModal';
import { TitleScreen } from './components/TitleScreen';
import { VSSplashModal } from './components/VSSplashModal';
import { getCharacterConfig } from './game/characters';
import { CHAPTERS } from './game/config';
import { GameEngine } from './game/engine';
import {
  equipSkillToSlot,
  loadSaveData,
  selectCharacter,
  unlockCharacter,
  unlockSkill,
  updateSettings,
} from './game/save';
import { GameMode, GameScreen, GameSettings, HUDState, SaveData } from './game/types';

function mapBodyDatasetState(screen: GameScreen): string {
  if (screen === 'match_over') return 'gameover';
  if (screen === 'playing') return 'playing';
  if (screen === 'paused') return 'paused';
  return screen;
}

interface PendingMatchup {
  mode: GameMode;
  p1CharId: string;
  p2CharId: string;
  p2Name?: string;
  p2Title?: string;
  isEcho?: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<GameScreen>('title');
  const [pendingMode, setPendingMode] = useState<GameMode>('chapter');
  const [matchup, setMatchup] = useState<PendingMatchup | null>(null);
  const [showTitleSettings, setShowTitleSettings] = useState(false);
  const [skillTreeReturnTo, setSkillTreeReturnTo] = useState<'title' | 'story_card' | 'match_over'>(
    'title',
  );
  const [hud, setHud] = useState<HUDState | null>(null);

  const syncScreen = useCallback((next: GameScreen) => {
    setScreen(next);
    document.body.dataset.state = mapBodyDatasetState(next);
    if (engineRef.current && engineRef.current.getScreen() !== next) {
      engineRef.current.setScreen(next);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialSave = loadSaveData();
    setSave(initialSave);

    const engine = new GameEngine({
      canvas,
      save: initialSave,
      onHudUpdate: (nextHud) => {
        setHud(nextHud);
        setScreen(nextHud.screen);
        document.body.dataset.state = mapBodyDatasetState(nextHud.screen);
      },
      onSaveUpdate: (nextSave) => {
        setSave(nextSave);
      },
    });
    engineRef.current = engine;
    engine.startLoop();

    // Support ?autostart=1 to jump directly into active gameplay
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      document.body.dataset.state = 'playing';
      setScreen('playing');
      engine.startMatch({
        mode: 'chapter',
        chapterIndex: initialSave.currentChapter,
        duelIndex: initialSave.currentDuel,
        p1CharacterId: initialSave.selectedCharacterId,
        withInkWipe: false,
      });
    } else {
      document.body.dataset.state = 'title';
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', Boolean(save.settings.darkMode));
  }, [save.settings.darkMode]);

  const launchMatchImmediate = useCallback(
    (params: { mode: GameMode; p1CharId: string; p2CharId?: string }) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setShowTitleSettings(false);
      document.body.dataset.state = 'playing';
      setScreen('playing');
      engineRef.current?.startMatch({
        mode: params.mode,
        chapterIndex: save.currentChapter,
        duelIndex: save.currentDuel,
        p1CharacterId: params.p1CharId,
        p2CharacterId: params.p2CharId,
        withInkWipe: true,
      });
    },
    [save.currentChapter, save.currentDuel],
  );

  const handleOpenCharacterSelect = useCallback((mode: GameMode) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowTitleSettings(false);
    setPendingMode(mode);
    syncScreen('character_select');
  }, [syncScreen]);

  const handleLockInCharacter = useCallback(
    (p1CharId: string, explicitP2Id?: string) => {
      const chapter = CHAPTERS[save.currentChapter] ?? CHAPTERS[0];
      const duel = chapter.duels[save.currentDuel] ?? chapter.duels[0];

      if (pendingMode === 'chapter') {
        const p2CharId = duel.isEcho ? p1CharId : duel.characterId;
        setMatchup({
          mode: 'chapter',
          p1CharId,
          p2CharId,
          p2Name: duel.name,
          p2Title: duel.title,
          isEcho: duel.isEcho,
        });
      } else if (pendingMode === 'versus') {
        const p2CharId = explicitP2Id ?? (p1CharId === 'tomoe' ? 'kenshin' : 'tomoe');
        const p2Cfg = getCharacterConfig(p2CharId);
        setMatchup({
          mode: 'versus',
          p1CharId,
          p2CharId,
          p2Name: p2Cfg.name,
          p2Title: p2Cfg.title,
          isEcho: false,
        });
      } else {
        const p2CharId = explicitP2Id ?? 'benkei';
        const p2Cfg = getCharacterConfig(p2CharId);
        setMatchup({
          mode: 'dojo',
          p1CharId,
          p2CharId,
          p2Name: `Dojo · ${p2Cfg.name}`,
          p2Title: p2Cfg.title,
          isEcho: false,
        });
      }
      syncScreen('vs_splash');
    },
    [pendingMode, save.currentChapter, save.currentDuel, syncScreen],
  );

  const handleStartFightFromSplash = useCallback(() => {
    if (!matchup) return;
    launchMatchImmediate({
      mode: matchup.mode,
      p1CharId: matchup.p1CharId,
      p2CharId: matchup.p2CharId,
    });
  }, [matchup, launchMatchImmediate]);

  const handleTogglePause = useCallback(() => {
    if (!engineRef.current) return;
    if (screen === 'playing') {
      engineRef.current.clearHeldInputs();
      syncScreen('paused');
    } else if (screen === 'paused') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      syncScreen('playing');
    }
  }, [screen, syncScreen]);

  const handleToggleMute = useCallback(() => {
    setSave((prev) => {
      const nextVol = prev.settings.volume > 0 ? 0 : 0.65;
      const next = updateSettings(prev, { volume: nextVol });
      engineRef.current?.updateSave(next);
      return next;
    });
  }, []);

  // Global keyboard shortcuts (Enter/Space on Title, Esc for Pause, M for Mute; KeyP stays free for Ultimate!)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (screen === 'title' && !showTitleSettings) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleOpenCharacterSelect('chapter');
        }
      } else if (screen === 'playing' || screen === 'paused') {
        if (e.code === 'Escape') {
          e.preventDefault();
          handleTogglePause();
        } else if (e.code === 'KeyM' && screen === 'playing' && hud?.mode !== 'versus') {
          e.preventDefault();
          handleToggleMute();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    showTitleSettings,
    hud?.mode,
    handleOpenCharacterSelect,
    handleTogglePause,
    handleToggleMute,
  ]);

  const handleUpdateSettings = (patch: Partial<GameSettings>) => {
    setSave((prev) => {
      const next = updateSettings(prev, patch);
      engineRef.current?.updateSave(next);
      return next;
    });
  };

  const handleUnlockSkill = (skillId: string) => {
    setSave((prev) => {
      const next = unlockSkill(prev, skillId);
      engineRef.current?.updateSave(next);
      return next;
    });
  };

  const handleEquipSkill = (skillId: string, slot: 0 | 1 | 2) => {
    setSave((prev) => {
      const next = equipSkillToSlot(prev, skillId, slot);
      engineRef.current?.updateSave(next);
      return next;
    });
  };

  const handleSelectCharacter = (characterId: string) => {
    setSave((prev) => {
      const next = selectCharacter(prev, characterId);
      engineRef.current?.updateSave(next);
      return next;
    });
  };

  const handleUnlockCharacter = (characterId: string) => {
    setSave((prev) => {
      const next = unlockCharacter(prev, characterId);
      engineRef.current?.updateSave(next);
      return next;
    });
  };

  const handleReturnTitle = () => {
    setShowTitleSettings(false);
    syncScreen('title');
  };

  const handleContinueAfterMatch = () => {
    if (!hud || !engineRef.current) return;
    if (hud.mode === 'versus') {
      handleOpenCharacterSelect('versus');
      return;
    }
    if (hud.matchStats?.winner === 1 && hud.mode === 'chapter') {
      setSkillTreeReturnTo('story_card');
      syncScreen('skill_tree');
    } else {
      launchMatchImmediate({
        mode: hud.mode,
        p1CharId: save.selectedCharacterId,
      });
    }
  };

  return (
    <main className="relative w-full h-full overflow-hidden bg-[var(--paper)]">
      {/* Isolated Canvas 2D Arena Mount */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          className="block w-full h-full"
        />
      </div>

      {/* Title Screen */}
      {screen === 'title' && (
        <TitleScreen
          save={save}
          onStartMode={handleOpenCharacterSelect}
          onOpenRoster={() => handleOpenCharacterSelect('chapter')}
          onOpenSkillTree={() => {
            setSkillTreeReturnTo('title');
            syncScreen('skill_tree');
          }}
          onOpenSettings={() => setShowTitleSettings(true)}
        />
      )}

      {/* Title Settings Modal */}
      {screen === 'title' && showTitleSettings && (
        <PauseModal
          save={save}
          isSettingsOnly
          onUpdateSettings={handleUpdateSettings}
          onResume={() => setShowTitleSettings(false)}
          onReturnTitle={() => setShowTitleSettings(false)}
        />
      )}

      {/* MOBA Character Select Screen */}
      {screen === 'character_select' && (
        <CharacterSelectModal
          save={save}
          mode={pendingMode}
          onSelectCharacter={handleSelectCharacter}
          onUnlockCharacter={handleUnlockCharacter}
          onLockIn={handleLockInCharacter}
          onBack={handleReturnTitle}
        />
      )}

      {/* Dramatic VS Splash Screen */}
      {screen === 'vs_splash' && matchup && (
        <VSSplashModal
          p1CharacterId={matchup.p1CharId}
          p2CharacterId={matchup.p2CharId}
          p2DisplayName={matchup.p2Name}
          p2Title={matchup.p2Title}
          isEchoDuel={matchup.isEcho}
          mode={matchup.mode}
          chapterIndex={save.currentChapter}
          duelIndex={save.currentDuel}
          darkMode={save.settings.darkMode}
          onStartFight={handleStartFightFromSplash}
        />
      )}

      {/* Active Gameplay HUD */}
      {screen === 'playing' && hud && (
        <BattleHUD
          hud={hud}
          save={save}
          engineRef={engineRef}
          onPause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Pause Modal */}
      {screen === 'paused' && (
        <PauseModal
          save={save}
          onUpdateSettings={handleUpdateSettings}
          onResume={() => syncScreen('playing')}
          onRestart={() =>
            launchMatchImmediate({
              mode: hud?.mode ?? 'chapter',
              p1CharId: save.selectedCharacterId,
            })
          }
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Match Over Modal */}
      {screen === 'match_over' && hud?.matchStats && (
        <MatchOverModal
          stats={hud.matchStats}
          save={save}
          chapterIndex={hud.chapterIndex}
          isVersus={hud.mode === 'versus'}
          onContinue={handleContinueAfterMatch}
          onOpenSkillTree={() => {
            setSkillTreeReturnTo('match_over');
            syncScreen('skill_tree');
          }}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Skill Constellation Modal */}
      {screen === 'skill_tree' && (
        <SkillTreeModal
          save={save}
          onUnlock={handleUnlockSkill}
          onEquip={handleEquipSkill}
          continueLabel={skillTreeReturnTo === 'story_card' ? 'Next' : 'Back'}
          onClose={() => syncScreen(skillTreeReturnTo)}
        />
      )}

      {/* Between-Chapters Ink-Painted Story Card */}
      {screen === 'story_card' && (
        <StoryCardModal
          save={save}
          chapterIndex={save.currentChapter}
          duelIndex={save.currentDuel}
          onEnterDuel={() => handleLockInCharacter(save.selectedCharacterId)}
          onOpenSkillTree={() => {
            setSkillTreeReturnTo('story_card');
            syncScreen('skill_tree');
          }}
          onBackToTitle={handleReturnTitle}
        />
      )}
    </main>
  );
}
