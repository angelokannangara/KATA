/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArmoryModal } from './components/ArmoryModal';
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
  buyWeapon,
  equipSkillToSlot,
  equipWeapon,
  loadSaveData,
  markPrologueSeen,
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
  const [isPrologueMode, setIsPrologueMode] = useState(false);
  const [matchup, setMatchup] = useState<PendingMatchup | null>(null);
  const [showTitleSettings, setShowTitleSettings] = useState(false);
  const [skillTreeReturnTo, setSkillTreeReturnTo] = useState<'title' | 'story_card' | 'match_over'>(
    'title',
  );
  const [armoryReturnTo, setArmoryReturnTo] = useState<
    'title' | 'character_select' | 'story_card' | 'match_over'
  >('title');
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

  const handleOpenCharacterSelect = useCallback(
    (mode: GameMode) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setShowTitleSettings(false);
      setPendingMode(mode);
      syncScreen('character_select');
    },
    [syncScreen],
  );

  const handleStartModeFromTitle = useCallback(
    (mode: GameMode) => {
      if (mode === 'chapter' && !save.hasSeenPrologue) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setShowTitleSettings(false);
        setPendingMode('chapter');
        setIsPrologueMode(true);
        syncScreen('story_card');
        return;
      }
      handleOpenCharacterSelect(mode);
    },
    [save.hasSeenPrologue, handleOpenCharacterSelect, syncScreen],
  );

  const handleFinishPrologue = useCallback(() => {
    setSave((prev) => {
      const next = markPrologueSeen(prev);
      engineRef.current?.updateSave(next);
      return next;
    });
    setIsPrologueMode(false);
    setPendingMode('chapter');
    syncScreen('character_select');
  }, [syncScreen]);

  const openChapterVSSplash = useCallback(
    (p1CharId: string) => {
      const chapter = CHAPTERS[save.currentChapter] ?? CHAPTERS[0];
      const duel = chapter.duels[save.currentDuel] ?? chapter.duels[0];
      const p2CharId = duel.isEcho ? p1CharId : duel.characterId;
      setMatchup({
        mode: 'chapter',
        p1CharId,
        p2CharId,
        p2Name: duel.name,
        p2Title: duel.title,
        isEcho: duel.isEcho,
      });
      syncScreen('vs_splash');
    },
    [save.currentChapter, save.currentDuel, syncScreen],
  );

  const handleLockInCharacter = useCallback(
    (p1CharId: string, explicitP2Id?: string) => {
      if (pendingMode === 'chapter') {
        setIsPrologueMode(false);
        syncScreen('story_card');
        return;
      }

      if (pendingMode === 'versus') {
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
    [pendingMode, syncScreen],
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
          handleStartModeFromTitle('chapter');
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
    handleStartModeFromTitle,
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

  const handleBuyWeapon = (weaponId: string, currency: 'coins' | 'sp') => {
    setSave((prev) => {
      const next = buyWeapon(prev, weaponId, currency);
      engineRef.current?.updateSave(next);
      return next;
    });
  };

  const handleEquipWeapon = (weaponId: string) => {
    setSave((prev) => {
      const next = equipWeapon(prev, weaponId);
      engineRef.current?.updateSave(next);
      return next;
    });
  };

  const handleReturnTitle = () => {
    setShowTitleSettings(false);
    setIsPrologueMode(false);
    syncScreen('title');
  };

  const handleContinueAfterMatch = () => {
    if (!hud || !engineRef.current) return;
    if (hud.mode === 'versus') {
      handleOpenCharacterSelect('versus');
      return;
    }
    if (hud.matchStats?.winner === 1 && hud.mode === 'chapter') {
      setIsPrologueMode(false);
      syncScreen('story_card');
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
          onStartMode={handleStartModeFromTitle}
          onOpenRoster={() => handleOpenCharacterSelect('chapter')}
          onOpenArmory={() => {
            setArmoryReturnTo('title');
            syncScreen('armory');
          }}
          onOpenStory={() => {
            setIsPrologueMode(true);
            syncScreen('story_card');
          }}
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

      {/* Weapon Armory & Forge */}
      {screen === 'armory' && (
        <ArmoryModal
          save={save}
          onBuyWeapon={handleBuyWeapon}
          onEquipWeapon={handleEquipWeapon}
          onBack={() => syncScreen(armoryReturnTo)}
        />
      )}

      {/* MOBA Character Select Screen */}
      {screen === 'character_select' && (
        <CharacterSelectModal
          save={save}
          mode={pendingMode}
          onSelectCharacter={handleSelectCharacter}
          onUnlockCharacter={handleUnlockCharacter}
          onOpenArmory={() => {
            setArmoryReturnTo('character_select');
            syncScreen('armory');
          }}
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
          onOpenArmory={() => {
            setArmoryReturnTo('match_over');
            syncScreen('armory');
          }}
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

      {/* Pre-Gameplay Prologue & Between-Levels Story Scroll */}
      {screen === 'story_card' && (
        <StoryCardModal
          save={save}
          chapterIndex={save.currentChapter}
          duelIndex={save.currentDuel}
          isPrologue={isPrologueMode}
          onFinishPrologue={handleFinishPrologue}
          onEnterDuel={() => openChapterVSSplash(save.selectedCharacterId)}
          onOpenArmory={() => {
            setArmoryReturnTo('story_card');
            syncScreen('armory');
          }}
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
