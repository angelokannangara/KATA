import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Download, Pause, Play, RotateCcw, Video, X } from 'lucide-react';
import { updateFighterAnimation } from '../game/animation';
import { soundEngine } from '../game/audio';
import { getCharacterConfig } from '../game/characters';
import { createFighter, getMoveForAction } from '../game/combat';
import { CHAPTERS, CONFIG, STANCE_META, STORY_PROLOGUE } from '../game/config';
import { InkRenderer } from '../game/renderer';
import { ActionKind, FighterState, SaveData } from '../game/types';

interface StoryFilmModalProps {
  save: SaveData;
  onClose: () => void;
}

interface FilmScene {
  kind: 'title' | 'narration';
  chapter: number;
  heading: string;
  sub?: string;
  text?: string;
  duration: number;
  sfx?: 'gong';
}

const FILM_W = 1280;
const FILM_H = 720;
const BEAT_SEC = 2.4;
const MOVES = ['light', 'heavy', 'kick', 'skill_0', 'light', 'kick_combo', 'skill_1', 'heavy'] as const;

const readTime = (text: string) => Math.max(6, text.split(/\s+/).length * 0.34 + 3);

/** Build the whole story as a timeline of scenes from the game's own story data. */
function buildScenes(): FilmScene[] {
  const scenes: FilmScene[] = [
    { kind: 'title', chapter: 0, heading: 'KATA', sub: 'INK & ECHO', duration: 5, sfx: 'gong' },
  ];
  STORY_PROLOGUE.forEach((beat) =>
    scenes.push({
      kind: 'narration',
      chapter: 0,
      heading: beat.title,
      text: beat.line,
      duration: readTime(beat.line),
    }),
  );
  CHAPTERS.forEach((ch, i) => {
    scenes.push({
      kind: 'title',
      chapter: i,
      heading: `Chapter ${i + 1}`,
      sub: ch.subtitle.toUpperCase(),
      duration: 4,
      sfx: 'gong',
    });
    scenes.push({
      kind: 'narration',
      chapter: i,
      heading: ch.title,
      text: ch.storyIntro,
      duration: readTime(ch.storyIntro),
    });
    scenes.push({
      kind: 'narration',
      chapter: i,
      heading: `${ch.title} · Aftermath`,
      text: ch.storyOutro,
      duration: readTime(ch.storyOutro),
    });
  });
  scenes.push({
    kind: 'title',
    chapter: CHAPTERS.length - 1,
    heading: 'The Echo Walks On',
    sub: 'YOUR KATA IS NEVER FINISHED',
    duration: 6,
    sfx: 'gong',
  });
  return scenes;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const StoryFilmModal: React.FC<StoryFilmModalProps> = ({ save, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scenes = useMemo(buildScenes, []);
  const starts = useMemo(() => {
    let acc = 0;
    return scenes.map((s) => {
      const st = acc;
      acc += s.duration;
      return st;
    });
  }, [scenes]);
  const total = useMemo(() => scenes.reduce((a, s) => a + s.duration, 0), [scenes]);

  const tRef = useRef(0);
  const playingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sceneLabel, setSceneLabel] = useState('');
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState('webm');
  const canRecord = typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';

  const setPlay = useCallback((v: boolean) => {
    playingRef.current = v;
    setPlaying(v);
    if (v) {
      soundEngine.init();
      soundEngine.startAmbientLoop();
    } else {
      soundEngine.stopAmbientLoop();
    }
  }, []);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  // ---------------------------------------------------------------- render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = FILM_W;
    canvas.height = FILM_H;

    const renderer = new InkRenderer();
    const hero = getCharacterConfig(save.selectedCharacterId);
    const mk = (id: 1 | 2, x: number, facing: 1 | -1, echo: boolean): FighterState =>
      createFighter({
        id,
        characterId: hero.id,
        name: echo ? 'Echo' : hero.name,
        x,
        facing,
        isAI: false,
        personality: 'balanced',
        maxHp: hero.maxHp,
        stance: hero.signatureStance,
        equippedSkills: [hero.skills[0].id, hero.skills[1].id, hero.skills[2].id],
        accentColor: echo ? '#B8861E' : hero.accentColor,
        isEcho: echo,
        equippedWeaponId: echo ? 'default' : save.equippedWeaponId || 'default',
      });
    const p1 = mk(1, 470, 1, false);
    const p2 = mk(2, 730, -1, true);
    const base = { p1: 470, p2: 730 };

    let beatIndex = -1;
    let hitFired = true;
    let shake = 0;
    let flash = 0;
    let last = performance.now();
    let simTime = 0;
    let raf = 0;

    const stepFighter = (f: FighterState, dt: number, onActive: () => void) => {
      if (f.currentMove) {
        f.actionTimer += dt;
        const startup = f.currentMove.startup * STANCE_META[f.stance].startupMult;
        const dur = startup + f.currentMove.active + f.currentMove.recovery;
        if (f.actionTimer >= startup && f.actionTimer <= startup + f.currentMove.active) {
          const limb = f.currentMove.activeLimb;
          const pt =
            limb === 'footR' || limb === 'bothFeet'
              ? f.joints.footR
              : limb === 'footL'
                ? f.joints.footL
                : limb === 'weaponTip'
                  ? (f.weaponTip ?? f.joints.handR)
                  : f.joints.handR;
          f.slashTrail.push({
            x: pt.x,
            y: pt.y,
            alpha: 1,
            width: f.currentMove.spinArc ? 11 : 9,
            color: f.currentMove.inkColor ?? f.accentColor,
            style: f.currentMove.trailStyle,
          });
          if (f.slashTrail.length > 12) f.slashTrail.shift();
          if (!hitFired) {
            hitFired = true;
            onActive();
          }
        }
        if (f.actionTimer >= dur) {
          f.currentMove = null;
          f.action = 'idle';
          f.actionTimer = 0;
        }
      }
      f.y = CONFIG.groundY;
      updateFighterAnimation(f, dt);
    };

    const startBeat = (idx: number) => {
      const attacker = idx % 2 === 0 ? p1 : p2;
      const kind = MOVES[idx % MOVES.length];
      const move = getMoveForAction(attacker, kind) ?? getMoveForAction(attacker, 'light');
      if (!move) return;
      attacker.currentMove = move;
      attacker.action = kind as ActionKind;
      attacker.actionTimer = 0;
      attacker.slashTrail = [];
      hitFired = false;
      soundEngine.playWhoosh(kind === 'heavy' || kind === 'kick_combo');
    };

    const drawText = (scene: FilmScene, local: number) => {
      const c = ctx;
      const fadeIn = Math.min(1, local / 0.8);
      c.save();
      c.textAlign = 'center';
      c.shadowColor = 'rgba(0,0,0,0.85)';
      c.shadowBlur = 18;
      if (scene.kind === 'title') {
        c.globalAlpha = fadeIn;
        c.fillStyle = '#F4ECD8';
        c.font = `800 ${scene.heading.length > 10 ? 84 : 150}px "Shippori Mincho", Georgia, serif`;
        c.fillText(scene.heading, FILM_W / 2, FILM_H * 0.42);
        if (scene.sub) {
          c.font = '700 30px Rajdhani, Inter, sans-serif';
          c.fillStyle = '#FF6A55';
          (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '10px';
          c.fillText(scene.sub, FILM_W / 2, FILM_H * 0.42 + 56);
          (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
        }
      } else if (scene.text) {
        // dark gradient behind subtitles
        const g = c.createLinearGradient(0, FILM_H * 0.55, 0, FILM_H);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.78)');
        c.shadowBlur = 0;
        c.fillStyle = g;
        c.fillRect(0, FILM_H * 0.55, FILM_W, FILM_H * 0.45);
        c.shadowBlur = 12;
        c.globalAlpha = Math.min(1, local / 0.5);
        c.fillStyle = '#FFC247';
        c.font = '700 26px Rajdhani, Inter, sans-serif';
        (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '5px';
        c.fillText(scene.heading.toUpperCase(), FILM_W / 2, FILM_H * 0.7);
        (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
        c.font = 'italic 32px "Shippori Mincho", Georgia, serif';
        c.fillStyle = '#F4ECD8';
        const lines = wrapText(c, scene.text, FILM_W * 0.78);
        const totalChars = scene.text.length;
        let remaining = Math.floor(totalChars * Math.min(1, local / (scene.duration * 0.62)));
        lines.forEach((ln, i) => {
          const shown = ln.slice(0, Math.max(0, remaining));
          remaining -= ln.length + 1;
          c.globalAlpha = 1;
          c.fillText(shown, FILM_W / 2, FILM_H * 0.7 + 52 + i * 44);
        });
      }
      c.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      simTime += dt;

      if (playingRef.current) {
        tRef.current += dt;
        if (tRef.current >= total) {
          tRef.current = total;
          playingRef.current = false;
          setPlaying(false);
          soundEngine.stopAmbientLoop();
          stopRecording();
        }
      }

      const t = tRef.current;
      let si = scenes.length - 1;
      for (let i = 0; i < scenes.length; i++) {
        if (t < starts[i] + scenes[i].duration) {
          si = i;
          break;
        }
      }
      const scene = scenes[si];
      const local = Math.max(0, t - starts[si]);

      // choreography: alternating attacks on a fixed beat
      if (scene.kind === 'narration') {
        const idx = Math.floor(local / BEAT_SEC) + si * 3;
        const into = local % BEAT_SEC;
        if (idx !== beatIndex && into < 0.5 && playingRef.current) {
          beatIndex = idx;
          startBeat(idx);
        }
      }
      if (scene.sfx === 'gong' && local < dt * 1.5 && playingRef.current) soundEngine.playGong();

      const onActive = () => {
        const attacker = beatIndex % 2 === 0 ? p1 : p2;
        const defender = attacker === p1 ? p2 : p1;
        const heavy = attacker.action === 'heavy' || attacker.action === 'kick_combo';
        renderer.spawnBurst({
          kind: 'ink',
          x: defender.x,
          y: CONFIG.groundY - 90,
          count: heavy ? 22 : 12,
          dirX: attacker.facing,
        });
        renderer.spawnRing(defender.x, CONFIG.groundY - 90, '#FFC247', heavy ? 30 : 20);
        if (heavy) soundEngine.playHit(true);
        else soundEngine.playParryClang();
        shake = heavy ? 10 : 5;
        flash = heavy ? 0.35 : 0.18;
      };

      if (playingRef.current || t < 0.1) {
        stepFighter(p1, dt, onActive);
        stepFighter(p2, dt, onActive);
        renderer.updateParticles(dt);
      }

      // lunge / recoil positions
      const lunge = (f: FighterState, dir: 1 | -1) => {
        if (!f.currentMove) return 0;
        const startup = f.currentMove.startup * STANCE_META[f.stance].startupMult;
        const dur = startup + f.currentMove.active + f.currentMove.recovery;
        return Math.sin(Math.PI * Math.min(1, f.actionTimer / dur)) * 70 * dir;
      };
      const attackerIsP1 = beatIndex % 2 === 0;
      p1.x = base.p1 + lunge(p1, 1) - (!attackerIsP1 ? 0 : 0);
      p2.x = base.p2 + lunge(p2, -1);
      if (p1.currentMove) p2.x += 26 * Math.sin(Math.PI * Math.min(1, p1.actionTimer / 0.5));
      if (p2.currentMove) p1.x -= 26 * Math.sin(Math.PI * Math.min(1, p2.actionTimer / 0.5));
      p1.facing = 1;
      p2.facing = -1;

      shake *= 0.86;
      flash *= 0.84;
      const zoom = 1.12 + 0.1 * (local / scene.duration) + (scene.kind === 'title' ? 0.06 : 0);

      renderer.renderFrame({
        ctx,
        width: FILM_W,
        height: FILM_H,
        stage: CHAPTERS[scene.chapter]?.stage ?? CHAPTERS[0].stage,
        time: simTime,
        cameraX: (p1.x + p2.x) / 2,
        cameraZoom: zoom,
        shakeX: (Math.random() * 2 - 1) * shake,
        shakeY: (Math.random() * 2 - 1) * shake,
        p1,
        p2,
        projectiles: [],
        clones: [],
        inkTransition: 0,
        ultimateOverlay: null,
        darkMode: false,
      });

      // ---- cinematic overlays (letterbox, flash, text, fades)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (flash > 0.01) {
        ctx.fillStyle = `rgba(255,240,220,${flash})`;
        ctx.fillRect(0, 0, FILM_W, FILM_H);
      }
      drawText(scene, local);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, FILM_W, FILM_H * 0.085);
      ctx.fillRect(0, FILM_H * (1 - 0.085), FILM_W, FILM_H * 0.085);
      const fade = Math.min(1, local / 0.7, (scene.duration - local) / 0.7);
      if (fade < 1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`;
        ctx.fillRect(0, 0, FILM_W, FILM_H);
      }

      setProgress(t / total);
      setSceneLabel(scene.kind === 'title' ? scene.heading : scene.heading);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      soundEngine.stopAmbientLoop();
    };
  }, [save.selectedCharacterId, save.equippedWeaponId, scenes, starts, total, stopRecording]);

  // clean up object URL
  useEffect(
    () => () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl],
  );

  const restart = () => {
    tRef.current = 0;
    setPlay(true);
  };

  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canRecord) return;
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    soundEngine.init();
    const stream = canvas.captureStream(30);
    soundEngine.getRecordingStream()?.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 6_000_000,
    });
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || 'video/webm';
      setVideoExt(type.includes('mp4') ? 'mp4' : 'webm');
      setVideoUrl(URL.createObjectURL(new Blob(chunksRef.current, { type })));
      setRecording(false);
    };
    recorderRef.current = rec;
    rec.start(250);
    setRecording(true);
    tRef.current = 0;
    setPlay(true);
  };

  const pct = Math.round(progress * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-4xl max-h-[96vh] overflow-y-auto bg-[var(--paper)] border-2 border-[var(--ink)] p-3 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--ink)] flex items-center gap-2">
            <Clapperboard className="w-5 h-5" aria-hidden="true" />
            Story Film
          </h2>
          <button
            type="button"
            onClick={() => {
              stopRecording();
              onClose();
            }}
            className="kata-btn inline-flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        <div className="relative w-full aspect-video bg-black border border-[var(--ink-border)] overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full block" />
          {!playing && !recording && progress < 0.001 && (
            <button
              type="button"
              onClick={() => setPlay(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
              aria-label="Play story film"
            >
              <span className="kata-btn inline-flex items-center gap-2 px-6 py-3 text-lg" data-start="true">
                <Play className="w-5 h-5" aria-hidden="true" />
                Play Film
              </span>
            </button>
          )}
          {recording && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 bg-black/70 text-xs font-mono text-[#FF6A55]">
              <span className="w-2 h-2 rounded-full bg-[#FF4A3D] animate-pulse" />
              REC {pct}%
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPlay(!playing)}
            disabled={recording}
            className="kata-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm cursor-pointer disabled:opacity-50"
          >
            {playing ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={restart}
            disabled={recording}
            className="kata-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Restart</span>
          </button>
          {canRecord && (
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              data-start="true"
              className="kata-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm cursor-pointer"
            >
              <Video className="w-4 h-4" aria-hidden="true" />
              <span>{recording ? 'Stop & Save' : 'Render Video'}</span>
            </button>
          )}
          {videoUrl && (
            <a
              href={videoUrl}
              download={`KATA-story-film.${videoExt}`}
              className="kata-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Download .{videoExt}</span>
            </a>
          )}
        </div>

        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            disabled={recording}
            onChange={(e) => {
              tRef.current = (Number(e.target.value) / 1000) * total;
            }}
            aria-label="Film position"
            className="w-full accent-[var(--crimson)]"
          />
          <div className="flex items-center justify-between text-xs font-mono text-[var(--ink-muted)]">
            <span className="truncate">{sceneLabel}</span>
            <span>
              {Math.floor((progress * total) / 60)}:{String(Math.floor((progress * total) % 60)).padStart(2, '0')} /{' '}
              {Math.floor(total / 60)}:{String(Math.floor(total % 60)).padStart(2, '0')}
            </span>
          </div>
          {canRecord && (
            <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
              “Render Video” records the film in real time as a video with sound. Keep this tab open until it
              finishes, then download the file.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
