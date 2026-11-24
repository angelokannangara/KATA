import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';

type TouchAction = Parameters<GameEngine['triggerTouchButton']>[0];

interface PadButtonProps {
  label: string;
  sub?: string;
  color: string;
  filled?: boolean;
  dim?: boolean;
  big?: boolean;
  onDown: () => void;
  onUp?: () => void;
  ariaLabel: string;
}

const PadButton: React.FC<PadButtonProps> = ({
  label,
  sub,
  color,
  filled,
  dim,
  big,
  onDown,
  onUp,
  ariaLabel,
}) => {
  const [pressed, setPressed] = useState(false);
  const release = () => {
    if (pressed) {
      setPressed(false);
      onUp?.();
    }
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setPressed(true);
        onDown();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      className="touch-none select-none rounded-full flex flex-col items-center justify-center leading-none font-bold uppercase transition-transform"
      style={{
        width: big ? 'calc(var(--k) * 1.0)' : 'var(--k)',
        height: big ? 'calc(var(--k) * 1.0)' : 'var(--k)',
        border: `2px solid ${color}`,
        backgroundColor: pressed || filled ? color : 'rgba(12,10,18,0.72)',
        color: pressed || filled ? '#120f16' : color,
        opacity: dim && !pressed ? 0.45 : 1,
        transform: pressed ? 'scale(0.92)' : undefined,
        boxShadow: pressed ? `0 0 14px ${color}` : undefined,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 'calc(var(--k) * 0.34)' }}>{label}</span>
      {sub && <span style={{ fontSize: 'calc(var(--k) * 0.22)', opacity: 0.8, marginTop: 2 }}>{sub}</span>}
    </button>
  );
};

type CrossSlot = Omit<PadButtonProps, 'big'> | null;

const Cross: React.FC<{
  title: string;
  top: CrossSlot;
  left: CrossSlot;
  right: CrossSlot;
  bottom: CrossSlot;
  center: CrossSlot;
}> = ({ title, top, left, right, bottom, center }) => {
  const cell = (slot: CrossSlot, big = false) =>
    slot ? <PadButton {...slot} big={big} /> : <span aria-hidden="true" />;
  return (
    <div role="group" aria-label={title} className="flex flex-col items-center">
      <div
        className="grid place-items-center"
        style={{
          gridTemplateColumns: 'repeat(3, var(--k))',
          gridTemplateRows: 'repeat(3, var(--k))',
          gap: 2,
        }}
      >
        <span aria-hidden="true" />
        {cell(top)}
        <span aria-hidden="true" />
        {cell(left)}
        {cell(center, true)}
        {cell(right)}
        <span aria-hidden="true" />
        {cell(bottom)}
        <span aria-hidden="true" />
      </div>
    </div>
  );
};

export interface TouchControlsProps {
  engineRef: React.MutableRefObject<GameEngine | null>;
  skills: { glyph: string; cost: number; color: string; ready: boolean }[];
  ult: { ready: boolean; color: string };
  stance: { kanji: string; color: string };
}

/**
 * Cross-style mobile controls:
 *  - left: movement D-pad
 *  - right: skills cross (3 skills + ultimate, stance switch in the center)
 *  - far right: fight cross (light / heavy / kick / dash, parry in the center)
 */
export const TouchControls: React.FC<TouchControlsProps> = ({ engineRef, skills, ult, stance }) => {
  const dir = useRef({ left: false, right: false, up: false, down: false });

  const setDir = (patch: Partial<typeof dir.current>) => {
    dir.current = { ...dir.current, ...patch };
    engineRef.current?.setTouchDirectional(dir.current);
  };

  useEffect(
    () => () => {
      engineRef.current?.setTouchDirectional({ left: false, right: false, up: false, down: false });
      engineRef.current?.triggerTouchButton('block_up');
    },
    [engineRef],
  );

  const fire = (a: TouchAction) => () => engineRef.current?.triggerTouchButton(a);
  const MOVE = '#EFE9DC';
  const GOLD = '#FFC247';
  const RED = '#FF4A3D';
  const TEAL = '#65C4A6';

  const skillBtn = (idx: number): CrossSlot => {
    const s = skills[idx];
    if (!s) return null;
    return {
      label: s.glyph,
      sub: String(s.cost),
      color: s.color,
      dim: !s.ready,
      onDown: fire(`skill_${idx}` as TouchAction),
      ariaLabel: `Skill ${idx + 1}`,
    };
  };

  return (
    <div
      className="w-full flex items-end justify-between gap-2 pointer-events-auto"
      style={{
        ['--k' as string]: 'clamp(34px, 8.6vmin, 52px)',
        paddingBottom: 'max(4px, env(safe-area-inset-bottom))',
      }}
    >
      {/* MOVEMENT CROSS */}
      <Cross
        title="Movement"
        top={{
          label: '▲',
          sub: 'jump',
          color: MOVE,
          onDown: () => setDir({ up: true }),
          onUp: () => setDir({ up: false }),
          ariaLabel: 'Jump',
        }}
        left={{
          label: '◀',
          color: MOVE,
          onDown: () => setDir({ left: true }),
          onUp: () => setDir({ left: false }),
          ariaLabel: 'Move left',
        }}
        right={{
          label: '▶',
          color: MOVE,
          onDown: () => setDir({ right: true }),
          onUp: () => setDir({ right: false }),
          ariaLabel: 'Move right',
        }}
        bottom={{
          label: '▼',
          sub: 'duck',
          color: MOVE,
          onDown: () => setDir({ down: true }),
          onUp: () => setDir({ down: false }),
          ariaLabel: 'Crouch',
        }}
        center={null}
      />

      <div className="flex items-end gap-2 sm:gap-5">
        {/* SKILLS CROSS */}
        <Cross
          title="Skills"
          top={{
            label: 'ULT',
            color: ult.color,
            filled: ult.ready,
            dim: !ult.ready,
            onDown: fire('ultimate'),
            ariaLabel: 'Ultimate',
          }}
          left={skillBtn(0)}
          bottom={skillBtn(1)}
          right={skillBtn(2)}
          center={{
            label: stance.kanji,
            sub: 'stance',
            color: stance.color,
            onDown: fire('stance'),
            ariaLabel: 'Switch stance',
          }}
        />

        {/* FIGHT CROSS */}
        <Cross
          title="Fight"
          top={{ label: 'Heavy', color: RED, filled: true, onDown: fire('heavy'), ariaLabel: 'Heavy strike' }}
          left={{ label: 'Light', color: MOVE, onDown: fire('light'), ariaLabel: 'Light strike' }}
          right={{ label: 'Kick', color: GOLD, onDown: fire('kick'), ariaLabel: 'Kick' }}
          bottom={{ label: 'Dash', color: TEAL, onDown: fire('dash'), ariaLabel: 'Dash' }}
          center={{
            label: 'Parry',
            color: MOVE,
            onDown: fire('block_down'),
            onUp: fire('block_up'),
            ariaLabel: 'Parry (hold)',
          }}
        />
      </div>
    </div>
  );
};
