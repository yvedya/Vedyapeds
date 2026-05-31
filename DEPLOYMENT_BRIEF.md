# Repository — Deployment Hand-off Brief

A working note for when this app moves from the Claude chat prototype to a real site at **vedyapeds.com**. Hand this to Claude Code (or a developer) along with `repository.html`.

## What the app is
A single self-contained `repository.html` — a personal life-management app for a pediatric critical care physician. Features: tasks/goals (hierarchical, with daily-habit streaks), a daily Log with AI sorting, Knowledge notes (subject → subcategory → note, with a force-directed graph, revision history, and AI-generated Anki cloze cards), Study sources with progress bars, Wellness daily check-ins (fitness/diet/sleep) including nutrition-screenshot vision extraction, Memories with photo theming, and a daily featured quote. State currently persists via the Claude artifact `window.storage` key-value API under keys: `repo:entries`, `repo:areas`, `repo:study`, `repo:wellness`, `repo:prefs`.

## Why it needs a real backend (priority order)

### 1. Real authentication — REQUIRED before any clinical content
The prototype has **no authentication at all** (a placeholder privacy gate was removed as security theater — it stored a passphrase hash in the file alongside the data, protecting nothing). Security should be built into the foundation at deployment, not bolted on.

**Build real, server-side auth as step one — before any content goes in:**
- Server-side login (email + password, or an auth provider like Auth0/Clerk/Supabase Auth).
- Sessions/tokens validated on the server, not in the page.
- Data stored in a database behind that auth, not in a readable file.
- Consider whether identifiable patient data should live here at all vs. de-identified teaching material. If PHI is ever involved, add **encryption at rest**, transport over HTTPS only, audit logging, and review HIPAA obligations. Strongly prefer keeping notes de-identified.

### 2. Serverless function to hold the Anthropic API key
Several features call the Anthropic API directly from the browser (log sorting `splitLog`, tag suggestion `suggestTags`, study-progress detection `detectStudyProgress`, wellness detection `detectWellness`, nutrition vision `extractNutrition`, subject/subcategory suggestion `suggestSubject`, Anki cloze generation `generateCloze`). The API key must **never** ship in client code.
- Add a serverless function (Netlify/Vercel free tier is fine) that proxies requests to `api.anthropic.com` and injects the key from a server-side env var.
- Point the app's `fetch("https://api.anthropic.com/v1/messages", …)` calls at that function instead.
- Set a spending cap on the key as a backstop. Expected cost for single-user personal use: pennies to ~$1/month (vision/nutrition scans are the priciest at ~1–2¢ each).

### 3. Storage migration (cross-device sync)
Replace `window.storage` with either:
- **localStorage** — trivial, but single-device only (no sync). Good first step.
- **A cloud database** (Supabase or Firebase) — enables cross-device sync and pairs naturally with the real auth above. This is what the user ultimately wants (cloud-synced, email login).
Keep the same logical keys/shape (`entries`, `areas`, `study`, `wellness`, `prefs`) to minimize rewrites. The storage layer is small and centralized (`load()`, `saveEntries()`, `saveAreas()`, `saveStudy()`, `saveWellness()`, `savePrefs()`), so swapping the implementation is contained.

### 4. AnkiConnect (already built, needs config on deploy)
The Study tab has an "Sync Anki" feature that calls AnkiConnect at `http://127.0.0.1:8765` to pull real review stats (new/learning/young/mature/due), matching cards by a per-note tag `repo::<note-id>`. It cannot work inside the Claude chat sandbox but will work once the app runs locally or as a real site **with Anki desktop open and the AnkiConnect add-on installed**.
- AnkiConnect must allow the app's origin: add the site's URL to AnkiConnect's `webCorsOriginList` config (in Anki: Tools → Add-ons → AnkiConnect → Config). For a deployed site, add `https://vedyapeds.com`. For a local file, `null`/`http://localhost` as appropriate.

## Domain
- Target domain: **vedyapeds.com** (already owned). Point its DNS at the chosen host (Netlify/Vercel), or move nameservers. Confirm where it's currently registered/managed and whether anything is already served on it before repointing.
- Optional: a subdomain like `app.vedyapeds.com` keeps the bare domain free for other use; technically identical to deploy.


## Suggested order
1. Split `repository.html` into maintainable files (optional but recommended given its size).
2. Stand up host + domain + serverless API-key proxy (unlocks AI features safely).
3. Add real auth + database (unlocks sync + makes it safe for real content).
4. Configure AnkiConnect CORS for the deployed origin.
5. Migrate existing prototype data if any is worth keeping (export from the chat version first).

## Honest note carried over from the build
Until real auth + encryption are in place, the app is not protected to a clinical standard regardless of the passphrase gate. Keep anything truly patient-identifying out of it until then.
