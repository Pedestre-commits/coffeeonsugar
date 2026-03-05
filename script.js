// ===== Configuration =====
const DATA_URL = 'data/places.json';
const EUROPE_BOUNDS = L.latLngBounds([[34.0, -25.0], [72.0, 45.0]]);
const DEFAULT_SPEED_KMH = 400;

// ===== State =====
let places = [];
let map, tiles, markersLayer, routeLine, arrowsDecorator, planeMarker;

let anim = {
  playing: false,
  startTs: 0,
  pausedAt: 0,
  distance: 0,
  totalMeters: 0,
  segments: []
};

// MULTI-YEAR TRIPS STORAGE
let TRIPS = {};          // { "2025":[...], "2026":[...] }
let activeYear = "2026"; // default active trip

// ===== Utilities =====
function $(sel) { return document.querySelector(sel); }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function toFixed(n, d=5) { return Number.parseFloat(n).toFixed(d); }

// Haversine
function haversineMeters(a, b) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat/2), sinDLng = Math.sin(dLng/2);
  const h = sinDLat*sinDLat +
            Math.cos(lat1)*Math.cos(lat2)*sinDLng*sinDLng;
  const c = 2*Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  return R*c;
}

function bearingDeg(a, b) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;

  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng)*Math.cos(lat2);
  const x = Math.cos(lat1)*Math.sin(lat2) -
            Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function computeSegments(latlngs) {
  const segs = [];
  let cum = 0;

  for (let i = 0; i < latlngs.length - 1; i++) {
    const a = latlngs[i], b = latlngs[i+1];
    const len = haversineMeters(a, b);

    segs.push({
      a, b, len,
      cumStart: cum,
      cumEnd: cum + len,
      bearing: bearingDeg(a, b)
    });

    cum += len;
  }
  return { segs, total: cum };
}

function positionAtDistance(segs, d) {
  if (segs.length === 0) return null;
  if (d <= 0) return { lat: segs[0].a.lat, lng: segs[0].a.lng, bearing: segs[0].bearing };
  const last = segs[segs.length-1];
  if (d >= last.cumEnd) return { lat: last.b.lat, lng: last.b.lng, bearing: last.bearing };

  let s = null;
  for (const seg of segs) { if (d <= seg.cumEnd) { s = seg; break; } }

  const along = (d - s.cumStart) / s.len;
  const lat = s.a.lat + (s.b.lat - s.a.lat)*along;
  const lng = s.a.lng + (s.b.lng - s.a.lng)*along;
  return { lat, lng, bearing: s.bearing };
}

function kmhToMps(kmh) { return kmh * 1000 / 3600; }

// ===== LocalStorage (offline fallback) =====
function loadFromLocalStorageSafe() {
  try {
    const raw = localStorage.getItem("trips.v1");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveToLocalStorageSafe(data) {
  try { localStorage.setItem("trips.v1", JSON.stringify(data)); }
  catch {}
}

// ===== Fetch with fallback =====
async function tryFetchPlacesJSON() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch { return null; }
}

// ===== Map setup =====
function initMap() {
  map = L.map('map', {
    zoomControl: true,
    maxBounds: EUROPE_BOUNDS.pad(0.15),
    minZoom: 3,
    maxZoom: 12
  });

  map.fitBounds(EUROPE_BOUNDS);

  tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© https://www.openstreetmap.org/copyrightOpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  map.on("click", function(e) {
    const name = prompt("Name this place:");
    if (!name) return;
    addPlaceToTrip(name, e.latlng.lat, e.latlng.lng);
  });
}

