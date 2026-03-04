// ===== Configuration =====
const DATA_URL = 'data/places.json';
const EUROPE_BOUNDS = L.latLngBounds([[34.0, -25.0], [72.0, 45.0]]);

// ===== State =====
let places = [];
let map, tiles, markersLayer, routeLine, arrowsDecorator;

// ===== Utilities =====
function $(sel) { return document.querySelector(sel); }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function toFixed(n, d=5) { return Number.parseFloat(n).toFixed(d); }

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function saveToLocal() { localStorage.setItem('eu_places', JSON.stringify(places)); }
function loadFromLocal() {
  try { const s = localStorage.getItem('eu_places'); if (s) return JSON.parse(s); } catch {}
  return null;
}

// ===== Map setup =====
function initMap() {
  map = L.map('map', { zoomControl: true, maxBounds: EUROPE_BOUNDS.pad(0.15), minZoom: 3, maxZoom: 12 });
  map.fitBounds(EUROPE_BOUNDS);

  tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© https://www.openstreetmap.org/copyrightOpenStreetMap</a> contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Click to add a new place
  map.on('click', (e) => {
    const idx = places.length + 1;
    const p = {
      name: `New place ${idx}`,
      lat: Number(e.latlng.lat.toFixed(6)),
      lng: Number(e.latlng.lng.toFixed(6)),
      // Simple content framework per pin:
      title: 'Title here',
      text: 'Write a short note about what you saw or ate.',
      img: 'images/placeholder.jpg' // replace with your own file in images/
    };
    places.push(p);
    onDataChanged();
    // Open the popup right away so you see the placeholder
    const lastMarker = markersLayer.getLayers()[markersLayer.getLayers().length - 1];
    if (lastMarker) lastMarker.openPopup();
  });
}

function markerIcon(index, role) {
  const classes = ['marker-index'];
  if (role === 'start') classes.push('marker-start');
  if (role === 'end') classes.push('marker-end');
  return L.divIcon({
    html: `<div class="${classes.join(' ')}"><span>${index}</span></div>`,
    className: '', iconSize: [28, 28], iconAnchor: [14, 28]
  });
}

function popupHtml(p) {
  const img = escapeHtml(p.img || '');
  const title = escapeHtml(p.title || p.name || 'Untitled');
  const text = escapeHtml(p.text || '');

  const imgTag = img
    ? `<imgg}`
    : `<div style="width:80px;height:80px;border:1px dashed #2a2f55;border-radius:8px;display:grid;place-items:center;color:#a9b1d6;font-size:.75rem;">No image</div>`;

  return `
    <div class="popup-card">
      ${imgTag}
      <div class="popup-body">
        <h4>${title}</h4>
        <p>${text}</p>
      </div>
    </div>
  `;
}

function renderMarkers() {
  markersLayer.clearLayers();
  places.forEach((p, i) => {
    const role = i === 0 ? 'start' : (i === places.length - 1 ? 'end' : 'mid');
    const m = L.marker([p.lat, p.lng], { icon: markerIcon(i + 1, role) })
      .bindTooltip(`${i + 1}. ${p.name}`, { direction: 'top', offset: [0, -12] })
      .bindPopup(popupHtml(p), { minWidth: 220, maxWidth: 340 });
    markersLayer.addLayer(m);
  });
}

function renderRoute() {
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (arrowsDecorator) { map.removeLayer(arrowsDecorator); arrowsDecorator = null; }
  if (places.length < 2) return;

  const latlngs = places.map(p => L.latLng(p.lat, p.lng));
  routeLine = L.polyline(latlngs, { color: '#5eead4', weight: 4, opacity: 0.9, className: 'route-polyline' }).addTo(map);

  if ($('#toggleArrows')?.checked) {
    arrowsDecorator = L.polylineDecorator(routeLine, {
      patterns: [
        { offset: 12, repeat: 80, symbol: L.Symbol.arrowHead({ pixelSize: 10, polygon: false, pathOptions: { stroke: true, color: '#6ea8fe', weight: 2 } }) }
      ]
    }).addTo(map);
  }
}

