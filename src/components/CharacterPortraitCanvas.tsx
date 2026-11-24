import React, { useEffect, useRef } from 'react';
import { updateFighterAnimation } from '../game/animation';
import { getCharacterConfig } from '../game/characters';
import { createFighter, getMoveForAction } from '../game/combat';
import { CONFIG, STANCE_META } from '../game/config';
import { InkRenderer } from '../game/renderer';
import { ActionKind } from '../game/types';

interface CharacterPortraitCanvasProps {
  characterId: string;
  equippedWeaponId?: string;
  darkMode: boolean;
  animated?: boolean;
  facing?: 1 | -1;
  previewAction?: {
    kind: 'light' | 'heavy' | 'kick' | 'kick_combo' | 'skill_0' | 'skill_1' | 'skill_2' | 'ultimate';
    key: number;
  } | null;
  zoom?: number;
  className?: string;
}

export const CharacterPortraitCanvas: React.FC<CharacterPortraitCanvasProps> = ({
  characterId,
  equippedWeaponId = 'default',
  darkMode,
  animated = false,
  facing = 1,
  previewAction = null,
  zoom = 1.65,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<InkRenderer | null>(null);
  const fighterRef = useRef(
    createFighter({
      id: 1,
      characterId,
      name: getCharacterConfig(characterId).name,
      x: 600,
      facing,
      isAI: false,
      personality: 'balanced',
      maxHp: 120,
      stance: getCharacterConfig(characterId).signatureStance,
      equippedSkills: [
        getCharacterConfig(characterId).skills[0].id,
        getCharacterConfig(characterId).skills[1].id,
        getCharacterConfig(characterId).skills[2].id,
      ],
      accentColor: getCharacterConfig(characterId).accentColor,
      isEcho: characterId === 'echo',
      equippedWeaponId,
    }),
  );

  // Rebuild fighter when characterId, facing, or equippedWeaponId changes
  useEffect(() => {
    const char = getCharacterConfig(characterId);
    fighterRef.current = createFighter({
      id: 1,
      characterId,
      name: char.name,
      x: 600,
      facing,
      isAI: false,
      personality: 'balanced',
      maxHp: char.maxHp,
      stance: char.signatureStance,
      equippedSkills: [char.skills[0].id, char.skills[1].id, char.skills[2].id],
      accentColor: char.accentColor,
      isEcho: characterId === 'echo',
      equippedWeaponId,
    });
  }, [characterId, facing, equippedWeaponId]);

  // Trigger move preview animation cleanly
  useEffect(() => {
    if (!previewAction) return;
    const f = fighterRef.current;
    const move = getMoveForAction(f, previewAction.kind);
    if (!move) return;
    f.currentMove = move;
    f.action = previewAction.kind as ActionKind;
    f.actionTimer = 0;
    f.slashTrail = [];
  }, [previewAction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!rendererRef.current) {
      rendererRef.current = new InkRenderer();
    }
    const renderer = rendererRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();
    let time = 0;

    const drawOnce = (dt: number) => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(80, Math.round(rect.width || canvas.clientWidth || 160));
      const h = Math.max(80, Math.round(rect.height || canvas.clientHeight || 160));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const f = fighterRef.current;
      if (f.currentMove) {
        f.actionTimer += dt;
        const dur =
          f.currentMove.startup * STANCE_META[f.stance].startupMult +
          f.currentMove.active +
          f.currentMove.recovery;
        const sTime = f.currentMove.startup * STANCE_META[f.stance].startupMult;
        if (f.actionTimer >= sTime && f.actionTimer <= sTime + f.currentMove.active) {
          const limb = f.currentMove.activeLimb;
          const pt =
            limb === 'footR' || limb === 'bothFeet'
              ? f.joints.footR
              : limb === 'footL'
                ? f.joints.footL
                : limb === 'weaponTip'
                  ? f.weaponTip ?? f.joints.handR
                  : f.joints.handR;
          f.slashTrail.push({
            x: pt.x,
            y: pt.y,
            alpha: 1,
            width: f.currentMove.kind === 'ultimate' ? 14 : f.currentMove.spinArc ? 11 : 9,
            color: f.currentMove.inkColor ?? f.accentColor,
            style: f.currentMove.trailStyle,
          });
          if (f.slashTrail.length > 12) f.slashTrail.shift();
        }
        if (f.actionTimer >= dur) {
          f.currentMove = null;
          f.action = 'idle';
          f.actionTimer = 0;
        }
      }
      f.x = 600;
      f.y = CONFIG.groundY;
      updateFighterAnimation(f, dt);

      renderer.renderStandaloneCharacter({
        ctx,
        width: w,
        height: h,
        fighter: f,
        darkMode: true,
        time,
        zoom,
      });
    };

    if (!animated) {
      drawOnce(1 / 60);
      return;
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      time += dt;
      drawOnce(dt);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [characterId, equippedWeaponId, darkMode, animated, facing, zoom]);

  return <canvas ref={canvasRef} className={className} />;
};
