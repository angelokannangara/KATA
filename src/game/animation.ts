/**
 * KATA: Ink & Echo — Procedural Skeletal Animation, Proportions, Cloth & Weapon Transforms
 * Blends joint-angle poses with easing curves (easeOutBack, easeOutCubic, spring)
 * and computes Forward Kinematics joints + trailing scarf/ponytail/sash/weapon tip physics.
 */

import { getCharacterConfig } from './characters';
import { CONFIG, POSES, STANCE_META } from './config';
import {
  BodyProportions,
  EasingName,
  FighterState,
  JointPositions,
  Pose,
  ScarfNode,
} from './types';

export function applyEasing(t: number, curve: EasingName): number {
  const x = Math.max(0, Math.min(1, t));
  if (x === 0) return 0;
  if (x === 1) return 1;
  switch (curve) {
    case 'easeOutCubic':
      return 1 - Math.pow(1 - x, 3);
    case 'easeOutBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    case 'easeInOutQuad':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'spring': {
      const c4 = (2 * Math.PI) / 3;
      if (x === 0 || x === 1) return x;
      return Math.pow(2, -8 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    }
    default:
      return x;
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hipOffsetY: lerp(a.hipOffsetY, b.hipOffsetY, t),
    torsoAngle: lerp(a.torsoAngle, b.torsoAngle, t),
    headAngle: lerp(a.headAngle, b.headAngle, t),
    shoulderL: lerp(a.shoulderL, b.shoulderL, t),
    elbowL: lerp(a.elbowL, b.elbowL, t),
    shoulderR: lerp(a.shoulderR, b.shoulderR, t),
    elbowR: lerp(a.elbowR, b.elbowR, t),
    hipL: lerp(a.hipL, b.hipL, t),
    kneeL: lerp(a.kneeL, b.kneeL, t),
    hipR: lerp(a.hipR, b.hipR, t),
    kneeR: lerp(a.kneeR, b.kneeR, t),
    scaleX: lerp(a.scaleX ?? 1, b.scaleX ?? 1, t),
    scaleY: lerp(a.scaleY ?? 1, b.scaleY ?? 1, t),
  };
}

export function getIdlePoseForStance(stance: FighterState['stance']): Pose {
  if (stance === 'tiger') return POSES.idleTiger;
  if (stance === 'serpent') return POSES.idleSerpent;
  return POSES.idleCrane;
}

/**
 * Computes the target procedural pose for a fighter's current action & character style.
 */
