/**
 * KATA: Ink & Echo — 60fps Fixed-Timestep Simulation Engine
 * Coordinates input buffering, physics, combat resolution, AI/Echo, camera zoom/shake,
 * hitstop, slow-motion, Ultimate ink flashes, round state, and throttled HUD emission.
 */

import { computeAIInput, emptyInput } from './ai';
import { updateFighterAnimation } from './animation';
import { soundEngine } from './audio';
import { buildCharacterSkillsMeta, getCharacterConfig } from './characters';
import {
  canCancelIntoSkillOrCombo,
  checkMoveHit,
  createFighter,
  getMoveForAction,
  getMovePhase,
  getSkillKitForSlot,
  getTotalMoveDuration,
  resolveAttackHit,
} from './combat';
import { CHAPTERS, CONFIG, SKILL_MAP, STANCE_META } from './config';
import { EchoRecorder } from './echo';
import { InkRenderer } from './renderer';
import { persistSaveData, unlockChapterRewardCharacters } from './save';
import { getWeaponItem } from './weapons';
import {
  ActionKind,
  EchoRecordedToken,
  FighterState,
  GameMode,
  GameScreen,
  HUDCallout,
  HUDState,
  InkClone,
  InputSnapshot,
  MatchStats,
  MoveDefinition,
  Projectile,
  SaveData,
  StanceId,
  UltimateOverlayState,
} from './types';

interface BufferedAction {
  kind:
    | 'light'
    | 'heavy'
    | 'kick'
    | 'dash'
    | 'jump'
    | 'block'
    | 'stance_prev'
    | 'stance_next'
    | 'stance_crane'
    | 'stance_tiger'
    | 'stance_serpent'
    | 'skill_0'
    | 'skill_1'
    | 'skill_2'
    | 'ultimate';
  expiresAt: number;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer = new InkRenderer();
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private accumulator = 0;
  private simTime = 0;
  private roundStartMs = 0;

  private save: SaveData;
  private echoRecorder: EchoRecorder;

  private screen: GameScreen = 'title';
  private mode: GameMode = 'chapter';
  private chapterIndex = 0;
  private duelIndex = 0;
  private roundNumber = 1;
  private roundTimer: number = CONFIG.roundDurationSec;
  private p1Rounds = 0;
  private p2Rounds = 0;
  private announcement = '';
  private announcementKey = 0;
  private announcementTimer = 0;
  private htmlCallouts: (HUDCallout & { expiresAt: number })[] = [];
  private nextCalloutId = 1;
  private roundEndingTimer = 0;
  private roundResolved = false;

  private p1CharacterId = 'kenshin';
  private p2CharacterId = 'tomoe';

  // Ultimate flash state
  private ultimateOverlay: UltimateOverlayState | null = null;
  private ultimateOverlayTimer = 0;

  // Match mastery tracking
  private matchMaxCombo = 0;
  private matchPerfectParries = 0;
  private matchStanceWeaves = 0;
  private matchTookDamageThisRound = false;
  private matchHadNoDamageRound = false;
  private matchStats: MatchStats | null = null;

  // Juice: Hitstop, Slow-Mo, Camera & Ink Transition
  private hitstopTimer = 0;
  private slowMoTimer = 0;
  private timeScale = 1;
  private cameraX = 0;
  private cameraZoom = 1;
  private targetZoom = 1;
  private shakeTrauma = 0;
  private inkTransition = 0;
  private inkTransitionDir: -1 | 0 | 1 = 0;
  private pendingTransitionAction: (() => void) | null = null;

  private p1!: FighterState;
  private p2!: FighterState;
  private projectiles: Projectile[] = [];
  private clones: InkClone[] = [];
  private nextProjId = 1;

  // Dojo frame data tracker
  private dojoLastMove = {
    moveName: 'Ready',
    phase: 'Idle',
    startupF: 0,
    activeF: 0,
    recoveryF: 0,
    damage: 0,
    lastHitBonus: '—',
  };
  private dojoDummyRegenTimer = 0;

  // Input Tracking
  private heldKeys = new Set<string>();
  private p1Buffer: BufferedAction[] = [];
  private p2Buffer: BufferedAction[] = [];
  private touchState = {
    left: false,
    right: false,
    up: false,
    down: false,
    block: false,
  };

  private onHudUpdate: (hud: HUDState) => void;
  private onSaveUpdate: (save: SaveData) => void;
  private hudEmitAccum = 0;

  constructor(params: {
    canvas: HTMLCanvasElement;
    save: SaveData;
    onHudUpdate: (hud: HUDState) => void;
    onSaveUpdate: (save: SaveData) => void;
  }) {
    this.canvas = params.canvas;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    this.ctx = context;
    this.save = params.save;
    this.p1CharacterId = this.save.selectedCharacterId || 'kenshin';
    this.echoRecorder = new EchoRecorder(this.save.echoEvents);
    this.onHudUpdate = params.onHudUpdate;
    this.onSaveUpdate = params.onSaveUpdate;

    this.chapterIndex = Math.min(CHAPTERS.length - 1, this.save.currentChapter);
    this.duelIndex = Math.min(3, this.save.currentDuel);

    soundEngine.setVolume(this.save.settings.volume);
    soundEngine.setMusicEnabled(this.save.settings.musicEnabled);

    this.spawnDemoTitleFighters();
    this.bindInput();
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const clampedDt = Math.min(Math.max(rawDt, 0), 0.05);
      this.stepFrame(clampedDt);
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
    this.emitHud(true);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.unbindInput();
    soundEngine.stopAmbientLoop();
  }

  public updateSave(nextSave: SaveData): void {
    this.save = nextSave;
    this.p1CharacterId = this.save.selectedCharacterId || 'kenshin';
    soundEngine.setVolume(this.save.settings.volume);
    soundEngine.setMusicEnabled(this.save.settings.musicEnabled);
    if (this.p1 && !this.p1.isAI) {
      this.p1.equippedWeaponId = this.save.equippedWeaponId || 'default';
      this.p1.equippedSkills = [...this.getEquippedSkillsForCharacter(this.p1CharacterId)] as [
        string,
        string,
        string,
      ];
    }
    if (this.screen === 'title' || this.screen === 'story_card') {
      if (this.screen === 'title') {
        this.spawnDemoTitleFighters();
      }
      this.render();
    }
  }

  public setScreen(screen: GameScreen): void {
    this.screen = screen;
    if (screen === 'title') {
      this.spawnDemoTitleFighters();
    }
    this.emitHud(true);
  }

  public getScreen(): GameScreen {
    return this.screen;
  }

  private getEquippedSkillsForCharacter(charId: string): [string, string, string] {
    const char = getCharacterConfig(charId);
    return [char.skills[0].id, char.skills[1].id, char.skills[2].id];
  }

  public startMatch(params: {
    mode: GameMode;
    chapterIndex?: number;
    duelIndex?: number;
    p1CharacterId?: string;
    p2CharacterId?: string;
    withInkWipe?: boolean;
  }): void {
    if (params.withInkWipe !== false) {
      soundEngine.init();
      soundEngine.startAmbientLoop();
    }

    const begin = () => {
      this.mode = params.mode;
      this.chapterIndex = params.chapterIndex ?? this.save.currentChapter;
      this.duelIndex = params.duelIndex ?? this.save.currentDuel;
      this.p1CharacterId = params.p1CharacterId ?? this.save.selectedCharacterId ?? 'kenshin';
      if (params.p2CharacterId) {
        this.p2CharacterId = params.p2CharacterId;
      } else if (this.mode === 'chapter') {
        const ch = CHAPTERS[this.chapterIndex] ?? CHAPTERS[0];
        const duel = ch.duels[this.duelIndex] ?? ch.duels[0];
        this.p2CharacterId = duel.isEcho ? this.p1CharacterId : duel.characterId;
      } else if (this.mode === 'versus') {
        this.p2CharacterId = this.p1CharacterId === 'tomoe' ? 'kenshin' : 'tomoe';
      } else {
        this.p2CharacterId = 'benkei';
      }

      this.roundNumber = 1;
      this.p1Rounds = 0;
      this.p2Rounds = 0;
      this.matchMaxCombo = 0;
      this.matchPerfectParries = 0;
      this.matchStanceWeaves = 0;
      this.matchHadNoDamageRound = false;
      this.matchStats = null;
      this.ultimateOverlay = null;
      this.ultimateOverlayTimer = 0;
      this.screen = 'playing';
      this.resetRound();
      this.emitHud(true);
    };

    if (params.withInkWipe) {
      this.triggerInkWipe(begin);
    } else {
      begin();
    }
  }

