/**
 * KATA: Ink & Echo — Combat Mechanics, Weapon-Tip Hitboxes, Character Passives & Stance-Weaving
 * Pure deterministic rules decoupled from rendering for unit testing and 60fps simulation.
 */

import { getCharacterConfig } from './characters';
import { computeJointPositions, createScarf, updateWeaponTransform } from './animation';
import { CONFIG, POSES, SKILL_MAP, STANCE_META, STANCE_MOVES } from './config';
import {
  AIPersonality,
  FighterState,
  MoveDefinition,
  StanceId,
} from './types';

export interface CircleBox {
  x: number;
  y: number;
  r: number;
}

export interface HitResult {
  connected: boolean;
  parried: boolean;
  blocked: boolean;
  countered: boolean;
  damage: number;
  isStanceWeave: boolean;
  hitX: number;
  hitY: number;
  hitstop: number;
  shake: number;
}

export function createFighter(params: {
  id: 1 | 2;
  characterId?: string;
  name: string;
  x: number;
  facing: 1 | -1;
  isAI: boolean;
  personality: AIPersonality;
  maxHp: number;
  stance: StanceId;
  equippedSkills: [string, string, string];
  accentColor: string;
  isEcho?: boolean;
}): FighterState {
  const characterId = params.characterId ?? 'kenshin';
  const char = getCharacterConfig(characterId);

  const rawIdle =
    params.stance === 'tiger'
      ? { ...POSES.idleTiger }
      : params.stance === 'serpent'
        ? { ...POSES.idleSerpent }
        : { ...POSES.idleCrane };
  const initialPose = char.costume.crouchIdle
    ? { ...rawIdle, hipOffsetY: rawIdle.hipOffsetY - 11, torsoAngle: rawIdle.torsoAngle + 0.2 }
    : rawIdle;

  const joints = computeJointPositions(
    params.x,
    CONFIG.groundY,
    params.facing,
    initialPose,
    1,
    1,
    char.proportions,
  );

  const fighter: FighterState = {
    id: params.id,
    characterId,
    name: params.name,
    isAI: params.isAI,
    personality: params.personality,
    x: params.x,
    y: CONFIG.groundY,
    vx: 0,
    vy: 0,
    facing: params.facing,
    hp: params.maxHp,
    maxHp: params.maxHp,
    ghostHp: params.maxHp,
    flow: CONFIG.startingFlow,
    stance: params.stance,
    lastComboStance: null,
    stanceWeaveChain: 0,
    grounded: true,
    crouching: false,
    blocking: false,
    blockStartTime: -99999,
    counterWindowTimer: 0,
    action: 'idle',
    actionTimer: 0,
    currentMove: null,
    moveHitRegistered: false,
    moveHitStep: 0,
    hitstunTimer: 0,
    knockdownTimer: 0,
    invulnTimer: 0,
    dashCooldown: 0,
    hitFlashTimer: 0,
    comboCount: 0,
    comboResetTimer: 0,
    equippedSkills: [...params.equippedSkills] as [string, string, string],
    skillCooldowns: [0, 0, 0],
    animTime: params.id * 1.3,
    walkDistance: 0,
    currentPose: initialPose,
    prevPose: initialPose,
    poseBlend: 1,
    squashX: 1,
    squashY: 1,
    scarf: createScarf(joints.shoulder.x, joints.shoulder.y, 7),
    ponytail:
      char.costume.ponytailLength > 0
        ? createScarf(joints.head.x - params.facing * 10, joints.head.y - 3, 6)
        : [],
    sashTails: char.costume.obiSash ? createScarf(joints.hip.x, joints.hip.y + 4, 5) : [],
    chainTip: { x: joints.handL.x - params.facing * 16, y: joints.handL.y + 24 },
    weaponBase: { x: joints.handR.x, y: joints.handR.y },
    weaponTip: { x: joints.handR.x + params.facing * char.weapon.length, y: joints.handR.y },
    weaponAngle: 0,
    joints,
    slashTrail: [],
    afterimages: [],
    accentColor: params.accentColor,
    isEcho: Boolean(params.isEcho),
    empoweredDrawReady: false,
    aiState: 'approach',
    aiTimer: 0.25,
    aiComboQueue: [],
    aiReactionCooldown: 0,
  };

  updateWeaponTransform(fighter, 1 / 60);
  return fighter;
}

