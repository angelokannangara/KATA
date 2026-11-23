/**
 * KATA: Ink & Echo — Core Type Definitions
 */

export type StanceId = 'crane' | 'tiger' | 'serpent';

export type GameScreen =
  | 'title'
  | 'character_select'
  | 'vs_splash'
  | 'story_card'
  | 'playing'
  | 'paused'
  | 'skill_tree'
  | 'armory'
  | 'match_over';

export type GameMode = 'chapter' | 'dojo' | 'versus';

export type AIPersonality =
  | 'balanced'
  | 'aggressive'
  | 'defensive'
  | 'trickster'
  | 'zoner'
  | 'grappler'
  | 'echo';

export type CharacterRole =
  | 'Duelist'
  | 'Assassin'
  | 'Tank'
  | 'Trickster'
  | 'Bruiser'
  | 'Ranged'
  | 'Berserker'
  | 'Support'
  | 'Grappler'
  | 'Mirror';

export type WeaponKind =
  | 'katana'
  | 'twin_kunai'
  | 'naginata'
  | 'war_fan'
  | 'odachi'
  | 'bow'
  | 'iron_claws'
  | 'staff'
  | 'kusarigama';

export type HeadgearKind =
  | 'topknot'
  | 'ninja_hood'
  | 'monk_kabuto'
  | 'kasa_hat'
  | 'crest_kabuto'
  | 'ponytail'
  | 'oni_mask'
  | 'fox_mask'
  | 'phantom_hood'
  | 'echo_cowl';

export type TrailStyle =
  | 'katana'
  | 'kunai'
  | 'naginata'
  | 'fan'
  | 'odachi'
  | 'claws'
  | 'chain'
  | 'mist'
  | 'kick';

export interface WeaponItem {
  id: string;
  name: string;
  subtitle: string;
  kind: WeaponKind | 'signature';
  tier: 0 | 1 | 2 | 3;
  costCoins: number;
  costSP: number;
  damageMult: number;
  speedMult: number;
  reachBonus: number;
  flowBonus: number;
  guardBreakMult: number;
  lifestealOnHit?: number;
  critChance?: number;
  bladeTint?: string;
  trailStyle?: TrailStyle;
  perkLabel: string;
  description: string;
}

export interface BodyProportions {
  heightScale: number; // 0.92 .. 1.12
  shoulderWidth: number; // 0.85 .. 1.25
  armLength: number; // 0.92 .. 1.12
  legLength: number; // 0.92 .. 1.12
  limbBulk: number; // 0.82 .. 1.28
}

export interface CostumeConfig {
  headgear: HeadgearKind;
  hakama: boolean;
  kimonoSleeves: boolean;
  sodeArmor: boolean; // Shoulder plates
  chestPlate: boolean;
  kusazuri: boolean; // Waist armor skirt
  obiSash: boolean;
  tabiShins: boolean;
  ponytailLength: number; // 0 = none
  crouchIdle: boolean; // Ninja coiled stance vs upright samurai
  walkStyle: 'samurai' | 'shinobi' | 'heavy';
  dashStyle: 'glide' | 'flash' | 'charge';
}

export interface WeaponConfig {
  kind: WeaponKind;
  length: number;
  width: number;
  sheathOnHip?: boolean;
}

export interface CharacterSkillKit {
  id: string;
  name: string;
  flowCost: number;
  cooldown: number;
  summary: string;
  move: MoveDefinition;
}

export interface CharacterConfig {
  id: string;
  name: string;
  title: string;
  role: CharacterRole;
  accentColor: string;
  starterUnlocked: boolean;
  unlockCostSP: number;
  unlockChapter?: number;
  stats: {
    power: number; // 1..10
    speed: number; // 1..10
    defense: number; // 1..10
  };
  maxHp: number;
  speedMult: number;
  damageMult: number;
  defenseMult: number; // < 1 reduces incoming damage
  signatureStance: StanceId;
  stanceTwist: string;
  passiveName: string;
  passiveSummary: string;
  victoryQuote: string;
  aiPersonality: AIPersonality;
  proportions: BodyProportions;
  costume: CostumeConfig;
  weapon: WeaponConfig;
  basicReach: number;
  basicSpeed: number;
  trailStyle: TrailStyle;
  skills: [CharacterSkillKit, CharacterSkillKit, CharacterSkillKit];
  ultimate: CharacterSkillKit;
}

