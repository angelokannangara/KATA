import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEasing, computeJointPositions, updateFighterAnimation } from './animation';
import { CHARACTERS, CHARACTER_LIST, STARTER_CHARACTER_IDS } from './characters';
import {
  checkMoveHit,
  createFighter,
  getMoveForAction,
  getMoveHitboxes,
  isPerfectParry,
  resolveAttackHit,
} from './combat';
import { CHAPTERS, CONFIG, POSES, SKILL_NODES, STANCE_META } from './config';
import { EchoRecorder } from './echo';
import { computeAIInput } from './ai';
import {
  canUnlockCharacter,
  canUnlockSkill,
  createInitialSaveData,
  equipSkillToSlot,
  selectCharacter,
  unlockCharacter,
  unlockSkill,
} from './save';

test('procedural FK computes grounded skeleton joints cleanly', () => {
  const joints = computeJointPositions(400, CONFIG.groundY, 1, POSES.idleCrane);
  assert.ok(joints.head.y < joints.shoulder.y, 'head should be above shoulder');
  assert.ok(joints.shoulder.y < joints.hip.y, 'shoulder should be above hip');
  assert.ok(joints.footR.y > joints.kneeR.y, 'foot should be below knee');
  assert.equal(applyEasing(0, 'easeOutBack'), 0);
  assert.equal(Math.round(applyEasing(1, 'easeOutCubic')), 1);
});

test('animated limb and weaponTip hitboxes intersect defender hurtboxes when in striking range', () => {
  const p1 = createFighter({
    id: 1,
    characterId: 'kenshin',
    name: 'Kenshin',
    x: 400,
    facing: 1,
    isAI: false,
    personality: 'balanced',
    maxHp: 120,
    stance: 'crane',
    equippedSkills: ['kenshin_quickdraw', 'kenshin_parry_flash', 'kenshin_crescent'],
    accentColor: '#B8292F',
  });
  const p2 = createFighter({
    id: 2,
    characterId: 'benkei',
    name: 'Benkei',
    x: 472,
    facing: -1,
    isAI: true,
    personality: 'defensive',
    maxHp: 145,
    stance: 'tiger',
    equippedSkills: ['benkei_iron_sweep', 'benkei_bastion_charge', 'benkei_sky_bell'],
    accentColor: '#8A5A2B',
  });

  const move = getMoveForAction(p1, 'light')!;
  assert.equal(move.activeLimb, 'weaponTip');
  p1.currentMove = move;
  p1.action = 'light';
  p1.actionTimer = move.startup * STANCE_META.crane.startupMult + 0.03;

  for (let i = 0; i < 12; i++) {
    updateFighterAnimation(p1, 1 / 60);
    updateFighterAnimation(p2, 1 / 60);
  }

  const boxes = getMoveHitboxes(p1);
  assert.ok(boxes.length >= 2, 'weaponTip attack should emit blade span hitboxes');
  const res = checkMoveHit(p1, p2);
  assert.equal(res.hit, true, 'extended katana blade tip hitbox should reach defender hurtbox');
});

test('perfect parry triggers within 155ms window, grants Counter + Flow + Kenshin empowered draw', () => {
  const p1 = createFighter({
    id: 1,
    characterId: 'raiden',
    name: 'Raiden',
    x: 400,
    facing: 1,
    isAI: false,
    personality: 'balanced',
    maxHp: 132,
    stance: 'tiger',
    equippedSkills: ['raiden_thunder_cleave', 'raiden_lightning_arc', 'raiden_sky_breaker'],
    accentColor: '#2B4C7E',
  });
  const p2 = createFighter({
    id: 2,
    characterId: 'kenshin',
    name: 'Kenshin',
    x: 455,
    facing: -1,
    isAI: false,
    personality: 'balanced',
    maxHp: 120,
    stance: 'serpent',
    equippedSkills: ['kenshin_quickdraw', 'kenshin_parry_flash', 'kenshin_crescent'],
    accentColor: '#B8292F',
  });

  p2.blocking = true;
  p2.blockStartTime = 1000;
  assert.equal(isPerfectParry(p2, 1100), true);
  assert.equal(isPerfectParry(p2, 1300), false);

  const move = getMoveForAction(p1, 'heavy')!;
  const initialFlow = p2.flow;
  const hit = resolveAttackHit({
    attacker: p1,
    defender: p2,
    move,
    hitX: 430,
    hitY: 420,
    nowMs: 1090,
  });

  assert.equal(hit.parried, true);
  assert.equal(hit.damage, 0);
  assert.ok(p2.counterWindowTimer > 0, 'defender gains counter window');
  assert.ok(p2.flow > initialFlow, 'defender gains Flow on perfect parry');
  assert.equal(p2.empoweredDrawReady, true, 'Kenshin gains empowered draw-cut on perfect parry');
});

