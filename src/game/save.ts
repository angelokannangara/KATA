/**
 * KATA: Ink & Echo — LocalStorage Persistence & Progression Rules
 */

import {
  CHARACTERS,
  CHARACTER_LIST,
  STARTER_CHARACTER_IDS,
} from './characters';
import {
  DEFAULT_EQUIPPED_SKILLS,
  DEFAULT_UNLOCKED_SKILLS,
  SKILL_MAP,
} from './config';
import { createDefaultEchoProfile } from './echo';
import { GameSettings, SaveData } from './types';
import { WEAPON_MAP } from './weapons';

const SAVE_KEY = 'kata_ink_echo_save_v1';

export function createInitialSaveData(): SaveData {
  return {
    spiritPoints: 50,
    coins: 120,
    unlockedSkills: [...DEFAULT_UNLOCKED_SKILLS],
    equippedSkills: [...DEFAULT_EQUIPPED_SKILLS] as [string, string, string],
    unlockedCharacters: [...STARTER_CHARACTER_IDS],
    selectedCharacterId: 'kenshin',
    unlockedWeapons: ['default'],
    equippedWeaponId: 'default',
    hasSeenPrologue: false,
    currentChapter: 0,
    currentDuel: 0,
    highestChapter: 0,
    totalWins: 0,
    perfectParries: 0,
    maxComboRecord: 0,
    echoEvents: [],
    echoProfile: createDefaultEchoProfile(),
    settings: {
      volume: 0.65,
      musicEnabled: true,
      screenShake: true,
      touchControls: 'auto',
      darkMode: false,
    },
  };
}

export function loadSaveData(): SaveData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createInitialSaveData();
  }
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialSaveData();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = createInitialSaveData();
    const unlockedCharacters = Array.isArray(parsed.unlockedCharacters)
      ? Array.from(
          new Set([
            ...STARTER_CHARACTER_IDS,
            ...parsed.unlockedCharacters.filter((id) => Boolean(CHARACTERS[id])),
          ]),
        )
      : base.unlockedCharacters;
    const selectedCharacterId =
      typeof parsed.selectedCharacterId === 'string' &&
      unlockedCharacters.includes(parsed.selectedCharacterId)
        ? parsed.selectedCharacterId
        : base.selectedCharacterId;

    const unlockedWeapons = Array.isArray(parsed.unlockedWeapons)
      ? Array.from(
          new Set([
            'default',
            ...parsed.unlockedWeapons.filter((id) => Boolean(WEAPON_MAP[id])),
          ]),
        )
      : base.unlockedWeapons;

    const equippedWeaponId =
      typeof parsed.equippedWeaponId === 'string' &&
      unlockedWeapons.includes(parsed.equippedWeaponId)
        ? parsed.equippedWeaponId
        : 'default';

    return {
      ...base,
      ...parsed,
      coins: typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) ? parsed.coins : base.coins,
      unlockedSkills: Array.isArray(parsed.unlockedSkills)
        ? Array.from(new Set([...DEFAULT_UNLOCKED_SKILLS, ...parsed.unlockedSkills]))
        : base.unlockedSkills,
      equippedSkills:
        Array.isArray(parsed.equippedSkills) && parsed.equippedSkills.length === 3
          ? (parsed.equippedSkills as [string, string, string])
          : base.equippedSkills,
      unlockedCharacters,
      selectedCharacterId,
      unlockedWeapons,
      equippedWeaponId,
      hasSeenPrologue: Boolean(parsed.hasSeenPrologue),
      echoEvents: Array.isArray(parsed.echoEvents) ? parsed.echoEvents : [],
      echoProfile: parsed.echoProfile ?? base.echoProfile,
      settings: {
        ...base.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return createInitialSaveData();
  }
}