/**
 * Derives hurtbox circles directly from the fighter's animated skeleton joints.
 */
export function getFighterHurtboxes(fighter: FighterState): CircleBox[] {
  const j = fighter.joints;
  const char = getCharacterConfig(fighter.characterId);
  const bulk = char.proportions.limbBulk;
  return [
    { x: j.head.x, y: j.head.y, r: CONFIG.headRadius + 5 },
    {
      x: (j.shoulder.x + j.hip.x) * 0.5,
      y: (j.shoulder.y + j.hip.y) * 0.5,
      r: 22 * bulk,
    },
    { x: j.hip.x, y: j.hip.y, r: 20 * bulk },
    { x: j.kneeL.x, y: j.kneeL.y, r: 13 * bulk },
    { x: j.kneeR.x, y: j.kneeR.y, r: 13 * bulk },
  ];
}

/**
 * Derives active attack hitbox circles directly from the weapon blade tip or animated limb(s).
 */
export function getMoveHitboxes(fighter: FighterState): CircleBox[] {
  const move = fighter.currentMove;
  if (!move) return [];
  const j = fighter.joints;
  const r = move.hitboxRadius;
  const char = getCharacterConfig(fighter.characterId);

  switch (move.activeLimb) {
    case 'weaponTip': {
      const base = fighter.weaponBase ?? j.handR;
      const tip = fighter.weaponTip ?? j.handR;
      const midX = (base.x + tip.x) * 0.5;
      const midY = (base.y + tip.y) * 0.5;
      const boxes: CircleBox[] = [
        { x: tip.x, y: tip.y, r },
        { x: midX, y: midY, r: r * 0.85 },
        { x: base.x, y: base.y, r: r * 0.68 },
      ];
      if (char.weapon.kind === 'kusarigama' && fighter.chainTip) {
        boxes.push({ x: fighter.chainTip.x, y: fighter.chainTip.y, r: r * 0.95 });
      }
      return boxes;
    }
    case 'handR':
      return [
        { x: j.handR.x, y: j.handR.y, r },
        { x: (j.elbowR.x + j.handR.x) * 0.5, y: (j.elbowR.y + j.handR.y) * 0.5, r: r * 0.72 },
      ];
    case 'handL':
      return [{ x: j.handL.x, y: j.handL.y, r }];
    case 'bothHands':
      return [
        { x: j.handR.x, y: j.handR.y, r },
        { x: j.handL.x, y: j.handL.y, r: r * 0.9 },
        ...(fighter.weaponTip ? [{ x: fighter.weaponTip.x, y: fighter.weaponTip.y, r: r * 0.85 }] : []),
      ];
    case 'footR':
      return [
        { x: j.footR.x, y: j.footR.y, r },
        { x: (j.kneeR.x + j.footR.x) * 0.5, y: (j.kneeR.y + j.footR.y) * 0.5, r: r * 0.72 },
      ];
    case 'footL':
      return [{ x: j.footL.x, y: j.footL.y, r }];
    case 'torso':
      return [{ x: j.shoulder.x, y: (j.shoulder.y + j.hip.y) * 0.5, r }];
  }
}

export function circlesIntersect(a: CircleBox, b: CircleBox): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rad = a.r + b.r;
  return dx * dx + dy * dy <= rad * rad;
}

export function checkMoveHit(attacker: FighterState, defender: FighterState): {
  hit: boolean;
  hitX: number;
  hitY: number;
} {
  if (defender.invulnTimer > 0 || defender.hp <= 0) {
    return { hit: false, hitX: 0, hitY: 0 };
  }
  const hitboxes = getMoveHitboxes(attacker);
  const hurtboxes = getFighterHurtboxes(defender);
  for (const hb of hitboxes) {
    for (const tb of hurtboxes) {
      if (circlesIntersect(hb, tb)) {
        return {
          hit: true,
          hitX: (hb.x + tb.x) * 0.5,
          hitY: (hb.y + tb.y) * 0.5,
        };
      }
    }
  }
  return { hit: false, hitX: 0, hitY: 0 };
}

