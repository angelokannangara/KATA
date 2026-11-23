import React, { useState } from 'react';
import { ChevronLeft, Lock, Sparkles } from 'lucide-react';
import { SKILL_MAP, SKILL_NODES, STANCE_META } from '../game/config';
import { canUnlockSkill } from '../game/save';
import { SaveData, SkillNode } from '../game/types';

interface SkillTreeModalProps {
  save: SaveData;
  onUnlock: (skillId: string) => void;
  onEquip: (skillId: string, slot: 0 | 1 | 2) => void;
  onClose: () => void;
  continueLabel?: string;
}

export const SkillTreeModal: React.FC<SkillTreeModalProps> = ({
  save,
  onUnlock,
  onEquip,
  onClose,
  continueLabel = 'Back',
}) => {
  const [selectedId, setSelectedId] = useState<string>(save.equippedSkills[0] || SKILL_NODES[0].id);
  const selected: SkillNode = SKILL_MAP[selectedId] ?? SKILL_NODES[0];
  const isUnlocked = save.unlockedSkills.includes(selected.id);
  const unlockable = canUnlockSkill(save, selected.id);
  const equippedSlot = save.equippedSkills.indexOf(selected.id);
  const slotLabels = ['U', 'I', 'O'] as const;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-6 bg-black/75">
      <div className="w-full max-w-5xl max-h-[92vh] bg-[var(--paper)] border-2 border-[var(--ink)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[var(--ink-border)]">
          <div>
            <h2 className="font-display font-bold text-2xl md:text-3xl text-[var(--ink)]">
              Skill Constellation
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Unlock stars · Equip 3 skills
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="font-mono font-bold text-base sm:text-lg tabular-nums text-[var(--ink)]">
              {save.spiritPoints} SP
            </div>
            <button
              type="button"
              onClick={onClose}
              className="kata-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2]" aria-hidden="true" />
              <span>{continueLabel}</span>
            </button>
          </div>
        </div>

        {/* Body: Constellation Canvas + Inspector */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
          {/* Left: Star Constellation Map (21 nodes across 3 stances) */}
          <div className="lg:col-span-8 relative min-h-[360px] md:min-h-[430px] bg-[#141311] overflow-hidden">
            {/* Branch Column Headers */}
            <div className="absolute top-3 inset-x-4 grid grid-cols-3 text-center text-xs font-display font-bold tracking-widest pointer-events-none z-10">
              <span style={{ color: '#65C4A6' }}>鶴 CRANE</span>
              <span style={{ color: '#E86A70' }}>虎 TIGER</span>
              <span style={{ color: '#E6BD5C' }}>蛇 SERPENT</span>
            </div>

            {/* SVG Constellation Connection Lines */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {SKILL_NODES.map((node) =>
                node.prerequisites.map((preId) => {
                  const pre = SKILL_MAP[preId];
                  if (!pre) return null;
                  const bothUnlocked =
                    save.unlockedSkills.includes(node.id) &&
                    save.unlockedSkills.includes(pre.id);
                  const preUnlocked = save.unlockedSkills.includes(pre.id);
                  const stanceColor = STANCE_META[node.stance].color;
                  return (
                    <line
                      key={`${preId}->${node.id}`}
                      x1={pre.x}
                      y1={pre.y}
                      x2={node.x}
                      y2={node.y}
                      stroke={bothUnlocked ? stanceColor : preUnlocked ? '#8C8478' : '#36322D'}
                      strokeWidth={bothUnlocked ? '0.65' : '0.35'}
                      strokeDasharray={bothUnlocked ? undefined : '1.2 1.2'}
                    />
                  );
                }),
              )}
            </svg>

            {/* Star Nodes */}
            {SKILL_NODES.map((node) => {
              const unlocked = save.unlockedSkills.includes(node.id);
              const available = canUnlockSkill(save, node.id);
              const isSelected = node.id === selected.id;
              const slotIdx = save.equippedSkills.indexOf(node.id);
              const sColor = STANCE_META[node.stance].color;

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  aria-label={`${node.name} (${node.stance} stance)`}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    transform: 'translate(-50%, -50%)',
                    borderColor: isSelected
                      ? '#F4EFE4'
                      : unlocked
                        ? sColor
                        : available
                          ? '#D6CEBF'
                          : '#4B463F',
                    backgroundColor: unlocked ? sColor : '#1C1A17',
                  }}
                  className="absolute w-7 h-7 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F4EFE4]"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: unlocked ? '#F4EFE4' : available ? '#F4EFE4' : '#5E584F',
                    }}
                  />
                  {slotIdx !== -1 && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 text-[10px] font-mono font-bold bg-[#F4EFE4] text-[#141311] flex items-center justify-center border border-[#141311]">
                      {slotLabels[slotIdx]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Star Inspector & 3-Slot Equipment Loadout */}
          <div className="lg:col-span-4 p-5 flex flex-col justify-between gap-5 bg-[var(--paper)] border-t lg:border-t-0 lg:border-l border-[var(--ink-border)]">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider">
                <span style={{ color: STANCE_META[selected.stance].color }}>
                  {STANCE_META[selected.stance].kanji} {STANCE_META[selected.stance].name}
                </span>
                <span className="font-mono text-[var(--ink-muted)] tabular-nums">
                  {isUnlocked ? 'Unlocked' : `${selected.costSP} SP`}
                </span>
              </div>

              <h3 className="font-display font-bold text-2xl sm:text-3xl text-[var(--ink)] mt-1">
                {selected.name}
              </h3>

              <p className="text-sm text-[var(--ink-muted)] leading-relaxed mt-2">
                {selected.summary}
              </p>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[var(--ink-border)] text-xs font-mono tabular-nums">
                <div>
                  <div className="font-sans text-[var(--ink-muted)]">DMG</div>
                  <div className="font-bold text-[var(--ink)] mt-0.5">
                    {selected.move.damage * (selected.move.multiHitCount ?? 1)}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[var(--ink-muted)]">FLOW</div>
                  <div className="font-bold text-[var(--ink)] mt-0.5">{selected.flowCost}</div>
                </div>
                <div>
                  <div className="font-sans text-[var(--ink-muted)]">CD</div>
                  <div className="font-bold text-[var(--ink)] mt-0.5">
                    {selected.cooldown.toFixed(1)}s
                  </div>
                </div>
              </div>

              {/* Unlock or Equip Actions */}
              <div className="mt-5">
                {!isUnlocked ? (
                  <button
                    type="button"
                    disabled={!unlockable}
                    onClick={() => onUnlock(selected.id)}
                    className={`kata-btn inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 text-sm font-semibold ${
                      unlockable
                        ? 'bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--crimson)] hover:text-[#F4EFE4] cursor-pointer'
                        : 'bg-[var(--ink-track)] text-[var(--ink-muted)] cursor-not-allowed shadow-none'
                    }`}
                  >
                    {unlockable ? (
                      <Sparkles className="w-4 h-4 stroke-[2]" aria-hidden="true" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
                    )}
                    <span>
                      {save.spiritPoints < selected.costSP
                        ? `Need ${selected.costSP} SP`
                        : unlockable
                          ? `Unlock (${selected.costSP} SP)`
                          : 'Locked'}
                    </span>
                  </button>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-[var(--ink-muted)] mb-2">
                      {equippedSlot !== -1
                        ? `Slot [${slotLabels[equippedSlot]}] · Reassign`
                        : 'Equip Slot'}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {([0, 1, 2] as const).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => onEquip(selected.id, slot)}
                          className={`kata-btn py-2 text-xs font-mono font-bold border cursor-pointer ${
                            equippedSlot === slot
                              ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]'
                              : 'border-[var(--ink-border)] text-[var(--ink)] hover:border-[var(--ink)]'
                          }`}
                        >
                          [{slotLabels[slot]}]
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active 3-Skill Loadout Summary */}
            <div className="pt-4 border-t border-[var(--ink-border)]">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-2">
                Loadout
              </div>
              <div className="space-y-1.5">
                {save.equippedSkills.map((id, idx) => {
                  const sk = SKILL_MAP[id];
                  if (!sk) return null;
                  return (
                    <button
                      key={`${id}-${idx}`}
                      type="button"
                      onClick={() => setSelectedId(id)}
                      className="kata-btn w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs border border-[var(--ink-border)] hover:border-[var(--ink)] cursor-pointer text-[var(--ink)]"
                    >
                      <span>
                        <strong className="font-mono mr-2">[{slotLabels[idx]}]</strong>
                        {sk.name}
                      </span>
                      <span
                        className="font-semibold"
                        style={{ color: STANCE_META[sk.stance].color }}
                      >
                        {STANCE_META[sk.stance].kanji}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