export function computeTargetPose(fighter: FighterState): Pose {
  const char = getCharacterConfig(fighter.characterId);
  const rawIdle = getIdlePoseForStance(fighter.stance);
  const baseIdle: Pose = char.costume.crouchIdle
    ? {
        ...rawIdle,
        hipOffsetY: rawIdle.hipOffsetY - 11,
        torsoAngle: rawIdle.torsoAngle + 0.2,
        headAngle: rawIdle.headAngle - 0.12,
        hipL: rawIdle.hipL - 0.18,
        kneeL: rawIdle.kneeL - 0.34,
        hipR: rawIdle.hipR + 0.16,
        kneeR: rawIdle.kneeR - 0.32,
      }
    : rawIdle;

  const breatheRate = char.costume.crouchIdle ? 4.0 : 3.0;
  const breathe = Math.sin(fighter.animTime * breatheRate);
  const speedLean = Math.max(-0.22, Math.min(0.28, (fighter.vx * fighter.facing) / 1350));

  // Attack moves use explicit 3-phase anticipation -> strike -> recovery blending
  if (
    fighter.currentMove &&
    (fighter.action === 'light' ||
      fighter.action === 'heavy' ||
      fighter.action === 'crouch_attack' ||
      fighter.action === 'air_attack' ||
      fighter.action === 'skill_0' ||
      fighter.action === 'skill_1' ||
      fighter.action === 'skill_2' ||
      fighter.action === 'ultimate')
  ) {
    const move = fighter.currentMove;
    const startupMult = STANCE_META[fighter.stance].startupMult;
    const sTime = move.startup * startupMult;
    const aTime = move.active;
    const rTime = move.recovery;
    const t = fighter.actionTimer;

    if (t < sTime) {
      const k = applyEasing(t / Math.max(0.01, sTime), 'easeOutCubic');
      return lerpPose(baseIdle, move.anticipationPose, k);
    }
    if (t < sTime + aTime) {
      const localT = (t - sTime) / Math.max(0.01, aTime);
      const k = applyEasing(Math.min(1, localT * 1.45), move.easingIn);
      const pose = lerpPose(move.anticipationPose, move.strikePose, k);
      if ((move.multiHitCount ?? 1) > 1) {
        const osc = Math.sin(localT * Math.PI * (move.multiHitCount ?? 2) * 2);
        pose.shoulderR += osc * 0.45;
        pose.shoulderL -= osc * 0.45;
      }
      return pose;
    }
    const rProgress = (t - sTime - aTime) / Math.max(0.01, rTime);
    const k = applyEasing(rProgress, move.easingOut);
    return lerpPose(move.strikePose, move.recoveryPose, k);
  }

  switch (fighter.action) {
    case 'ko':
    case 'knockdown':
      return { ...POSES.knockdown };
    case 'hitstun':
      return { ...POSES.hitstun };
    case 'victory': {
      // Unique victory pose per weapon/role silhouette
      if (char.costume.crouchIdle) {
        return {
          ...POSES.victory,
          hipOffsetY: -12 + breathe * 1.2,
          torsoAngle: 0.14,
          shoulderL: -0.9,
          elbowL: 1.1,
          shoulderR: 1.55,
          elbowR: 1.25,
          hipL: -0.65,
          kneeL: -0.95,
          hipR: 0.55,
          kneeR: -0.85,
        };
      }
      if (char.weapon.kind === 'naginata' || char.weapon.kind === 'staff') {
        return {
          ...POSES.victory,
          hipOffsetY: 3 + breathe * 1.2,
          torsoAngle: -0.04,
          shoulderR: 1.15,
          elbowR: 0.45,
          shoulderL: -0.45,
          elbowL: 0.75,
        };
      }
      if (char.weapon.kind === 'war_fan') {
        return {
          ...POSES.victory,
          hipOffsetY: 5 + breathe * 1.5,
          torsoAngle: -0.08,
          shoulderR: 2.05,
          elbowR: 0.85,
          shoulderL: -1.1,
          elbowL: 0.5,
        };
      }
      return {
        ...POSES.victory,
        hipOffsetY: POSES.victory.hipOffsetY + breathe * 1.5,
      };
    }
    case 'block':
    case 'parry_counter':
      return {
        ...POSES.block,
        hipOffsetY: POSES.block.hipOffsetY + breathe * 1.2,
      };
    case 'dash_fwd': {
      if (char.costume.dashStyle === 'flash') {
        return {
          ...POSES.dashFwd,
          hipOffsetY: -18,
          torsoAngle: 0.68,
          shoulderL: -1.5,
          shoulderR: -1.35,
          scaleX: 1.18,
          scaleY: 0.86,
        };
      }
      if (char.costume.dashStyle === 'charge') {
        return {
          ...POSES.dashFwd,
          hipOffsetY: -6,
          torsoAngle: 0.42,
          shoulderL: 0.85,
          elbowL: 1.35,
          shoulderR: -0.5,
          scaleX: 1.08,
          scaleY: 0.94,
        };
      }
      return { ...POSES.dashFwd };
    }
    case 'dash_back':
      return { ...POSES.dashBack };
    case 'crouch':
      return {
        ...POSES.crouch,
        hipOffsetY: POSES.crouch.hipOffsetY + breathe * 1.4,
      };
    case 'jump': {
      const airTilt = Math.max(-0.25, Math.min(0.25, fighter.vy / 2400));
      return {
        ...POSES.jump,
        torsoAngle: POSES.jump.torsoAngle + airTilt * 0.4,
        hipL: POSES.jump.hipL - airTilt * 0.5,
      };
    }
    case 'walk_fwd':
    case 'walk_back': {
      const freq = char.costume.walkStyle === 'shinobi' ? 0.068 : char.costume.walkStyle === 'heavy' ? 0.044 : 0.055;
      const stride = Math.sin(fighter.walkDistance * freq);
      const lift = Math.abs(Math.cos(fighter.walkDistance * freq));
      const extraLean = char.costume.walkStyle === 'shinobi' ? 0.2 : char.costume.walkStyle === 'heavy' ? -0.04 : 0.03;
      const stompLift = char.costume.walkStyle === 'heavy' ? 7 : 4.5;
      return {
        ...baseIdle,
        hipOffsetY: baseIdle.hipOffsetY - 4 + lift * stompLift,
        torsoAngle: baseIdle.torsoAngle + speedLean + extraLean,
        headAngle: baseIdle.headAngle - (speedLean + extraLean) * 0.45,
        shoulderL: baseIdle.shoulderL - stride * (char.costume.walkStyle === 'shinobi' ? 0.56 : 0.4),
        shoulderR: baseIdle.shoulderR + stride * (char.costume.walkStyle === 'shinobi' ? 0.28 : 0.38),
        hipL: stride * (char.costume.walkStyle === 'heavy' ? 0.5 : 0.68),
        kneeL: -0.35 - Math.max(0, stride) * 0.55,
        hipR: -stride * (char.costume.walkStyle === 'heavy' ? 0.5 : 0.68),
        kneeR: -0.35 - Math.max(0, -stride) * 0.55,
      };
    }
    default: {
      const sway = Math.sin(fighter.animTime * (char.costume.crouchIdle ? 2.1 : 1.5));
      return {
        ...baseIdle,
        hipOffsetY: baseIdle.hipOffsetY + breathe * (char.costume.crouchIdle ? 2.8 : 2.1),
        torsoAngle: baseIdle.torsoAngle + breathe * 0.03 + sway * 0.02,
        shoulderL: baseIdle.shoulderL + breathe * 0.06,
        shoulderR: baseIdle.shoulderR - breathe * 0.06,
        elbowL: baseIdle.elbowL + breathe * 0.04,
        elbowR: baseIdle.elbowR - breathe * 0.04,
      };
    }
  }
}

