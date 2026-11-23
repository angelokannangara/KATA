/**
 * KATA: Ink & Echo — Armory Weapon Catalog & Pure Weapon Stat Resolvers
 * Weapons can be purchased using either Gold Coins or Spirit Points (SP)
 * and override a fighter's visual silhouette, reach, speed, and combat perks.
 */

import { CharacterConfig, TrailStyle, WeaponConfig, WeaponItem } from './types';

export const WEAPONS: WeaponItem[] = [
  {
    id: 'default',
    name: 'Signature Armament',
    subtitle: 'Warrior’s Native Form',
    kind: 'signature',
    tier: 0,
    costCoins: 0,
    costSP: 0,
    damageMult: 1,
    speedMult: 1,
    reachBonus: 0,
    flowBonus: 0,
    guardBreakMult: 1,
    perkLabel: 'Native Balance',
    description: 'Uses your chosen warrior’s authentic weapon silhouette and natural timing.',
  },
  {
    id: 'bamboo_bokken',
    name: 'Mist Bamboo Bokken',
    subtitle: 'Light Practice Katana',
    kind: 'katana',
    tier: 1,
    costCoins: 60,
    costSP: 35,
    damageMult: 1.0,
    speedMult: 1.12,
    reachBonus: 4,
    flowBonus: 3,
    guardBreakMult: 1.0,
    bladeTint: '#3A7D65',
    trailStyle: 'katana',
    perkLabel: '+12% Speed · +3 Flow',
    description: 'Featherweight lacquered bamboo carved for rapid draw-cuts and swift Flow recovery.',
  },
  {
    id: 'jade_wind_katana',
    name: 'Jade Wind Katana',
    subtitle: 'Tempered Grove Steel',
    kind: 'katana',
    tier: 1,
    costCoins: 110,
    costSP: 65,
    damageMult: 1.08,
    speedMult: 1.08,
    reachBonus: 10,
    flowBonus: 2,
    guardBreakMult: 1.1,
    bladeTint: '#1F6E58',
    trailStyle: 'katana',
    perkLabel: '+8% Dmg · +8% Spd · +10 Reach',
    description: 'Forged in river mist with an extended fuller that slices wind and guards alike.',
  },
  {
    id: 'obsidian_kunai',
    name: 'Twin Obsidian Kunai',
    subtitle: 'Shadow Assassin Daggers',
    kind: 'twin_kunai',
    tier: 1,
    costCoins: 120,
    costSP: 70,
    damageMult: 1.04,
    speedMult: 1.16,
    reachBonus: 2,
    flowBonus: 4,
    guardBreakMult: 1.0,
    critChance: 0.2,
    bladeTint: '#4B3F72',
    trailStyle: 'kunai',
    perkLabel: '+16% Speed · 20% Crit',
    description: 'Dual volcanic glass blades weighted for relentless flurry pressure and sudden crits.',
  },
  {
    id: 'thunder_naginata',
    name: 'Thunder Monk Naginata',
    subtitle: 'Long-Shafted Shrine Glaive',
    kind: 'naginata',
    tier: 2,
    costCoins: 200,
    costSP: 120,
    damageMult: 1.14,
    speedMult: 0.98,
    reachBonus: 20,
    flowBonus: 2,
    guardBreakMult: 1.32,
    bladeTint: '#2B4C7E',
    trailStyle: 'naginata',
    perkLabel: '+14% Dmg · +20 Reach · Guard Break',
    description: 'Sweeping temple polearm whose wide crescent arc keeps foes pinned at range.',
  },
  {
    id: 'demon_claws',
    name: 'Ash Demon Claws',
    subtitle: 'Serrated Tekko-Kagi',
    kind: 'iron_claws',
    tier: 2,
    costCoins: 210,
    costSP: 125,
    damageMult: 1.16,
    speedMult: 1.1,
    reachBonus: 4,
    flowBonus: 2,
    guardBreakMult: 1.15,
    critChance: 0.25,
    bladeTint: '#B8292F',
    trailStyle: 'claws',
    perkLabel: '+16% Dmg · +10% Spd · 25% Crit',
    description: 'Twin iron talons leaving triple crimson ink scars across guarded armor.',
  },
  {
    id: 'golden_kusarigama',
    name: 'Eclipse Kusarigama',
    subtitle: 'Weighted Chain Sickle',
    kind: 'kusarigama',
    tier: 2,
    costCoins: 240,
    costSP: 140,
    damageMult: 1.12,
    speedMult: 1.04,
    reachBonus: 16,
    flowBonus: 6,
    guardBreakMult: 1.2,
    bladeTint: '#B8861E',
    trailStyle: 'chain',
    perkLabel: '+12% Dmg · +16 Reach · +6 Flow',
    description: 'A gilded sickle tethered by weighted links that harvests Flow with every strike.',
  },
  {
    id: 'blood_odachi',
    name: 'Crimson Blood Odachi',
    subtitle: 'Colossal Ash Greatsword',
    kind: 'odachi',
    tier: 3,
    costCoins: 340,
    costSP: 200,
    damageMult: 1.24,
    speedMult: 0.94,
    reachBonus: 24,
    flowBonus: 2,
    guardBreakMult: 1.48,
    bladeTint: '#A62126',
    trailStyle: 'odachi',
    perkLabel: '+24% Dmg · +24 Reach · Heavy Break',
    description: 'An immense two-handed field blade that cleaves through guard stance and bone.',
  },
  {
    id: 'celestial_muramasa',
    name: 'Celestial Muramasa',
    subtitle: 'Mythic Ink-Forged Katana',
    kind: 'katana',
    tier: 3,
    costCoins: 420,
    costSP: 250,
    damageMult: 1.22,
    speedMult: 1.1,
    reachBonus: 14,
    flowBonus: 5,
    guardBreakMult: 1.25,
    lifestealOnHit: 2,
    critChance: 0.18,
    bladeTint: '#D9463E',
    trailStyle: 'katana',
    perkLabel: '+22% Dmg · +10% Spd · +2 HP Leech',
    description: 'Quenched in final-sanctum ink; drinks a sliver of vitality on every clean cut.',
  },
];