export type ActionKind =
  | 'idle'
  | 'walk_fwd'
  | 'walk_back'
  | 'crouch'
  | 'jump'
  | 'dash_fwd'
  | 'dash_back'
  | 'block'
  | 'parry_counter'
  | 'light'
  | 'heavy'
  | 'kick'
  | 'kick_combo'
  | 'crouch_attack'
  | 'air_attack'
  | 'skill_0'
  | 'skill_1'
  | 'skill_2'
  | 'ultimate'
  | 'hitstun'
  | 'knockdown'
  | 'ko'
  | 'victory';

export type EasingName = 'linear' | 'easeOutCubic' | 'easeOutBack' | 'easeInOutQuad' | 'spring';

export interface Pose {
  hipOffsetY: number;
  torsoAngle: number;
  headAngle: number;
  shoulderL: number;
  elbowL: number;
  shoulderR: number;
  elbowR: number;
  hipL: number;
  kneeL: number;
  hipR: number;
  kneeR: number;
  scaleX?: number;
  scaleY?: number;
}

export interface JointPositions {
  hip: { x: number; y: number };
  shoulder: { x: number; y: number };
  head: { x: number; y: number };
  elbowL: { x: number; y: number };
  handL: { x: number; y: number };
  elbowR: { x: number; y: number };
  handR: { x: number; y: number };
  kneeL: { x: number; y: number };
  footL: { x: number; y: number };
  kneeR: { x: number; y: number };
  footR: { x: number; y: number };
}

export type LimbTarget =
  | 'handR'
  | 'handL'
  | 'footR'
  | 'footL'
  | 'bothFeet'
  | 'torso'
  | 'bothHands'
  | 'weaponTip';

export interface MoveDefinition {
  id: string;
  name: string;
  stance: StanceId;
  kind: 'light' | 'heavy' | 'kick' | 'crouch' | 'air' | 'skill' | 'ultimate';
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  chipDamage: number;
  hitstun: number;
  blockstun: number;
  knockbackX: number;
  knockbackY: number;
  lungeVelX: number;
  lungeVelY?: number;
  hitboxRadius: number;
  activeLimb: LimbTarget;
  hitstop: number;
  shake: number;
  isGrab?: boolean;
  isLow?: boolean;
  isOverhead?: boolean;
  isCounter?: boolean;
  isTeleport?: boolean;
  isClone?: boolean;
  spinArc?: boolean;
  spawnsProjectile?: boolean;
  multiHitCount?: number;
  invulnerableDuringStartup?: boolean;
  healsHp?: number;
  reflectsProjectiles?: boolean;
  pullsOpponent?: boolean;
  isUltimate?: boolean;
  trailStyle?: TrailStyle;
  flowGainOnHit: number;
  flowCost: number;
  cooldown: number;
  anticipationPose: Pose;
  strikePose: Pose;
  recoveryPose: Pose;
  easingIn: EasingName;
  easingOut: EasingName;
  inkColor?: string;
}

export interface SkillNode {
  id: string;
  name: string;
  stance: StanceId;
  costSP: number;
  flowCost: number;
  cooldown: number;
  summary: string;
  prerequisites: string[];
  x: number;
  y: number;
  move: MoveDefinition;
}

export interface ScarfNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Afterimage {
  joints: JointPositions;
  facing: 1 | -1;
  alpha: number;
  color: string;
  scarf: { x: number; y: number }[];
}