test('character passives modify damage accurately (Tomoe backstab & Oni Hatsu berserker)', () => {
  const tomoe = createFighter({
    id: 1,
    characterId: 'tomoe',
    name: 'Tomoe',
    x: 400,
    facing: 1,
    isAI: false,
    personality: 'trickster',
    maxHp: 108,
    stance: 'crane',
    equippedSkills: ['tomoe_shadow_flicker', 'tomoe_smoke_kunai', 'tomoe_crescent_flurry'],
    accentColor: '#1F6E58',
  });
  const target = createFighter({
    id: 2,
    characterId: 'kenshin',
    name: 'Kenshin',
    x: 445,
    facing: -1,
    isAI: false,
    personality: 'balanced',
    maxHp: 300,
    stance: 'crane',
    equippedSkills: ['kenshin_quickdraw', 'kenshin_parry_flash', 'kenshin_crescent'],
    accentColor: '#B8292F',
  });

  const move = getMoveForAction(tomoe, 'light')!;
  const frontHit = resolveAttackHit({
    attacker: tomoe,
    defender: target,
    move,
    hitX: 430,
    hitY: 420,
    nowMs: 200,
  });

  target.comboCount = 0;
  tomoe.comboCount = 0;
  tomoe.lastComboStance = null;
  target.facing = 1; // Same facing = Tomoe strikes from behind!
  const backHit = resolveAttackHit({
    attacker: tomoe,
    defender: target,
    move,
    hitX: 430,
    hitY: 420,
    nowMs: 2500,
  });

  assert.ok(backHit.damage > frontHit.damage, 'Tomoe backstab must deal bonus damage from behind');

  const hatsu = createFighter({
    id: 1,
    characterId: 'oni_hatsu',
    name: 'Oni Hatsu',
    x: 400,
    facing: 1,
    isAI: false,
    personality: 'aggressive',
    maxHp: 124,
    stance: 'tiger',
    equippedSkills: ['hatsu_frenzy_rend', 'hatsu_oni_pounce', 'hatsu_crimson_maul'],
    accentColor: '#A62126',
  });
  const hatsuMove = getMoveForAction(hatsu, 'heavy')!;
  const fullHpHit = resolveAttackHit({
    attacker: hatsu,
    defender: target,
    move: hatsuMove,
    hitX: 430,
    hitY: 420,
    nowMs: 3000,
  });
  hatsu.comboCount = 0;
  hatsu.hp = 20; // Low HP -> berserker bonus
  const lowHpHit = resolveAttackHit({
    attacker: hatsu,
    defender: target,
    move: hatsuMove,
    hitX: 430,
    hitY: 420,
    nowMs: 5000,
  });
  assert.ok(lowHpHit.damage > fullHpHit.damage, 'Oni Hatsu deals higher damage at low HP');
});

test('stance-weaving mid-combo increases damage by 25% and grants bonus Flow', () => {
  const p1 = createFighter({
    id: 1,
    name: 'P1',
    x: 400,
    facing: 1,
    isAI: false,
    personality: 'balanced',
    maxHp: 120,
    stance: 'crane',
    equippedSkills: ['crane_wing_evade', 'rising_dragon', 'serpent_wrap'],
    accentColor: '#1F6E58',
  });
  const p2 = createFighter({
    id: 2,
    name: 'P2',
    x: 450,
    facing: -1,
    isAI: false,
    personality: 'balanced',
    maxHp: 200,
    stance: 'crane',
    equippedSkills: ['crane_wing_evade', 'rising_dragon', 'serpent_wrap'],
    accentColor: '#1F6E58',
  });

  const craneLight = getMoveForAction(p1, 'light')!;
  const firstHit = resolveAttackHit({
    attacker: p1,
    defender: p2,
    move: craneLight,
    hitX: 430,
    hitY: 420,
    nowMs: 500,
  });
  assert.equal(firstHit.isStanceWeave, false);

  p1.stance = 'tiger';
  const tigerLight = getMoveForAction(p1, 'light')!;
  const flowBeforeWeave = p1.flow;
  const weaveHit = resolveAttackHit({
    attacker: p1,
    defender: p2,
    move: tigerLight,
    hitX: 430,
    hitY: 420,
    nowMs: 700,
  });

  assert.equal(weaveHit.isStanceWeave, true);
  assert.equal(p1.stanceWeaveChain, 1);
  const expectedBase = Math.round(tigerLight.damage * STANCE_META.tiger.damageMult);
  assert.ok(weaveHit.damage > expectedBase, 'stance-weave damage should exceed single-stance damage');
  assert.ok(p1.flow >= flowBeforeWeave + CONFIG.stanceWeaveFlowBonus);
});

