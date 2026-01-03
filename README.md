## Overview

This repo is now a React Native / Expo project from the root. The web (Vite/ReactDOM) shell has been removed; the shared game logic, ink content, and assets remain in `src/` and are consumed by the native UI.

## Project layout

- `App.tsx` — root entry for the Expo app.
- `app/` — native UI components, assets manifest, and utilities (`@app/*`).
- `src/` — shared game logic (`game/`, `ink/`, `utils/`, `types/`) consumed via the `@shared/*` alias.
- `assets/` — Expo app icons/splash assets.
- `compileInk.js` — helper to compile ink scripts into JSON.

## Setup & running (mobile)

Install dependencies and start Expo from the repo root:

```bash
npm install
npm run start
```

## Ink compilation

If you update ink scripts under `src/ink/`, rebuild their JSON with:

```bash
npm run compile:ink
```

The generated JSON files remain alongside the ink sources for the app to consume.
