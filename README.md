# Skyfall Bomber

Axie-inspired Bomberman **1v1** vs AI, with **skyfall blocks** that crash onto the arena after a warm-up period.

Fighters use layered Axie part sprites (`public/axie/`: body, eyes, tail). Falling sky blocks use `ball.png` with ground `shadow.png` warnings.

**Play:** https://enryu8191.github.io/skyfall-bomber/

## Controls

| Key | Action |
|-----|--------|
| **WASD** / Arrow keys | Move |
| **Space** | Place bomb |
| **R** | Restart / rematch |

## Local development

```bash
npm ci
npm run dev
```

Dev server runs on **port 3002** (`http://localhost:3002`).

```bash
npm run build    # production build → dist/
npm run preview  # preview build on port 3002
```

## Stack
- 32px tiles, 19×15 classic Bomberman grid (640×568 canvas)
- Axie PNGs loaded from `axie/...` (served from `public/axie/`)

- Phaser 4 + TypeScript + Vite
- GitHub Pages via GitHub Actions (`.github/workflows/deploy-pages.yml`)

## GitHub Pages setup

1. Repo **Settings – Pages**
2. **Source:** GitHub Actions
3. Push to `main` to deploy

## Gameplay notes

- Soft crates drop bomb / range / speed power-ups
- After ~8s, skyfall shadows appear; blocks land as hard walls and can crush fighters
- Density ramps over time; last fighter standing wins
