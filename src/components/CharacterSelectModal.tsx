import React, { useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  Check,
  Coins,
  Crosshair,
  Flame,
  Ghost,
  HeartHandshake,
  Lock,
  Play,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Unlock,
  Zap,
} from 'lucide-react';
import { CHARACTER_LIST, getCharacterConfig } from '../game/characters';
import { STANCE_META } from '../game/config';
import { CharacterRole, GameMode, SaveData } from '../game/types';
import { getWeaponItem } from '../game/weapons';
import { CharacterPortraitCanvas } from './CharacterPortraitCanvas';

interface CharacterSelectModalProps {
  save: SaveData;
  mode: GameMode;
  onSelectCharacter: (characterId: string) => void;
  onUnlockCharacter: (characterId: string) => void;
  onOpenArmory?: () => void;
  onLockIn: (p1CharacterId: string, p2CharacterId?: string) => void;
  onBack: () => void;
}

function RoleIcon({ role, className = 'w-3.5 h-3.5' }: { role: CharacterRole; className?: string }) {
  switch (role) {
    case 'Duelist':
      return <Swords className={className} aria-hidden="true" />;
    case 'Assassin':
      return <Zap className={className} aria-hidden="true" />;
    case 'Tank':
      return <Shield className={className} aria-hidden="true" />;
    case 'Trickster':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'Bruiser':
      return <Flame className={className} aria-hidden="true" />;
    case 'Ranged':
      return <Crosshair className={className} aria-hidden="true" />;
    case 'Berserker':
      return <Skull className={className} aria-hidden="true" />;
    case 'Support':
      return <HeartHandshake className={className} aria-hidden="true" />;
    case 'Grappler':
      return <Anchor className={className} aria-hidden="true" />;
    case 'Mirror':
      return <Ghost className={className} aria-hidden="true" />;
  }
}

const PREVIEW_CYCLE: (
  | 'light'
  | 'heavy'
  | 'kick'
  | 'kick_combo'
  | 'skill_0'
  | 'skill_1'
  | 'skill_2'
  | 'ultimate'
)[] = ['light', 'kick', 'kick_combo', 'heavy', 'skill_0', 'skill_1', 'skill_2', 'ultimate'];

const PREVIEW_LABELS: Record<(typeof PREVIEW_CYCLE)[number], string> = {
  light: 'Light',
  heavy: 'Heavy',
  kick: 'Kick F',
  kick_combo: '360° Kick',
  skill_0: 'Skill U',
  skill_1: 'Skill I',
  skill_2: 'Skill O',
  ultimate: 'Ultimate P',
};