/**
 * Forward kinematics: transforms joint angles into world-space 2D limb coordinates,
 * scaling proportions per character while preserving default dimensions when omitted.
 */
export function computeJointPositions(
  x: number,
  y: number,
  facing: 1 | -1,
  pose: Pose,
  squashX = 1,
  squashY = 1,
  proportions?: BodyProportions,
): JointPositions {
  const hScale = proportions?.heightScale ?? 1;
  const armScale = proportions?.armLength ?? 1;
  const legScale = proportions?.legLength ?? 1;

  const torsoLen = CONFIG.torsoLength * hScale;
  const headOffset = (CONFIG.headRadius + 6) * hScale;
  const upperArmLen = CONFIG.upperArmLength * armScale;
  const forearmLen = CONFIG.forearmLength * armScale;
  const thighLen = CONFIG.thighLength * legScale;
  const shinLen = CONFIG.shinLength * legScale;

  const sx = facing * squashX;
  const sy = squashY;
  const baseHipHeight = thighLen + shinLen - 10;
  const hipX = x;
  const hipY = y - (baseHipHeight + pose.hipOffsetY) * sy;

  const torsoAngle = pose.torsoAngle;
  const shoulderX = hipX + Math.sin(torsoAngle) * torsoLen * sx;
  const shoulderY = hipY - Math.cos(torsoAngle) * torsoLen * sy;

  const headAngle = torsoAngle + pose.headAngle;
  const headX = shoulderX + Math.sin(headAngle) * headOffset * sx;
  const headY = shoulderY - Math.cos(headAngle) * headOffset * sy;

  const armLAngle = torsoAngle + pose.shoulderL;
  const elbowLX = shoulderX + Math.sin(armLAngle) * upperArmLen * sx;
  const elbowLY = shoulderY + Math.cos(armLAngle) * upperArmLen * sy;
  const foreLAngle = armLAngle + pose.elbowL;
  const handLX = elbowLX + Math.sin(foreLAngle) * forearmLen * sx;
  const handLY = elbowLY + Math.cos(foreLAngle) * forearmLen * sy;

  const armRAngle = torsoAngle + pose.shoulderR;
  const elbowRX = shoulderX + Math.sin(armRAngle) * upperArmLen * sx;
  const elbowRY = shoulderY + Math.cos(armRAngle) * upperArmLen * sy;
  const foreRAngle = armRAngle + pose.elbowR;
  const handRX = elbowRX + Math.sin(foreRAngle) * forearmLen * sx;
  const handRY = elbowRY + Math.cos(foreRAngle) * forearmLen * sy;

  const thighLAngle = pose.hipL;
  const kneeLX = hipX + Math.sin(thighLAngle) * thighLen * sx;
  const kneeLY = hipY + Math.cos(thighLAngle) * thighLen * sy;
  const shinLAngle = thighLAngle + pose.kneeL;
  const footLX = kneeLX + Math.sin(shinLAngle) * shinLen * sx;
  const footLY = kneeLY + Math.cos(shinLAngle) * shinLen * sy;

  const thighRAngle = pose.hipR;
  const kneeRX = hipX + Math.sin(thighRAngle) * thighLen * sx;
  const kneeRY = hipY + Math.cos(thighRAngle) * thighLen * sy;
  const shinRAngle = thighRAngle + pose.kneeR;
  const footRX = kneeRX + Math.sin(shinRAngle) * shinLen * sx;
  const footRY = kneeRY + Math.cos(shinRAngle) * shinLen * sy;

  return {
    hip: { x: hipX, y: hipY },
    shoulder: { x: shoulderX, y: shoulderY },
    head: { x: headX, y: headY },
    elbowL: { x: elbowLX, y: elbowLY },
    handL: { x: handLX, y: handLY },
    elbowR: { x: elbowRX, y: elbowRY },
    handR: { x: handRX, y: handRY },
    kneeL: { x: kneeLX, y: kneeLY },
    footL: { x: footLX, y: footLY },
    kneeR: { x: kneeRX, y: kneeRY },
    footR: { x: footRX, y: footRY },
  };
}

