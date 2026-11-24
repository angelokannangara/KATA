/**
 * KATA: Ink & Echo — Sumi-e Layered Samurai/Ninja Canvas 2D Renderer
 * Renders tapered vector silhouettes, layered armor & hakama, spring cloth chains,
 * attached real weapons, weapon-specific slash trails, projectiles, particles,
 * full-screen Ultimate ink flashes, and standalone character select previews.
 */

import { getCharacterConfig } from './characters';
import { CONFIG, STANCE_META } from './config';
import {
  CharacterConfig,
  FighterState,
  InkClone,
  JointPositions,
  Projectile,
  StageTheme,
  TrailStyle,
  UltimateOverlayState,
  WeaponConfig,
} from './types';
import { resolveFighterWeapon } from './weapons';

export type ParticleKind = 'ink' | 'dust' | 'spark' | 'ring';

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  gravity: number;
}

const PARTICLE_POOL_SIZE = 260;

function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => {
    let x = h.replace('#', '');
    if (x.length === 3) x = x.split('').map((c) => c + c).join('');
    const n = parseInt(x, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const m = (u: number, v: number) => Math.round(u + (v - u) * t);
  return '#' + [m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export class InkRenderer {
  private paperPattern: CanvasPattern | null = null;
  private backdropCache: HTMLCanvasElement | null = null;
  private backdropCacheKey = '';
  private particles: Particle[] = [];
  private particleCursor = 0;
  private dripSeeds: number[] = [];

  constructor() {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        kind: 'ink',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 4,
        alpha: 1,
        life: 0,
        maxLife: 0.5,
        color: '#141311',
        gravity: 600,
      });
    }
    for (let i = 0; i < 34; i++) {
      this.dripSeeds.push(0.45 + ((i * 73) % 100) / 110);
    }
  }

  private ensurePaperPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.paperPattern) return this.paperPattern;
    if (typeof document === 'undefined') return null;
    const off = document.createElement('canvas');
    off.width = 128;
    off.height = 128;
    const octx = off.getContext('2d');
    if (!octx) return null;
    octx.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 180; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const len = 2 + Math.random() * 6;
      const ang = Math.random() * Math.PI;
      octx.strokeStyle =
        i % 3 === 0 ? 'rgba(110, 92, 68, 0.045)' : 'rgba(255, 255, 255, 0.06)';
      octx.lineWidth = 0.8;
      octx.beginPath();
      octx.moveTo(x, y);
      octx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      octx.stroke();
    }
    this.paperPattern = ctx.createPattern(off, 'repeat');
    return this.paperPattern;
  }

  private ensureBackdropCache(
    width: number,
    height: number,
    stage: StageTheme,
    darkMode: boolean,
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const key = `${w}x${h}:${stage.id}:${darkMode ? 'd' : 'l'}`;
    if (this.backdropCache && this.backdropCacheKey === key) {
      return this.backdropCache;
    }
    if (!this.backdropCache) {
      this.backdropCache = document.createElement('canvas');
    }
    this.backdropCache.width = w;
    this.backdropCache.height = h;
    this.backdropCacheKey = key;
    const bctx = this.backdropCache.getContext('2d');
    if (!bctx) return null;

    if (!darkMode) {
      // Game sky: deep night at the top, glowing stage-colored horizon, big sun
      const a = stage.accent;
      const sky = bctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, mixHex(a, '#05040a', 0.86));
      sky.addColorStop(0.5, mixHex(a, '#05040a', 0.5));
      sky.addColorStop(1, mixHex(a, '#ffffff', 0.38));
      bctx.fillStyle = sky;
      bctx.fillRect(0, 0, w, h);
      const sx = w * 0.72;
      const sy = h * 0.36;
      const sr = Math.min(w, h) * 0.55;
      const glow = bctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      glow.addColorStop(0, mixHex(a, '#ffffff', 0.92) + 'ff');
      glow.addColorStop(0.2, mixHex(a, '#ffffff', 0.6) + 'bb');
      glow.addColorStop(1, a + '00');
      bctx.fillStyle = glow;
      bctx.fillRect(0, 0, w, h);
      bctx.fillStyle = mixHex(a, '#ffffff', 0.94);
      bctx.beginPath();
      bctx.arc(sx, sy, Math.min(w, h) * 0.09, 0, Math.PI * 2);
      bctx.fill();
    } else {
      const bgGrad = bctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, stage.paper);
      bgGrad.addColorStop(1, stage.paperDark);
      bctx.fillStyle = bgGrad;
      bctx.fillRect(0, 0, w, h);
      const pat = this.ensurePaperPattern(bctx);
      if (pat) {
        bctx.fillStyle = pat;
        bctx.fillRect(0, 0, w, h);
      }
    }

    const vig = bctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      Math.min(w, h) * 0.34,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.75,
    );
    vig.addColorStop(0, 'rgba(20, 19, 17, 0)');
    vig.addColorStop(1, darkMode ? 'rgba(20, 19, 17, 0.12)' : 'rgba(4, 3, 8, 0.62)');
    bctx.fillStyle = vig;
    bctx.fillRect(0, 0, w, h);

    return this.backdropCache;
  }

  /** Floating embers / fireflies for atmosphere (screen space). */
  private drawEmbers(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    stage: StageTheme,
    time: number,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = mixHex(stage.accent, '#ffffff', 0.6);
    for (let i = 0; i < 34; i++) {
      const sp = 10 + (i % 5) * 5;
      const rise = 16 + (i % 4) * 7;
      const span = width + 40;
      const x = ((((i * 137.5 + time * sp) % span) + span) % span) - 20;
      const y = height * 0.92 - ((i * 61 + time * rise) % (height * 0.85));
      ctx.globalAlpha = (0.25 + 0.35 * Math.abs(Math.sin(time * 1.6 + i))) * Math.max(0, y / height);
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public spawnBurst(params: {
    kind: ParticleKind;
    x: number;
    y: number;
    count: number;
    dirX?: number;
    speedMin?: number;
    speedMax?: number;
    sizeMin?: number;
    sizeMax?: number;
    color?: string;
    life?: number;
  }): void {
    const {
      kind,
      x,
      y,
      count,
      dirX = 0,
      speedMin = 80,
      speedMax = 340,
      sizeMin = 3,
      sizeMax = 9,
      color = '#141311',
      life = 0.48,
    } = params;

    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;

      const spreadAngle =
        dirX !== 0
          ? (dirX > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.65
          : Math.random() * Math.PI * 2;
      const spd = speedMin + Math.random() * (speedMax - speedMin);

      p.active = true;
      p.kind = kind;
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = Math.cos(spreadAngle) * spd;
      p.vy =
        kind === 'dust'
          ? -Math.abs(Math.sin(spreadAngle) * spd * 0.45) - 18
          : Math.sin(spreadAngle) * spd - (kind === 'ink' ? 95 : 0);
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.alpha = 1;
      p.life = 0;
      p.maxLife = life * (0.75 + Math.random() * 0.5);
      p.color = color;
      p.gravity = kind === 'ink' ? 880 : kind === 'dust' ? -25 : 220;
    }
  }

  public spawnRing(x: number, y: number, color: string, size = 18): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
    p.active = true;
    p.kind = 'ring';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.size = size;
    p.alpha = 0.95;
    p.life = 0;
    p.maxLife = 0.32;
    p.color = color;
    p.gravity = 0;
  }

  public updateParticles(dt: number): void {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      if (p.kind === 'ring') {
        p.size += dt * 260;
        p.alpha = 1 - p.life / p.maxLife;
      } else {
        p.vy += p.gravity * dt;
        p.vx *= Math.exp(-2.8 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'ink' && p.y > CONFIG.groundY) {
          p.y = CONFIG.groundY;
          p.vx *= 0.3;
          p.vy = 0;
        }
        p.alpha = 1 - Math.pow(p.life / p.maxLife, 1.4);
      }
    }
  }

  public renderFrame(params: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    stage: StageTheme;
    time: number;
    cameraX: number;
    cameraZoom: number;
    shakeX: number;
    shakeY: number;
    p1: FighterState;
    p2: FighterState;
    projectiles: Projectile[];
    clones: InkClone[];
    inkTransition: number;
    ultimateOverlay?: UltimateOverlayState | null;
    darkMode?: boolean;
  }): void {
    const {
      ctx,
      width,
      height,
      stage: rawStage,
      time,
      cameraX,
      cameraZoom,
      shakeX,
      shakeY,
      p1,
      p2,
      projectiles,
      clones,
      inkTransition,
      ultimateOverlay = null,
      darkMode = false,
    } = params;

    const stage: StageTheme = darkMode
      ? {
          ...rawStage,
          paper: '#171614',
          paperDark: '#100F0E',
          ink: '#EAE3D4',
          accent: rawStage.id === 'bridge' ? '#5882C4' : rawStage.accent,
        }
      : rawStage;

    ctx.save();

    // 1. Cached rice-paper base + vignette
    const cachedBg = this.ensureBackdropCache(width, height, stage, darkMode);
    if (cachedBg) {
      ctx.drawImage(cachedBg, 0, 0, width, height);
    } else {
      ctx.fillStyle = stage.paper;
      ctx.fillRect(0, 0, width, height);
    }

    this.drawEmbers(ctx, width, height, stage, time);

    const baseScale = Math.min(width / CONFIG.arenaWidth, height / CONFIG.virtualHeight);
    const scale = Math.max(0.42, baseScale) * cameraZoom;
    const worldCenterX = CONFIG.arenaWidth * 0.5 + cameraX;
    const worldFocusY = CONFIG.groundY - 125;

    ctx.save();
    ctx.translate(width * 0.5 + shakeX, height * 0.68 + shakeY);
    ctx.scale(scale, scale);
    ctx.translate(-worldCenterX, -worldFocusY);

    // 2. Stage parallax layers
    this.drawStageParallax(ctx, stage, time, cameraX);

    // 3. Full-screen Ultimate Ink Dim + Diagonal Slash Lines (behind fighters so silhouettes pop!)
    if (ultimateOverlay?.active) {
      ctx.save();
      const dimAlpha = Math.sin(Math.min(1, ultimateOverlay.progress) * Math.PI) * 0.78;
      ctx.fillStyle = darkMode ? 'rgba(6, 5, 5, 0.88)' : 'rgba(12, 11, 10, 0.82)';
      ctx.globalAlpha = Math.max(0.25, dimAlpha);
      ctx.fillRect(-600, -400, CONFIG.arenaWidth + 1200, CONFIG.virtualHeight + 600);

      // Diagonal accent ink slashes cutting across screen
      ctx.strokeStyle = ultimateOverlay.accentColor;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const yOff = 140 + i * 72 + Math.sin(time * 9 + i) * 14;
        ctx.globalAlpha = (0.35 + (i % 2) * 0.3) * Math.max(0.4, dimAlpha);
        ctx.lineWidth = i % 2 === 0 ? 5 : 2.2;
        ctx.beginPath();
        ctx.moveTo(-200, yOff + 160);
        ctx.lineTo(CONFIG.arenaWidth + 200, yOff - 190);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Soft brush-stroke ground
    this.drawBrushGround(ctx, stage, darkMode ? '#0D0C0B' : stage.ink);

    // 5. Ink Clones (decoy silhouettes)
    for (const clone of clones) {
      const alpha = Math.max(0, 0.62 * (clone.life / clone.maxLife));
      this.drawCharacterVectorSilhouette(ctx, clone.joints, clone.facing, {
        char: getCharacterConfig('tomoe'),
        fill: stage.ink,
        highlight: stage.paper,
        accent: clone.color,
        alpha,
        scarf: [],
        ponytail: [],
        sashTails: [],
        glow: 0.4,
        isEcho: false,
        vx: 0,
        isDash: false,
        animTime: time,
        weaponBase: clone.joints.handR,
        weaponTip: clone.joints.handR,
        weaponAngle: 0,
        chainTip: clone.joints.handL,
        isAttacking: false,
      });
    }

    // 6. Afterimages & Slash trails behind fighters
    this.drawAfterimages(ctx, p1, stage);
    this.drawAfterimages(ctx, p2, stage);
    this.drawSlashTrail(ctx, p1);
    this.drawSlashTrail(ctx, p2);

    // 7. Fighters (with contact shadow on ground)
    this.drawContactShadow(ctx, p1);
    this.drawContactShadow(ctx, p2);
    this.drawFighter(ctx, p2, stage, time);
    this.drawFighter(ctx, p1, stage, time);

    // 8. Projectiles (waves, shurikens, kunai, arrows)
    for (const proj of projectiles) {
      if (!proj.active) continue;
      this.drawProjectile(ctx, proj, stage, time);
    }

    // 9. Pooled Ink, Dust & Parry Ring Particles
    this.drawParticles(ctx);

    ctx.restore();

    // 10. Ink-Drip Screen Transition Curtain
    if (inkTransition > 0.005) {
      this.drawInkDripCurtain(ctx, width, height, darkMode ? '#0D0C0B' : stage.ink, inkTransition);
    }

    ctx.restore();
  }

  /**
   * Standalone portrait/inspector renderer used inside Character Select & VS Splash canvases.
   */
  public renderStandaloneCharacter(params: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    fighter: FighterState;
    darkMode?: boolean;
    time: number;
    zoom?: number;
  }): void {
    const { ctx, width, height, fighter, darkMode = false, time, zoom = 1.65 } = params;
    const ink = darkMode ? '#EAE3D4' : '#141311';
    const paper = darkMode ? '#181614' : '#F4EFE4';
    const char = getCharacterConfig(fighter.characterId);
    const resolvedWeapon = resolveFighterWeapon(char, fighter.equippedWeaponId);
    const previewAccent = resolvedWeapon.bladeTint ?? char.accentColor;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Subtle ink moon halo behind character
    ctx.fillStyle = previewAccent;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.44, Math.min(width, height) * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = previewAccent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.44, Math.min(width, height) * 0.38, 0.3, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const fitDim = Math.min(width * 0.94, height * 0.82);
    const scale = (fitDim / 210) * zoom;
    ctx.translate(width * 0.5, height * 0.88);
    ctx.scale(scale, scale);
    ctx.translate(-fighter.x, -CONFIG.groundY);

    // Ground brush line
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(fighter.x, CONFIG.groundY + 4, 48, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    this.drawSlashTrail(ctx, fighter);
    this.drawCharacterVectorSilhouette(ctx, fighter.joints, fighter.facing, {
      char,
      fill: ink,
      highlight: paper,
      accent: fighter.accentColor || char.accentColor,
      alpha: 1,
      scarf: fighter.scarf,
      ponytail: fighter.ponytail,
      sashTails: fighter.sashTails,
      glow: fighter.currentMove ? 0.7 : 0.15,
      isEcho: fighter.isEcho || fighter.characterId === 'echo',
      vx: fighter.vx,
      isDash: fighter.action === 'dash_fwd' || fighter.action === 'dash_back',
      animTime: time,
      weaponBase: fighter.weaponBase,
      weaponTip: fighter.weaponTip,
      weaponAngle: fighter.weaponAngle,
      chainTip: fighter.chainTip,
      isAttacking: fighter.currentMove !== null,
      equippedWeaponId: fighter.equippedWeaponId,
    });

    ctx.restore();
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    proj: Projectile,
    stage: StageTheme,
    time: number,
  ): void {
    ctx.save();
    ctx.translate(proj.x, proj.y);
    const dir = proj.vx >= 0 ? 1 : -1;

    if (proj.kind === 'shuriken') {
      ctx.rotate(time * 22 * dir);
      ctx.fillStyle = stage.ink;
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const r = proj.radius * 0.65;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * (r * 0.3), Math.sin(a + Math.PI / 4) * (r * 0.3));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (proj.kind === 'arrow' || proj.kind === 'kunai') {
      ctx.scale(dir, 1);
      ctx.strokeStyle = stage.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(10, -5);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.scale(dir, 1);
      ctx.strokeStyle = proj.color;
      ctx.fillStyle = stage.ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, proj.radius, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      ctx.arc(-6, 0, proj.radius * 0.82, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawStageParallax(
    ctx: CanvasRenderingContext2D,
    stage: StageTheme,
    time: number,
    cameraX: number,
  ): void {
    const gy = CONFIG.groundY;

    // Celestial disc (Sun / Moon / Eclipse)
    ctx.save();
    const moonX = CONFIG.arenaWidth * 0.5 - cameraX * 0.08;
    const moonY = gy - 260;
    if (stage.motif === 'eclipse') {
      ctx.fillStyle = stage.accent;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 84, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = stage.ink;
      ctx.globalAlpha = 0.94;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 72, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = stage.accent;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 92, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 118, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Distant sumi-e mountain ridge
    ctx.save();
    const mShift = -cameraX * 0.14;
    ctx.fillStyle = stage.ink;
    ctx.globalAlpha = 0.075;
    ctx.beginPath();
    ctx.moveTo(-400 + mShift, gy);
    ctx.lineTo(-120 + mShift, gy - 170);
    ctx.lineTo(140 + mShift, gy - 95);
    ctx.lineTo(420 + mShift, gy - 210);
    ctx.lineTo(680 + mShift, gy - 120);
    ctx.lineTo(960 + mShift, gy - 235);
    ctx.lineTo(1280 + mShift, gy - 115);
    ctx.lineTo(1600 + mShift, gy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Midground motif
    ctx.save();
    const midShift = -cameraX * 0.28;
    ctx.translate(midShift, 0);

    if (stage.motif === 'bamboo') {
      const stalks = [130, 175, 210, 990, 1035, 1085];
      stalks.forEach((bx, i) => {
        const sway = Math.sin(time * 1.1 + i * 0.8) * 9;
        ctx.strokeStyle = stage.ink;
        ctx.globalAlpha = 0.13 + (i % 2) * 0.06;
        ctx.lineWidth = 5 + (i % 3) * 2;
        ctx.beginPath();
        ctx.moveTo(bx, gy);
        ctx.quadraticCurveTo(bx + sway * 0.5, gy - 160, bx + sway, gy - 340);
        ctx.stroke();

        ctx.fillStyle = stage.accent;
        ctx.globalAlpha = 0.16;
        for (let seg = 1; seg <= 3; seg++) {
          const ly = gy - seg * 85;
          const lx = bx + sway * (seg / 3.2);
          ctx.beginPath();
          ctx.ellipse(lx + 16, ly, 16, 4, -0.35 + sway * 0.01, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    } else if (stage.motif === 'torii') {
      ctx.fillStyle = stage.accent;
      ctx.globalAlpha = 0.16;
      const tx = 600;
      ctx.fillRect(tx - 115, gy - 245, 16, 245);
      ctx.fillRect(tx + 99, gy - 245, 16, 245);
      ctx.fillRect(tx - 148, gy - 210, 296, 13);
      ctx.beginPath();
      ctx.moveTo(tx - 168, gy - 255);
      ctx.quadraticCurveTo(tx, gy - 235, tx + 168, gy - 255);
      ctx.lineTo(tx + 158, gy - 238);
      ctx.quadraticCurveTo(tx, gy - 222, tx - 158, gy - 238);
      ctx.closePath();
      ctx.fill();
    } else if (stage.motif === 'pagoda') {
      ctx.fillStyle = stage.ink;
      ctx.globalAlpha = 0.11;
      const px = 600;
      for (let tier = 0; tier < 3; tier++) {
        const ty = gy - 105 - tier * 72;
        const w = 150 - tier * 28;
        ctx.fillRect(px - w * 0.52, ty, w * 1.04, 62);
        ctx.beginPath();
        ctx.moveTo(px - w * 0.95, ty + 6);
        ctx.quadraticCurveTo(px, ty - 22, px + w * 0.95, ty + 6);
        ctx.lineTo(px + w * 0.7, ty + 14);
        ctx.lineTo(px - w * 0.7, ty + 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = stage.accent;
      ctx.globalAlpha = 0.28 + Math.sin(time * 2.4) * 0.05;
      ctx.beginPath();
      ctx.arc(360, gy - 115, 11, 0, Math.PI * 2);
      ctx.arc(840, gy - 115, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage.motif === 'bridge') {
      ctx.strokeStyle = stage.ink;
      ctx.fillStyle = stage.ink;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 4;
      for (let x = 140; x <= 1060; x += 230) {
        ctx.fillRect(x - 6, gy - 82, 12, 82);
        ctx.beginPath();
        ctx.arc(x, gy - 86, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(60, gy - 68);
      ctx.lineTo(1140, gy - 68);
      ctx.stroke();
    } else if (stage.motif === 'eclipse') {
      ctx.strokeStyle = stage.ink;
      ctx.globalAlpha = 0.1;
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(600, gy - 150, 185, 0.35, Math.PI * 2 - 0.25);
      ctx.stroke();
    }

    // Drifting mist ribbon
    ctx.fillStyle = stage.paper;
    ctx.globalAlpha = 0.35;
    const mistDrift = Math.sin(time * 0.4) * 45;
    ctx.beginPath();
    ctx.ellipse(600 + mistDrift, gy - 20, 640, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawBrushGround(
    ctx: CanvasRenderingContext2D,
    stage: StageTheme,
    groundColor: string = stage.ink,
  ): void {
    const gy = CONFIG.groundY;
    ctx.save();
    ctx.fillStyle = groundColor;
    ctx.fillRect(-350, gy, CONFIG.arenaWidth + 700, 320);

    ctx.strokeStyle = groundColor;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-300, gy + 1);
    for (let x = -300; x <= CONFIG.arenaWidth + 300; x += 60) {
      const wave = Math.sin(x * 0.025) * 2.5;
      ctx.lineTo(x, gy + wave);
    }
    ctx.stroke();

    ctx.strokeStyle = stage.accent;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CONFIG.arenaPadding, gy + 5);
    ctx.lineTo(CONFIG.arenaWidth - CONFIG.arenaPadding, gy + 5);
    ctx.stroke();

    ctx.restore();
  }

  private drawContactShadow(ctx: CanvasRenderingContext2D, f: FighterState): void {
    const heightAboveGround = Math.max(0, CONFIG.groundY - f.y);
    const scale = Math.max(0.35, 1 - heightAboveGround / 280);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 14, 12, 0.24)';
    ctx.beginPath();
    ctx.ellipse(f.x, CONFIG.groundY + 4, 38 * scale, 6.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawAfterimages(ctx: CanvasRenderingContext2D, f: FighterState, stage: StageTheme): void {
    const char = getCharacterConfig(f.characterId);
    for (const ghost of f.afterimages) {
      this.drawCharacterVectorSilhouette(ctx, ghost.joints, ghost.facing, {
        char,
        fill: ghost.color,
        highlight: stage.paper,
        accent: ghost.color,
        alpha: ghost.alpha * 0.34,
        scarf: ghost.scarf,
        ponytail: [],
        sashTails: [],
        glow: 0,
        isEcho: false,
        vx: 0,
        isDash: true,
        animTime: 0,
        weaponBase: ghost.joints.handR,
        weaponTip: ghost.joints.handR,
        weaponAngle: 0,
        chainTip: ghost.joints.handL,
        isAttacking: false,
      });
    }
  }

  private drawSlashTrail(ctx: CanvasRenderingContext2D, f: FighterState): void {
    if (f.slashTrail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const style: TrailStyle =
      f.slashTrail[f.slashTrail.length - 1]?.style ??
      getCharacterConfig(f.characterId).trailStyle;

    for (let i = 1; i < f.slashTrail.length; i++) {
      const prev = f.slashTrail[i - 1];
      const curr = f.slashTrail[i];
      if (curr.alpha <= 0.02) continue;
      const tRatio = i / f.slashTrail.length;

      if (style === 'kick') {
        // Dramatic sweeping martial-arts wind crescent + crisp inner ink streak
        ctx.strokeStyle = curr.color;
        ctx.globalAlpha = curr.alpha * 0.88;
        ctx.lineWidth = Math.max(3, curr.width * 1.45 * tRatio);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();

        ctx.strokeStyle = '#F4EFE4';
        ctx.globalAlpha = curr.alpha * 0.65;
        ctx.lineWidth = Math.max(1.6, curr.width * 0.4 * tRatio);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y - 4);
        ctx.lineTo(curr.x, curr.y - 4);
        ctx.stroke();
      } else if (style === 'claws') {
        // Triple rake lines
        ctx.strokeStyle = curr.color;
        ctx.globalAlpha = curr.alpha * 0.8;
        ctx.lineWidth = Math.max(1.5, curr.width * 0.32 * tRatio);
        for (const offset of [-6, 0, 6]) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y + offset);
          ctx.lineTo(curr.x, curr.y + offset);
          ctx.stroke();
        }
      } else if (style === 'chain') {
        ctx.strokeStyle = curr.color;
        ctx.globalAlpha = curr.alpha * 0.72;
        ctx.lineWidth = Math.max(2, curr.width * 0.55 * tRatio);
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (style === 'odachi' || style === 'naginata') {
        // Wide ink brush arc with hot paper core
        ctx.strokeStyle = curr.color;
        ctx.globalAlpha = curr.alpha * 0.82;
        ctx.lineWidth = curr.width * 1.35 * tRatio;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();

        ctx.strokeStyle = '#F4EFE4';
        ctx.globalAlpha = curr.alpha * 0.55;
        ctx.lineWidth = Math.max(1.5, curr.width * 0.3 * tRatio);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      } else {
        ctx.strokeStyle = curr.color;
        ctx.globalAlpha = curr.alpha * 0.82;
        ctx.lineWidth = curr.width * tRatio;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawFighter(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    stage: StageTheme,
    time: number,
  ): void {
    const char = getCharacterConfig(f.characterId);
    const isSkill =
      f.action === 'skill_0' ||
      f.action === 'skill_1' ||
      f.action === 'skill_2' ||
      f.action === 'ultimate' ||
      f.counterWindowTimer > 0;
    const activeColor = f.currentMove?.inkColor ?? (f.accentColor || char.accentColor);
    const fill = f.hitFlashTimer > 0 ? stage.paper : stage.ink;

    const inTelegraph =
      f.currentMove !== null &&
      f.actionTimer < f.currentMove.startup * STANCE_META[f.stance].startupMult &&
      (f.currentMove.kind === 'heavy' ||
        f.currentMove.kind === 'skill' ||
        f.currentMove.kind === 'ultimate');

    if (inTelegraph || isSkill || f.empoweredDrawReady) {
      ctx.save();
      ctx.strokeStyle = activeColor;
      ctx.globalAlpha = isSkill ? 0.34 : 0.24;
      ctx.lineWidth = f.action === 'ultimate' ? 11 : isSkill ? 7 : 4.5;
      ctx.beginPath();
      ctx.arc(
        f.joints.shoulder.x,
        (f.joints.shoulder.y + f.joints.hip.y) * 0.5,
        f.action === 'ultimate' ? 66 : isSkill ? 54 : 44,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    }

    if (f.blocking || f.currentMove?.isCounter) {
      ctx.save();
      ctx.strokeStyle = f.currentMove?.isCounter ? '#B8861E' : activeColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 4;
      const cx = f.joints.shoulder.x + f.facing * 24;
      const cy = (f.joints.shoulder.y + f.joints.hip.y) * 0.5;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        38,
        f.facing === 1 ? -1.05 : Math.PI - 1.05,
        f.facing === 1 ? 1.05 : Math.PI + 1.05,
      );
      ctx.stroke();
      ctx.restore();
    }

    this.drawCharacterVectorSilhouette(ctx, f.joints, f.facing, {
      char,
      fill,
      highlight: stage.paper,
      accent: activeColor,
      alpha: 1,
      scarf: f.scarf,
      ponytail: f.ponytail ?? [],
      sashTails: f.sashTails ?? [],
      glow: isSkill ? 0.85 : 0,
      isEcho: f.isEcho || f.characterId === 'echo',
      vx: f.vx,
      isDash: f.action === 'dash_fwd' || f.action === 'dash_back',
      animTime: time,
      weaponBase: f.weaponBase ?? f.joints.handR,
      weaponTip: f.weaponTip ?? f.joints.handR,
      weaponAngle: f.weaponAngle ?? 0,
      chainTip: f.chainTip ?? f.joints.handL,
      isAttacking: f.currentMove !== null,
      equippedWeaponId: f.equippedWeaponId,
    });
  }

  private drawTaperedLimb(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    rA: number,
    rB: number,
    rimColor?: string,
  ): void {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      ctx.beginPath();
      ctx.arc(ax, ay, rA, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const nx = -dy / len;
    const ny = dx / len;
    const ang = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(ax + nx * rA, ay + ny * rA);
    ctx.lineTo(bx + nx * rB, by + ny * rB);
    ctx.arc(bx, by, rB, ang + Math.PI * 0.5, ang - Math.PI * 0.5, true);
    ctx.lineTo(ax - nx * rA, ay - ny * rA);
    ctx.arc(ax, ay, rA, ang - Math.PI * 0.5, ang + Math.PI * 0.5, true);
    ctx.closePath();
    ctx.fill();

    // Subtle paper-white lit rim edge
    if (rimColor) {
      ctx.save();
      ctx.strokeStyle = rimColor;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(ax + nx * rA, ay + ny * rA);
      ctx.lineTo(bx + nx * rB, by + ny * rB);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawChainRibbon(
    ctx: CanvasRenderingContext2D,
    nodes: { x: number; y: number }[],
    color: string,
    startW: number,
    stepDrop: number,
  ): void {
    if (nodes.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < nodes.length; i++) {
      ctx.lineWidth = Math.max(1.8, startW - i * stepDrop);
      ctx.beginPath();
      ctx.moveTo(nodes[i - 1].x, nodes[i - 1].y);
      ctx.lineTo(nodes[i].x, nodes[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCharacterVectorSilhouette(
    ctx: CanvasRenderingContext2D,
    j: JointPositions,
    facing: 1 | -1,
    opts: {
      char: CharacterConfig;
      fill: string;
      highlight: string;
      accent: string;
      alpha: number;
      scarf: { x: number; y: number }[];
      ponytail: { x: number; y: number }[];
      sashTails: { x: number; y: number }[];
      glow: number;
      isEcho: boolean;
      vx: number;
      isDash: boolean;
      animTime: number;
      weaponBase: { x: number; y: number };
      weaponTip: { x: number; y: number };
      weaponAngle: number;
      chainTip: { x: number; y: number };
      isAttacking: boolean;
      equippedWeaponId?: string;
    },
  ): void {
    const { char, fill, highlight, accent } = opts;
    const resolvedWeapon = resolveFighterWeapon(char, opts.equippedWeaponId);
    const weaponCfg = resolvedWeapon.weaponConfig;
    const weaponAccent = resolvedWeapon.bladeTint ?? accent;
    const bulk = char.proportions.limbBulk;
    const sWidth = char.proportions.shoulderWidth;
    const billow = Math.min(18, Math.abs(opts.vx) * 0.022) * (opts.isDash ? 1.5 : 1);

    ctx.save();
    ctx.globalAlpha = opts.alpha;

    if (opts.glow > 0 || opts.isEcho) {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = opts.glow > 0 ? 0.25 * opts.glow : 0.16;
      ctx.lineWidth = opts.glow > 0 ? 11 : 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(j.head.x, j.head.y);
      ctx.lineTo(j.shoulder.x, j.shoulder.y);
      ctx.lineTo(j.hip.x, j.hip.y);
      ctx.stroke();
      ctx.restore();
    }

    // 1. Secondary cloth behind body: scarf, ponytail, obi sash tails
    this.drawChainRibbon(ctx, opts.scarf, accent, 8.5, 1.0);
    if (opts.ponytail.length >= 2) {
      this.drawChainRibbon(ctx, opts.ponytail, fill, 6.2, 0.75);
    }
    if (opts.sashTails.length >= 2) {
      this.drawChainRibbon(ctx, opts.sashTails, accent, 5.2, 0.7);
    }

    ctx.fillStyle = fill;

    // 2. Back arm & kimono sleeve behind torso
    if (char.costume.kimonoSleeves) {
      this.drawKimonoSleeve(ctx, j.shoulder, j.elbowL, j.handL, facing, fill, highlight, opts.vx);
    }
    this.drawTaperedLimb(ctx, j.shoulder.x, j.shoulder.y, j.elbowL.x, j.elbowL.y, 7 * bulk, 5 * bulk);
    this.drawTaperedLimb(ctx, j.elbowL.x, j.elbowL.y, j.handL.x, j.handL.y, 5 * bulk, 3.3 * bulk);

    // 3. Back leg (hakama flare or tabi shin wrap)
    if (char.costume.hakama) {
      this.drawHakamaLeg(ctx, j.hip, j.kneeL, j.footL, facing, fill, billow);
    } else {
      this.drawTaperedLimb(ctx, j.hip.x, j.hip.y, j.kneeL.x, j.kneeL.y, 10.5 * bulk, 7 * bulk);
      this.drawTaperedLimb(ctx, j.kneeL.x, j.kneeL.y, j.footL.x, j.footL.y, 6.8 * bulk, 3.8 * bulk);
    }
    this.drawTabiFoot(ctx, j.kneeL, j.footL, facing, fill, accent, char.costume.tabiShins);

    // 4. Torso (broad shoulder armor chest silhouette tapering cleanly into waist)
    const chestRadius = (char.costume.chestPlate ? 16.5 : 13.8) * sWidth * bulk;
    const waistRadius = 9.5 * bulk;
    this.drawTaperedLimb(
      ctx,
      j.shoulder.x,
      j.shoulder.y,
      j.hip.x,
      j.hip.y,
      chestRadius,
      waistRadius,
      highlight,
    );

    // Chest armor collar plates
    if (char.costume.chestPlate) {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(j.shoulder.x - facing * 13 * sWidth, j.shoulder.y - 2);
      ctx.lineTo(j.shoulder.x + facing * 15 * sWidth, j.shoulder.y + 3);
      ctx.lineTo(j.hip.x + facing * 10, j.hip.y - 6);
      ctx.lineTo(j.hip.x - facing * 11, j.hip.y - 6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.28;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Front leg
    if (char.costume.hakama) {
      this.drawHakamaLeg(ctx, j.hip, j.kneeR, j.footR, facing, fill, billow, highlight);
    } else {
      this.drawTaperedLimb(ctx, j.hip.x, j.hip.y, j.kneeR.x, j.kneeR.y, 11 * bulk, 7.2 * bulk, highlight);
      this.drawTaperedLimb(ctx, j.kneeR.x, j.kneeR.y, j.footR.x, j.footR.y, 7 * bulk, 3.8 * bulk, highlight);
    }
    this.drawTabiFoot(ctx, j.kneeR, j.footR, facing, fill, accent, char.costume.tabiShins);

    // 6. Waist armor kusazuri & obi sash
    if (char.costume.kusazuri) {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(j.hip.x - 14 * sWidth, j.hip.y - 2);
      ctx.lineTo(j.hip.x + 14 * sWidth, j.hip.y - 2);
      ctx.lineTo(j.hip.x + 21 * sWidth, j.hip.y + 22);
      ctx.lineTo(j.hip.x - 21 * sWidth, j.hip.y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.restore();
    }

    if (char.costume.obiSash) {
      ctx.save();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(j.hip.x - 11.5 * bulk, j.hip.y - 5, 23 * bulk, 8.5, 3);
      ctx.fill();
      ctx.restore();
    }

    // Katana scabbard (saya) on hip when applicable
    if (weaponCfg.sheathOnHip) {
      ctx.save();
      ctx.translate(j.hip.x - facing * 4, j.hip.y + 1);
      ctx.rotate(facing * 0.36);
      ctx.strokeStyle = fill;
      ctx.lineWidth = 4.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-facing * 36, 10);
      ctx.lineTo(facing * 14, -4);
      ctx.stroke();
      ctx.strokeStyle = weaponAccent;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-facing * 8, 2);
      ctx.lineTo(facing * 5, -1.5);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Head + distinctive silhouette headgear + glowing eye slit
    this.drawHeadgear(ctx, j, facing, char, fill, highlight, accent);

    // 8. Shoulder armor sode (if armored)
    if (char.costume.sodeArmor) {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 1.3;
      ctx.translate(j.shoulder.x - facing * 4, j.shoulder.y - 2);
      ctx.rotate(-facing * 0.25);
      ctx.beginPath();
      ctx.roundRect(-14, -8, 26, 20, 3);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.restore();
    }

    // 9. Front arm + sleeve + real weapon attached to hand joint
    if (char.costume.kimonoSleeves) {
      this.drawKimonoSleeve(ctx, j.shoulder, j.elbowR, j.handR, facing, fill, highlight, opts.vx);
    }
    this.drawTaperedLimb(ctx, j.shoulder.x, j.shoulder.y, j.elbowR.x, j.elbowR.y, 7.6 * bulk, 5.4 * bulk, highlight);
    this.drawTaperedLimb(ctx, j.elbowR.x, j.elbowR.y, j.handR.x, j.handR.y, 5.4 * bulk, 3.6 * bulk, highlight);

    this.drawWeapon(ctx, j, facing, weaponCfg, fill, highlight, weaponAccent, {
      base: opts.weaponBase,
      tip: opts.weaponTip,
      angle: opts.weaponAngle,
      chainTip: opts.chainTip,
      isAttacking: opts.isAttacking,
    });

    ctx.restore();
  }

  private drawHakamaLeg(
    ctx: CanvasRenderingContext2D,
    hip: { x: number; y: number },
    knee: { x: number; y: number },
    foot: { x: number; y: number },
    facing: 1 | -1,
    fill: string,
    billow: number,
    rimColor?: string,
  ): void {
    const dir = foot.x >= hip.x ? 1 : -1;
    const flare = 12 + billow * 0.55;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(hip.x - 10, hip.y - 2);
    ctx.lineTo(hip.x + 10, hip.y - 2);
    ctx.quadraticCurveTo(knee.x + 13 + dir * flare * 0.4, knee.y, foot.x + 11, foot.y - 6);
    ctx.lineTo(foot.x - 12 - dir * flare * 0.5, foot.y - 6);
    ctx.quadraticCurveTo(knee.x - 14 - facing * flare * 0.3, knee.y, hip.x - 10, hip.y - 2);
    ctx.closePath();
    ctx.fill();

    if (rimColor) {
      ctx.strokeStyle = rimColor;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hip.x + 10, hip.y - 2);
      ctx.quadraticCurveTo(knee.x + 13, knee.y, foot.x + 11, foot.y - 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawKimonoSleeve(
    ctx: CanvasRenderingContext2D,
    shoulder: { x: number; y: number },
    elbow: { x: number; y: number },
    hand: { x: number; y: number },
    facing: 1 | -1,
    fill: string,
    highlight: string,
    vx: number,
  ): void {
    const lag = Math.max(-14, Math.min(14, -vx * 0.03));
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(hand.x - facing * 4, hand.y - 2);
    ctx.lineTo(hand.x - facing * 8 + lag, hand.y + 18);
    ctx.quadraticCurveTo(elbow.x - facing * 12 + lag, elbow.y + 22, shoulder.x - facing * 8, shoulder.y + 16);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = highlight;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(hand.x - facing * 4, hand.y - 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawTabiFoot(
    ctx: CanvasRenderingContext2D,
    knee: { x: number; y: number },
    foot: { x: number; y: number },
    facing: 1 | -1,
    fill: string,
    accent: string,
    wrappedShins: boolean,
  ): void {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(foot.x + facing * 4, foot.y, 7.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (wrappedShins) {
      const dx = knee.x - foot.x;
      const dy = knee.y - foot.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy * 4.4;
      const py = ux * 4.4;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const dist of [9, 15]) {
        const cx = foot.x + ux * dist;
        const cy = foot.y + uy * dist;
        ctx.moveTo(cx - px, cy - py);
        ctx.lineTo(cx + px, cy + py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHeadgear(
    ctx: CanvasRenderingContext2D,
    j: JointPositions,
    facing: 1 | -1,
    char: CharacterConfig,
    fill: string,
    highlight: string,
    accent: string,
  ): void {
    const hx = j.head.x;
    const hy = j.head.y;
    const hr = CONFIG.headRadius;
    const tilt = Math.atan2(hx - j.shoulder.x, j.shoulder.y - hy);

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(tilt * 0.55);

    // Base cranium silhouette
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.fill();

    // Subtle paper highlight rim on brow/crown
    ctx.strokeStyle = highlight;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, hr, -Math.PI * 0.75, -Math.PI * 0.05);
    ctx.stroke();
    ctx.globalAlpha = 1;

    switch (char.costume.headgear) {
      case 'topknot': {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(-facing * 5, -hr - 3, 7, 4, -0.3 * facing, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.fillRect(-hr + 1, -6, hr * 2 - 2, 3.2);
        break;
      }
      case 'ninja_hood': {
        // Sleek mask collar + headband
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(0, 2, hr + 1.5, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.fillRect(-hr - 1, -5, hr * 2 + 2, 3);
        break;
      }
      case 'monk_kabuto': {
        // Heavy domed iron monk helmet + flared side plates
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(0, -2, hr + 4.5, Math.PI, Math.PI * 2);
        ctx.lineTo(hr + 6, 4);
        ctx.lineTo(-hr - 6, 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = highlight;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Forehead steel crest
        ctx.fillStyle = accent;
        ctx.fillRect(-4, -hr - 4, 8, 5);
        break;
      }
      case 'kasa_hat': {
        // Wide woven samurai straw kasa cone hat
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(0, -hr - 11);
        ctx.lineTo(facing * 32, -3);
        ctx.quadraticCurveTo(0, -7, -facing * 32, -3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = highlight;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -hr - 11);
        ctx.lineTo(facing * 32, -3);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-facing * 24, -4);
        ctx.lineTo(facing * 24, -4);
        ctx.stroke();
        break;
      }
      case 'crest_kabuto': {
        // Horned crescent kabuto helmet + back shikoro neck guard
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(0, -2, hr + 3.5, Math.PI * 0.9, Math.PI * 2.1);
        ctx.lineTo(-facing * (hr + 9), 11);
        ctx.lineTo(-facing * 4, 9);
        ctx.closePath();
        ctx.fill();
        // Crescent kuwagata horns in accent gold/blue
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(facing * 5, -hr + 1);
        ctx.lineTo(facing * 21, -hr - 17);
        ctx.lineTo(facing * 12, -hr - 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(facing * 1, -hr + 1);
        ctx.lineTo(-facing * 11, -hr - 15);
        ctx.lineTo(-facing * 3, -hr - 2);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'ponytail': {
        ctx.fillStyle = accent;
        ctx.fillRect(-hr, -6, hr * 2, 3);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(-facing * (hr - 1), -5, 4.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'oni_mask': {
        // Wild top mane + curved oni horns
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(facing * 4, -hr + 2);
        ctx.lineTo(facing * 13, -hr - 15);
        ctx.lineTo(facing * 9, -hr + 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(-facing * 3, -hr + 2);
        ctx.lineTo(-facing * 12, -hr - 13);
        ctx.lineTo(-facing * 7, -hr + 3);
        ctx.closePath();
        ctx.fill();
        // Oni lower tusk jaw silhouette
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(facing * 10, 4);
        ctx.lineTo(facing * 15, -1);
        ctx.lineTo(facing * 13, 7);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'fox_mask': {
        // Pointed kitsune ears + white/crimson shrine face edge
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(-2, -hr + 3);
        ctx.lineTo(-7, -hr - 13);
        ctx.lineTo(5, -hr + 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(5, -hr + 3);
        ctx.lineTo(facing * 11, -hr - 12);
        ctx.lineTo(facing * 12, -hr + 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(facing * 6, -3);
        ctx.lineTo(facing * 13, 2);
        ctx.stroke();
        break;
      }
      case 'phantom_hood': {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(facing * hr, -4);
        ctx.quadraticCurveTo(0, -hr - 11, -facing * (hr + 11), 3);
        ctx.lineTo(-facing * 4, hr);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'echo_cowl': {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(facing * hr, -2);
        ctx.quadraticCurveTo(-facing * 4, -hr - 9, -facing * (hr + 8), -2);
        ctx.lineTo(-facing * (hr + 3), 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, hr + 1.5, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
        break;
      }
    }

    // Thin glowing accent eye slit (reads silhouette direction & personality cleanly!)
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(facing * 8, -2, 4.4, 1.65, -0.18 * facing, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawWeapon(
    ctx: CanvasRenderingContext2D,
    j: JointPositions,
    facing: 1 | -1,
    weaponCfg: WeaponConfig,
    fill: string,
    highlight: string,
    accent: string,
    w: {
      base: { x: number; y: number };
      tip: { x: number; y: number };
      angle: number;
      chainTip: { x: number; y: number };
      isAttacking: boolean;
    },
  ): void {
    const kind = weaponCfg.kind;
    ctx.save();

    if (kind === 'katana' || kind === 'odachi') {
      const len = weaponCfg.length;
      const thick = weaponCfg.width;
      ctx.translate(w.base.x, w.base.y);
      ctx.rotate(w.angle);
      // Handle (tsuka)
      ctx.fillStyle = fill;
      ctx.fillRect(-15, -2.5, 16, 5);
      // Hand guard (tsuba)
      ctx.fillStyle = accent;
      ctx.fillRect(0, -6.5, 3.5, 13);
      // Slightly curved ink-steel blade
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(3, -thick * 0.55);
      ctx.quadraticCurveTo(len * 0.55, -thick * 0.9, len, -1.2);
      ctx.lineTo(len - 5, thick * 0.65);
      ctx.quadraticCurveTo(len * 0.5, thick * 0.35, 3, thick * 0.45);
      ctx.closePath();
      ctx.fill();
      // Weapon accent fuller sheen
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.quadraticCurveTo(len * 0.52, -thick * 0.2, len - 6, 0.2);
      ctx.stroke();
      // Paper-white keen blade glint edge
      ctx.strokeStyle = highlight;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(4, -thick * 0.5);
      ctx.quadraticCurveTo(len * 0.55, -thick * 0.85, len, -1);
      ctx.stroke();
    } else if (kind === 'twin_kunai') {
      // Draw kunai in both hands!
      for (const hand of [
        { pos: j.handR, elbow: j.elbowR },
        { pos: j.handL, elbow: j.elbowL },
      ]) {
        const ang = Math.atan2(hand.pos.y - hand.elbow.y, hand.pos.x - hand.elbow.x);
        ctx.save();
        ctx.translate(hand.pos.x, hand.pos.y);
        ctx.rotate(ang);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(2, -4);
        ctx.lineTo(weaponCfg.length, 0);
        ctx.lineTo(2, 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(-6, 0, 3.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (kind === 'naginata') {
      ctx.translate(w.base.x, w.base.y);
      ctx.rotate(w.angle);
      const shaftLen = weaponCfg.length - 26;
      // Long polearm shaft
      ctx.strokeStyle = fill;
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(shaftLen, 0);
      ctx.stroke();
      // Accent ring + tassel
      ctx.fillStyle = accent;
      ctx.fillRect(shaftLen - 4, -4.5, 6, 9);
      // Curved glaive blade
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(shaftLen, -2.5);
      ctx.quadraticCurveTo(shaftLen + 18, -7, shaftLen + 30, -3);
      ctx.lineTo(shaftLen + 23, 5.5);
      ctx.lineTo(shaftLen, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = highlight;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(shaftLen + 1, -2.5);
      ctx.quadraticCurveTo(shaftLen + 18, -7, shaftLen + 30, -3);
      ctx.stroke();
    } else if (kind === 'war_fan') {
      ctx.translate(w.base.x, w.base.y);
      ctx.rotate(w.angle);
      // Unfolded tessen war-fan arc
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 29, -0.78, 0.78);
      ctx.closePath();
      ctx.fill();
      // Crimson/accent outer rim + ribs
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, 28, -0.74, 0.74);
      ctx.stroke();
      ctx.strokeStyle = highlight;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      for (const rib of [-0.4, 0, 0.4]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(rib) * 26, Math.sin(rib) * 26);
        ctx.stroke();
      }
    } else if (kind === 'bow') {
      ctx.translate(j.handL.x, j.handL.y);
      ctx.scale(facing, 1);
      // Asymmetric yumi bow curve
      ctx.strokeStyle = fill;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(-4, -36);
      ctx.quadraticCurveTo(16, -8, 12, 0);
      ctx.quadraticCurveTo(14, 14, -3, 30);
      ctx.stroke();
      // Bowstring & nocked arrow tip glint
      ctx.strokeStyle = highlight;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, -36);
      ctx.lineTo(w.isAttacking ? -14 : -4, 0);
      ctx.lineTo(-3, 30);
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(24, 0);
      ctx.stroke();
    } else if (kind === 'iron_claws') {
      for (const hand of [
        { pos: j.handR, elbow: j.elbowR },
        { pos: j.handL, elbow: j.elbowL },
      ]) {
        const ang = Math.atan2(hand.pos.y - hand.elbow.y, hand.pos.x - hand.elbow.x);
        ctx.save();
        ctx.translate(hand.pos.x, hand.pos.y);
        ctx.rotate(ang);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.2;
        for (const off of [-4.5, 0, 4.5]) {
          ctx.beginPath();
          ctx.moveTo(0, off);
          ctx.quadraticCurveTo(12, off + 1, 20, off - 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (kind === 'staff') {
      ctx.translate(w.base.x, w.base.y);
      ctx.rotate(w.angle);
      const len = weaponCfg.length;
      ctx.strokeStyle = fill;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.lineTo(len - 8, 0);
      ctx.stroke();
      // Sacred brass shrine ring at tip
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(len - 4, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = highlight;
      ctx.fillRect(len - 13, 5, 5, 11);
    } else if (kind === 'kusarigama') {
      // Kama sickle in right hand
      ctx.save();
      ctx.translate(w.base.x, w.base.y);
      ctx.rotate(w.angle);
      ctx.strokeStyle = fill;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(18, -1);
      ctx.quadraticCurveTo(28, 12 * facing, 10, 22 * facing);
      ctx.quadraticCurveTo(20, 10 * facing, 14, 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Animated chain link from handL -> chainTip + heavy iron weight
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(j.handL.x, j.handL.y);
      ctx.quadraticCurveTo(
        (j.handL.x + w.chainTip.x) * 0.5,
        (j.handL.y + w.chainTip.y) * 0.5 + 14,
        w.chainTip.x,
        w.chainTip.y,
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(w.chainTip.x, w.chainTip.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active || p.alpha <= 0.01) continue;
      ctx.globalAlpha = p.alpha;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'dust') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.2 - p.alpha * 0.3), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        const speed = Math.hypot(p.vx, p.vy);
        const angle = Math.atan2(p.vy, p.vx);
        const stretch = Math.min(2.6, 1 + speed / 260);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * stretch, p.size * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private drawInkDripCurtain(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    inkColor: string,
    progress: number,
  ): void {
    ctx.save();
    ctx.fillStyle = inkColor;
    const cols = this.dripSeeds.length;
    const colW = width / cols + 2;
    for (let i = 0; i < cols; i++) {
      const dripH = Math.min(height + 80, height * progress * (0.8 + this.dripSeeds[i] * 0.65));
      const x = i * (width / cols);
      ctx.fillRect(x, 0, colW, dripH);
      ctx.beginPath();
      ctx.arc(x + colW * 0.5, dripH, colW * 0.52, 0, Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }
}
