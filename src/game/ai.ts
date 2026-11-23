/**
 * KATA: Ink & Echo — Enemy & Echo Boss AI State Machine
 * Supports distinct personalities (balanced, aggressive, defensive, trickster, zoner, grappler, echo)
 * and replays the player's learned EchoProfile habits during boss encounters.
 */

import { getCharacterConfig } from './characters';
import { getSkillKitForSlot } from './combat';
import {
  EchoProfile,
  FighterState,
  InputSnapshot,
  StanceId,
} from './types';

export function emptyInput(): InputSnapshot {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    block: false,
    justLight: false,
    justHeavy: false,
    justDash: false,
    justJump: false,
    justBlock: false,
    justStancePrev: false,
    justStanceNext: false,
    justStanceCrane: false,
    justStanceTiger: false,
    justStanceSerpent: false,
    justSkill0: false,
    justSkill1: false,
    justSkill2: false,
    justUltimate: false,
  };
}

function mapEchoTokenToQueue(
  token: string,
): FighterState['aiComboQueue'][number] | null {
  switch (token) {
    case 'L':
      return 'light';
    case 'H':
      return 'heavy';
    case 'C':
      return 'crouch';
    case 'A':
      return 'jump';
    case 'D_FWD':
      return 'dash_fwd';
    case 'D_BACK':
      return 'dash_back';
    case 'PARRY':
      return 'block';
    case 'SK0':
      return 'skill_0';
    case 'SK1':
      return 'skill_1';
    case 'SK2':
      return 'skill_2';
    case 'ULT':
      return 'ultimate';
    case 'STANCE':
      return 'stance';
    default:
      return null;
  }
}

export function pickWeightedStance(weights: Record<StanceId, number>, rng: () => number): StanceId {
  const r = rng();
  if (r < weights.crane) return 'crane';
  if (r < weights.crane + weights.tiger) return 'tiger';
  return 'serpent';
}

/**
 * Generates an InputSnapshot for an AI-controlled fighter based on its personality,
 * difficulty, current state machine phase, and (for Echo bosses) the player's EchoProfile.
 */