export function createScarf(anchorX: number, anchorY: number, count = 7): ScarfNode[] {
  const nodes: ScarfNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({ x: anchorX - i * 8, y: anchorY + i * 2, vx: 0, vy: 0 });
  }
  return nodes;
}

function updateChainNodes(
  nodes: ScarfNode[],
  anchorX: number,
  anchorY: number,
  windX: number,
  gravityY: number,
  segLen: number,
  animTime: number,
  vx: number,
  dt: number,
): void {
  if (!nodes.length) return;
  nodes[0].x = anchorX;
  nodes[0].y = anchorY;
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    const prev = nodes[i - 1];
    const flutter = Math.sin(animTime * 8.5 - i * 0.9) * 18;
    n.vx = (n.vx + (windX - vx * 0.08) * dt * 5) * Math.exp(-6 * dt);
    n.vy = (n.vy + (gravityY + flutter) * dt * 4) * Math.exp(-6 * dt);
    n.x += n.vx * dt;
    n.y += n.vy * dt;

    const dx = n.x - prev.x;
    const dy = n.y - prev.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist > segLen) {
      const pull = (dist - segLen) / dist;
      n.x -= dx * pull;
      n.y -= dy * pull;
    }
  }
}

export function updateScarfPhysics(fighter: FighterState, dt: number): void {
  const char = getCharacterConfig(fighter.characterId);
  const windBase = -fighter.facing * 38 - fighter.vx * 0.26 + Math.sin(fighter.animTime * 4.5) * 18;

  // 1. Neck/Shoulder scarf
  updateChainNodes(
    fighter.scarf,
    fighter.joints.shoulder.x - fighter.facing * 4,
    fighter.joints.shoulder.y - 4,
    windBase,
    120,
    9.5,
    fighter.animTime,
    fighter.vx,
    dt,
  );

  // 2. Hair ponytail chain
  if (fighter.ponytail && fighter.ponytail.length > 0 && char.costume.ponytailLength > 0) {
    const segLen = Math.max(5.5, char.costume.ponytailLength / Math.max(1, fighter.ponytail.length - 1));
    updateChainNodes(
      fighter.ponytail,
      fighter.joints.head.x - fighter.facing * 11,
      fighter.joints.head.y - 3,
      windBase * 1.15 - fighter.facing * 16,
      145,
      segLen,
      fighter.animTime + 1.1,
      fighter.vx,
      dt,
    );
  }

  // 3. Obi sash trailing tails (billows sharply on dashes)
  if (fighter.sashTails && fighter.sashTails.length > 0) {
    const dashBoost = fighter.action === 'dash_fwd' || fighter.action === 'dash_back' ? -fighter.facing * 70 : 0;
    updateChainNodes(
      fighter.sashTails,
      fighter.joints.hip.x - fighter.facing * 6,
      fighter.joints.hip.y + 4,
      windBase + dashBoost,
      165,
      8.5,
      fighter.animTime + 2.2,
      fighter.vx,
      dt,
    );
  }
}

/**
 * Computes live world-space weapon base, blade tip, orientation angle, and kusarigama chain tip.
 */
