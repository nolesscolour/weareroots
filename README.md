# Roots

Time to explore world music. Live radio from around the world, by place and genre.

Vite + React 19 + TypeScript. Static site, no backend, no API keys, no `.env`.

## Run locally

```
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Build

```
npm run build     # type-checks, then builds to dist/
npm run preview   # serves dist/ locally
```

## Deploy (Vercel)

Import the repo at vercel.com/new. Vercel detects Vite from `vercel.json`; no settings to change.

## Structure

```
src/
  App.tsx                     screens: splash → player → list / settings
  controller/RootsController  all logic: directory, tuning, audio, sleep timer, keyboard
  engine/rootsField.ts        splash texture (canvas)
  engine/cymatics.ts          player visualiser (canvas)
  data/directory.ts           Radio Browser fetch, mirror fallback
  data/sanitize.ts            validation for everything the API returns
  data/demo.ts                offline station set
  components/                 Splash, Player, ListPanel, SettingsSheet, Toast, ErrorBoundary
```

## Security

- No third-party scripts at runtime: React and the DotGothic16 font are bundled.
- `vercel.json` sets a strict Content-Security-Policy (scripts, styles and fonts only from this site; data only from `*.api.radio-browser.info`; audio only over https), plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS.
- Station data is untrusted: names are cleaned, stream and logo URLs must be https, station IDs must be hex. Nothing is rendered as raw HTML.
- `localStorage` only stores volume, validated on read.
- Dependencies are pinned; Dependabot opens weekly update PRs. Run `npm audit` before deploying.