export function getMovePhase(
  fighter: FighterState,
): 'none' | 'startup' | 'active' | 'recovery' {
  const move = fighter.currentMove;
  if (!move) return 'none';
  const sTime = move.startup * STANCE_META[fighter.stance].startupMult;
  if (fighter.actionTimer < sTime) return 'startup';
  if (fighter.actionTimer < sTime + move.active) return 'active';
  return 'recovery';
}

export function getTotalMoveDuration(move: MoveDefinition, stance: StanceId): number {
  return move.startup * STANCE_META[stance].startupMult + move.active + move.recovery;
}

export function canCancelIntoSkillOrCombo(fighter: FighterState): boolean {
  if (
    fighter.action === 'idle' ||
    fighter.action === 'walk_fwd' ||
    fighter.action === 'walk_back' ||
    fighter.action === 'crouch' ||
    fighter.action === 'jump'
  ) {
    return true;
  }
  if (fighter.currentMove && fighter.moveHitRegistered && getMovePhase(fighter) === 'recovery') {
    return true;
  }
  return false;
}

export function getSkillKitForSlot(
  fighter: FighterState,
  slot: 0 | 1 | 2,
): { id: string; name: string; flowCost: number; cooldown: number; move: MoveDefinition } | null {
  const char = getCharacterConfig(fighter.characterId);
  const skillId = fighter.equippedSkills[slot];
  // Match character signature skill kit ID first
  const charSkill = char.skills.find((s) => s.id === skillId);
  if (charSkill) return charSkill;
  // Fallback to constellation skill node if explicitly equipped
  const node = SKILL_MAP[skillId];
  if (node) {
    return {
      id: node.id,
      name: node.name,
      flowCost: node.flowCost,
      cooldown: node.cooldown,
      move: {
        ...node.move,
        activeLimb:
          node.move.activeLimb === 'handR' && char.weapon.kind !== 'iron_claws'
            ? 'weaponTip'
            : node.move.activeLimb,
        trailStyle: char.trailStyle,
      },
    };
  }
  return char.skills[slot] ?? null;
}

export function getMoveForAction(
  fighter: FighterState,
  kind: 'light' | 'heavy' | 'crouch' | 'air' | 'skill_0' | 'skill_1' | 'skill_2' | 'ultimate',
): MoveDefinition | null {
  const char = getCharacterConfig(fighter.characterId);
  if (kind === 'ultimate') {
    return char.ultimate.move;
  }
  if (kind === 'skill_0' || kind === 'skill_1' || kind === 'skill_2') {
    const slot = kind === 'skill_0' ? 0 : kind === 'skill_1' ? 1 : 2;
    return getSkillKitForSlot(fighter, slot)?.move ?? null;
  }
  const base = STANCE_MOVES[fighter.stance][kind];
  const speedRatio = 1 / Math.max(0.75, char.basicSpeed);
  const usesWeaponTip =
    base.activeLimb === 'handR' || base.activeLimb === 'bothHands';
  return {
    ...base,
    startup: Number((base.startup * speedRatio).toFixed(3)),
    hitboxRadius: Math.round(base.hitboxRadius * (0.9 + char.basicReach * 0.14)),
    activeLimb: usesWeaponTip ? 'weaponTip' : base.activeLimb,
    trailStyle: char.trailStyle,
    inkColor: base.inkColor ?? char.accentColor,
  };
}

export function isPerfectParry(defender: FighterState, nowMs: number): boolean {
  return (
    defender.blocking &&
    nowMs - defender.blockStartTime <= CONFIG.perfectParryWindowMs
  );
}

/**
 * Resolves an attack hit against a defender, handling Character Passives,
 * Counter Mirror, Perfect Parry, Guard/Chip, Stance-Weaving, Flow gain, and Knockback/Pulls.
 */
