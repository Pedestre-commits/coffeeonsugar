
# Europe Trip Map

An interactive, single-page map to showcase the places you've visited across Europe, with an animated route, arrows for direction, and a simple editor to add/reorder stops.

## Quick Start (GitHub Pages)

1. **Create a new repository** on GitHub (e.g., `europe-trip-map`).
2. Upload all files in this folder to the repo root.
3. Go to **Settings → Pages** and set **Branch** to `main` (or `master`) and folder `/root`, then **Save**.
4. Your site will be published at `https://<your-username>.github.io/<repo-name>/` after a minute.

## Editing Your Places

- Your route is defined in `data/places.json` as an array of `{ name, lat, lng }` in the exact travel order.
- You can also use the right-side editor on the page to **Add**, **Reorder (↑/↓)**, **Remove**, **Export** (download JSON) and **Import** a JSON file.
- The page saves to your browser's `localStorage` so you can tweak interactively and export when ready.

### Example `places.json`
```json
[
  { "name": "Lisbon, Portugal",   "lat": 38.7223, "lng": -9.1393 },
  { "name": "Madrid, Spain",      "lat": 40.4168, "lng": -3.7038 },
  { "name": "Barcelona, Spain",   "lat": 41.3874, "lng": 2.1686 }
]
```

## Features

- **Leaflet** map with OpenStreetMap tiles
- **Route polyline** with glowing style and **direction arrows**
- **Animated plane** traveling along your path
- **Play / Pause / Reset** and **Speed control** (km/h)
- **Editable list** of places with reorder buttons
- **Export/Import** your data as `places.json`
- Responsive layout (desktop & mobile)

## Notes

- Make sure your coordinates are valid numbers (latitude between -90 and 90, longitude between -180 and 180).
- If you need help converting place names to coordinates, open an issue or ask for assistance.
- You can customize colors in `style.css` (see the `:root` CSS variables).

## License

MIT