  public triggerInkWipe(onMidpoint: () => void): void {
    this.inkTransition = 0.01;
    this.inkTransitionDir = 1;
    this.pendingTransitionAction = onMidpoint;
  }

  private spawnDemoTitleFighters(): void {
    const p1Char = getCharacterConfig(this.p1CharacterId);
    const p2Char = getCharacterConfig('tomoe');
    this.p1 = createFighter({
      id: 1,
      characterId: p1Char.id,
      name: p1Char.name,
      x: 430,
      facing: 1,
      isAI: false,
      personality: 'balanced',
      maxHp: p1Char.maxHp,
      stance: p1Char.signatureStance,
      equippedSkills: this.getEquippedSkillsForCharacter(p1Char.id),
      accentColor: p1Char.accentColor,
      equippedWeaponId: this.save.equippedWeaponId || 'default',
    });
    this.p2 = createFighter({
      id: 2,
      characterId: p2Char.id,
      name: p2Char.name,
      x: 770,
      facing: -1,
      isAI: true,
      personality: 'echo',
      maxHp: p2Char.maxHp,
      stance: p2Char.signatureStance,
      equippedSkills: this.getEquippedSkillsForCharacter(p2Char.id),
      accentColor: '#B8861E',
      isEcho: true,
    });
    this.projectiles = [];
    this.clones = [];
  }

  private resetRound(): void {
    const chapter = CHAPTERS[this.chapterIndex] ?? CHAPTERS[0];
    const duel = chapter.duels[this.duelIndex] ?? chapter.duels[0];
    const p1Char = getCharacterConfig(this.p1CharacterId);

    this.p1 = createFighter({
      id: 1,
      characterId: p1Char.id,
      name: p1Char.name,
      x: 380,
      facing: 1,
      isAI: false,
      personality: 'balanced',
      maxHp: p1Char.maxHp,
      stance: p1Char.signatureStance,
      equippedSkills: this.getEquippedSkillsForCharacter(p1Char.id),
      accentColor: p1Char.accentColor,
      equippedWeaponId: this.save.equippedWeaponId || 'default',
    });

    if (this.mode === 'dojo') {
      const dummyChar = getCharacterConfig(this.p2CharacterId || 'benkei');
      this.p2 = createFighter({
        id: 2,
        characterId: dummyChar.id,
        name: `Dojo · ${dummyChar.name}`,
        x: 800,
        facing: -1,
        isAI: false,
        personality: 'defensive',
        maxHp: dummyChar.maxHp,
        stance: dummyChar.signatureStance,
        equippedSkills: this.getEquippedSkillsForCharacter(dummyChar.id),
        accentColor: dummyChar.accentColor,
      });
    } else if (this.mode === 'versus') {
      const p2Char = getCharacterConfig(this.p2CharacterId);
      this.p2 = createFighter({
        id: 2,
        characterId: p2Char.id,
        name: p2Char.name,
        x: 820,
        facing: -1,
        isAI: false,
        personality: 'balanced',
        maxHp: p2Char.maxHp,
        stance: p2Char.signatureStance,
        equippedSkills: this.getEquippedSkillsForCharacter(p2Char.id),
        accentColor: p2Char.accentColor,
      });
    } else {
      const p2CharId = duel.isEcho ? p1Char.id : duel.characterId;
      const p2Char = getCharacterConfig(p2CharId);
      this.p2 = createFighter({
        id: 2,
        characterId: p2CharId,
        name: duel.name,
        x: 820,
        facing: -1,
        isAI: true,
        personality: duel.personality,
        maxHp: duel.maxHp,
        stance: duel.isEcho ? p1Char.signatureStance : duel.stance,
        equippedSkills: this.getEquippedSkillsForCharacter(p2CharId),
        accentColor: duel.isEcho ? '#B8861E' : p2Char.accentColor,
        isEcho: duel.isEcho || p2CharId === 'echo',
      });
    }

    this.projectiles = [];
    this.clones = [];
    this.roundTimer = CONFIG.roundDurationSec;
    this.roundStartMs = performance.now();
    this.roundResolved = false;
    this.roundEndingTimer = 0;
    this.matchTookDamageThisRound = false;
    this.hitstopTimer = 0;
    this.slowMoTimer = 0;
    this.ultimateOverlay = null;
    this.ultimateOverlayTimer = 0;
    this.timeScale = 1;
    this.targetZoom = 1;
    this.htmlCallouts = [];
    this.announcement =
      this.mode === 'dojo'
        ? 'TRAINING DOJO'
        : this.mode === 'versus'
          ? `ROUND ${this.roundNumber}`
          : duel.isEcho
            ? `ECHO DUEL · ${duel.name.toUpperCase()}`
            : `ROUND ${this.roundNumber}`;
    this.announcementKey += 1;
    this.announcementTimer = 1.25;
    this.clearHeldInputs();
  }

  public clearHeldInputs(): void {
    this.heldKeys.clear();
    this.p1Buffer = [];
    this.p2Buffer = [];
    this.touchState = { left: false, right: false, up: false, down: false, block: false };
  }

  // ============================================================================
  // TOUCH CONTROLS INJECTION (Mobile & Tablet)
  // ============================================================================

