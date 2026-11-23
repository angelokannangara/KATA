import React, { useEffect, useRef, useState } from 'react';
import { Flame, LogOut, Pause, Volume2, VolumeX } from 'lucide-react';
import { getCharacterConfig } from '../game/characters';
import { STANCE_META } from '../game/config';
import { GameEngine } from '../game/engine';
import { HUDState, SaveData } from '../game/types';

interface BattleHUDProps {
  hud: HUDState;
  save: SaveData;
  engineRef: React.MutableRefObject<GameEngine | null>;
  onPause: () => void;
  onToggleMute: () => void;
  onReturnTitle: () => void;
}

export const BattleHUD: React.FC<BattleHUDProps> = ({
  hud,
  save,
  engineRef,
  onPause,
  onToggleMute,
  onReturnTitle,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const checkTouch = () => {
      const coarse =
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(pointer: coarse)').matches ||
          'ontouchstart' in window ||
          window.innerWidth < 768);
      setIsTouchDevice(Boolean(coarse));
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const showTouch =
    save.settings.touchControls === 'on' ||
    (save.settings.touchControls === 'auto' && isTouchDevice);

  const p1Char = getCharacterConfig(hud.p1.characterId);
  const p2Char = getCharacterConfig(hud.p2.characterId);
  const enemyAccent = hud.p2.isEcho ? '#B8861E' : p2Char.accentColor;

  const p1Stance = STANCE_META[hud.p1.stance];
  const p2Stance = STANCE_META[hud.p2.stance];

  const p1HpPct = Math.max(0, Math.min(100, (hud.p1.hp / hud.p1.maxHp) * 100));
  const p1GhostPct = Math.max(p1HpPct, Math.min(100, (hud.p1.ghostHp / hud.p1.maxHp) * 100));
  const p2HpPct = Math.max(0, Math.min(100, (hud.p2.hp / hud.p2.maxHp) * 100));
  const p2GhostPct = Math.max(p2HpPct, Math.min(100, (hud.p2.ghostHp / hud.p2.maxHp) * 100));

  const skillKeys = ['U', 'I', 'O'] as const;

  const handleStickPointer = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el || !engineRef.current) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxR = rect.width * 0.36;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = dist > maxR ? maxR / dist : 1;
    setStickOffset({ x: dx * clamped, y: dy * clamped });

    engineRef.current.setTouchDirectional({
      left: dx < -14,
      right: dx > 14,
      up: dy < -22,
      down: dy > 20,
    });
  };

  const resetStick = () => {
    setStickOffset({ x: 0, y: 0 });
    engineRef.current?.setTouchDirectional({
      left: false,
      right: false,
      up: false,
      down: false,
    });
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* TOP PERIMETER CLUSTER */}
      <div className="w-full px-3 pt-3 sm:px-5 sm:pt-4 md:px-7 md:pt-5">
        <div className="max-w-7xl mx-auto flex items-start justify-between gap-2 sm:gap-4">
          {/* Player 1 Cluster (Top-Left) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-1.5 mb-1">
              <div className="flex items-baseline gap-1 sm:gap-1.5 min-w-0">
                <span className="font-display font-bold text-[13px] sm:text-base md:text-lg text-[var(--ink)] truncate">
                  {hud.p1.name}
                </span>
                <span
                  className="text-[11px] sm:text-xs font-semibold tracking-wide whitespace-nowrap shrink-0"
                  style={{ color: p1Stance.color }}
                >
                  {p1Stance.kanji}{' '}
                  <span className="hidden sm:inline">{p1Stance.name}</span>
                </span>
              </div>
              <span className="text-[11px] sm:text-xs font-mono tabular-nums text-[var(--ink-muted)] shrink-0">
                {hud.p1.hp}
                <span className="hidden sm:inline">/{hud.p1.maxHp}</span>
              </span>
            </div>

            {/* Thick Black Health Bar with Light-Grey Track, Lagging Pale Trail & Hit Flash */}
            <div
              className="relative h-3.5 sm:h-4 md:h-5 bg-[var(--ink-track)] border border-[var(--ink)] overflow-hidden transition-colors duration-75"
              style={{
                backgroundColor: hud.p1.hitFlashing ? 'rgba(184, 41, 47, 0.35)' : undefined,
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-[var(--paper-dim)] border-r border-[var(--crimson)]/50"
                style={{ width: `${p1GhostPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 transition-colors duration-75"
                style={{
                  width: `${p1HpPct}%`,
                  backgroundColor: hud.p1.hitFlashing ? '#F4EFE4' : 'var(--ink)',
                }}
              />
            </div>

            {/* Thin Accent FLOW Bar + Mono Label + Two Square Round-Win Indicators */}
            <div className="flex items-center justify-between gap-1.5 sm:gap-3 mt-1.5">
              <div className="flex-1 min-w-[28px] h-1.5 bg-[var(--ink-track)] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${hud.p1.flow}%`,
                    backgroundColor: p1Stance.color,
                  }}
                />
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono tabular-nums text-[var(--ink-muted)] whitespace-nowrap">
                <span className="hidden sm:inline">FLOW </span>
                {hud.p1.flow}
              </span>
              {hud.mode !== 'dojo' && (
                <div
                  className="flex items-center gap-1 shrink-0"
                  aria-label={`Player 1 rounds won: ${hud.p1Rounds}`}
                >
                  {[0, 1].map((idx) => (
                    <span
                      key={idx}
                      className="w-2 h-2 sm:w-2.5 sm:h-2.5 border border-[var(--ink)] inline-block"
                      style={{
                        backgroundColor: idx < hud.p1Rounds ? p1Stance.color : 'transparent',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* HTML Brush-Styled Combo Counter */}
            {(hud.p1.combo >= 2 || hud.p1.counterActive) && (
              <div
                key={`combo-p1-${hud.p1.combo}-${hud.p1.stanceWeaveChain}`}
                className="animate-brush-in mt-2 inline-flex items-baseline gap-2"
              >
                {hud.p1.combo >= 2 && (
                  <span className="font-display font-bold text-lg sm:text-xl tracking-wide text-[var(--ink)] drop-shadow-sm tabular-nums">
                    {hud.p1.combo} HIT
                  </span>
                )}
                {hud.p1.stanceWeaveChain > 0 && (
                  <span
                    className="font-display font-bold text-sm sm:text-base tracking-wider uppercase"
                    style={{ color: p1Stance.color }}
                  >
                    · WEAVE ×{hud.p1.stanceWeaveChain}
                  </span>
                )}
                {hud.p1.counterActive && (
                  <span className="font-display font-bold text-sm tracking-wider uppercase text-[var(--gold)]">
                    · COUNTER
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Center Round Timer */}
          <div className="flex flex-col items-center shrink-0 px-1 sm:px-3 md:px-5 pt-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] sm:tracking-[0.22em] font-semibold text-[var(--ink-muted)]">
              {hud.mode === 'dojo' ? (
                'DOJO'
              ) : (
                <>
                  <span className="sm:hidden">R{hud.roundNumber}</span>
                  <span className="hidden sm:inline">ROUND {hud.roundNumber}</span>
                </>
              )}
            </span>
            <span className="font-display font-extrabold text-2xl sm:text-4xl leading-none tabular-nums text-[var(--ink)] mt-0.5">
              {hud.mode === 'dojo' ? '∞' : hud.roundTimer}
            </span>
          </div>

          {/* Player 2 / Enemy Cluster (Top-Right, Mirrored) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-1.5 mb-1">
              <span className="text-[11px] sm:text-xs font-mono tabular-nums text-[var(--ink-muted)] shrink-0">
                {hud.p2.hp}
                <span className="hidden sm:inline">/{hud.p2.maxHp}</span>
              </span>
              <div className="flex items-baseline justify-end gap-1 sm:gap-1.5 min-w-0 ml-auto">
                <span
                  className="text-[11px] sm:text-xs font-semibold tracking-wide whitespace-nowrap shrink-0"
                  style={{ color: p2Stance.color }}
                >
                  <span className="hidden sm:inline">{p2Stance.name} </span>
                  {p2Stance.kanji}
                </span>
                <span className="font-display font-bold text-[13px] sm:text-base md:text-lg text-[var(--ink)] truncate text-right">
                  {hud.p2.name}
                </span>
              </div>
            </div>

            {/* Right-to-Left Health Bar in Stage Accent Color */}
            <div
              className="relative h-3.5 sm:h-4 md:h-5 bg-[var(--ink-track)] border border-[var(--ink)] overflow-hidden transition-colors duration-75"
              style={{
                backgroundColor: hud.p2.hitFlashing ? 'rgba(184, 41, 47, 0.35)' : undefined,
              }}
            >
              <div
                className="absolute inset-y-0 right-0 bg-[var(--paper-dim)] border-l border-[var(--crimson)]/50"
                style={{ width: `${p2GhostPct}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 transition-colors duration-75"
                style={{
                  width: `${p2HpPct}%`,
                  backgroundColor: hud.p2.hitFlashing ? '#F4EFE4' : enemyAccent,
                }}
              />
            </div>

            {/* Mirrored Flow Bar + Mono Label + Two Square Round-Win Pips */}
            <div className="flex items-center justify-between gap-1.5 sm:gap-3 mt-1.5">
              {hud.mode !== 'dojo' && (
                <div
                  className="flex items-center gap-1 shrink-0"
                  aria-label={`Opponent rounds won: ${hud.p2Rounds}`}
                >
                  {[0, 1].map((idx) => (
                    <span
                      key={idx}
                      className="w-2 h-2 sm:w-2.5 sm:h-2.5 border border-[var(--ink)] inline-block"
                      style={{
                        backgroundColor: idx < hud.p2Rounds ? enemyAccent : 'transparent',
                      }}
                    />
                  ))}
                </div>
              )}
              <span className="text-[10px] sm:text-[11px] font-mono tabular-nums text-[var(--ink-muted)] whitespace-nowrap">
                <span className="hidden sm:inline">FLOW </span>
                {hud.p2.flow}
              </span>
              <div className="flex-1 min-w-[28px] h-1.5 bg-[var(--ink-track)] overflow-hidden">
                <div
                  className="h-full ml-auto"
                  style={{
                    width: `${hud.p2.flow}%`,
                    backgroundColor: enemyAccent,
                  }}
                />
              </div>
            </div>

            {hud.p2.combo >= 2 && (
              <div className="animate-brush-in mt-2 text-right font-display font-bold text-lg sm:text-xl tracking-wide text-[var(--ink)] tabular-nums">
                {hud.p2.combo} HIT
              </div>
            )}
          </div>

          {/* Far Top-Right Square Icon Buttons: Mute, Pause & Dojo Exit */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pointer-events-auto ml-0.5 sm:ml-1">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={save.settings.volume > 0 ? 'Mute Audio' : 'Unmute Audio'}
              title="Toggle Mute [M]"
              className="kata-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
            >
              {save.settings.volume > 0 ? (
                <Volume2 className="w-4 h-4 stroke-[1.9]" aria-hidden="true" />
              ) : (
                <VolumeX className="w-4 h-4 stroke-[1.9] text-[var(--crimson)]" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause Game"
              title="Pause [Esc]"
              className="kata-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
            >
              <Pause className="w-4 h-4 stroke-[2.1]" aria-hidden="true" />
            </button>
            {hud.mode === 'dojo' && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onReturnTitle();
                }}
                aria-label="Exit Dojo"
                className="kata-btn inline-flex items-center gap-1 px-2.5 h-7 sm:h-8 text-xs font-semibold border border-[var(--ink-border)] bg-[var(--paper-card)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
                <span>Exit</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BRUSH-STYLED HTML CALLOUTS (PARRY, WEAVE, COUNTER MIRROR) */}
      {hud.callouts.length > 0 && (
        <div className="fixed inset-x-0 top-[24%] z-10 pointer-events-none px-8 max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            {hud.callouts
              .filter((c) => c.side === 'left')
              .map((c) => (
                <div
                  key={c.id}
                  className="animate-brush-in font-display font-extrabold text-2xl sm:text-3xl tracking-[0.12em] uppercase"
                  style={{ color: c.color }}
                >
                  {c.text}
                </div>
              ))}
          </div>
          <div className="flex flex-col items-center gap-1">
            {hud.callouts
              .filter((c) => c.side === 'center')
              .map((c) => (
                <div
                  key={c.id}
                  className="animate-brush-in font-display font-extrabold text-2xl sm:text-3xl tracking-[0.12em] uppercase"
                  style={{ color: c.color }}
                >
                  {c.text}
                </div>
              ))}
          </div>
          <div className="flex flex-col items-end gap-1">
            {hud.callouts
              .filter((c) => c.side === 'right')
              .map((c) => (
                <div
                  key={c.id}
                  className="animate-brush-in font-display font-extrabold text-2xl sm:text-3xl tracking-[0.12em] uppercase"
                  style={{ color: c.color }}
                >
                  {c.text}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* CENTER BRUSH ANNOUNCEMENT BANNER (ROUND 1 / K.O.) */}
      {hud.announcement && (
        <div
          key={`ann-${hud.announcementKey}-${hud.announcement}`}
          className="animate-brush-in my-auto text-center pointer-events-none"
        >
          <div className="inline-flex flex-col items-center px-8 py-2.5 bg-[var(--paper-card)] border-y-2 border-[var(--ink)] shadow-sm">
            <span className="font-display font-extrabold text-3xl sm:text-5xl tracking-[0.2em] text-[var(--ink)] uppercase">
              {hud.announcement}
            </span>
            <svg viewBox="0 0 180 8" className="w-36 h-2 mt-1 overflow-visible" aria-hidden="true">
              <path
                d="M2 4 Q 90 1 178 5"
                stroke="var(--crimson)"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      )}

      {/* BOTTOM FULL-WIDTH DARK GROUND BAND */}
      <div className="w-full bg-[var(--ground-band)] border-t border-white/10 px-3 py-2.5 sm:px-5 sm:py-3 md:px-7">
        <div className="max-w-7xl mx-auto">
          {/* Desktop Skill Cards + Ultimate [P] + Dojo Strip */}
          {!showTouch && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              {/* Left: 3 Skill Cards + 4th Ultimate Card */}
              <div className="grid grid-cols-2 sm:flex sm:items-stretch gap-1.5 sm:gap-2">
                {hud.p1.skillsMeta.map((skill, idx) => {
                  const cd = hud.p1.skillCooldowns[idx] ?? 0;
                  const coolingDown = cd > 0.05;
                  const enoughFlow = hud.p1.flow >= skill.flowCost;
                  const ready = !coolingDown && enoughFlow;
                  const sMeta = STANCE_META[skill.stance];
                  const fillUpPct = coolingDown
                    ? Math.max(0, Math.min(100, (1 - cd / Math.max(0.1, skill.cooldown)) * 100))
                    : 0;

                  return (
                    <div
                      key={`${skill.id}-${idx}`}
                      className={`relative overflow-hidden px-2 py-1.5 sm:px-2.5 sm:py-2 min-w-0 sm:min-w-[132px] border-2 bg-[#1A1815] transition-opacity ${
                        ready ? 'skill-ready-pulse' : 'opacity-55'
                      }`}
                      style={{
                        borderColor: sMeta.color,
                        color: sMeta.color,
                      }}
                    >
                      {coolingDown && (
                        <div
                          className="absolute inset-x-0 bottom-0 pointer-events-none"
                          style={{
                            height: `${fillUpPct}%`,
                            backgroundColor: sMeta.color,
                            opacity: 0.24,
                          }}
                        />
                      )}

                      <div className="relative flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 bg-[#0A0908] text-[#EFE9DC] border border-white/20 rounded-[2px] shrink-0">
                            {skillKeys[idx]}
                          </span>
                          <span className="text-[11px] sm:text-xs font-bold text-[#EFE9DC] truncate">
                            {skill.name}
                          </span>
                        </div>
                        <span className="text-xs font-semibold shrink-0" style={{ color: sMeta.color }}>
                          {sMeta.kanji}
                        </span>
                      </div>

                      <div className="relative mt-1 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono tabular-nums">
                        <span className="text-[#B8B0A0]">Flow {skill.flowCost}</span>
                        {coolingDown ? (
                          <span className="text-[#EFE9DC]/85">CD {cd.toFixed(1)}s</span>
                        ) : !enoughFlow ? (
                          <span className="text-[#E87A7F]">Low Flow</span>
                        ) : (
                          <span style={{ color: sMeta.color }}>Ready</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 4th Card: Character Ultimate [P] */}
                {(() => {
                  const ultReady = hud.p1.flow >= hud.p1.ultimateCost;
                  const ultPct = Math.min(100, (hud.p1.flow / Math.max(1, hud.p1.ultimateCost)) * 100);
                  return (
                    <div
                      className={`relative overflow-hidden px-2 py-1.5 sm:px-3 sm:py-2 min-w-0 sm:min-w-[144px] border-2 bg-[#141210] transition-opacity ${
                        ultReady ? 'skill-ready-pulse' : 'opacity-70'
                      }`}
                      style={{
                        borderColor: p1Char.accentColor,
                        color: p1Char.accentColor,
                      }}
                    >
                      <div
                        className="absolute inset-x-0 bottom-0 pointer-events-none"
                        style={{
                          height: `${ultPct}%`,
                          backgroundColor: p1Char.accentColor,
                          opacity: ultReady ? 0.24 : 0.1,
                        }}
                      />
                      <div className="relative flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="font-mono text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 text-[#F4EFE4] rounded-[2px] shrink-0"
                            style={{ backgroundColor: p1Char.accentColor }}
                          >
                            P
                          </span>
                          <span className="text-[11px] sm:text-xs font-bold text-[#EFE9DC] truncate">
                            {hud.p1.ultimateName}
                          </span>
                        </div>
                        <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      </div>
                      <div className="relative mt-1 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono tabular-nums">
                        <span className="text-[#B8B0A0]">Ult {hud.p1.ultimateCost}</span>
                        {ultReady ? (
                          <span className="font-bold" style={{ color: p1Char.accentColor }}>
                            UNLEASH
                          </span>
                        ) : (
                          <span className="text-[#B8B0A0]">{Math.round(ultPct)}%</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Training Dojo Frame Data Strip */}
              {hud.mode === 'dojo' && (
                <div className="px-3 py-1.5 border border-white/15 bg-white/5 text-xs font-mono tabular-nums text-[var(--ground-text)]">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">{hud.dojoFrameData.moveName}</span>
                    <span>S {hud.dojoFrameData.startupF}f</span>
                    <span>A {hud.dojoFrameData.activeF}f</span>
                    <span>R {hud.dojoFrameData.recoveryF}f</span>
                    <span>Dmg {hud.dojoFrameData.damage}</span>
                    <span className="text-[#65C4A6]">{hud.dojoFrameData.lastHitBonus}</span>
                  </div>
                </div>
              )}

              {/* Bottom-Right Concise Hint */}
              {hud.mode !== 'dojo' && (
                <div className="text-xs font-mono text-[var(--ground-text)]/70 hidden lg:block text-right">
                  {hud.mode === 'versus'
                    ? 'P2: Arrows · N/M · , Parry · 7/8/9'
                    : 'Q/E Stance Weave · P Ultimate'}
                </div>
              )}
            </div>
          )}

          {/* MOBILE / TOUCH VIRTUAL CONTROLS */}
          {showTouch && (
            <div className="w-full flex items-end justify-between gap-2 pointer-events-auto">
              <div
                ref={stickRef}
                aria-label="Movement Joystick"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handleStickPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (e.buttons > 0 || e.pressure > 0) {
                    handleStickPointer(e.clientX, e.clientY);
                  }
                }}
                onPointerUp={resetStick}
                onPointerCancel={resetStick}
                className="relative w-22 h-22 sm:w-26 sm:h-26 rounded-full border-2 border-white/30 bg-white/5 touch-none flex items-center justify-center shrink-0"
              >
                <div
                  className="w-9 h-9 rounded-full bg-[#EFE9DC]/85"
                  style={{
                    transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)`,
                  }}
                />
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1">
                  {hud.p1.skillsMeta.map((skill, idx) => {
                    const ready =
                      hud.p1.skillCooldowns[idx] <= 0.05 && hud.p1.flow >= skill.flowCost;
                    const sColor = STANCE_META[skill.stance].color;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onPointerDown={() =>
                          engineRef.current?.triggerTouchButton(
                            idx === 0 ? 'skill_0' : idx === 1 ? 'skill_1' : 'skill_2',
                          )
                        }
                        className="min-w-[34px] h-9 px-2 text-xs font-mono font-bold border bg-[#1A1815] text-[#EFE9DC] rounded-[2px]"
                        style={{
                          borderColor: sColor,
                          opacity: ready ? 1 : 0.45,
                        }}
                      >
                        {skillKeys[idx]}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onPointerDown={() => engineRef.current?.triggerTouchButton('ultimate')}
                    className="min-w-[38px] h-9 px-2 text-xs font-mono font-bold border text-[#F4EFE4] rounded-[2px]"
                    style={{
                      borderColor: p1Char.accentColor,
                      backgroundColor:
                        hud.p1.flow >= hud.p1.ultimateCost ? p1Char.accentColor : '#1A1815',
                      opacity: hud.p1.flow >= hud.p1.ultimateCost ? 1 : 0.45,
                    }}
                  >
                    P
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => engineRef.current?.triggerTouchButton('stance')}
                    className="min-w-[54px] h-9 px-2 text-xs font-bold border bg-[#1A1815] rounded-[2px]"
                    style={{ borderColor: p1Stance.color, color: p1Stance.color }}
                  >
                    {p1Stance.kanji} {p1Stance.name}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onPointerDown={() => engineRef.current?.triggerTouchButton('block_down')}
                    onPointerUp={() => engineRef.current?.triggerTouchButton('block_up')}
                    onPointerCancel={() => engineRef.current?.triggerTouchButton('block_up')}
                    className="w-11 h-11 rounded-full border-2 border-white/40 bg-[#1A1815] text-[11px] font-bold text-[#EFE9DC]"
                  >
                    Parry
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => engineRef.current?.triggerTouchButton('dash')}
                    className="w-11 h-11 rounded-full border-2 border-white/40 bg-[#1A1815] text-[11px] font-bold text-[#EFE9DC]"
                  >
                    Dash
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => engineRef.current?.triggerTouchButton('light')}
                    className="w-12 h-12 rounded-full bg-[#EFE9DC] text-[#141311] text-xs font-bold"
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => engineRef.current?.triggerTouchButton('heavy')}
                    className="w-12 h-12 rounded-full bg-[var(--crimson)] text-[#F4EFE4] text-xs font-bold"
                  >
                    Heavy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