export const CharacterSelectModal: React.FC<CharacterSelectModalProps> = ({
  save,
  mode,
  onSelectCharacter,
  onUnlockCharacter,
  onOpenArmory,
  onLockIn,
  onBack,
}) => {
  const [inspectedId, setInspectedId] = useState<string>(save.selectedCharacterId || 'kenshin');
  const [pickingSlot, setPickingSlot] = useState<1 | 2>(1);
  const [p2CharId, setP2CharId] = useState<string>(
    save.selectedCharacterId === 'tomoe' ? 'kenshin' : 'tomoe',
  );
  const [previewIdx, setPreviewIdx] = useState<number>(0);
  const [previewAction, setPreviewAction] = useState<{
    kind: (typeof PREVIEW_CYCLE)[number];
    key: number;
  } | null>(null);

  const inspected = getCharacterConfig(inspectedId);
  const isUnlocked = save.unlockedCharacters.includes(inspected.id);
  const canAfford = save.spiritPoints >= inspected.unlockCostSP;
  const stanceMeta = STANCE_META[inspected.signatureStance];

  const handleCardClick = (charId: string) => {
    setInspectedId(charId);
    setPreviewAction(null);
    if (save.unlockedCharacters.includes(charId)) {
      if (pickingSlot === 1) {
        onSelectCharacter(charId);
      } else {
        setP2CharId(charId);
      }
    }
  };

  const handlePreviewMoves = () => {
    const kind = PREVIEW_CYCLE[previewIdx % PREVIEW_CYCLE.length];
    setPreviewAction((prev) => ({ kind, key: (prev?.key ?? 0) + 1 }));
    setPreviewIdx((prev) => (prev + 1) % PREVIEW_CYCLE.length);
  };

  const handlePrimaryConfirm = () => {
    if (!isUnlocked) {
      if (canAfford) {
        onUnlockCharacter(inspected.id);
      }
      return;
    }
    const chosenP1 = pickingSlot === 1 ? inspected.id : save.selectedCharacterId;
    onLockIn(chosenP1, mode === 'versus' || mode === 'dojo' ? p2CharId : undefined);
  };

  const statRows: { label: string; value: number }[] = [
    { label: 'Power', value: inspected.stats.power },
    { label: 'Speed', value: inspected.stats.speed },
    { label: 'Defense', value: inspected.stats.defense },
  ];

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
                {mode === 'versus' ? 'Versus Roster' : mode === 'dojo' ? 'Dojo Sparring' : 'Select Warrior'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {(mode === 'versus' || mode === 'dojo') && (
              <div className="inline-flex border border-[var(--ink-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setPickingSlot(1);
                    setInspectedId(save.selectedCharacterId);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    pickingSlot === 1
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'text-[var(--ink-muted)]'
                  }`}
                >
                  P1: {getCharacterConfig(save.selectedCharacterId).name}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickingSlot(2);
                    setInspectedId(p2CharId);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    pickingSlot === 2
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'text-[var(--ink-muted)]'
                  }`}
                >
                  P2: {getCharacterConfig(p2CharId).name}
                </button>
              </div>
            )}

            <div className="inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-bold px-2.5 py-1 border border-[var(--ink-border)] text-[var(--ink)] tabular-nums">
              <Coins className="w-3.5 h-3.5 text-[var(--gold)]" aria-hidden="true" />
              <span>{save.coins}</span>
            </div>

            <div className="font-mono text-xs sm:text-sm font-bold px-3 py-1 border border-[var(--ink-border)] text-[var(--ink)] tabular-nums">
              {save.spiritPoints} SP
            </div>

            {onOpenArmory && (
              <button
                type="button"
                onClick={onOpenArmory}
                className="kata-btn inline-flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-medium border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
              >
                <Sword className="w-3.5 h-3.5 text-[var(--gold)]" aria-hidden="true" />
                <span className="hidden sm:inline">{getWeaponItem(save.equippedWeaponId).name}</span>
                <span className="sm:hidden">Armory</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* Left: 10-Character MOBA Grid */}
          <div className="lg:w-[58%] p-3 sm:p-5 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-[var(--ink-border)]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5 gap-2.5">
              {CHARACTER_LIST.map((char) => {
                const unlocked = save.unlockedCharacters.includes(char.id);
                const selectedP1 = save.selectedCharacterId === char.id;
                const selectedP2 = (mode === 'versus' || mode === 'dojo') && p2CharId === char.id;
                const active = inspected.id === char.id;

                return (
                  <button
                    key={char.id}
                    type="button"
                    data-char-card={char.id}
                    onClick={() => handleCardClick(char.id)}
                    className={`relative text-left border transition-transform hover:-translate-y-0.5 cursor-pointer flex flex-col bg-[var(--paper-card)] ${
                      active
                        ? 'border-2 ring-1 ring-offset-1 ring-offset-[var(--paper)]'
                        : 'border-[var(--ink-border)] hover:border-[var(--ink)]'
                    }`}
                    style={{
                      borderColor: active ? char.accentColor : undefined,
                    }}
                  >
                    {/* Top accent bar */}
                    <div
                      className="h-1 w-full"
                      style={{ backgroundColor: char.accentColor }}
                    />

                    {/* Vector Silhouette Portrait */}
                    <div className="relative h-28 sm:h-32 w-full overflow-hidden">
                      <CharacterPortraitCanvas
                        characterId={char.id}
                        darkMode={save.settings.darkMode}
                        animated={false}
                        zoom={1.04}
                        className={`w-full h-full block ${!unlocked ? 'opacity-45 grayscale-[30%]' : ''}`}
                      />

                      {/* Role Icon Badge */}
                      <span
                        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center bg-[var(--paper)]/90 border border-[var(--ink-border)]"
                        style={{ color: char.accentColor }}
                        title={char.role}
                      >
                        <RoleIcon role={char.role} className="w-3 h-3" />
                      </span>

                      {/* P1 / P2 Selected Markers */}
                      {(selectedP1 || selectedP2) && (
                        <span
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#F4EFE4]"
                          style={{ backgroundColor: char.accentColor }}
                        >
                          {selectedP1 && selectedP2 ? 'P1/P2' : selectedP1 ? 'P1' : 'P2'}
                        </span>
                      )}

                      {/* Lock Overlay */}
                      {!unlocked && (
                        <div className="absolute inset-x-0 bottom-0 bg-[var(--ink)]/85 text-[var(--paper)] px-1.5 py-1 flex items-center justify-between text-[10px] font-mono">
                          <span className="inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                            <span>{char.unlockCostSP} SP</span>
                          </span>
                          {char.unlockChapter !== undefined && (
                            <span className="opacity-75">Ch.{char.unlockChapter + 1}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Label */}
                    <div className="px-2 py-1.5 border-t border-[var(--ink-border)]">
                      <div className="font-display font-bold text-xs sm:text-sm text-[var(--ink)] truncate">
                        {char.name}
                      </div>
                      <div className="text-[10px] text-[var(--ink-muted)] truncate">
                        {char.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Animated Character Inspector */}
          <div className="lg:w-[42%] p-4 sm:p-5 flex flex-col justify-between bg-[var(--paper)] lg:overflow-y-auto">
            <div>
              {/* Live Animated Stage + Header */}
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-4 items-stretch">
                <div className="relative h-52 sm:h-56 sm:w-48 lg:w-full xl:w-52 shrink-0 border border-[var(--ink-border)] bg-[var(--paper-card)] overflow-hidden">
                  <CharacterPortraitCanvas
                    characterId={inspected.id}
                    equippedWeaponId={pickingSlot === 1 ? save.equippedWeaponId : 'default'}
                    darkMode={save.settings.darkMode}
                    animated={true}
                    previewAction={previewAction}
                    zoom={1.06}
                    className="w-full h-full block"
                  />
                  <button
                    type="button"
                    data-preview-moves="true"
                    onClick={handlePreviewMoves}
                    className="kata-btn absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] cursor-pointer"
                  >
                    <Play className="w-2.5 h-2.5 stroke-[2.2]" aria-hidden="true" />
                    <span>
                      {previewAction
                        ? PREVIEW_LABELS[previewAction.kind]
                        : 'Preview Moves'}
                    </span>
                  </button>
                </div>

                {/* Identity & 3 Stat Bars */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: inspected.accentColor }}
                      >
                        <RoleIcon role={inspected.role} className="w-3.5 h-3.5" />
                        <span>{inspected.role}</span>
                      </span>
                      <span className="text-[var(--ink-muted)]">·</span>
                      <span style={{ color: stanceMeta.color }}>
                        {stanceMeta.kanji} {stanceMeta.name}
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-2xl sm:text-3xl text-[var(--ink)] mt-0.5 leading-tight">
                      {inspected.name}
                    </h3>
                    <div className="text-xs text-[var(--ink-muted)] mb-3">
                      {inspected.title}
                    </div>
                  </div>

                  {/* 3 Stat Bars */}
                  <div className="space-y-2">
                    {statRows.map((row) => (
                      <div key={row.label} className="flex items-center gap-2.5 text-xs">
                        <span className="w-14 font-medium text-[var(--ink-muted)]">
                          {row.label}
                        </span>
                        <div className="flex-1 h-2 bg-[var(--ink-track)] overflow-hidden">
                          <div
                            className="h-full transition-all duration-200"
                            style={{
                              width: `${row.value * 10}%`,
                              backgroundColor: inspected.accentColor,
                            }}
                          />
                        </div>
                        <span className="w-5 text-right font-mono text-[11px] text-[var(--ink)] tabular-nums">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Passive Box */}
              <div className="mt-4 p-2.5 border border-[var(--ink-border)] bg-[var(--paper-card)]">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                  <span>Passive · {inspected.passiveName}</span>
                  <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                    HP {inspected.maxHp}
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5 leading-snug">
                  {inspected.passiveSummary}
                </p>
              </div>

              {/* 3 Skills (U/I/O) + Ultimate (P) */}
              <div className="mt-3 space-y-1.5">
                {inspected.skills.map((sk, idx) => {
                  const key = idx === 0 ? 'U' : idx === 1 ? 'I' : 'O';
                  return (
                    <div
                      key={sk.id}
                      className="px-2.5 py-1.5 border border-[var(--ink-border)] flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold mr-1.5 text-[var(--ink)]">
                          [{key}]
                        </span>
                        <span className="font-semibold text-[var(--ink)]">{sk.name}</span>
                        <div className="text-[11px] text-[var(--ink-muted)] leading-snug mt-0.5">
                          {sk.summary}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--ink-muted)] whitespace-nowrap shrink-0">
                        {sk.flowCost} Flow
                      </span>
                    </div>
                  );
                })}

                {/* Ultimate Card */}
                <div
                  className="px-2.5 py-2 border-2 flex items-start justify-between gap-2 text-xs bg-[var(--ink)]/5"
                  style={{ borderColor: inspected.accentColor }}
                >
                  <div className="min-w-0">
                    <span
                      className="font-mono font-bold mr-1.5"
                      style={{ color: inspected.accentColor }}
                    >
                      [P] ULT
                    </span>
                    <span className="font-bold text-[var(--ink)]">{inspected.ultimate.name}</span>
                    <div className="text-[11px] text-[var(--ink-muted)] leading-snug mt-0.5">
                      {inspected.ultimate.summary}
                    </div>
                  </div>
                  <span
                    className="font-mono text-[10px] font-bold whitespace-nowrap shrink-0"
                    style={{ color: inspected.accentColor }}
                  >
                    {inspected.ultimate.flowCost} Flow
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Lock In / Unlock CTA */}
            <div className="mt-4 pt-3 border-t border-[var(--ink-border)] flex items-center justify-between gap-3">
              <div className="text-[11px] text-[var(--ink-muted)] truncate">
                {inspected.stanceTwist}
              </div>

              <button
                type="button"
                data-lock-in="true"
                disabled={!isUnlocked && !canAfford}
                onClick={handlePrimaryConfirm}
                className={`kata-btn inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  isUnlocked
                    ? 'bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4]'
                    : canAfford
                      ? 'bg-[var(--gold)] text-[#141311]'
                      : 'bg-[var(--ink-track)] text-[var(--ink-muted)] cursor-not-allowed'
                }`}
              >
                {isUnlocked ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                    <span>Lock In</span>
                  </>
                ) : (
                  <>
                    {canAfford ? (
                      <Unlock className="w-4 h-4 stroke-[2]" aria-hidden="true" />
                    ) : (
                      <Lock className="w-4 h-4 stroke-[2]" aria-hidden="true" />
                    )}
                    <span>Unlock · {inspected.unlockCostSP} SP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