export function persistSaveData(data: SaveData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function updateSettings(save: SaveData, patch: Partial<GameSettings>): SaveData {
  const next: SaveData = {
    ...save,
    settings: { ...save.settings, ...patch },
  };
  persistSaveData(next);
  return next;
}

export function canUnlockSkill(save: SaveData, skillId: string): boolean {
  const node = SKILL_MAP[skillId];
  if (!node) return false;
  if (save.unlockedSkills.includes(skillId)) return false;
  if (save.spiritPoints < node.costSP) return false;
  return node.prerequisites.every((req) => save.unlockedSkills.includes(req));
}

export function unlockSkill(save: SaveData, skillId: string): SaveData {
  if (!canUnlockSkill(save, skillId)) return save;
  const node = SKILL_MAP[skillId];
  const next: SaveData = {
    ...save,
    spiritPoints: save.spiritPoints - node.costSP,
    unlockedSkills: [...save.unlockedSkills, skillId],
  };
  persistSaveData(next);
  return next;
}

export function equipSkillToSlot(save: SaveData, skillId: string, slot: 0 | 1 | 2): SaveData {
  if (!save.unlockedSkills.includes(skillId)) return save;
  const equipped = [...save.equippedSkills] as [string, string, string];
  const existingIdx = equipped.indexOf(skillId);
  if (existingIdx !== -1 && existingIdx !== slot) {
    equipped[existingIdx] = equipped[slot];
  }
  equipped[slot] = skillId;
  const next: SaveData = {
    ...save,
    equippedSkills: equipped,
  };
  persistSaveData(next);
  return next;
}

export function canUnlockCharacter(save: SaveData, characterId: string): boolean {
  const char = CHARACTERS[characterId];
  if (!char) return false;
  if (save.unlockedCharacters.includes(characterId)) return false;
  return save.spiritPoints >= char.unlockCostSP;
}

export function unlockCharacter(save: SaveData, characterId: string): SaveData {
  if (!canUnlockCharacter(save, characterId)) return save;
  const char = CHARACTERS[characterId];
  const next: SaveData = {
    ...save,
    spiritPoints: save.spiritPoints - char.unlockCostSP,
    unlockedCharacters: [...save.unlockedCharacters, characterId],
    selectedCharacterId: characterId,
  };
  persistSaveData(next);
  return next;
}

export function selectCharacter(save: SaveData, characterId: string): SaveData {
  if (!save.unlockedCharacters.includes(characterId) || !CHARACTERS[characterId]) {
    return save;
  }
  const next: SaveData = {
    ...save,
    selectedCharacterId: characterId,
  };
  persistSaveData(next);
  return next;
}

export function unlockChapterRewardCharacters(
  save: SaveData,
  clearedChapterIndex: number,
): string[] {
  const newlyUnlocked: string[] = [];
  for (const char of CHARACTER_LIST) {
    if (
      char.unlockChapter !== undefined &&
      clearedChapterIndex >= char.unlockChapter &&
      !save.unlockedCharacters.includes(char.id)
    ) {
      newlyUnlocked.push(char.id);
    }
  }
  return newlyUnlocked;
}

export function canBuyWeapon(
  save: SaveData,
  weaponId: string,
  currency: 'coins' | 'sp',
): boolean {
  const weapon = WEAPON_MAP[weaponId];
  if (!weapon || weapon.id === 'default') return false;
  if (save.unlockedWeapons.includes(weaponId)) return false;
  return currency === 'coins' ? save.coins >= weapon.costCoins : save.spiritPoints >= weapon.costSP;
}

export function buyWeapon(
  save: SaveData,
  weaponId: string,
  currency: 'coins' | 'sp',
): SaveData {
  if (!canBuyWeapon(save, weaponId, currency)) return save;
  const weapon = WEAPON_MAP[weaponId];
  const next: SaveData = {
    ...save,
    coins: currency === 'coins' ? save.coins - weapon.costCoins : save.coins,
    spiritPoints: currency === 'sp' ? save.spiritPoints - weapon.costSP : save.spiritPoints,
    unlockedWeapons: [...save.unlockedWeapons, weaponId],
    equippedWeaponId: weaponId,
  };
  persistSaveData(next);
  return next;
}

export function equipWeapon(save: SaveData, weaponId: string): SaveData {
  if (!WEAPON_MAP[weaponId] || !save.unlockedWeapons.includes(weaponId)) {
    return save;
  }
  const next: SaveData = {
    ...save,
    equippedWeaponId: weaponId,
  };
  persistSaveData(next);
  return next;
}

export function markPrologueSeen(save: SaveData): SaveData {
  if (save.hasSeenPrologue) return save;
  const next: SaveData = {
    ...save,
    hasSeenPrologue: true,
  };
  persistSaveData(next);
  return next;
}