export interface SlashArcPoint {
  x: number;
  y: number;
  alpha: number;
  width: number;
  color: string;
  style?: TrailStyle;
}

export interface Projectile {
  id: number;
  owner: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  hitstun: number;
  knockbackX: number;
  life: number;
  maxLife: number;
  color: string;
  active: boolean;
  kind?: 'wave' | 'shuriken' | 'kunai' | 'arrow';
}

export interface InkClone {
  owner: 1 | 2;
  x: number;
  y: number;
  facing: 1 | -1;
  joints: JointPositions;
  life: number;
  maxLife: number;
  exploded: boolean;
  color: string;
}

export interface FighterState {
  id: 1 | 2;
  characterId: string;
  equippedWeaponId?: string;
  name: string;
  isAI: boolean;
  personality: AIPersonality;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  ghostHp: number;
  flow: number;
  stance: StanceId;
  lastComboStance: StanceId | null;
  stanceWeaveChain: number;
  grounded: boolean;
  crouching: boolean;
  blocking: boolean;
  blockStartTime: number;
  counterWindowTimer: number;
  action: ActionKind;
  actionTimer: number;
  currentMove: MoveDefinition | null;
  moveHitRegistered: boolean;
  moveHitStep: number;
  hitstunTimer: number;
  knockdownTimer: number;
  invulnTimer: number;
  dashCooldown: number;
  hitFlashTimer: number;
  comboCount: number;
  comboResetTimer: number;
  equippedSkills: [string, string, string];
  skillCooldowns: [number, number, number];
  // Animation & Secondary motion
  animTime: number;
  walkDistance: number;
  currentPose: Pose;
  prevPose: Pose;
  poseBlend: number;
  squashX: number;
  squashY: number;
  scarf: ScarfNode[];
  ponytail: ScarfNode[];
  sashTails: ScarfNode[];
  chainTip: { x: number; y: number };
  weaponBase: { x: number; y: number };
  weaponTip: { x: number; y: number };
  weaponAngle: number;
  joints: JointPositions;
  slashTrail: SlashArcPoint[];
  afterimages: Afterimage[];
  accentColor: string;
  isEcho: boolean;
  empoweredDrawReady?: boolean;
  // AI runtime state
  aiState: 'approach' | 'pressure' | 'retreat' | 'bait_punish' | 'defend';
  aiTimer: number;
  aiComboQueue: (
    | 'light'
    | 'heavy'
    | 'kick'
    | 'crouch'
    | 'dash_fwd'
    | 'dash_back'
    | 'block'
    | 'jump'
    | 'stance'
    | 'skill_0'
    | 'skill_1'
    | 'skill_2'
    | 'ultimate'
  )[];
  aiReactionCooldown: number;
}

export interface InputSnapshot {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  block: boolean;
  justLight: boolean;
  justHeavy: boolean;
  justKick?: boolean;
  justDash: boolean;
  justJump: boolean;
  justBlock: boolean;
  justStancePrev?: boolean;
  justStanceNext: boolean;
  justStanceCrane: boolean;
  justStanceTiger: boolean;
  justStanceSerpent: boolean;
  justSkill0: boolean;
  justSkill1: boolean;
  justSkill2: boolean;
  justUltimate?: boolean;
}

export type EchoRecordedToken =
  | 'L'
  | 'H'
  | 'FK'
  | 'C'
  | 'A'
  | 'D_FWD'
  | 'D_BACK'
  | 'PARRY'
  | 'SK0'
  | 'SK1'
  | 'SK2'
  | 'ULT'
  | 'STANCE';

export interface EchoEvent {
  t: number;
  token: EchoRecordedToken;
  stance: StanceId;
  dist: number;
  oppAttacking: boolean;
}

export interface EchoProfile {
  totalEvents: number;
  topCombos: string[][];
  favoriteStance: StanceId;
  stanceWeights: Record<StanceId, number>;
  aggressionRatio: number;
  parryTendency: number;
  dashFrequency: number;
  favoriteSkillIndices: number[];
  avgActionIntervalMs: number;
}

