# coffeeonsugar — Travel Map

Personal travel map website. Hosted on GitHub Pages at the domain in `CNAME`.

## What it is
An interactive map showing trip stops by year. Has a public map view and a password-protected admin panel for adding/editing stops.

## Tech stack
- Pure HTML/CSS/JS — no build step, no framework
- **Leaflet.js** for the map (OpenStreetMap tiles)
- **Leaflet.PolylineDecorator** for route arrows
- **JSZip** for local export fallback
- **GitHub API** (via PAT) for reading/writing data
- **GitHub Pages** for hosting (deploys from `main` branch)

## Key files
| File | Purpose |
|------|---------|
| `index.html` + `script.js` + `style.css` | Public map page |
| `admin.html` | Admin panel (inline script, no separate file) |
| `index_1.html` + `styles_1.css` + `app.js` | Coffee/sugar animation page (separate mini-project) |
| `data/places.json` | Trip data — source of truth, committed to repo |
| `photos/<slug>/<n>.<ext>` | Stop photos, committed to repo |
| `CNAME` | Custom domain for GitHub Pages |

## Data structure (`data/places.json`)
```json
{
  "2024": [
    { "name": "Lisbon, Portugal", "lat": 38.71667, "lng": -9.13333, "photos": ["photos/lisbon-portugal/1.jpg"] }
  ]
}
```
Stop name format: `"City, Country"` — the country is parsed from the last comma-delimited segment and mapped to an ISO code for flag display.

## Admin panel flow
1. User enters a GitHub Personal Access Token (PAT) with `Contents: Read & Write` on this repo
2. Token stored in `sessionStorage` (cleared on tab close, never committed)
3. Data loaded from `Pedestre-commits/coffeeonsugar` via GitHub Contents API
4. When saving: uses GitHub Git Data API to create a single atomic commit (blobs → tree → commit → update ref)
5. GitHub Pages redeploys automatically in ~60s

## GitHub config
- **Owner/repo:** `Pedestre-commits/coffeeonsugar`
- **Production branch:** `main` (GitHub Pages source)
- **Dev branch:** `dev` (active development, merge → main to deploy)

## Local dev
IIS Express on port 3000 (configured in `.claude/launch.json`).

The app fetches `data/places.json` at runtime. If you're testing admin saves locally, they go straight to the GitHub repo (live), so test carefully.

## Branches
- `dev` → active work
- `main` → production (GitHub Pages)
- PR from dev → main to deploy

## Workflow reminders
- Always work on `dev`, merge to `main` when ready to deploy
- `git push` before switching machines so the other machine can `git pull`
- The admin panel's "Save to GitHub" button commits directly to `main` regardless of local branch

## Machine paths
| Machine | Project path |
|---------|-------------|
| Desktop | `D:\Profiles\Documents\coffeeonsugar` |
| Laptop  | `C:\Users\Bruno\source\repos\coffeeonsugar` |

Both use IIS Express on port 3000 for local dev.

## Features built (in order — check before suggesting something)
| Status | Feature |
|--------|---------|
| ✓ | Country flag popups on pins + photo gallery per stop |
| ✓ | GitHub-powered admin panel (PAT login, saves atomic commit to `main`) |
| ✓ | Admin lock/unlock button to prevent accidental edits |
| ✓ | Stop reordering via drag in admin |
| ✓ | Per-stop photo upload in admin |
| ✗ removed | Map legend (Start/Stop/End/Route) |
| ✗ removed | Map style picker |
| ✗ removed | Data card |
| ✗ removed | Import button |
| ✗ removed | Pin colors |
| ✗ removed | Trips count display |

## Current data state
`data/places.json` has placeholder loremflickr photo URLs. Real photos go in `photos/<slug>/<n>.<ext>` and are committed to the repo.