function markerIcon(index, role) {
  const classes = ['marker-index'];
  if (role === 'start') classes.push('marker-start');
  if (role === 'end') classes.push('marker-end');

  return L.divIcon({
    html: `<div class="${classes.join(' ')}"><span>${index}</span></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });
}

function escapeHtml(s) {
  return (s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}


// Accept normal relative paths ("images/foo.jpg", "./images/foo.jpg", "../images/foo.jpg"),
// root-relative ("/images/foo.jpg"), and http(s) URLs.
// Only block obviously dangerous "javascript:" URLs.
function isSafeUrl(u) {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  if (/^javascript:/i.test(s)) return false;      // block JS URLs
  return /^(https?:\/\/|\/|\.{0,2}\/|[A-Za-z0-9_\-./]+$)/i.test(s);
}


function markerTooltipHTML(p, i) {
  const title = escapeHtml(p.title ?? p.name ?? `Stop ${i+1}`);
  const desc = escapeHtml(p.desc ?? '');
  const img = (p.img && isSafeUrl(p.img)) ? p.img : null;

  return `
    <div class="tt-card">
      ${img ? `${img}` : ''}
      <div class="tt-body">
        <div class="tt-title">${title}</div>
        ${desc ? `<div class="tt-text">${desc}</div>` : ''}
      </div>
    </div>
  `;
}
``



function renderMarkers() {
  markersLayer.clearLayers();

  places.forEach((p, i) => {
    const role = i === 0 ? 'start' : (i === places.length - 1 ? 'end' : 'mid');
    const html = markerTooltipHTML(p, i);

    const m = L.marker([p.lat, p.lng], { icon: markerIcon(i + 1, role) })
      // Hover card (tooltip)
      .bindTooltip(html, {
        direction: 'top',
        offset: [0, -12],
        sticky: true,           // follows mouse for nicer UX
        opacity: 1,
        className: 'place-tooltip'
      })
      // Tap/click card (popup) – useful on touch devices
      .bindPopup(html, {
        className: 'place-popup',
        maxWidth: 280,
        autoPan: true,
      });

    markersLayer.addLayer(m);
  });
}
function renderRoute() {
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (arrowsDecorator) { map.removeLayer(arrowsDecorator); arrowsDecorator = null; }
  if (places.length < 2) return;

  const latlngs = places.map(p => L.latLng(p.lat, p.lng));

  routeLine = L.polyline(latlngs, {
    color: '#5eead4',
    weight: 4,
    opacity: 0.9,
    className: 'route-polyline'
  }).addTo(map);

  if ($('#toggleArrows') && $('#toggleArrows').checked) {
    arrowsDecorator = L.polylineDecorator(routeLine, {
      patterns: [{
        offset: 12,
        repeat: 80,
        symbol: L.Symbol.arrowHead({
          pixelSize: 10,
          polygon: false,
          pathOptions: { stroke: true, color: '#6ea8fe', weight: 2 }
        })
      }]
    }).addTo(map);
  }

  const segData = computeSegments(latlngs);
  anim.segments = segData.segs;
  anim.totalMeters = segData.total;
  anim.distance = 0;
  anim.pausedAt = 0;
  anim.playing = false;

  ensurePlaneMarker();
  updatePlanePosition(0);

  // >>> NEW: prevent over-zooming
  const bounds = routeLine.getBounds();
  map.fitBounds(bounds);
  if (map.getZoom() > 6) map.setZoom(6);
}

function ensurePlaneMarker() {
  if (planeMarker) { map.removeLayer(planeMarker); planeMarker = null; }
  if (places.length < 1) return;

  const pos = places[0];
  planeMarker = L.marker([pos.lat, pos.lng], {
    icon: L.divIcon({
      html: '<div class="plane">✈️</div>',
      className: '',
      iconSize: [24,24],
      iconAnchor: [12,12]
    })
  }).addTo(map);
}

function setPlaneRotation(deg) {
  if (!planeMarker || !planeMarker._icon) return;
  const node = planeMarker._icon.querySelector('.plane');
  if (node) node.style.transform = `rotate(${deg}deg)`;
}

function updatePlanePosition(distanceMeters) {
  if (!planeMarker || anim.segments.length === 0) return;
  const pos = positionAtDistance(anim.segments, distanceMeters);
  planeMarker.setLatLng([pos.lat, pos.lng]);
  setPlaneRotation(pos.bearing);
}

// ===== Animation =====
let rafId = null;

function play() {
  if (places.length < 2 || anim.segments.length === 0) return;
  if (anim.distance >= anim.totalMeters) anim.distance = 0;

  anim.playing = true;
  anim.startTs = performance.now() - anim.pausedAt;

  loop();
}

function pause() {
  anim.playing = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function reset() {
  pause();
  anim.distance = 0;
  anim.pausedAt = 0;
  updatePlanePosition(0);
}

function loop(ts) {
  if (!anim.playing) return;

  const now = performance.now();
  const elapsed = now - anim.startTs;
  anim.pausedAt = elapsed;

  const speedKmh = Number($('#speedInput').value || DEFAULT_SPEED_KMH);
  const speedMps = kmhToMps(speedKmh);

  anim.distance = speedMps * (elapsed / 1000);

  if (anim.distance >= anim.totalMeters) {
    anim.distance = anim.totalMeters;
    updatePlanePosition(anim.distance);
    pause();
    return;
  }

  updatePlanePosition(anim.distance);
  rafId = requestAnimationFrame(loop);
}

// ===== UI =====
function renderList() {
  const ul = $('#placesList');
  ul.innerHTML = '';

  places.forEach((p, i) => {
    const li = el('li', 'place-item');

    const idx = el('span', 'place-index');
    idx.textContent = i+1;
    li.appendChild(idx);

    const info = el('div');
    const name = el('div', 'place-name');
    name.textContent = p.name;
    info.appendChild(name);

    const coords = el('div', 'place-coords');
    coords.textContent = `${toFixed(p.lat,4)}, ${toFixed(p.lng,4)}`;
    info.appendChild(coords);

    li.appendChild(info);

    // Move / Delete Buttons
    const actions = el('div', 'item-actions');

    const up = el('button', 'icon-btn');
    up.textContent = '↑';
    up.title = 'Move up';
    up.onclick = () => {
      if (i > 0) {
        [places[i-1], places[i]] = [places[i], places[i-1]];
        commitTripChange();
      }
    };

    const down = el('button', 'icon-btn');
    down.textContent = '↓';
    down.title = 'Move down';
    down.onclick = () => {
      if (i < places.length - 1) {
        [places[i+1], places[i]] = [places[i], places[i+1]];
        commitTripChange();
      }
    };

    const del = el('button', 'icon-btn');
    del.textContent = '✕';
    del.title = 'Remove';
    del.onclick = () => {
      places.splice(i, 1);
      commitTripChange();
    };

    actions.appendChild(up);
    actions.appendChild(down);
    actions.appendChild(del);

    li.appendChild(actions);
    ul.appendChild(li);
  });
}

function commitTripChange() {
  TRIPS[activeYear] = places;
  saveToLocalStorageSafe(TRIPS);
  onDataChanged();
}

function onDataChanged() {
  renderList();
  renderMarkers();
  renderRoute();
}

// ===== Year Switching =====
function renderActiveYear() {
  places = TRIPS[activeYear] || [];

  renderList();
  renderMarkers();
  renderRoute();

  $('#year2026').classList.toggle("active-year", activeYear === "2026");
  $('#year2025').classList.toggle("active-year", activeYear === "2025");
}

function wireYearButtons() {
  $('#year2026').onclick = () => { activeYear = "2026"; renderActiveYear(); };
  $('#year2025').onclick = () => { activeYear = "2025"; renderActiveYear(); };
}

// ===== Add Place =====
function addPlaceToTrip(name, lat, lng) {
  if (!name || isNaN(lat) || isNaN(lng)) return;

  TRIPS[activeYear].push({
    name: String(name),
    lat: Number(lat),
    lng: Number(lng)
  });

  saveToLocalStorageSafe(TRIPS);
  renderActiveYear();
}

// ===== Clear =====
function clearAll() {
  TRIPS[activeYear] = [];
  saveToLocalStorageSafe(TRIPS);
  renderActiveYear();
}

// ===== Export =====
function downloadTrips() {
  const blob = new Blob([JSON.stringify(TRIPS, null, 2)], {
    type: 'application/json'
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "places.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ===== Import =====
function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!data["2025"] || !data["2026"]) {
        alert("Invalid format. Expected {2025:[...], 2026:[...]}");
        return;
      }

      TRIPS = data;
      saveToLocalStorageSafe(TRIPS);
      renderActiveYear();
    }
    catch (err) {
      alert("Failed to parse JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

// ===== Load Logic =====
async function loadTripsStartup() {
  let json = await tryFetchPlacesJSON();
  if (!json) json = loadFromLocalStorageSafe();
  if (!json) json = { "2026": [], "2025": [] };

  if (!json["2026"]) json["2026"] = [];
  if (!json["2025"]) json["2025"] = [];

  TRIPS = json;
  renderActiveYear();
  wireYearButtons();
}

// ===== Bootstrap =====
window.addEventListener('DOMContentLoaded', () => {
  initMap();

  $('#btnClear').onclick = () => {
    if (confirm("Clear all places in this trip?")) clearAll();
  };

  $('#btnDownload').onclick = downloadTrips;

  $('#fileInput').onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      importFromFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  


const btnAdd = $('#btnAdd');
if (btnAdd) {
  btnAdd.onclick = () => {
    const name = $('#placeName').value.trim();
    const lat = parseFloat($('#placeLat').value);
    const lng = parseFloat($('#placeLng').value);

    if (!name) { alert('Please enter a place name.'); return; }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert('Please enter valid latitude and longitude.'); 
      return;
    }

    addPlaceToTrip(name, lat, lng);

    $('#placeName').value = '';
    $('#placeLat').value = '';
    $('#placeLng').value = '';
  };
}


  loadTripsStartup();
});