export interface StageTheme {
  id: string;
  name: string;
  paper: string;
  paperDark: string;
  ink: string;
  accent: string;
  motif: 'bamboo' | 'torii' | 'pagoda' | 'bridge' | 'eclipse';
}

export interface StoryBeat {
  title: string;
  line: string;
}

export interface DuelOpponent {
  characterId: string;
  name: string;
  title: string;
  personality: AIPersonality;
  difficulty: number;
  maxHp: number;
  stance: StanceId;
  skills: [string, string, string];
  isEcho?: boolean;
  quote: string;
  storyBeat?: StoryBeat;
}

export interface ChapterConfig {
  id: number;
  title: string;
  subtitle: string;
  storyIntro: string;
  storyOutro: string;
  stage: StageTheme;
  duels: DuelOpponent[];
}

export interface GameSettings {
  volume: number;
  musicEnabled: boolean;
  screenShake: boolean;
  touchControls: 'auto' | 'on' | 'off';
  darkMode: boolean;
}

export interface SaveData {
  spiritPoints: number;
  coins: number;
  unlockedSkills: string[];
  equippedSkills: [string, string, string];
  unlockedCharacters: string[];
  selectedCharacterId: string;
  unlockedWeapons: string[];
  equippedWeaponId: string;
  hasSeenPrologue: boolean;
  currentChapter: number;
  currentDuel: number;
  highestChapter: number;
  totalWins: number;
  perfectParries: number;
  maxComboRecord: number;
  echoEvents: EchoEvent[];
  echoProfile: EchoProfile;
  settings: GameSettings;
}

export interface MatchStats {
  winner: 1 | 2;
  p1CharacterId: string;
  p2CharacterId: string;
  victoryQuote: string;
  p1Rounds: number;
  p2Rounds: number;
  maxCombo: number;
  perfectParries: number;
  noDamageRound: boolean;
  stanceWeaves: number;
  spEarned: {
    win: number;
    parries: number;
    noDamage: number;
    comboBonus: number;
    total: number;
  };
  coinsEarned: {
    win: number;
    style: number;
    total: number;
  };
  isChapterClear: boolean;
  isCampaignComplete: boolean;
}

export interface HUDCallout {
  id: number;
  text: string;
  side: 'left' | 'right' | 'center';
  color: string;
}

export interface UltimateOverlayState {
  active: boolean;
  progress: number;
  accentColor: string;
  name: string;
  attackerId: 1 | 2;
}

export interface HUDState {
  screen: GameScreen;
  mode: GameMode;
  chapterIndex: number;
  duelIndex: number;
  roundNumber: number;
  roundTimer: number;
  p1Rounds: number;
  p2Rounds: number;
  announcement: string;
  announcementKey: number;
  callouts: HUDCallout[];
  ultimateOverlay: UltimateOverlayState | null;
  p1: {
    characterId: string;
    equippedWeaponName?: string;
    name: string;
    hp: number;
    maxHp: number;
    ghostHp: number;
    hitFlashing: boolean;
    flow: number;
    stance: StanceId;
    combo: number;
    stanceWeaveChain: number;
    skillCooldowns: [number, number, number];
    equippedSkills: [string, string, string];
    skillsMeta: { id: string; name: string; flowCost: number; cooldown: number; stance: StanceId }[];
    ultimateName: string;
    ultimateCost: number;
    counterActive: boolean;
  };
  p2: {
    characterId: string;
    name: string;
    hp: number;
    maxHp: number;
    ghostHp: number;
    hitFlashing: boolean;
    flow: number;
    stance: StanceId;
    combo: number;
    isEcho: boolean;
  };
  dojoFrameData: {
    moveName: string;
    phase: string;
    startupF: number;
    activeF: number;
    recoveryF: number;
    damage: number;
    lastHitBonus: string;
  };
  matchStats: MatchStats | null;
}