export function computeAIInput(params: {
  ai: FighterState;
  opponent: FighterState;
  dt: number;
  difficulty: number;
  echoProfile: EchoProfile;
  rng?: () => number;
}): InputSnapshot {
  const { ai, opponent, dt, difficulty, echoProfile, rng = Math.random } = params;
  const input = emptyInput();

  if (ai.hp <= 0 || ai.action === 'ko' || ai.action === 'victory') {
    return input;
  }

  const aiChar = getCharacterConfig(ai.characterId);
  const strikeReach = Math.round(165 * aiChar.basicReach);
  const dx = opponent.x - ai.x;
  const dist = Math.abs(dx);
  const towardLeft = dx < 0;
  const oppAttacking =
    opponent.currentMove !== null && opponent.actionTimer < opponent.currentMove.startup + 0.14;

  ai.aiTimer -= dt;
  ai.aiReactionCooldown = Math.max(0, ai.aiReactionCooldown - dt);

  // 1. Reactive defense / parry / punish check
  if (oppAttacking && dist < 185 && ai.aiReactionCooldown <= 0 && ai.grounded) {
    const baseGuardChance =
      ai.personality === 'defensive'
        ? 0.6
        : ai.personality === 'echo'
          ? echoProfile.parryTendency * 0.9
          : ai.personality === 'aggressive'
            ? 0.22
            : 0.36;

    const scaledChance = Math.min(0.88, baseGuardChance * (0.55 + difficulty * 0.65));
    ai.aiReactionCooldown = Math.max(0.18, 0.52 - difficulty * 0.3);

    if (rng() < scaledChance) {
      ai.aiState = 'defend';
      ai.aiTimer = 0.24 + rng() * 0.16;
      const parryAttemptChance =
        ai.personality === 'echo'
          ? echoProfile.parryTendency * difficulty
          : Math.max(0.05, (difficulty - 0.3) * 0.45);
      if (rng() < parryAttemptChance) {
        input.justBlock = true;
      }
      input.block = true;
      if (rng() < 0.25 + difficulty * 0.45) {
        ai.aiComboQueue = ['light', 'heavy'];
      }
      return input;
    } else if (
      (ai.personality === 'trickster' || ai.personality === 'zoner') &&
      ai.dashCooldown <= 0 &&
      rng() < 0.55
    ) {
      if (towardLeft) input.right = true;
      else input.left = true;
      input.justDash = true;
      ai.aiState = 'bait_punish';
      ai.aiTimer = 0.28;
      return input;
    }
  }

  // 2. Execute queued combo actions
  if (ai.aiComboQueue.length > 0 && ai.hitstunTimer <= 0) {
    const canAct =
      ai.action === 'idle' ||
      ai.action === 'walk_fwd' ||
      ai.action === 'walk_back' ||
      ai.action === 'crouch' ||
      (ai.currentMove !== null && ai.moveHitRegistered);

    if (canAct && ai.aiTimer <= 0) {
      const next = ai.aiComboQueue.shift()!;
      const cadenceSec =
        ai.personality === 'echo'
          ? Math.max(0.12, (echoProfile.avgActionIntervalMs / 1000) * 0.72)
          : Math.max(0.14, 0.34 - difficulty * 0.16);
      ai.aiTimer = cadenceSec;

      switch (next) {
        case 'light':
          if (dist < strikeReach) input.justLight = true;
          break;
        case 'heavy':
          if (dist < strikeReach + 25) input.justHeavy = true;
          break;
        case 'crouch':
          input.down = true;
          if (dist < strikeReach) input.justLight = true;
          break;
        case 'jump':
          input.justJump = true;
          if (towardLeft) input.left = true;
          else input.right = true;
          break;
        case 'dash_fwd':
          if (towardLeft) input.left = true;
          else input.right = true;
          input.justDash = true;
          break;
        case 'dash_back':
          if (towardLeft) input.right = true;
          else input.left = true;
          input.justDash = true;
          break;
        case 'block':
          input.justBlock = true;
          input.block = true;
          break;
        case 'stance':
          input.justStanceNext = true;
          break;
        case 'ultimate':
          if (ai.flow >= aiChar.ultimate.flowCost && dist < 340) {
            input.justUltimate = true;
          }
          break;
        case 'skill_0':
        case 'skill_1':
        case 'skill_2': {
          const idx = next === 'skill_0' ? 0 : next === 'skill_1' ? 1 : 2;
          const kit = getSkillKitForSlot(ai, idx);
          if (kit && ai.flow >= kit.flowCost && ai.skillCooldowns[idx] <= 0 && dist < 360) {
            if (idx === 0) input.justSkill0 = true;
            else if (idx === 1) input.justSkill1 = true;
            else input.justSkill2 = true;
          } else if (dist < strikeReach) {
            input.justLight = true;
          }
          break;
        }
      }
      return input;
    }
  }

  // 3. State machine transitions when timer expires
  if (ai.aiTimer <= 0) {
    // High-flow Ultimate trigger opportunity
    if (ai.flow >= aiChar.ultimate.flowCost && dist < 240 && rng() < 0.28 * difficulty) {
      input.justUltimate = true;
      ai.aiTimer = 0.45;
      return input;
    }

    if (ai.personality === 'echo') {
      if (rng() < 0.32) {
        const targetStance = pickWeightedStance(echoProfile.stanceWeights, rng);
        if (targetStance === 'crane') input.justStanceCrane = true;
        else if (targetStance === 'tiger') input.justStanceTiger = true;
        else input.justStanceSerpent = true;
      }

      if (dist > 220) {
        ai.aiState = rng() < echoProfile.dashFrequency + 0.35 ? 'approach' : 'bait_punish';
        ai.aiTimer = 0.25 + rng() * 0.22;
        if (rng() < echoProfile.dashFrequency * 1.4 && ai.dashCooldown <= 0) {
          if (towardLeft) input.left = true;
          else input.right = true;
          input.justDash = true;
        }
      } else if (dist <= strikeReach) {
        if (rng() < echoProfile.aggressionRatio * (0.75 + difficulty * 0.35)) {
          ai.aiState = 'pressure';
          const comboPool = echoProfile.topCombos;
          const chosen = comboPool[Math.floor(rng() * comboPool.length)] ?? ['L', 'L', 'H'];
          ai.aiComboQueue = chosen
            .map(mapEchoTokenToQueue)
            .filter((x): x is NonNullable<typeof x> => x !== null);
          if (rng() < 0.35 && ai.flow >= 22) {
            const favIdx = echoProfile.favoriteSkillIndices[0] ?? 0;
            ai.aiComboQueue.push(
              favIdx === 0 ? 'skill_0' : favIdx === 1 ? 'skill_1' : 'skill_2',
            );
          }
          ai.aiTimer = 0.05;
        } else {
          ai.aiState = rng() < 0.5 ? 'retreat' : 'bait_punish';
          ai.aiTimer = 0.26 + rng() * 0.25;
        }
      } else {
        ai.aiState = 'approach';
        ai.aiTimer = 0.22;
      }
    } else if (ai.personality === 'zoner') {
      // Ranged characters kite back when close & fire shurikens/arrows from mid-far range
      if (dist < 140) {
        ai.aiState = 'retreat';
        ai.aiTimer = 0.28;
        if (ai.flow >= 24 && ai.skillCooldowns[1] <= 0 && rng() < 0.65) {
          input.justSkill1 = true;
        } else if (ai.dashCooldown <= 0 && rng() < 0.5) {
          if (towardLeft) input.right = true;
          else input.left = true;
          input.justDash = true;
        }
      } else if (dist < 420 && ai.flow >= 20 && rng() < 0.55 * (0.6 + difficulty * 0.5)) {
        ai.aiState = 'bait_punish';
        ai.aiTimer = 0.32;
        if (ai.skillCooldowns[0] <= 0) input.justSkill0 = true;
        else if (ai.skillCooldowns[2] <= 0 && ai.flow >= 28) input.justSkill2 = true;
      } else {
        ai.aiState = dist > 380 ? 'approach' : 'bait_punish';
        ai.aiTimer = 0.28;
      }
    } else if (ai.personality === 'grappler') {
      // Chain/Grappler closes gap and fishes for chain yank or shadow throw
      if (dist > 220 && ai.flow >= 22 && ai.skillCooldowns[0] <= 0 && rng() < 0.55) {
        ai.aiState = 'pressure';
        input.justSkill0 = true;
        ai.aiTimer = 0.25;
      } else if (dist < strikeReach) {
        ai.aiState = 'pressure';
        ai.aiComboQueue = ai.flow >= 28 && rng() < 0.5 ? ['light', 'skill_2'] : ['light', 'heavy'];
        ai.aiTimer = 0.08;
      } else {
        ai.aiState = 'approach';
        ai.aiTimer = 0.24;
      }
    } else {
      const aggroBias =
        ai.personality === 'aggressive'
          ? 0.8
          : ai.personality === 'defensive'
            ? 0.36
            : ai.personality === 'trickster'
              ? 0.58
              : 0.55;

      if (dist > 220) {
        ai.aiState = 'approach';
        ai.aiTimer = 0.28 + rng() * 0.22;
        if (
          (ai.personality === 'aggressive' || ai.personality === 'trickster') &&
          ai.dashCooldown <= 0 &&
          rng() < 0.35 * difficulty
        ) {
          if (towardLeft) input.left = true;
          else input.right = true;
          input.justDash = true;
        }
      } else if (dist < strikeReach) {
        if (rng() < aggroBias * (0.65 + difficulty * 0.45)) {
          ai.aiState = 'pressure';
          const roll = rng();
          if (roll < 0.36) {
            ai.aiComboQueue = ['light', 'heavy'];
          } else if (roll < 0.62) {
            ai.aiComboQueue = ['light', 'crouch'];
          } else if (roll < 0.82 && ai.flow >= 22) {
            const sk = rng() < 0.34 ? 'skill_0' : rng() < 0.67 ? 'skill_1' : 'skill_2';
            ai.aiComboQueue = ['light', sk];
          } else {
            ai.aiComboQueue = ['stance', 'heavy'];
          }
          ai.aiTimer = 0.06;
        } else if (ai.personality === 'trickster' && rng() < 0.5) {
          ai.aiState = 'bait_punish';
          ai.aiComboQueue = ['dash_back', 'skill_0'];
          ai.aiTimer = 0.08;
        } else {
          ai.aiState = 'retreat';
          ai.aiTimer = 0.26 + rng() * 0.25;
        }
      } else {
        ai.aiState = rng() < aggroBias ? 'approach' : 'bait_punish';
        ai.aiTimer = 0.24 + rng() * 0.2;
        if (rng() < 0.28 * difficulty && ai.flow >= 22) {
          input.justSkill1 = true;
        }
      }
    }
  }

  // 4. Continuous movement per active state
  switch (ai.aiState) {
    case 'approach':
    case 'pressure':
      if (dist > 88) {
        if (towardLeft) input.left = true;
        else input.right = true;
      }
      break;
    case 'retreat':
      if (dist < 280) {
        if (towardLeft) input.right = true;
        else input.left = true;
      }
      break;
    case 'defend':
      input.block = true;
      break;
    case 'bait_punish':
      if (dist < 145) {
        if (towardLeft) input.right = true;
        else input.left = true;
      } else if (dist > 220) {
        if (towardLeft) input.left = true;
        else input.right = true;
      }
      break;
  }

  return input;
}