export const WEAPON_MAP: Record<string, WeaponItem> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
);

export function getWeaponItem(id?: string): WeaponItem {
  if (!id) return WEAPONS[0];
  return WEAPON_MAP[id] ?? WEAPONS[0];
}

export interface ResolvedWeapon {
  item: WeaponItem;
  weaponConfig: WeaponConfig;
  trailStyle: TrailStyle;
  bladeTint?: string;
  damageMult: number;
  speedMult: number;
  reachBonus: number;
  flowBonus: number;
  guardBreakMult: number;
  lifestealOnHit: number;
  critChance: number;
}

const DEFAULT_DIMENSIONS: Record<WeaponConfig['kind'], { length: number; width: number; sheathOnHip?: boolean }> = {
  katana: { length: 58, width: 4.4, sheathOnHip: true },
  twin_kunai: { length: 28, width: 4.5, sheathOnHip: false },
  naginata: { length: 82, width: 4.6, sheathOnHip: false },
  war_fan: { length: 34, width: 5.5, sheathOnHip: false },
  odachi: { length: 84, width: 6.2, sheathOnHip: false },
  bow: { length: 48, width: 3.8, sheathOnHip: false },
  iron_claws: { length: 24, width: 4.0, sheathOnHip: false },
  staff: { length: 78, width: 4.6, sheathOnHip: false },
  kusarigama: { length: 52, width: 4.2, sheathOnHip: false },
};

export function resolveFighterWeapon(
  char: CharacterConfig,
  equippedWeaponId?: string,
): ResolvedWeapon {
  const item = getWeaponItem(equippedWeaponId);
  if (item.id === 'default' || item.kind === 'signature') {
    return {
      item,
      weaponConfig: char.weapon,
      trailStyle: char.trailStyle,
      damageMult: 1,
      speedMult: 1,
      reachBonus: 0,
      flowBonus: 0,
      guardBreakMult: 1,
      lifestealOnHit: 0,
      critChance: 0,
    };
  }

  const baseDim = DEFAULT_DIMENSIONS[item.kind];
  const weaponConfig: WeaponConfig = {
    kind: item.kind,
    length: baseDim.length + item.reachBonus,
    width: baseDim.width,
    sheathOnHip: baseDim.sheathOnHip,
  };

  return {
    item,
    weaponConfig,
    trailStyle: item.trailStyle ?? char.trailStyle,
    bladeTint: item.bladeTint,
    damageMult: item.damageMult,
    speedMult: item.speedMult,
    reachBonus: item.reachBonus,
    flowBonus: item.flowBonus,
    guardBreakMult: item.guardBreakMult,
    lifestealOnHit: item.lifestealOnHit ?? 0,
    critChance: item.critChance ?? 0,
  };
}