test('EchoRecorder extracts player favorite combos, stance weights, and drives Echo AI', () => {
  const recorder = new EchoRecorder();
  let t = 100;
  for (let rep = 0; rep < 8; rep++) {
    recorder.record({ t, token: 'L', stance: 'serpent', dist: 110, oppAttacking: false });
    t += 220;
    recorder.record({ t, token: 'H', stance: 'serpent', dist: 105, oppAttacking: false });
    t += 240;
    recorder.record({ t, token: 'SK2', stance: 'serpent', dist: 100, oppAttacking: false });
    t += 950;
  }

  const profile = recorder.analyze();
  assert.equal(profile.favoriteStance, 'serpent');
  assert.ok(profile.topCombos.length >= 2);
  assert.deepEqual(profile.topCombos[0], ['L', 'H', 'SK2']);
  assert.equal(profile.favoriteSkillIndices[0], 2);

  const echo = createFighter({
    id: 2,
    characterId: 'kenshin',
    name: 'Echo',
    x: 520,
    facing: -1,
    isAI: true,
    personality: 'echo',
    maxHp: 140,
    stance: 'crane',
    equippedSkills: ['kenshin_quickdraw', 'kenshin_parry_flash', 'kenshin_crescent'],
    accentColor: '#B8861E',
    isEcho: true,
  });
  const player = createFighter({
    id: 1,
    characterId: 'kenshin',
    name: 'Player',
    x: 400,
    facing: 1,
    isAI: false,
    personality: 'balanced',
    maxHp: 120,
    stance: 'crane',
    equippedSkills: ['kenshin_quickdraw', 'kenshin_parry_flash', 'kenshin_crescent'],
    accentColor: '#1F6E58',
  });
  echo.aiTimer = 0;

  computeAIInput({
    ai: echo,
    opponent: player,
    dt: 0.016,
    difficulty: 0.85,
    echoProfile: profile,
    rng: () => 0.1,
  });

  assert.ok(echo.aiComboQueue.length >= 2, 'Echo AI should queue player recorded combo');
});

test('10-character MOBA roster configuration, skill constellation, and unlocks work cleanly', () => {
  assert.equal(CHARACTER_LIST.length, 10, 'roster must have 10 playable characters');
  assert.equal(STARTER_CHARACTER_IDS.length, 4, '4 starter characters unlocked free');
  for (const c of CHARACTER_LIST) {
    assert.equal(c.skills.length, 3, `${c.id} should have 3 skills`);
    assert.equal(c.ultimate.move.isUltimate, true, `${c.id} ultimate flag set`);
    assert.equal(c.ultimate.flowCost, 80, `${c.id} ultimate cost is 80 Flow`);
  }
  assert.ok(CHARACTERS.kagero.weapon.kind === 'kusarigama');

  assert.ok(SKILL_NODES.length >= 18, `expected >= 18 skills, got ${SKILL_NODES.length}`);
  assert.equal(CHAPTERS.length, 5, 'expected 5 chapters');
  assert.equal(CHAPTERS[0].duels.length, 4, 'expected 3 duels + 1 Echo boss per chapter');
  assert.equal(CHAPTERS[0].duels[3].isEcho, true);

  let save = createInitialSaveData();
  assert.deepEqual(save.unlockedCharacters, [...STARTER_CHARACTER_IDS]);
  save.spiritPoints = 200;

  assert.equal(canUnlockCharacter(save, 'raiden'), true);
  assert.equal(canUnlockCharacter(save, 'kenshin'), false, 'already unlocked');
  save = unlockCharacter(save, 'raiden');
  assert.equal(save.unlockedCharacters.includes('raiden'), true);
  assert.equal(save.selectedCharacterId, 'raiden');

  save = selectCharacter(save, 'tomoe');
  assert.equal(save.selectedCharacterId, 'tomoe');

  assert.equal(canUnlockSkill(save, 'whirlwind_kick'), true);
  assert.equal(canUnlockSkill(save, 'shadow_step'), false, 'cannot unlock tier-2 without prerequisite');

  save = unlockSkill(save, 'whirlwind_kick');
  assert.equal(save.unlockedSkills.includes('whirlwind_kick'), true);
  assert.equal(canUnlockSkill(save, 'shadow_step'), true);

  save = equipSkillToSlot(save, 'whirlwind_kick', 0);
  assert.equal(save.equippedSkills[0], 'whirlwind_kick');
});