  public setTouchDirectional(dir: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }): void {
    if (dir.up && !this.touchState.up) {
      this.pushBuffer(this.p1Buffer, 'jump');
    }
    this.touchState.left = dir.left;
    this.touchState.right = dir.right;
    this.touchState.up = dir.up;
    this.touchState.down = dir.down;
  }

  public triggerTouchButton(
    action:
      | 'light'
      | 'heavy'
      | 'kick'
      | 'dash'
      | 'block_down'
      | 'block_up'
      | 'stance'
      | 'skill_0'
      | 'skill_1'
      | 'skill_2'
      | 'ultimate',
  ): void {
    soundEngine.init();
    if (action === 'block_down') {
      this.touchState.block = true;
      this.pushBuffer(this.p1Buffer, 'block');
    } else if (action === 'block_up') {
      this.touchState.block = false;
    } else if (action === 'stance') {
      this.pushBuffer(this.p1Buffer, 'stance_next');
    } else {
      this.pushBuffer(this.p1Buffer, action);
    }
  }

  // ============================================================================
  // KEYBOARD INPUT HANDLING
  // ============================================================================

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      if (this.screen === 'playing') {
        e.preventDefault();
      }
    }

    if (e.repeat) return;
    this.heldKeys.add(code);

    if (this.screen !== 'playing') return;
    soundEngine.init();

    // P1 edge-triggered actions (KeyP triggers Character Ultimate!)
    if (code === 'KeyJ') this.pushBuffer(this.p1Buffer, 'light');
    else if (code === 'KeyK') this.pushBuffer(this.p1Buffer, 'heavy');
    else if (code === 'KeyF') this.pushBuffer(this.p1Buffer, 'kick');
    else if (code === 'Space') this.pushBuffer(this.p1Buffer, 'dash');
    else if (code === 'KeyW') this.pushBuffer(this.p1Buffer, 'jump');
    else if (code === 'KeyL') this.pushBuffer(this.p1Buffer, 'block');
    else if (code === 'KeyQ') this.pushBuffer(this.p1Buffer, 'stance_prev');
    else if (code === 'KeyE') this.pushBuffer(this.p1Buffer, 'stance_next');
    else if (code === 'Digit1') this.pushBuffer(this.p1Buffer, 'stance_crane');
    else if (code === 'Digit2') this.pushBuffer(this.p1Buffer, 'stance_tiger');
    else if (code === 'Digit3') this.pushBuffer(this.p1Buffer, 'stance_serpent');
    else if (code === 'KeyU') this.pushBuffer(this.p1Buffer, 'skill_0');
    else if (code === 'KeyI') this.pushBuffer(this.p1Buffer, 'skill_1');
    else if (code === 'KeyO') this.pushBuffer(this.p1Buffer, 'skill_2');
    else if (code === 'KeyP') this.pushBuffer(this.p1Buffer, 'ultimate');

    // P2 edge-triggered actions (Local Versus)
    if (this.mode === 'versus') {
      if (code === 'KeyN' || code === 'Numpad1') this.pushBuffer(this.p2Buffer, 'light');
      else if (code === 'KeyM' || code === 'Numpad2') this.pushBuffer(this.p2Buffer, 'heavy');
      else if (code === 'KeyB' || code === 'Backslash') this.pushBuffer(this.p2Buffer, 'kick');
      else if (code === 'Slash' || code === 'Numpad0') this.pushBuffer(this.p2Buffer, 'dash');
      else if (code === 'ArrowUp') this.pushBuffer(this.p2Buffer, 'jump');
      else if (code === 'Comma' || code === 'Numpad3') this.pushBuffer(this.p2Buffer, 'block');
      else if (code === 'Period' || code === 'NumpadEnter') this.pushBuffer(this.p2Buffer, 'stance_next');
      else if (code === 'Digit7' || code === 'Numpad4') this.pushBuffer(this.p2Buffer, 'skill_0');
      else if (code === 'Digit8' || code === 'Numpad5') this.pushBuffer(this.p2Buffer, 'skill_1');
      else if (code === 'Digit9' || code === 'Numpad6') this.pushBuffer(this.p2Buffer, 'skill_2');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onBlur = () => {
    this.clearHeldInputs();
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.clearHeldInputs();
    }
  };

  private bindInput(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private unbindInput(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private pushBuffer(buf: BufferedAction[], kind: BufferedAction['kind']): void {
    buf.push({ kind, expiresAt: performance.now() + 140 });
  }

  private consumeInputSnapshot(isP1: boolean): InputSnapshot {
    const buf = isP1 ? this.p1Buffer : this.p2Buffer;
    const now = performance.now();
    const snap = emptyInput();

    if (isP1) {
      snap.left = this.heldKeys.has('KeyA') || this.touchState.left;
      snap.right = this.heldKeys.has('KeyD') || this.touchState.right;
      snap.up = this.heldKeys.has('KeyW') || this.touchState.up;
      snap.down = this.heldKeys.has('KeyS') || this.touchState.down;
      snap.block = this.heldKeys.has('KeyL') || this.touchState.block;
    } else {
      snap.left = this.heldKeys.has('ArrowLeft');
      snap.right = this.heldKeys.has('ArrowRight');
      snap.up = this.heldKeys.has('ArrowUp');
      snap.down = this.heldKeys.has('ArrowDown');
      snap.block = this.heldKeys.has('Comma') || this.heldKeys.has('Numpad3');
    }

    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i].expiresAt < now) {
        buf.splice(i, 1);
      }
    }

    while (buf.length > 0) {
      const item = buf.shift()!;
      if (item.kind === 'light') snap.justLight = true;
      else if (item.kind === 'heavy') snap.justHeavy = true;
      else if (item.kind === 'kick') snap.justKick = true;
      else if (item.kind === 'dash') snap.justDash = true;
      else if (item.kind === 'jump') snap.justJump = true;
      else if (item.kind === 'block') snap.justBlock = true;
      else if (item.kind === 'stance_prev') snap.justStancePrev = true;
      else if (item.kind === 'stance_next') snap.justStanceNext = true;
      else if (item.kind === 'stance_crane') snap.justStanceCrane = true;
      else if (item.kind === 'stance_tiger') snap.justStanceTiger = true;
      else if (item.kind === 'stance_serpent') snap.justStanceSerpent = true;
      else if (item.kind === 'skill_0') snap.justSkill0 = true;
      else if (item.kind === 'skill_1') snap.justSkill1 = true;
      else if (item.kind === 'skill_2') snap.justSkill2 = true;
      else if (item.kind === 'ultimate') snap.justUltimate = true;
    }

    return snap;
  }

  // ============================================================================
  // MAIN FIXED-TIMESTEP LOOP
  // ============================================================================

  private stepFrame(realDt: number): void {
    if (this.inkTransitionDir !== 0) {
      this.inkTransition += this.inkTransitionDir * realDt * 3.1;
      if (this.inkTransitionDir === 1 && this.inkTransition >= 1.15) {
        this.inkTransition = 1.15;
        this.inkTransitionDir = -1;
        if (this.pendingTransitionAction) {
          const fn = this.pendingTransitionAction;
          this.pendingTransitionAction = null;
          fn();
        }
      } else if (this.inkTransitionDir === -1 && this.inkTransition <= 0) {
        this.inkTransition = 0;
        this.inkTransitionDir = 0;
      }
    }

    if (this.screen !== 'playing') {
      if (this.screen === 'title' || this.screen === 'story_card') {
        this.simTime += realDt;
        updateFighterAnimation(this.p1, realDt);
        updateFighterAnimation(this.p2, realDt);
        this.cameraX = Math.sin(this.simTime * 0.25) * 40;
        this.render();
      } else if (this.inkTransitionDir !== 0) {
        this.render();
      }
      return;
    }

    if (this.announcementTimer > 0) {
      this.announcementTimer = Math.max(0, this.announcementTimer - realDt);
      if (this.announcementTimer === 0) this.announcement = '';
    }

    if (this.ultimateOverlayTimer > 0 && this.ultimateOverlay) {
      this.ultimateOverlayTimer -= realDt;
      this.ultimateOverlay.progress = Math.min(1, 1 - this.ultimateOverlayTimer / 0.55);
      if (this.ultimateOverlayTimer <= 0) {
        this.ultimateOverlay = null;
      }
    }

    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= realDt;
      if (this.slowMoTimer <= 0) {
        this.timeScale = 1;
        this.targetZoom = 1;
      }
    }

    this.shakeTrauma = Math.max(0, this.shakeTrauma - realDt * 2.6);
    this.cameraZoom += (this.targetZoom - this.cameraZoom) * Math.min(1, realDt * 9);

    if (this.p1.hitFlashTimer > 0) this.p1.hitFlashTimer = Math.max(0, this.p1.hitFlashTimer - realDt);
    if (this.p2.hitFlashTimer > 0) this.p2.hitFlashTimer = Math.max(0, this.p2.hitFlashTimer - realDt);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= realDt;
      this.renderer.updateParticles(realDt * 0.25);
      this.render();
      return;
    }

    const fixedStep = 1 / 60;
    this.accumulator += realDt * this.timeScale;
    let steps = 0;
    while (this.accumulator >= fixedStep && steps < 4) {
      this.simulateTick(fixedStep);
      this.accumulator -= fixedStep;
      steps++;
    }

    this.render();
    this.hudEmitAccum += realDt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private pushHtmlCallout(text: string, side: 'left' | 'right' | 'center', color: string): void {
    const now = performance.now();
    this.htmlCallouts.push({
      id: this.nextCalloutId++,
      text,
      side,
      color,
      expiresAt: now + 900,
    });
    if (this.htmlCallouts.length > 4) {
      this.htmlCallouts.shift();
    }
    this.emitHud(true);
  }

  private simulateTick(dt: number): void {
    this.simTime += dt;
    const nowMs = performance.now();
    if (this.htmlCallouts.length > 0) {
      this.htmlCallouts = this.htmlCallouts.filter((c) => c.expiresAt > nowMs);
    }

    for (const f of [this.p1, this.p2]) {
      if (f.ghostHp > f.hp) {
        f.ghostHp = Math.max(f.hp, f.ghostHp - CONFIG.ghostHpDecaySpeed * dt);
      } else {
        f.ghostHp = f.hp;
      }
      if (f.hp > 0) {
        const echoBonus = f.characterId === 'echo' ? 1.1 : 1;
        f.flow = Math.min(CONFIG.maxFlow, f.flow + CONFIG.passiveFlowPerSec * echoBonus * dt);
      }
      f.dashCooldown = Math.max(0, f.dashCooldown - dt);
      f.invulnTimer = Math.max(0, f.invulnTimer - dt);
      f.counterWindowTimer = Math.max(0, f.counterWindowTimer - dt);
      for (let s = 0; s < 3; s++) {
        f.skillCooldowns[s] = Math.max(0, f.skillCooldowns[s] - dt);
      }
      if (f.comboResetTimer > 0) {
        f.comboResetTimer -= dt;
        if (f.comboResetTimer <= 0) {
          f.comboCount = 0;
          f.lastComboStance = null;
          f.stanceWeaveChain = 0;
        }
      }
    }

    if (this.mode === 'dojo') {
      if (this.p2.hp < this.p2.maxHp && this.p2.hitstunTimer <= 0) {
        this.dojoDummyRegenTimer += dt;
        if (this.dojoDummyRegenTimer > 1.8) {
          this.p2.hp = Math.min(this.p2.maxHp, this.p2.hp + 60 * dt);
        }
      } else {
        this.dojoDummyRegenTimer = 0;
      }
    }

    if (!this.roundResolved && this.mode !== 'dojo') {
      this.roundTimer = Math.max(0, this.roundTimer - dt);
      if (this.roundTimer <= 0) {
        this.resolveRoundTimeout();
      }
    }

    if (this.p1.hp > 0 && this.p2.hp > 0 && !this.roundResolved) {
      if (this.p1.currentMove === null && this.p1.hitstunTimer <= 0) {
        this.p1.facing = this.p2.x >= this.p1.x ? 1 : -1;
      }
      if (this.p2.currentMove === null && this.p2.hitstunTimer <= 0) {
        this.p2.facing = this.p1.x >= this.p2.x ? 1 : -1;
      }
    }

    const p1Input = this.roundResolved ? emptyInput() : this.consumeInputSnapshot(true);
    let p2Input = emptyInput();
    if (!this.roundResolved) {
      if (this.mode === 'versus') {
        p2Input = this.consumeInputSnapshot(false);
      } else if (this.p2.isAI) {
        const chapter = CHAPTERS[this.chapterIndex] ?? CHAPTERS[0];
        const duel = chapter.duels[this.duelIndex] ?? chapter.duels[0];
        p2Input = computeAIInput({
          ai: this.p2,
          opponent: this.p1,
          dt,
          difficulty: duel.difficulty,
          echoProfile: this.save.echoProfile,
        });
      }
    }

    this.applyFighterControl(this.p1, this.p2, p1Input, dt, nowMs, true);
    this.applyFighterControl(this.p2, this.p1, p2Input, dt, nowMs, false);

    this.integratePhysics(this.p1, dt);
    this.integratePhysics(this.p2, dt);
    this.resolveFighterBodySeparation();

    updateFighterAnimation(this.p1, dt);
    updateFighterAnimation(this.p2, dt);

    this.updateMoveEffects(this.p1);
    this.updateMoveEffects(this.p2);

    if (!this.roundResolved) {
      this.checkMeleeCombat(this.p1, this.p2, nowMs);
      this.checkMeleeCombat(this.p2, this.p1, nowMs);
      this.updateProjectiles(dt, nowMs);
      this.updateClones(dt, nowMs);
      this.checkKOState();
    } else {
      this.roundEndingTimer -= dt;
      if (this.roundEndingTimer <= 0) {
        this.advanceAfterRound();
      }
    }

    this.renderer.updateParticles(dt);
    const midX = (this.p1.x + this.p2.x) * 0.5;
    const clampedCamX = Math.max(360, Math.min(CONFIG.arenaWidth - 360, midX));
    this.cameraX += (clampedCamX - CONFIG.arenaWidth * 0.5 - this.cameraX) * Math.min(1, dt * 7);
  }

  private recordEcho(token: EchoRecordedToken): void {
    if (this.mode === 'versus') return;
    this.echoRecorder.record({
      t: Math.round(performance.now() - this.roundStartMs),
      token,
      stance: this.p1.stance,
      dist: Math.round(Math.abs(this.p2.x - this.p1.x)),
      oppAttacking: this.p2.currentMove !== null,
    });
  }

  private applyFighterControl(
    f: FighterState,
    opp: FighterState,
    input: InputSnapshot,
    dt: number,
    nowMs: number,
    isP1: boolean,
  ): void {
    if (f.hp <= 0 || f.action === 'ko' || f.action === 'victory') return;
    const char = getCharacterConfig(f.characterId);
    const berserkSpeed =
      f.characterId === 'oni_hatsu'
        ? 1 + Math.max(0, 1 - f.hp / Math.max(1, f.maxHp)) * 0.18
        : 1;
    const charSpeed = char.speedMult * berserkSpeed;

    if (f.hitstunTimer > 0) {
      f.hitstunTimer -= dt;
      f.blocking = false;
      if (f.hitstunTimer <= 0 && f.grounded) {
        f.action = 'idle';
      }
      return;
    }

    // Stance switching
    const prevStance = f.stance;
    if (input.justStanceCrane) f.stance = 'crane';
    else if (input.justStanceTiger) f.stance = 'tiger';
    else if (input.justStanceSerpent) f.stance = 'serpent';
    else if (input.justStancePrev) {
      const order: StanceId[] = ['crane', 'tiger', 'serpent'];
      f.stance = order[(order.indexOf(f.stance) + 2) % 3];
    } else if (input.justStanceNext) {
      const order: StanceId[] = ['crane', 'tiger', 'serpent'];
      f.stance = order[(order.indexOf(f.stance) + 1) % 3];
    }
    if (f.stance !== prevStance) {
      soundEngine.playStanceSwitch();
      this.renderer.spawnRing(f.x, f.y - 55, STANCE_META[f.stance].color, 10);
      if (isP1) this.recordEcho('STANCE');
    }

    // Active attack move progression
    if (f.currentMove) {
      f.actionTimer += dt;
      const totalDur = getTotalMoveDuration(f.currentMove, f.stance);

      const canChain = canCancelIntoSkillOrCombo(f);
      if (canChain) {
        if (this.tryStartUltimate(f, opp, input, isP1)) return;
        if (this.tryStartSkill(f, opp, input, isP1)) return;
        if (
          input.justKick &&
          f.action !== 'kick_combo' &&
          (f.currentMove.kind === 'light' ||
            f.currentMove.kind === 'heavy' ||
            f.currentMove.kind === 'kick')
        ) {
          this.startMove(f, 'kick_combo', isP1);
          return;
        }
        if (input.justHeavy && f.currentMove.kind === 'light') {
          this.startMove(f, 'heavy', isP1);
          return;
        }
      }

      if (f.actionTimer >= totalDur) {
        f.currentMove = null;
        f.action = f.grounded ? 'idle' : 'jump';
        f.actionTimer = 0;
      }
      return;
    }

    if (f.action === 'dash_fwd' || f.action === 'dash_back') {
      f.actionTimer += dt;
      if (f.actionTimer >= CONFIG.dashDuration) {
        f.action = f.grounded ? 'idle' : 'jump';
        f.actionTimer = 0;
        f.vx *= 0.4;
      }
      return;
    }

    // Try Ultimate (P) then Skills (U / I / O)
    if (this.tryStartUltimate(f, opp, input, isP1)) return;
    if (this.tryStartSkill(f, opp, input, isP1)) return;

    // Dash (Space)
    if (input.justDash && f.dashCooldown <= 0) {
      const movingBack =
        (f.facing === 1 && input.left) || (f.facing === -1 && input.right);
      const dir = movingBack ? -f.facing : f.facing;
      f.action = movingBack ? 'dash_back' : 'dash_fwd';
      f.actionTimer = 0;
      f.vx = dir * CONFIG.dashSpeed * STANCE_META[f.stance].speedMult * charSpeed;
      f.dashCooldown = CONFIG.dashCooldown;
      f.invulnTimer = char.costume.dashStyle === 'flash' ? 0.19 : 0.14;
      f.blocking = false;
      f.flow = Math.min(CONFIG.maxFlow, f.flow + CONFIG.dashFlowGain);
      soundEngine.playWhoosh(false);
      this.renderer.spawnBurst({
        kind: 'dust',
        x: f.x,
        y: CONFIG.groundY - 4,
        count: 6,
        dirX: -dir,
        color: '#8B8275',
      });
      this.pushAfterimage(f, f.accentColor);
      if (isP1) this.recordEcho(movingBack ? 'D_BACK' : 'D_FWD');
      return;
    }

    // Fancy Kicks (F)
    if (input.justKick) {
      if (!f.grounded) {
        this.startMove(f, 'air_kick', isP1);
        return;
      }
      if (input.down) {
        this.startMove(f, 'crouch_kick', isP1);
        return;
      }
      this.startMove(f, 'kick', isP1);
      return;
    }

    // Attacks (Air, Crouch, Light, Heavy)
    if (input.justLight || input.justHeavy) {
      if (!f.grounded) {
        this.startMove(f, 'air', isP1);
        return;
      }
      if (input.down && input.justLight) {
        this.startMove(f, 'crouch', isP1);
        return;
      }
      this.startMove(f, input.justHeavy ? 'heavy' : 'light', isP1);
      return;
    }

    // Block / Perfect Parry (L)
    if (input.block && f.grounded) {
      if (!f.blocking) {
        f.blockStartTime = !f.isAI || input.justBlock ? nowMs : nowMs - 500;
        if (isP1) this.recordEcho('PARRY');
      }
      f.blocking = true;
      f.crouching = input.down;
      f.action = 'block';
      f.vx *= 0.72;
      return;
    } else {
      f.blocking = false;
    }

    // Jump (W)
    if (input.justJump && f.grounded) {
      f.vy = CONFIG.jumpVelocity;
      f.grounded = false;
      f.crouching = false;
      f.action = 'jump';
      f.squashX = 0.84;
      f.squashY = 1.18;
      soundEngine.playWhoosh(false);
      this.renderer.spawnBurst({
        kind: 'dust',
        x: f.x,
        y: CONFIG.groundY,
        count: 5,
        color: '#8B8275',
      });
      if (isP1) this.recordEcho('A');
      return;
    }

    // Crouch (S)
    if (input.down && f.grounded) {
      f.crouching = true;
      f.action = 'crouch';
      f.vx *= 0.7;
      return;
    }
    f.crouching = false;

    // Horizontal Movement (A / D)
    const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (moveDir !== 0) {
      const forward = moveDir === f.facing;
      const spd =
        CONFIG.walkSpeed *
        STANCE_META[f.stance].speedMult *
        charSpeed *
        (forward ? 1 : CONFIG.backWalkFactor);
      f.vx = moveDir * spd;
      if (f.grounded) {
        f.action = forward ? 'walk_fwd' : 'walk_back';
      }
    } else {
      f.vx *= 0.68;
      if (Math.abs(f.vx) < 8) f.vx = 0;
      if (f.grounded) f.action = 'idle';
    }
  }

  private tryStartUltimate(
    f: FighterState,
    opp: FighterState,
    input: InputSnapshot,
    isP1: boolean,
  ): boolean {
    if (!input.justUltimate) return false;
    const char = getCharacterConfig(f.characterId);
    const ult = char.ultimate;
    if (f.flow < ult.flowCost) return false;

    f.flow -= ult.flowCost;
    this.beginMove(f, opp, ult.move, 'ultimate', isP1);

    // Full-screen Ultimate ink flash + dramatic freeze/slow-mo reveal!
    this.ultimateOverlay = {
      active: true,
      progress: 0,
      accentColor: char.accentColor,
      name: ult.name,
      attackerId: f.id,
    };
    this.ultimateOverlayTimer = 0.62;
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.14);
    this.slowMoTimer = 0.48;
    this.timeScale = 0.42;
    this.targetZoom = 1.15;
    soundEngine.playGong();
    this.pushHtmlCallout(
      ult.name.toUpperCase(),
      f.id === 1 ? 'left' : 'right',
      char.accentColor,
    );

    if (isP1) {
      this.recordEcho('ULT');
    }
    this.emitHud(true);
    return true;
  }

  private tryStartSkill(
    f: FighterState,
    opp: FighterState,
    input: InputSnapshot,
    isP1: boolean,
  ): boolean {
    const slot: 0 | 1 | 2 | null = input.justSkill0
      ? 0
      : input.justSkill1
        ? 1
        : input.justSkill2
          ? 2
          : null;
    if (slot === null) return false;

    const kit = getSkillKitForSlot(f, slot);
    if (!kit) return false;
    if (f.skillCooldowns[slot] > 0 || f.flow < kit.flowCost) return false;

    f.flow -= kit.flowCost;
    f.skillCooldowns[slot] = kit.cooldown;
    const actionKind: ActionKind =
      slot === 0 ? 'skill_0' : slot === 1 ? 'skill_1' : 'skill_2';
    this.beginMove(f, opp, kit.move, actionKind, isP1);

    if (isP1) {
      this.recordEcho(slot === 0 ? 'SK0' : slot === 1 ? 'SK1' : 'SK2');
    }
    return true;
  }

  private startMove(
    f: FighterState,
    kind: 'light' | 'heavy' | 'kick' | 'kick_combo' | 'crouch_kick' | 'air_kick' | 'crouch' | 'air',
    isP1: boolean,
  ): void {
    const move = getMoveForAction(f, kind);
    if (!move) return;
    const actionKind: ActionKind =
      kind === 'crouch' || kind === 'crouch_kick'
        ? 'crouch_attack'
        : kind === 'air' || kind === 'air_kick'
          ? 'air_attack'
          : kind;
    const opp = f.id === 1 ? this.p2 : this.p1;
    this.beginMove(f, opp, move, actionKind, isP1);

    if (isP1) {
      const tok: EchoRecordedToken =
        kind === 'kick' || kind === 'kick_combo' || kind === 'crouch_kick' || kind === 'air_kick'
          ? 'FK'
          : kind === 'light'
            ? 'L'
            : kind === 'heavy'
              ? 'H'
              : kind === 'crouch'
                ? 'C'
                : 'A';
      this.recordEcho(tok);
    }
  }

  private beginMove(
    f: FighterState,
    opp: FighterState,
    move: MoveDefinition,
    actionKind: ActionKind,
    isP1: boolean,
  ): void {
    const char = getCharacterConfig(f.characterId);
    f.action = actionKind;
    f.actionTimer = 0;
    f.currentMove = move;
    f.moveHitRegistered = false;
    f.moveHitStep = 0;
    f.blocking = false;
    f.crouching = move.kind === 'crouch';
    f.slashTrail = [];

    if (move.invulnerableDuringStartup) {
      f.invulnTimer = move.startup + 0.06;
    }

    // Heal mechanic (Shiori skills & Sanctuary Ultimate)
    const healAmount = (move.healsHp ?? 0) + (f.characterId === 'shiori' && move.kind === 'skill' ? 5 : 0);
    if (healAmount > 0 && f.hp > 0) {
      f.hp = Math.min(f.maxHp, f.hp + healAmount);
      this.renderer.spawnRing(f.x, f.y - 55, '#2E8B6E', 22);
      this.pushHtmlCallout(`+${healAmount} HP`, f.id === 1 ? 'left' : 'right', '#2E8B6E');
    }

    // Teleport & Clone specials
    if (move.isTeleport) {
      this.pushAfterimage(f, move.inkColor ?? char.accentColor);
      this.renderer.spawnBurst({
        kind: 'ink',
        x: f.x,
        y: f.y - 60,
        count: 14,
        color: '#141311',
      });
      const behindX = opp.x + opp.facing * -64;
      f.x = Math.max(CONFIG.arenaPadding, Math.min(CONFIG.arenaWidth - CONFIG.arenaPadding, behindX));
      f.facing = opp.x >= f.x ? 1 : -1;
    }

    if (move.isClone) {
      this.clones.push({
        owner: f.id,
        x: f.x,
        y: f.y,
        facing: f.facing,
        joints: JSON.parse(JSON.stringify(f.joints)),
        life: 3.0,
        maxLife: 3.0,
        exploded: false,
        color: move.inkColor ?? char.accentColor,
      });
    }

    f.vx = f.facing * move.lungeVelX;
    if (move.lungeVelY) {
      f.vy = move.lungeVelY;
      f.grounded = false;
    }

    if (move.kind === 'skill' || move.kind === 'ultimate' || actionKind === 'kick_combo') {
      soundEngine.playSkillTrigger();
      this.renderer.spawnRing(f.x, f.y - 60, move.inkColor ?? char.accentColor, 14);
      this.pushAfterimage(f, move.inkColor ?? char.accentColor);
    } else {
      soundEngine.playWhoosh(move.kind === 'heavy' || move.kind === 'kick');
    }

    if (isP1) {
      const startupMult = STANCE_META[f.stance].startupMult;
      this.dojoLastMove = {
        moveName: move.name,
        phase: 'Startup',
        startupF: Math.round(move.startup * startupMult * 60),
        activeF: Math.round(move.active * 60),
        recoveryF: Math.round(move.recovery * 60),
        damage: Math.round(move.damage * STANCE_META[f.stance].damageMult * char.damageMult),
        lastHitBonus: this.dojoLastMove.lastHitBonus,
      };
    }
  }

  private pushAfterimage(f: FighterState, color: string): void {
    f.afterimages.push({
      joints: JSON.parse(JSON.stringify(f.joints)),
      facing: f.facing,
      alpha: 0.9,
      color,
      scarf: f.scarf.map((n) => ({ x: n.x, y: n.y })),
    });
    if (f.afterimages.length > 5) f.afterimages.shift();
  }

  private updateMoveEffects(f: FighterState): void {
    if (!f.currentMove) return;
    const char = getCharacterConfig(f.characterId);
    const phase = getMovePhase(f);
    if (f.id === 1) {
      this.dojoLastMove.phase =
        phase === 'startup' ? 'Startup' : phase === 'active' ? 'Active' : 'Recovery';
    }
    if (phase === 'active') {
      const j = f.joints;
      const limb = f.currentMove.activeLimb;
      const pt =
        limb === 'weaponTip'
          ? f.weaponTip ?? j.handR
          : limb === 'footR' || limb === 'bothFeet'
            ? j.footR
            : limb === 'footL'
              ? j.footL
              : limb === 'handL'
                ? j.handL
                : limb === 'torso'
                  ? j.shoulder
                  : j.handR;
      const color = f.currentMove.inkColor ?? char.accentColor;
      f.slashTrail.push({
        x: pt.x,
        y: pt.y,
        alpha: 1,
        width:
          f.currentMove.kind === 'ultimate'
            ? 16
            : f.currentMove.kind === 'heavy' ||
                f.currentMove.kind === 'skill' ||
                f.currentMove.spinArc
              ? 11
              : 6,
        color,
        style: f.currentMove.trailStyle ?? char.trailStyle,
      });
      if (f.slashTrail.length > 14) f.slashTrail.shift();

      if (f.currentMove.spinArc && Math.random() < 0.35) {
        this.pushAfterimage(f, color);
      }

      if (
        (f.currentMove.kind === 'skill' || f.currentMove.kind === 'ultimate') &&
        Math.random() < 0.45
      ) {
        this.pushAfterimage(f, color);
      }

      // Spawn projectiles (arrows/shuriken/kunai/waves)
      if (f.currentMove.spawnsProjectile && f.moveHitStep === 0) {
        f.moveHitStep = 1;
        const projKind =
          char.weapon.kind === 'bow'
            ? 'arrow'
            : char.weapon.kind === 'twin_kunai'
              ? 'kunai'
              : f.characterId === 'kasumi'
                ? 'shuriken'
                : 'wave';

        const volleyCount = f.currentMove.isUltimate && char.weapon.kind === 'bow' ? 3 : 1;
        for (let v = 0; v < volleyCount; v++) {
          this.projectiles.push({
            id: this.nextProjId++,
            owner: f.id,
            x: pt.x + f.facing * (18 + v * 28),
            y: pt.y + (v - (volleyCount - 1) * 0.5) * 20,
            vx: f.facing * (projKind === 'arrow' ? 720 : 590),
            vy: (v - (volleyCount - 1) * 0.5) * 40,
            radius: projKind === 'arrow' || projKind === 'kunai' ? 16 : 24,
            damage: Math.round(f.currentMove.damage * (volleyCount > 1 ? 0.9 : 0.72)),
            hitstun: 0.3,
            knockbackX: 250,
            life: 0,
            maxLife: 1.15,
            color,
            active: true,
            kind: projKind,
          });
        }
      }
    }
  }

  private integratePhysics(f: FighterState, dt: number): void {
    f.x += f.vx * dt;
    if (!f.grounded || f.vy !== 0) {
      f.vy += CONFIG.gravity * dt;
      f.y += f.vy * dt;
      if (f.y >= CONFIG.groundY) {
        const impactVy = f.vy;
        f.y = CONFIG.groundY;
        f.vy = 0;
        f.grounded = true;
        if (impactVy > 220) {
          f.squashX = 1.2;
          f.squashY = 0.8;
          soundEngine.playStep();
          this.renderer.spawnBurst({
            kind: 'dust',
            x: f.x,
            y: CONFIG.groundY,
            count: 6,
            color: '#8B8275',
          });
        }
        if (f.action === 'jump' || f.action === 'air_attack') {
          f.currentMove = null;
          f.action = 'idle';
        }
      }
    }

    f.x = Math.max(CONFIG.arenaPadding, Math.min(CONFIG.arenaWidth - CONFIG.arenaPadding, f.x));
    if (f.grounded && (f.hitstunTimer > 0 || f.action === 'ko')) {
      f.vx *= Math.exp(-8 * dt);
    }
  }

  private resolveFighterBodySeparation(): void {
    const minDist = 48;
    const dx = this.p2.x - this.p1.x;
    const dist = Math.abs(dx);
    if (dist < minDist && Math.abs(this.p1.y - this.p2.y) < 90) {
      const push = (minDist - dist) * 0.5;
      const sign = dx >= 0 ? 1 : -1;
      this.p1.x = Math.max(CONFIG.arenaPadding, this.p1.x - sign * push);
      this.p2.x = Math.min(CONFIG.arenaWidth - CONFIG.arenaPadding, this.p2.x + sign * push);
    }
  }

  private checkMeleeCombat(attacker: FighterState, defender: FighterState, nowMs: number): void {
    const move = attacker.currentMove;
    if (!move || getMovePhase(attacker) !== 'active') return;

    const maxHits = move.multiHitCount ?? 1;
    if (maxHits === 1 && attacker.moveHitRegistered) return;

    if (maxHits > 1) {
      const sTime = move.startup * STANCE_META[attacker.stance].startupMult;
      const activeProgress =
        Math.max(0, attacker.actionTimer - sTime) / Math.max(0.01, move.active);
      const targetStep = Math.floor(activeProgress * maxHits);
      if (targetStep < attacker.moveHitStep || attacker.moveHitStep >= maxHits) {
        return;
      }
    }

    const collision = checkMoveHit(attacker, defender);
    if (!collision.hit) return;

    attacker.moveHitRegistered = true;
    attacker.moveHitStep += 1;

    const res = resolveAttackHit({
      attacker,
      defender,
      move,
      hitX: collision.hitX,
      hitY: collision.hitY,
      nowMs,
    });

    if (!res.connected) return;

    this.applyImpactJuice(
      attacker,
      defender,
      res,
      move.inkColor ?? getCharacterConfig(attacker.characterId).accentColor,
    );
  }

  private applyImpactJuice(
    attacker: FighterState,
    defender: FighterState,
    res: ReturnType<typeof resolveAttackHit>,
    accentColor: string,
  ): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, res.hitstop);
    if (this.save.settings.screenShake) {
      this.shakeTrauma = Math.min(1, this.shakeTrauma + res.shake / 14);
    }

    if (res.parried) {
      soundEngine.playParryClang();
      this.slowMoTimer = CONFIG.parrySlowMoDuration;
      this.timeScale = CONFIG.parrySlowMoScale;
      this.targetZoom = 1.12;
      this.renderer.spawnBurst({
        kind: 'spark',
        x: res.hitX,
        y: res.hitY,
        count: 16,
        speedMin: 180,
        speedMax: 440,
        color: '#B8861E',
      });
      this.renderer.spawnRing(res.hitX, res.hitY, '#B8861E', 20);
      this.pushHtmlCallout(
        res.countered ? 'COUNTER MIRROR' : 'PARRY',
        defender.id === 1 ? 'left' : 'right',
        '#B8861E',
      );
      if (defender.id === 1) {
        this.matchPerfectParries += 1;
      }
      return;
    }

    if (res.blocked) {
      soundEngine.playBlock();
      this.renderer.spawnBurst({
        kind: 'spark',
        x: res.hitX,
        y: res.hitY,
        count: 6,
        dirX: -attacker.facing,
        color: '#524D46',
      });
      return;
    }

    const heavy = res.damage >= 16;
    soundEngine.playHit(heavy);
    const inkColor = this.save.settings.darkMode ? '#EAE3D4' : '#141311';
    this.renderer.spawnBurst({
      kind: 'ink',
      x: res.hitX,
      y: res.hitY,
      count: heavy ? 22 : 11,
      dirX: attacker.facing,
      speedMin: 110,
      speedMax: heavy ? 420 : 280,
      sizeMin: 2.5,
      sizeMax: heavy ? 8.5 : 5.5,
      color: inkColor,
    });
    if (heavy) {
      this.renderer.spawnBurst({
        kind: 'ink',
        x: res.hitX,
        y: res.hitY,
        count: 6,
        dirX: attacker.facing,
        color: accentColor,
      });
    }

    if (res.isStanceWeave) {
      this.matchStanceWeaves += 1;
      this.pushHtmlCallout(
        `WEAVE +${Math.round((CONFIG.stanceWeaveBonusMult - 1) * 100)}%`,
        attacker.id === 1 ? 'left' : 'right',
        STANCE_META[attacker.stance].color,
      );
    }

    if (attacker.id === 1) {
      this.matchMaxCombo = Math.max(this.matchMaxCombo, attacker.comboCount);
      this.dojoLastMove.lastHitBonus = res.isStanceWeave
        ? 'Stance Weave (+25%)'
        : attacker.comboCount > 1
          ? `${attacker.comboCount}-Hit Combo`
          : 'Clean Hit';
    }
    if (defender.id === 1) {
      this.matchTookDamageThisRound = true;
    }
    this.emitHud(true);
  }

  private updateProjectiles(dt: number, nowMs: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.active) {
        this.projectiles.splice(i, 1);
        continue;
      }
      proj.life += dt;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      if (proj.life >= proj.maxLife || proj.x < 0 || proj.x > CONFIG.arenaWidth) {
        proj.active = false;
        continue;
      }

      const attacker = proj.owner === 1 ? this.p1 : this.p2;
      const defender = proj.owner === 1 ? this.p2 : this.p1;
      if (
        defender.invulnTimer <= 0 &&
        Math.abs(proj.x - defender.x) < proj.radius + 26 &&
        Math.abs(proj.y - (defender.y - 68)) < proj.radius + 54
      ) {
        // Projectile Reflect mechanic (Akane War Fan / Shiori Fox Mirror)
        if (
          defender.currentMove?.reflectsProjectiles &&
          getMovePhase(defender) === 'active'
        ) {
          proj.owner = defender.id;
          proj.vx = -proj.vx * 1.15;
          proj.life = 0;
          proj.color = getCharacterConfig(defender.characterId).accentColor;
          soundEngine.playParryClang();
          this.renderer.spawnRing(proj.x, proj.y, proj.color, 20);
          this.pushHtmlCallout('REFLECT', defender.id === 1 ? 'left' : 'right', proj.color);
          continue;
        }

        proj.active = false;
        const syntheticMove: MoveDefinition = {
          ...(attacker.currentMove ?? getMoveForAction(attacker, 'heavy')!),
          damage: proj.damage,
          chipDamage: Math.max(2, Math.round(proj.damage * 0.25)),
          hitstun: proj.hitstun,
          blockstun: 0.16,
          knockbackX: proj.knockbackX,
          knockbackY: -90,
          hitstop: 0.055,
          shake: 6,
          flowGainOnHit: 6,
          spawnsProjectile: true,
        };
        const res = resolveAttackHit({
          attacker,
          defender,
          move: syntheticMove,
          hitX: proj.x,
          hitY: proj.y,
          nowMs,
        });
        this.applyImpactJuice(attacker, defender, res, proj.color);
      }
    }
  }

  private updateClones(dt: number, nowMs: number): void {
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const clone = this.clones[i];
      clone.life -= dt;
      if (clone.life <= 0 || clone.exploded) {
        this.clones.splice(i, 1);
        continue;
      }
      const opp = clone.owner === 1 ? this.p2 : this.p1;
      const owner = clone.owner === 1 ? this.p1 : this.p2;
      if (Math.abs(opp.x - clone.x) < 52 && Math.abs(opp.y - clone.y) < 70 && opp.invulnTimer <= 0) {
        clone.exploded = true;
        soundEngine.playHit(true);
        this.renderer.spawnBurst({
          kind: 'ink',
          x: clone.x,
          y: clone.y - 65,
          count: 20,
          color: '#141311',
        });
        this.renderer.spawnRing(clone.x, clone.y - 65, clone.color, 18);
        const burstMove = {
          ...getMoveForAction(owner, 'heavy')!,
          damage: 14,
          knockbackX: 280,
          knockbackY: -180,
          hitstop: 0.055,
          shake: 7,
        };
        const res = resolveAttackHit({
          attacker: owner,
          defender: opp,
          move: burstMove,
          hitX: clone.x,
          hitY: clone.y - 65,
          nowMs,
        });
        this.applyImpactJuice(owner, opp, res, clone.color);
      }
    }
  }

  private checkKOState(): void {
    if (this.mode === 'dojo') {
      if (this.p2.hp <= 0) {
        this.p2.hp = this.p2.maxHp;
        this.p2.action = 'idle';
      }
      if (this.p1.hp <= 0) {
        this.p1.hp = this.p1.maxHp;
        this.p1.action = 'idle';
      }
      return;
    }

    if (this.p1.hp <= 0 || this.p2.hp <= 0) {
      this.roundResolved = true;
      this.roundEndingTimer = 1.65;
      this.slowMoTimer = CONFIG.koSlowMoDuration;
      this.timeScale = CONFIG.koSlowMoScale;
      this.targetZoom = 1.18;
      soundEngine.playGong();

      if (this.p2.hp <= 0 && this.p1.hp > 0) {
        this.p1Rounds += 1;
        this.p1.action = 'victory';
        if (!this.matchTookDamageThisRound) {
          this.matchHadNoDamageRound = true;
        }
        this.announcement = 'K.O.';
      } else {
        this.p2Rounds += 1;
        if (this.p1.hp <= 0 && this.p2.hp > 0) {
          this.p2.action = 'victory';
        }
        this.announcement = 'K.O.';
      }
      this.announcementKey += 1;
      this.announcementTimer = 1.8;
      this.emitHud(true);
    }
  }

  private resolveRoundTimeout(): void {
    this.roundResolved = true;
    this.roundEndingTimer = 1.4;
    soundEngine.playGong();
    const p1Pct = this.p1.hp / this.p1.maxHp;
    const p2Pct = this.p2.hp / this.p2.maxHp;
    if (p1Pct >= p2Pct) {
      this.p1Rounds += 1;
      this.p1.action = 'victory';
      this.announcement = 'TIME · ROUND WON';
    } else {
      this.p2Rounds += 1;
      this.p2.action = 'victory';
      this.announcement = 'TIME · ROUND LOST';
    }
    this.announcementKey += 1;
    this.announcementTimer = 1.6;
    this.emitHud(true);
  }

  private advanceAfterRound(): void {
    if (this.p1Rounds >= CONFIG.roundsToWin || this.p2Rounds >= CONFIG.roundsToWin) {
      this.finishMatch(this.p1Rounds >= CONFIG.roundsToWin ? 1 : 2);
      return;
    }
    this.roundNumber += 1;
    this.resetRound();
    this.emitHud(true);
  }

  private finishMatch(winner: 1 | 2): void {
    const isChapterClear = this.mode === 'chapter' && winner === 1 && this.duelIndex === 3;
    const isCampaignComplete = isChapterClear && this.chapterIndex >= CHAPTERS.length - 1;

    const winSP =
      winner === 1
        ? CONFIG.spWinBase + (isChapterClear ? CONFIG.spChapterBonus : 0)
        : 10;
    const parrySP = this.matchPerfectParries * CONFIG.spPerPerfectParry;
    const noDmgSP = winner === 1 && this.matchHadNoDamageRound ? CONFIG.spNoDamageRound : 0;
    const comboSP = this.matchMaxCombo >= CONFIG.spComboThreshold ? CONFIG.spComboBonus : 0;
    const totalSP = this.mode === 'versus' ? 0 : winSP + parrySP + noDmgSP + comboSP;

    const winCoins =
      winner === 1
        ? CONFIG.coinsWinBase + (isChapterClear ? CONFIG.coinsChapterBonus : 0)
        : 15;
    const styleCoins =
      this.matchPerfectParries * CONFIG.coinsPerPerfectParry +
      (this.matchMaxCombo >= CONFIG.spComboThreshold ? CONFIG.coinsComboBonus : 0);
    const totalCoins = this.mode === 'versus' ? 0 : winCoins + styleCoins;

    const updatedEchoEvents = this.echoRecorder.getEvents();
    const updatedProfile = this.echoRecorder.analyze();

    let nextChapter = this.save.currentChapter;
    let nextDuel = this.save.currentDuel;
    let highestChapter = this.save.highestChapter;
    let unlockedCharacters = [...this.save.unlockedCharacters];

    if (this.mode === 'chapter' && winner === 1) {
      if (isChapterClear) {
        const rewardIds = unlockChapterRewardCharacters(this.save, this.chapterIndex + 1);
        unlockedCharacters = Array.from(new Set([...unlockedCharacters, ...rewardIds]));
      }
      if (this.duelIndex < 3) {
        nextDuel = this.duelIndex + 1;
      } else if (this.chapterIndex < CHAPTERS.length - 1) {
        nextChapter = this.chapterIndex + 1;
        nextDuel = 0;
        highestChapter = Math.max(highestChapter, nextChapter);
      } else {
        nextChapter = CHAPTERS.length - 1;
        nextDuel = 3;
        highestChapter = CHAPTERS.length - 1;
      }
    }

    this.save = {
      ...this.save,
      spiritPoints: this.save.spiritPoints + totalSP,
      coins: this.save.coins + totalCoins,
      unlockedCharacters,
      currentChapter: nextChapter,
      currentDuel: nextDuel,
      highestChapter,
      totalWins: this.save.totalWins + (winner === 1 && this.mode === 'chapter' ? 1 : 0),
      perfectParries: this.save.perfectParries + this.matchPerfectParries,
      maxComboRecord: Math.max(this.save.maxComboRecord, this.matchMaxCombo),
      echoEvents: updatedEchoEvents,
      echoProfile: updatedProfile,
    };
    persistSaveData(this.save);
    this.onSaveUpdate(this.save);

    const winnerCharId = winner === 1 ? this.p1.characterId : this.p2.characterId;
    const winnerChar = getCharacterConfig(winnerCharId);

    this.matchStats = {
      winner,
      p1CharacterId: this.p1.characterId,
      p2CharacterId: this.p2.characterId,
      victoryQuote: winnerChar.victoryQuote,
      p1Rounds: this.p1Rounds,
      p2Rounds: this.p2Rounds,
      maxCombo: this.matchMaxCombo,
      perfectParries: this.matchPerfectParries,
      noDamageRound: this.matchHadNoDamageRound,
      stanceWeaves: this.matchStanceWeaves,
      spEarned: {
        win: winSP,
        parries: parrySP,
        noDamage: noDmgSP,
        comboBonus: comboSP,
        total: totalSP,
      },
      coinsEarned: {
        win: this.mode === 'versus' ? 0 : winCoins,
        style: this.mode === 'versus' ? 0 : styleCoins,
        total: totalCoins,
      },
      isChapterClear,
      isCampaignComplete,
    };

    this.screen = 'match_over';
    this.emitHud(true);
  }

  private render(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const targetW = Math.max(300, Math.round(rect.width * dpr));
    const targetH = Math.max(200, Math.round(rect.height * dpr));
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const stage = CHAPTERS[this.chapterIndex]?.stage ?? CHAPTERS[0].stage;

    const shakeMag = this.shakeTrauma * this.shakeTrauma * 16;
    const shakeX = (Math.random() * 2 - 1) * shakeMag;
    const shakeY = (Math.random() * 2 - 1) * shakeMag;

    this.renderer.renderFrame({
      ctx: this.ctx,
      width: rect.width,
      height: rect.height,
      stage,
      time: this.simTime,
      cameraX: this.cameraX,
      cameraZoom: this.cameraZoom,
      shakeX,
      shakeY,
      p1: this.p1,
      p2: this.p2,
      projectiles: this.projectiles,
      clones: this.clones,
      inkTransition: this.inkTransition,
      ultimateOverlay: this.ultimateOverlay,
      darkMode: this.save.settings.darkMode,
    });
  }

  private emitHud(force: boolean): void {
    if (!force && this.screen !== 'playing') return;
    const p1Char = getCharacterConfig(this.p1.characterId);
    const skillsMeta = this.p1.equippedSkills.map((id, idx) => {
      const charSkill = p1Char.skills.find((s) => s.id === id) ?? p1Char.skills[idx];
      const node = SKILL_MAP[id];
      return {
        id: charSkill ? charSkill.id : id,
        name: charSkill ? charSkill.name : node ? node.name : 'Skill',
        flowCost: charSkill ? charSkill.flowCost : node ? node.flowCost : 22,
        cooldown: charSkill ? charSkill.cooldown : node ? node.cooldown : 2.5,
        stance: charSkill ? charSkill.move.stance : node ? node.stance : this.p1.stance,
      };
    });

    this.onHudUpdate({
      screen: this.screen,
      mode: this.mode,
      chapterIndex: this.chapterIndex,
      duelIndex: this.duelIndex,
      roundNumber: this.roundNumber,
      roundTimer: Math.ceil(this.roundTimer),
      p1Rounds: this.p1Rounds,
      p2Rounds: this.p2Rounds,
      announcement: this.announcement,
      announcementKey: this.announcementKey,
      callouts: this.htmlCallouts.map(({ id, text, side, color }) => ({ id, text, side, color })),
      ultimateOverlay: this.ultimateOverlay ? { ...this.ultimateOverlay } : null,
      p1: {
        characterId: this.p1.characterId,
        name: this.p1.name,
        hp: Math.round(this.p1.hp),
        maxHp: this.p1.maxHp,
        ghostHp: Math.round(this.p1.ghostHp),
        hitFlashing: this.p1.hitFlashTimer > 0,
        flow: Math.round(this.p1.flow),
        stance: this.p1.stance,
        combo: this.p1.comboCount,
        stanceWeaveChain: this.p1.stanceWeaveChain,
        skillCooldowns: [...this.p1.skillCooldowns] as [number, number, number],
        equippedSkills: [...this.p1.equippedSkills] as [string, string, string],
        skillsMeta: skillsMeta.length
          ? skillsMeta
          : buildCharacterSkillsMeta(this.p1.characterId),
        ultimateName: p1Char.ultimate.name,
        ultimateCost: p1Char.ultimate.flowCost,
        counterActive: this.p1.counterWindowTimer > 0,
        equippedWeaponName: getWeaponItem(this.p1.equippedWeaponId).name,
      },
      p2: {
        characterId: this.p2.characterId,
        name: this.p2.name,
        hp: Math.round(this.p2.hp),
        maxHp: this.p2.maxHp,
        ghostHp: Math.round(this.p2.ghostHp),
        hitFlashing: this.p2.hitFlashTimer > 0,
        flow: Math.round(this.p2.flow),
        stance: this.p2.stance,
        combo: this.p2.comboCount,
        isEcho: this.p2.isEcho,
      },
      dojoFrameData: { ...this.dojoLastMove },
      matchStats: this.matchStats,
    });
  }
}
