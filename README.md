# KATA: Ink & Echo 🥋

A 2D martial arts duel game in the spirit of Shadow Fight: black ink silhouettes
against glowing, stage-colored skies. Built with React, TypeScript, Vite and
Canvas 2D. All graphics, animation and audio are generated in code.

## Highlights
- **Procedural skeletal animation** with easing, anticipation/strike/recovery
  phases, hit-stop, afterimages, slash trails and cloth physics
- **Echo system**: your inputs are recorded, and each chapter's final boss fights
  with your own habits and tempo
- **3 stances** (Crane, Tiger, Serpent) with bonus damage for weaving between them
- **Skill constellation**, weapon armory and a roster of unlockable fighters
- **Modes**: Story chapters, Training Dojo, local Versus
- **Story Film**: a cinematic of the whole story (prologue + 5 chapters) rendered live on a canvas, with a **Render Video** button that records it (with sound) to a downloadable `.webm`
- **Controls**: keyboard + mouse (left = light, right = heavy, middle = kick), fully remappable in Settings → Controls; cross-style touch controls on phones (move cross, skills cross, fight cross)
- **Synthesized audio** (Web Audio API), keyboard and touch controls,
  progress saved in localStorage

## Controls
WASD move · J/K or Left/Right click strike · F or Middle click kick · L parry · Space dash · Q/E stance · U/I/O skills · P ultimate

Every key and mouse button can be changed in **Settings → Controls & Key Bindings**.

## Run
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build in dist/
```

## License
MIT
