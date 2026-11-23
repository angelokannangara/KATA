import React, { useState } from 'react';
import { ArrowLeft, Check, Coins, Orbit, Play, ShieldAlert, Sparkles, Sword, Zap } from 'lucide-react';
import { getCharacterConfig } from '../game/characters';
import { canBuyWeapon } from '../game/save';
import { SaveData } from '../game/types';
import { getWeaponItem, WEAPONS } from '../game/weapons';
import { CharacterPortraitCanvas } from './CharacterPortraitCanvas';

interface ArmoryModalProps {
  save: SaveData;
  onBuyWeapon: (weaponId: string, currency: 'coins' | 'sp') => void;
  onEquipWeapon: (weaponId: string) => void;
  onBack: () => void;
}

const PREVIEW_SEQUENCE: ('light' | 'heavy' | 'kick' | 'kick_combo' | 'skill_0')[] = [
  'light',
  'kick',
  'kick_combo',
  'heavy',
  'skill_0',
];

const PREVIEW_LABELS: Record<(typeof PREVIEW_SEQUENCE)[number], string> = {
  light: 'Strike',
  kick: 'Fancy Kick',
  kick_combo: '360° Kick',
  heavy: 'Heavy Cut',
  skill_0: 'Skill',
};

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  save,
  onBuyWeapon,
  onEquipWeapon,
  onBack,
}) => {
  const [inspectedId, setInspectedId] = useState<string>(save.equippedWeaponId || 'default');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewAction, setPreviewAction] = useState<{
    kind: (typeof PREVIEW_SEQUENCE)[number];
    key: number;
  } | null>(null);

  const activeChar = getCharacterConfig(save.selectedCharacterId);
  const inspected = getWeaponItem(inspectedId);
  const isOwned = save.unlockedWeapons.includes(inspected.id);
  const isEquipped = (save.equippedWeaponId || 'default') === inspected.id;
  const affordableCoins = canBuyWeapon(save, inspected.id, 'coins');
  const affordableSP = canBuyWeapon(save, inspected.id, 'sp');

  const handlePreviewNext = (kindOverride?: (typeof PREVIEW_SEQUENCE)[number]) => {
    const chosen = kindOverride ?? PREVIEW_SEQUENCE[previewIdx % PREVIEW_SEQUENCE.length];
    setPreviewAction((prev) => ({ kind: chosen, key: (prev?.key ?? 0) + 1 }));
    if (!kindOverride) {
      setPreviewIdx((prev) => (prev + 1) % PREVIEW_SEQUENCE.length);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-2.5 sm:p-5 bg-[var(--paper)]/96">
      <div className="w-full max-w-6xl max-h-[92vh] bg-[var(--paper)] border-2 border-[var(--ink)] flex flex-col overflow-hidden shadow-2xl">
        {/* Top Bar */}
        <div className="px-4 py-3 sm:px-6 border-b border-[var(--ink-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="kata-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--ink)] leading-tight">
                Ink Forge &amp; Armory
              </h2>
              <p className="text-[11px] sm:text-xs text-[var(--ink-muted)]">
                Acquire blades with Coins or Spirit Points · Equipped for {activeChar.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              data-testid="armory-coins"
              className="inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold px-3 py-1 border border-[var(--ink-border)] text-[var(--ink)] tabular-nums"
            >
              <Coins className="w-3.5 h-3.5 text-[var(--gold)] stroke-[2.2]" aria-hidden="true" />
              <span>{save.coins} Coins</span>
            </div>
            <div
              data-testid="armory-sp"
              className="inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold px-3 py-1 border border-[var(--ink-border)] text-[var(--ink)] tabular-nums"
            >
              <Orbit className="w-3.5 h-3.5 text-[var(--crimson)] stroke-[2.2]" aria-hidden="true" />
              <span>{save.spiritPoints} SP</span>
            </div>
          </div>
        </div>

        {/* Main Split Panel */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* Left: 9-Weapon Catalog Grid */}
          <div className="lg:w-[56%] p-3 sm:p-5 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-[var(--ink-border)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WEAPONS.map((w) => {
                const owned = save.unlockedWeapons.includes(w.id);
                const equipped = (save.equippedWeaponId || 'default') === w.id;
                const active = inspected.id === w.id;
                const accent = w.bladeTint ?? activeChar.accentColor;

                return (
                  <button
                    key={w.id}
                    type="button"
                    data-weapon-card={w.id}
                    onClick={() => {
                      setInspectedId(w.id);
                      setPreviewAction(null);
                    }}
                    className={`relative text-left border p-3 transition-transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between bg-[var(--paper-card)] ${
                      active
                        ? 'border-2 ring-1 ring-offset-1 ring-offset-[var(--paper)]'
                        : 'border-[var(--ink-border)] hover:border-[var(--ink)]'
                    }`}
                    style={{ borderColor: active ? accent : undefined }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border border-[var(--ink-border)]"
                          style={{ color: accent }}
                        >
                          {w.tier === 0 ? 'Native' : `Tier ${w.tier}`}
                        </span>
                        {equipped ? (
                          <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 bg-[var(--ink)] text-[var(--paper)]">
                            Equipped
                          </span>
                        ) : owned ? (
                          <span className="text-[10px] font-mono font-semibold uppercase text-[var(--jade)]">
                            Owned
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-5 shrink-0"
                          style={{ backgroundColor: accent }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="font-display font-bold text-sm sm:text-base text-[var(--ink)] truncate">
                            {w.name}
                          </div>
                          <div className="text-[11px] text-[var(--ink-muted)] truncate">
                            {w.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] font-medium text-[var(--ink)] leading-snug">
                        {w.perkLabel}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[var(--ink-border)] flex items-center justify-between text-[11px] font-mono tabular-nums">
                      {owned ? (
                        <span className="text-[var(--ink-muted)]">
                          {equipped ? 'Active Loadout' : 'Ready to Equip'}
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 text-[var(--gold)] font-bold">
                            <Coins className="w-3 h-3" aria-hidden="true" />
                            <span>{w.costCoins}</span>
                          </span>
                          <span className="text-[var(--ink-muted)]">or</span>
                          <span className="inline-flex items-center gap-1 text-[var(--crimson)] font-bold">
                            <Orbit className="w-3 h-3" aria-hidden="true" />
                            <span>{w.costSP} SP</span>
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Animated Weapon Preview & Purchase Panel */}
          <div className="lg:w-[44%] p-4 sm:p-5 flex flex-col justify-between bg-[var(--paper)] lg:overflow-y-auto">
            <div>
              <div className="relative h-56 sm:h-60 w-full border border-[var(--ink-border)] bg-[var(--paper-card)] overflow-hidden">
                <CharacterPortraitCanvas
                  characterId={activeChar.id}
                  equippedWeaponId={inspected.id}
                  darkMode={save.settings.darkMode}
                  animated={true}
                  previewAction={previewAction}
                  zoom={1.08}
                  className="w-full h-full block"
                />

                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePreviewNext('light')}
                    className="kata-btn inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-[var(--paper)] border border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
                  >
                    <Sword className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>Slash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreviewNext('kick_combo')}
                    className="kata-btn inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] cursor-pointer"
                  >
                    <Play className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>
                      {previewAction ? PREVIEW_LABELS[previewAction.kind] : '360° Kick'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-mono font-bold uppercase tracking-widest"
                    style={{ color: inspected.bladeTint ?? activeChar.accentColor }}
                  >
                    {inspected.kind === 'signature'
                      ? `${activeChar.name} Signature`
                      : inspected.kind.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-mono text-[var(--ink-muted)]">
                    {inspected.tier === 0 ? 'Starter' : `Tier ${inspected.tier}`}
                  </span>
                </div>

                <h3 className="font-display font-bold text-2xl sm:text-3xl text-[var(--ink)] mt-0.5 leading-tight">
                  {inspected.name}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--ink-muted)] mt-1 leading-relaxed">
                  {inspected.description}
                </p>
              </div>

              {/* Combat Modifiers Table */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 border border-[var(--ink-border)] bg-[var(--paper-card)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)] flex items-center gap-1">
                    <Sword className="w-3 h-3" aria-hidden="true" />
                    <span>Damage / Guard</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-[var(--ink)] mt-0.5 tabular-nums">
                    ×{inspected.damageMult.toFixed(2)} · Break ×{inspected.guardBreakMult.toFixed(2)}
                  </div>
                </div>
                <div className="p-2.5 border border-[var(--ink-border)] bg-[var(--paper-card)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)] flex items-center gap-1">
                    <Zap className="w-3 h-3" aria-hidden="true" />
                    <span>Speed / Reach</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-[var(--ink)] mt-0.5 tabular-nums">
                    ×{inspected.speedMult.toFixed(2)} · +{inspected.reachBonus}px
                  </div>
                </div>
                <div className="p-2.5 border border-[var(--ink-border)] bg-[var(--paper-card)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    <span>Flow Gain</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-[var(--ink)] mt-0.5 tabular-nums">
                    +{inspected.flowBonus} / hit
                  </div>
                </div>
                <div className="p-2.5 border border-[var(--ink-border)] bg-[var(--paper-card)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)] flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                    <span>Special Trait</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-[var(--ink)] mt-0.5 tabular-nums">
                    {inspected.lifestealOnHit
                      ? `+${inspected.lifestealOnHit} HP Leech`
                      : inspected.critChance
                        ? `${Math.round(inspected.critChance * 100)}% Crit`
                        : 'Balanced'}
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase / Equip Actions */}
            <div className="mt-5 pt-4 border-t border-[var(--ink-border)] flex flex-wrap items-center justify-between gap-2.5">
              {isOwned ? (
                <button
                  type="button"
                  data-equip-weapon="true"
                  disabled={isEquipped}
                  onClick={() => onEquipWeapon(inspected.id)}
                  className={`kata-btn w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold ${
                    isEquipped
                      ? 'bg-[var(--ink-track)] text-[var(--ink-muted)] cursor-default'
                      : 'bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                  <span>{isEquipped ? 'Currently Equipped' : 'Equip Weapon'}</span>
                </button>
              ) : (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-buy-coins="true"
                    disabled={!affordableCoins}
                    onClick={() => onBuyWeapon(inspected.id, 'coins')}
                    className={`kata-btn inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-semibold ${
                      affordableCoins
                        ? 'bg-[var(--gold)] text-[#141311] hover:opacity-90 cursor-pointer'
                        : 'bg-[var(--ink-track)] text-[var(--ink-muted)] cursor-not-allowed'
                    }`}
                  >
                    <Coins className="w-4 h-4 stroke-[2]" aria-hidden="true" />
                    <span>Buy · {inspected.costCoins} Coins</span>
                  </button>

                  <button
                    type="button"
                    data-buy-sp="true"
                    disabled={!affordableSP}
                    onClick={() => onBuyWeapon(inspected.id, 'sp')}
                    className={`kata-btn inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-semibold ${
                      affordableSP
                        ? 'bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer'
                        : 'bg-[var(--ink-track)] text-[var(--ink-muted)] cursor-not-allowed'
                    }`}
                  >
                    <Orbit className="w-4 h-4 stroke-[2]" aria-hidden="true" />
                    <span>Buy · {inspected.costSP} SP</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