// ===== UI rendering =====
function renderList() {
  const ul = $('#placesList');
  ul.innerHTML = '';
  places.forEach((p, i) => {
    const li = el('li', 'place-item');

    const idx = el('span', 'place-index'); idx.textContent = i + 1; li.appendChild(idx);

    const info = el('div');
    const name = el('div', 'place-name'); name.textContent = p.name; info.appendChild(name);
    const coords = el('div', 'place-coords'); coords.textContent = `${toFixed(p.lat, 4)}, ${toFixed(p.lng, 4)}`; info.appendChild(coords);
    li.appendChild(info);

    const actions = el('div', 'item-actions');
    const up = el('button', 'icon-btn'); up.textContent = '↑'; up.title = 'Move up';
    const down = el('button', 'icon-btn'); down.textContent = '↓'; down.title = 'Move down';
    const del = el('button', 'icon-btn'); del.textContent = '✕'; del.title = 'Remove';
    up.onclick = () => { if (i > 0) { [places[i - 1], places[i]] = [places[i], places[i - 1]]; onDataChanged(); } };
    down.onclick = () => { if (i < places.length - 1) { [places[i + 1], places[i]] = [places[i], places[i + 1]]; onDataChanged(); } };
    del.onclick = () => { places.splice(i, 1); onDataChanged(); };
    actions.appendChild(up); actions.appendChild(down); actions.appendChild(del);
    li.appendChild(actions);

    // Click list item to fly to marker
    li.style.cursor = 'pointer';
    li.addEventListener('click', (evt) => {
      // ignore clicks on action buttons
      if (evt.target.closest('.icon-btn')) return;
      map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 6), { duration: 0.6 });
      const m = markersLayer.getLayers()[i];
      if (m) setTimeout(() => m.openPopup(), 650);
    });

    ul.appendChild(li);
  });
}

function onDataChanged() {
  saveToLocal();
  renderList();
  renderMarkers();
  renderRoute();
}

// ===== Data helpers =====
function clearAll() {
  places = [];
  onDataChanged();
}

function downloadPlaces() {
  const blob = new Blob([JSON.stringify(places, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'places.json';
  document.body.appendChild(a); a.click(); a.remove();
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data) && data.length && data[0].lat !== undefined) {
        // Accept extra fields (title, text, img) if present
        places = data.map((p, i) => ({
          name: String(p.name ?? `Place ${i+1}`),
          lat: Number(p.lat),
          lng: Number(p.lng),
          title: typeof p.title === 'string' ? p.title : (p.name ?? `Place ${i+1}`),
          text: typeof p.text === 'string' ? p.text : '',
          img: typeof p.img === 'string' ? p.img : 'images/placeholder.jpg'
        }));
        onDataChanged();
      } else {
        alert('Invalid JSON format. Expected an array of {name, lat, lng, [title], [text], [img]}');
      }
    } catch (err) { alert('Failed to parse JSON: ' + err.message); }
  };
  reader.readAsText(file);
}

// ===== Bootstrap =====
window.addEventListener('DOMContentLoaded', async () => {
  initMap();

  // UI hooks
  $('#btnClear').onclick = () => { if (confirm('Clear all places?')) clearAll(); };
  $('#btnDownload').onclick = downloadPlaces;
  $('#fileInput').onchange = (e) => { if (e.target.files && e.target.files[0]) importFromFile(e.target.files[0]); e.target.value = ''; };
  $('#toggleArrows').onchange = () => { renderRoute(); };

  // Load data: localStorage > JSON file
  const local = loadFromLocal();
  if (local && Array.isArray(local) && local.length) {
    places = local;
  } else {
    try {
      const resp = await fetch(DATA_URL);
      places = await resp.json();
      // If your existing JSON lacks the new fields, add safe defaults:
      places = places.map((p, i) => ({
        name: String(p.name ?? `Place ${i+1}`),
        lat: Number(p.lat),
        lng: Number(p.lng),
        title: typeof p.title === 'string' ? p.title : (p.name ?? `Place ${i+1}`),
        text: typeof p.text === 'string' ? p.text : '',
        img: typeof p.img === 'string' ? p.img : 'images/placeholder.jpg'
      }));
    } catch (e) {
      console.warn('Failed to load data/places.json, using sample.', e);
      places = [
        { name: 'Lisbon, Portugal', lat: 38.7223, lng: -9.1393, title: 'Pastéis & Miradouros', text: 'Belém pastries, Alfama viewpoints.', img: 'images/placeholder.jpg' },
        { name: 'Madrid, Spain',   lat: 40.4168, lng: -3.7038, title: 'Tapas run',            text: 'La Latina, Mercado de San Miguel.', img: 'images/placeholder.jpg' },
        { name: 'Barcelona, Spain',lat: 41.3874, lng: 2.1686,  title: 'Gaudí day',            text: 'Sagrada Família, tapas by the beach.', img: 'images/placeholder.jpg' }
      ];
    }
  }

  onDataChanged();
});