export function updateWeaponTransform(fighter: FighterState, dt: number): void {
  const char = getCharacterConfig(fighter.characterId);
  const j = fighter.joints;
  const hand = j.handR;
  const elbow = j.elbowR;

  // Forearm direction vector
  const fx = hand.x - elbow.x;
  const fy = hand.y - elbow.y;
  const forearmAngle = Math.atan2(fy, fx);

  // Determine how angled the weapon sits relative to the forearm depending on weapon type & state
  const isAttacking =
    fighter.currentMove !== null &&
    (fighter.action === 'light' ||
      fighter.action === 'heavy' ||
      fighter.action === 'crouch_attack' ||
      fighter.action === 'air_attack' ||
      fighter.action === 'skill_0' ||
      fighter.action === 'skill_1' ||
      fighter.action === 'skill_2' ||
      fighter.action === 'ultimate');

  let bladeAngle = forearmAngle;
  const reachMult = char.basicReach;
  const rawLen = char.weapon.length * (0.9 + reachMult * 0.12);

  if (char.weapon.kind === 'katana') {
    // Katana angles gracefully upward at rest and extends forward during draws/cuts
    if (isAttacking) {
      bladeAngle = forearmAngle - fighter.facing * 0.25;
    } else if (fighter.blocking) {
      bladeAngle = -Math.PI * 0.5 - fighter.facing * 0.22;
    } else {
      bladeAngle = forearmAngle - fighter.facing * 0.65;
    }
  } else if (char.weapon.kind === 'odachi') {
    if (isAttacking) {
      bladeAngle = forearmAngle - fighter.facing * 0.15;
    } else {
      // Rested backward over shoulder on idle
      bladeAngle = fighter.facing === 1 ? -Math.PI * 0.78 : -Math.PI * 0.22;
    }
  } else if (char.weapon.kind === 'naginata' || char.weapon.kind === 'staff') {
    bladeAngle = isAttacking ? forearmAngle : forearmAngle - fighter.facing * 0.85;
  } else if (char.weapon.kind === 'bow') {
    // Bow held vertically in front hand
    bladeAngle = fighter.facing === 1 ? -Math.PI * 0.08 : Math.PI * 1.08;
  } else if (char.weapon.kind === 'war_fan') {
    bladeAngle = forearmAngle - fighter.facing * 0.2;
  } else {
    bladeAngle = forearmAngle;
  }

  const base = { x: hand.x, y: hand.y };
  const tip = {
    x: base.x + Math.cos(bladeAngle) * rawLen,
    y: base.y + Math.sin(bladeAngle) * rawLen,
  };

  fighter.weaponBase = base;
  fighter.weaponTip = tip;
  fighter.weaponAngle = bladeAngle;

  // Kusarigama animated weighted chain spring target
  if (char.weapon.kind === 'kusarigama') {
    let targetX = j.handL.x - fighter.facing * 18;
    let targetY = j.handL.y + 28 + Math.sin(fighter.animTime * 4) * 5;
    if (isAttacking && fighter.currentMove?.pullsOpponent) {
      targetX = hand.x + fighter.facing * 125;
      targetY = hand.y - 10;
    } else if (isAttacking) {
      targetX = tip.x + Math.cos(bladeAngle) * 48;
      targetY = tip.y + Math.sin(bladeAngle) * 48;
    }
    const springRate = 1 - Math.exp(-18 * dt);
    fighter.chainTip = {
      x: lerp(fighter.chainTip.x, targetX, springRate),
      y: lerp(fighter.chainTip.y, targetY, springRate),
    };
  } else {
    fighter.chainTip = tip;
  }
}

/**
 * Advances pose blending, squash-and-stretch damping, scaled FK joints, cloth & weapon physics.
 */
export function updateFighterAnimation(fighter: FighterState, dt: number): void {
  const char = getCharacterConfig(fighter.characterId);
  fighter.animTime += dt;
  fighter.walkDistance += Math.abs(fighter.vx) * dt;

  const damp = 1 - Math.exp(-14 * dt);
  const targetPose = computeTargetPose(fighter);
  const blendRate = fighter.currentMove ? 26 : 16;
  fighter.currentPose = lerpPose(fighter.currentPose, targetPose, 1 - Math.exp(-blendRate * dt));

  const targetSX = fighter.currentPose.scaleX ?? 1;
  const targetSY = fighter.currentPose.scaleY ?? 1;
  fighter.squashX = lerp(fighter.squashX, targetSX, damp);
  fighter.squashY = lerp(fighter.squashY, targetSY, damp);

  fighter.joints = computeJointPositions(
    fighter.x,
    fighter.y,
    fighter.facing,
    fighter.currentPose,
    fighter.squashX,
    fighter.squashY,
    char.proportions,
  );

  updateScarfPhysics(fighter, dt);
  updateWeaponTransform(fighter, dt);

  for (let i = fighter.slashTrail.length - 1; i >= 0; i--) {
    fighter.slashTrail[i].alpha -= dt * 4.5;
    if (fighter.slashTrail[i].alpha <= 0) fighter.slashTrail.splice(i, 1);
  }
  for (let i = fighter.afterimages.length - 1; i >= 0; i--) {
    fighter.afterimages[i].alpha -= dt * 3.8;
    if (fighter.afterimages[i].alpha <= 0) fighter.afterimages.splice(i, 1);
  }
}