export function resolveAttackHit(params: {
  attacker: FighterState;
  defender: FighterState;
  move: MoveDefinition;
  hitX: number;
  hitY: number;
  nowMs: number;
  damageScale?: number;
}): HitResult {
  const { attacker, defender, move, hitX, hitY, nowMs, damageScale = 1 } = params;
  const attChar = getCharacterConfig(attacker.characterId);
  const defChar = getCharacterConfig(defender.characterId);

  // 1. Check Counter Mirror / Counter Stance
  if (
    defender.currentMove?.isCounter &&
    getMovePhase(defender) === 'active' &&
    !move.isGrab
  ) {
    defender.counterWindowTimer = CONFIG.parryCounterWindowSec;
    defender.flow = Math.min(CONFIG.maxFlow, defender.flow + CONFIG.parryFlowGain);
    if (defender.characterId === 'shiori') {
      defender.hp = Math.min(defender.maxHp, defender.hp + 8);
    }
    if (defender.characterId === 'kenshin') {
      defender.empoweredDrawReady = true;
    }
    attacker.hitstunTimer = 0.55;
    attacker.action = 'hitstun';
    attacker.currentMove = null;
    attacker.vx = -attacker.facing * 260;
    return {
      connected: true,
      parried: true,
      blocked: false,
      countered: true,
      damage: Math.round(move.damage * 0.75),
      isStanceWeave: false,
      hitX,
      hitY,
      hitstop: 0.09,
      shake: 10,
    };
  }

  // 2. Check Perfect Parry (within 155ms of raising guard)
  if (!move.isGrab && isPerfectParry(defender, nowMs)) {
    defender.counterWindowTimer = CONFIG.parryCounterWindowSec;
    defender.flow = Math.min(CONFIG.maxFlow, defender.flow + CONFIG.parryFlowGain);
    if (defender.characterId === 'kenshin') {
      defender.empoweredDrawReady = true;
    }
    if (defender.characterId === 'echo' || defender.isEcho) {
      const stolen = Math.min(attacker.flow, 12);
      attacker.flow -= stolen;
      defender.flow = Math.min(CONFIG.maxFlow, defender.flow + stolen);
    }
    attacker.hitstunTimer = 0.48;
    attacker.action = 'hitstun';
    attacker.currentMove = null;
    attacker.vx = -attacker.facing * 240;
    return {
      connected: true,
      parried: true,
      blocked: false,
      countered: false,
      damage: 0,
      isStanceWeave: false,
      hitX,
      hitY,
      hitstop: 0.085,
      shake: 9,
    };
  }

  // 3. Check standard Block (respecting Low vs Overhead)
  const blockValid =
    defender.blocking &&
    !move.isGrab &&
    !(move.isLow && !defender.crouching) &&
    !(move.isOverhead && defender.crouching);

  if (blockValid) {
    const benkeiGuardMult = defender.characterId === 'benkei' ? 0.5 : 1;
    const chip = Math.max(
      1,
      Math.round(move.chipDamage * damageScale * benkeiGuardMult * defChar.defenseMult),
    );
    defender.hp = Math.max(1, defender.hp - chip);
    defender.hitstunTimer =
      move.blockstun * (attacker.characterId === 'raiden' && move.kind !== 'light' ? 1.2 : 1);
    defender.vx = attacker.facing * move.knockbackX * 0.45;
    defender.flow = Math.min(CONFIG.maxFlow, defender.flow + CONFIG.blockFlowGain);
    attacker.flow = Math.min(CONFIG.maxFlow, attacker.flow + 3);
    return {
      connected: true,
      parried: false,
      blocked: true,
      countered: false,
      damage: chip,
      isStanceWeave: false,
      hitX,
      hitY,
      hitstop: move.hitstop * 0.65,
      shake: move.shake * 0.45,
    };
  }

  // 4. Clean Hit — apply Stance Multiplier + Stance-Weave + Character Passives
  const stanceMult = STANCE_META[attacker.stance].damageMult;
  const isStanceWeave =
    attacker.comboCount > 0 &&
    attacker.lastComboStance !== null &&
    attacker.lastComboStance !== attacker.stance;

  if (isStanceWeave) {
    attacker.stanceWeaveChain += 1;
    const akaneBonus = attacker.characterId === 'akane' ? 5 : 0;
    attacker.flow = Math.min(
      CONFIG.maxFlow,
      attacker.flow + CONFIG.stanceWeaveFlowBonus + akaneBonus,
    );
  } else if (attacker.comboCount === 0) {
    attacker.stanceWeaveChain = 0;
  }

  const weaveMult = isStanceWeave ? CONFIG.stanceWeaveBonusMult : 1;
  const counterMult = attacker.counterWindowTimer > 0 ? 1.3 : 1;

  // Character Passives Damage Modifiers
  let passiveMult = attChar.damageMult * defChar.defenseMult;

  // Kenshin: Empowered draw-cut after parry
  if (attacker.characterId === 'kenshin' && attacker.empoweredDrawReady) {
    passiveMult *= 1.35;
    attacker.empoweredDrawReady = false;
  }

  // Tomoe: +25% backstab damage when hitting from behind defender
  if (attacker.characterId === 'tomoe' && attacker.facing === defender.facing) {
    passiveMult *= 1.25;
  }

  // Oni Hatsu: Berserker scales up to +35% damage as HP drops
  if (attacker.characterId === 'oni_hatsu') {
    const missingRatio = Math.max(0, 1 - attacker.hp / Math.max(1, attacker.maxHp));
    passiveMult *= 1 + missingRatio * 0.35;
  }

  const totalDamage = Math.max(
    1,
    Math.round(move.damage * stanceMult * weaveMult * counterMult * passiveMult * damageScale),
  );

  defender.hp = Math.max(0, defender.hp - totalDamage);
  defender.hitFlashTimer = 0.075;
  defender.currentMove = null;
  defender.blocking = false;

  // Pulls opponent mechanic (Kagero's kusarigama chain pull!)
  if (move.pullsOpponent && defender.hp > 0) {
    const targetX = attacker.x + attacker.facing * 72;
    defender.x = Math.max(
      CONFIG.arenaPadding,
      Math.min(CONFIG.arenaWidth - CONFIG.arenaPadding, (defender.x + targetX) * 0.5),
    );
  }

  if (defender.hp <= 0) {
    defender.action = 'ko';
    defender.knockdownTimer = 2.0;
    defender.vx = attacker.facing * Math.max(280, Math.abs(move.knockbackX) * 1.15);
    defender.vy = Math.min(-260, move.knockbackY - 120);
    defender.grounded = false;
  } else if (move.knockbackY <= -220) {
    defender.action = 'hitstun';
    defender.hitstunTimer = move.hitstun;
    defender.vx = attacker.facing * move.knockbackX;
    defender.vy = move.knockbackY;
    defender.grounded = false;
  } else {
    defender.action = 'hitstun';
    defender.hitstunTimer = move.hitstun;
    defender.vx = attacker.facing * move.knockbackX;
    if (move.knockbackY < 0) {
      defender.vy = move.knockbackY;
      defender.grounded = false;
    }
  }

  attacker.comboCount += 1;
  attacker.comboResetTimer = CONFIG.comboResetSec;
  attacker.lastComboStance = attacker.stance;
  attacker.counterWindowTimer = 0;

  const flowGainBonus =
    attacker.characterId === 'echo'
      ? Math.round(move.flowGainOnHit * 1.15)
      : attacker.characterId === 'kasumi' && move.spawnsProjectile
        ? move.flowGainOnHit + 5
        : move.flowGainOnHit;
  attacker.flow = Math.min(CONFIG.maxFlow, attacker.flow + flowGainBonus);

  // Special Flow-drain moves (Echo Siphon & Kagero Tether)
  if (move.id === 'echo_siphon' || move.id === 'echo_siphon_cut' || attacker.characterId === 'kagero') {
    const drainAmt = attacker.characterId === 'kagero' ? 8 : 22;
    const stolen = Math.min(defender.flow, drainAmt);
    defender.flow -= stolen;
    attacker.flow = Math.min(CONFIG.maxFlow, attacker.flow + Math.round(stolen * 0.6));
  }

  return {
    connected: true,
    parried: false,
    blocked: false,
    countered: attacker.counterWindowTimer > 0,
    damage: totalDamage,
    isStanceWeave,
    hitX,
    hitY,
    hitstop: move.hitstop,
    shake: move.shake,
  };
}
