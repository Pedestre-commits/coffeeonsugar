# kpop page — context file

Sub-project within coffeeonsugar (GitHub Pages, `coffeeonsugar.online/kpop`).
Pure HTML/CSS/JS, no build step. Deployed from `main` branch, dev work on `dev`.

---

## Files

| File | Purpose |
|------|---------|
| `kpop.html` | Page structure |
| `kpop.js` | All logic — rendering, Last.fm, groups cloud, margin logos |
| `kpop.css` | Styles |
| `data/kpop.json` | Source of truth for concerts + groups |
| `assets/logos/*.svg/png` | Group logo files for margin decoration |

---

## data/kpop.json structure

```json
{
  "concerts": [
    {
      "id": "aespa-2025-madrid",
      "artist": "æspa",
      "tour": "SYNK : PARALLEL LINE",
      "date": "2025-03-12",
      "venue": "Movistar Arena",
      "city": "Madrid, Spain",
      "went_with": [],
      "rating": null,
      "setlist": ["Drama", "Black Mamba", "..."],
      "notes": "",
      "photos": [],
      "ticket_stub": null,
      "upcoming": false
    }
  ],
  "groups": [
    { "name": "NMIXX", "tier": 1, "songs": 66 },
    { "name": "4Minute", "tier": 3, "songs": 2 }
  ]
}
```

**Concert logic:**
- `upcoming: true` → forced into Upcoming section regardless of date
- `upcoming: false` + date in past → Attended section
- `upcoming: false` + date in future → still shows as Upcoming (date-driven)

**Groups tiers:**
- `tier: 1` — main "Groups I Follow" word cloud (sized by `songs` count)
- `tier: 3` — "& more" muted row below the cloud (tier 2 not yet used)

**Cache-busting:** `DATA_URL = 'data/kpop.json?v=5'` — bump `v` whenever JSON structure changes to force fresh fetch on GitHub Pages CDN.

---

## Features built

### Concert cards
- Upcoming + Attended sections, sorted by date
- Countdown ("X days to go") for upcoming
- Setlist toggle (collapsible), photo lightbox, star rating, ticket stub image
- Stats bar: Shows / Artists / Upcoming counts

### Last.fm "Favourite Artists"
- Period toggle: Week / Month / 6M / 12M / All Time
- Bar chart of top 15 artists with play counts
- Expandable per-artist top-5 tracks dropdown
- API key: `1269f913a8f04b71e848ecf0718dbe5a`, user: `Pedestre95`

### Groups I Follow (word cloud)
- `tier: 1` groups shown as gradient pill chips, font size scaled by `songs` count
- sqrt scale: `fontSize = 0.65 + sqrt((songs-1)/(maxSongs-1)) * 0.80` rem (range 0.65–1.45rem)
- `tier: 3` groups shown in a "& more" row at 35% opacity, 0.65rem, alphabetically sorted
- Chips are purely decorative (no click action), gradient text via `background-clip: text`

### Margin logos
- 12 group logo images (`assets/logos/`) placed `position: fixed` in left/right viewport gutters
- Logos = top 12 tier-1 groups by song count
- File naming: `slugify(group.name) + '.svg'` (falls back to `.png` via onerror chain)
  - slugify: lowercase, strip non-alphanumeric, spaces → hyphens
  - e.g. NMIXX → `nmixx.svg`, KISS OF LIFE → `kiss-of-life.png`, (G)I-DLE → `gi-dle.svg`
- CSS `filter: brightness(0) invert(1)` → all logos render as white silhouettes on dark bg
- Slot layout (px = distance from viewport edge):

| Slot | Side | Top | px | Size | Rotation |
|------|------|-----|----|------|----------|
| NMIXX | left | 8% | 20 | 60px | -8° |
| aespa | left | 24% | 36 | 50px | +6° |
| KISS OF LIFE | left | 42% | 16 | 64px | -4° |
| BABYMONSTER | left | 58% | 30 | 52px | +7° |
| EVERGLOW | left | 75% | 22 | 56px | -6° |
| (G)I-DLE | left | 88% | 38 | 46px | +5° |
| MEOVV | right | 14% | 30 | 56px | +7° |
| TWICE | right | 31% | 14 | 64px | -5° |
| BLACKPINK | right | 47% | 38 | 48px | +4° |
| LOONA | right | 63% | 20 | 60px | -7° |
| Dreamcatcher | right | 79% | 36 | 52px | +8° |
| LE SSERAFIM | right | 92% | 18 | 58px | -4° |

**Responsive sizes:**
- Mobile ≤600px: `30px !important`, opacity 7% (seen: 28%)
- Mid 601–1399px: `40px !important`, opacity 9% (seen: 38%)
- Wide ≥1400px: original sizes, opacity 11% (seen: 50%)

**Yellow glow for attended artists:**
- `renderMarginLogos(groups, attendedArtists)` receives a `Set` of normalised artist names from past concerts
- `normalizeArtist(name)`: lowercase, `æ→ae`, strip non-alphanumeric — handles æspa ↔ aespa
- Attended logos get class `margin-logo--seen`:
  ```css
  filter: brightness(0) invert(1) sepia(1) saturate(4) drop-shadow(0 0 10px rgba(255,210,0,0.85));
  opacity: 0.5;
  ```
- Currently glowing: **æspa, NMIXX, TWICE, EVERGLOW**

**Logo files sourced from:** Wikimedia Commons (SVGs), fandom wikis, pngitem.
Solid backgrounds removed with Pillow (`brightness(0) invert(1)` filter needs transparency).
`overflow-x: hidden` on `html, body` fixes right-side logos bleeding into scroll overflow on mobile.

---

## Concerts as of last update

| Artist | Date | Venue | Status |
|--------|------|-------|--------|
| æspa | 2025-03-12 | Movistar Arena, Madrid | Attended |
| NMIXX | 2026-03-17 | Palacio Vistalegre, Madrid | Attended |
| TWICE | 2026-05-09 | MEO Arena, Lisbon | Attended |
| EVERGLOW | 2026-06-05 | LAV – Lisboa Ao Vivo, Lisbon | Attended |
| LE SSERAFIM | 2026-10-16 | The O2, London | Upcoming |
| æspa | 2027-01-31 | Palau Sant Jordi, Barcelona | Upcoming |

---

## Groups (tier 1, by song count)

NMIXX(66), aespa(50), KISS OF LIFE(33), BABYMONSTER(30), EVERGLOW(21), (G)I-DLE(17),
MEOVV(16), TWICE(16), BLACKPINK(14), LOONA(14), Dreamcatcher(12), LE SSERAFIM(12),
OH MY GIRL(12), ILLIT(10), izna(10), KATSEYE(10), GFRIEND(9), IZ*ONE(9),
CHUNG HA(8), CLC(8), MAMAMOO(8), SUNMI(8), IVE(7), Weki Meki(7), fromis_9(7),
Hearts2Hearts(5), Red Velvet(5), NewJeans(4), STAYC(4), WJSN(4), Apink(2), IU(2)

Tier 3 ("& more") — 40 groups including 4Minute, BTS, EXO, XG, SECRET NUMBER, PIXY, etc.

---

## Pending / not yet built

- Tier 2 distinction within the main cloud (tier 1 vs tier 2 split TBD by Bruno)
- Ratings, photos, notes for attended concerts (all currently null/empty)
- Ticket stub images
- Admin panel for the kpop page (concerts are edited directly in kpop.json)
- NMIXX setlist for 2026 Madrid show (currently filled; others empty)
