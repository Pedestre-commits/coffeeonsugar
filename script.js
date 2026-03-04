
// ===== Configuration =====
const DATA_URL = 'data/places.json';
const EUROPE_BOUNDS = L.latLngBounds([ [34.0, -25.0], [72.0, 45.0] ]);
const DEFAULT_SPEED_KMH = 400;

// ===== State =====
let places = [];
let map, tiles, markersLayer, routeLine, arrowsDecorator, planeMarker;
let anim = { playing: false, startTs: 0, pausedAt: 0, distance: 0, totalMeters: 0, segments: [] };

// ===== Utilities =====
function $(sel) { return document.querySelector(sel); }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function toFixed(n, d=5) { return Number.parseFloat(n).toFixed(d); }

function haversineMeters(a, b) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371000; // meters
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat/2), sinDLng = Math.sin(dLng/2);
  const h = sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLng*sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  return R * c;
}

function bearingDeg(a, b) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng);
  const brng = Math.atan2(y, x);
  return (toDeg(brng) + 360) % 360; // 0..360
}

function computeSegments(latlngs) {
  const segs = [];
  let cum = 0;
  for (let i = 0; i < latlngs.length - 1; i++) {
    const a = latlngs[i], b = latlngs[i+1];
    const len = haversineMeters(a, b);
    segs.push({ a, b, len, cumStart: cum, cumEnd: cum + len, bearing: bearingDeg(a, b) });
    cum += len;
  }
  return { segs, total: cum };
}

function positionAtDistance(segs, d) {
  if (segs.length === 0) return null;
  if (d <= 0) return { lat: segs[0].a.lat, lng: segs[0].a.lng, bearing: segs[0].bearing };
  const last = segs[segs.length-1];
  if (d >= last.cumEnd) return { lat: last.b.lat, lng: last.b.lng, bearing: last.bearing };
  // find containing segment
  let s = null;
  for (const seg of segs) { if (d <= seg.cumEnd) { s = seg; break; } }
  const along = (d - s.cumStart) / s.len;
  const lat = s.a.lat + (s.b.lat - s.a.lat) * along;
  const lng = s.a.lng + (s.b.lng - s.a.lng) * along;
  return { lat, lng, bearing: s.bearing };
}

function kmhToMps(kmh) { return kmh * 1000 / 3600; }


// ===== Map setup =====
function initMap() {
  map = L.map('map', { zoomControl: true, maxBounds: EUROPE_BOUNDS.pad(0.15), minZoom: 3, maxZoom: 12 });
  map.fitBounds(EUROPE_BOUNDS);

  tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

map.on("click", function(e) {
    const name = prompt("Name this place:");
    if (!name) return;

    addPlace(name, e.latlng.lat, e.latlng.lng);
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

function renderMarkers() {
  markersLayer.clearLayers();
  places.forEach((p, i) => {
    const role = i === 0 ? 'start' : (i === places.length-1 ? 'end' : 'mid');
    const m = L.marker([p.lat, p.lng], { icon: markerIcon(i+1, role) })
      .bindTooltip(`${i+1}. ${p.name}`, { direction: 'top', offset: [0, -12] });
    markersLayer.addLayer(m);
  });
}

function renderRoute() {
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (arrowsDecorator) { map.removeLayer(arrowsDecorator); arrowsDecorator = null; }

  if (places.length < 2) return;

  const latlngs = places.map(p => L.latLng(p.lat, p.lng));
  routeLine = L.polyline(latlngs, { color: '#5eead4', weight: 4, opacity: 0.9, className: 'route-polyline' }).addTo(map);

  if ($('#toggleArrows').checked) {
    arrowsDecorator = L.polylineDecorator(routeLine, {
      patterns: [
        { offset: 12, repeat: 80, symbol: L.Symbol.arrowHead({ pixelSize: 10, polygon: false, pathOptions: { stroke: true, color: '#6ea8fe', weight: 2 } }) }
      ]
    }).addTo(map);
  }

  // prepare animation segments
  const segData = computeSegments(latlngs);
  anim.segments = segData.segs; anim.totalMeters = segData.total; anim.distance = 0; anim.pausedAt = 0; anim.playing = false;
  ensurePlaneMarker();
  updatePlanePosition(0);
}

function ensurePlaneMarker() {
  if (planeMarker) { map.removeLayer(planeMarker); planeMarker = null; }
  if (places.length < 1) return;
  const pos = places[0];
  planeMarker = L.marker([pos.lat, pos.lng], {
    icon: L.divIcon({ html: '<div class="plane">✈️</div>', className: '', iconSize: [24,24], iconAnchor: [12,12] })
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

// ===== Animation loop =====
let rafId = null;
function play() {
  if (places.length < 2 || anim.segments.length === 0) return;
  if (anim.distance >= anim.totalMeters) { anim.distance = 0; }
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
  anim.distance = 0; anim.pausedAt = 0;
  updatePlanePosition(0);
}

function loop(ts) {
  if (!anim.playing) return;
  const now = performance.now();
  const elapsed = now - anim.startTs; // ms since play
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

// ===== UI rendering =====
function renderList() {
  const ul = $('#placesList');
  ul.innerHTML = '';
  places.forEach((p, i) => {
    const li = el('li', 'place-item');

    const idx = el('span', 'place-index'); idx.textContent = i+1; li.appendChild(idx);

    const info = el('div');
    const name = el('div', 'place-name'); name.textContent = p.name; info.appendChild(name);
    const coords = el('div', 'place-coords'); coords.textContent = `${toFixed(p.lat, 4)}, ${toFixed(p.lng, 4)}`; info.appendChild(coords);
    li.appendChild(info);

    const actions = el('div', 'item-actions');
    const up = el('button', 'icon-btn'); up.textContent = '↑'; up.title = 'Move up';
    const down = el('button', 'icon-btn'); down.textContent = '↓'; down.title = 'Move down';
    const del = el('button', 'icon-btn'); del.textContent = '✕'; del.title = 'Remove';

    up.onclick = () => { if (i>0) { [places[i-1], places[i]] = [places[i], places[i-1]]; onDataChanged(); } };
    down.onclick = () => { if (i<places.length-1) { [places[i+1], places[i]] = [places[i], places[i+1]]; onDataChanged(); } };
    del.onclick = () => { places.splice(i,1); onDataChanged(); };

    actions.appendChild(up); actions.appendChild(down); actions.appendChild(del);
    li.appendChild(actions);
    ul.appendChild(li);
  });
}

function onDataChanged() {
  renderList();
  renderMarkers();
  renderRoute();
}

function addPlace(name, lat, lng) {
  if (!name || isNaN(lat) || isNaN(lng)) return;
  places.push({ name, lat: Number(lat), lng: Number(lng) });
  onDataChanged();
}

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
        places = data.map(p => ({ name: String(p.name||'Place'), lat: Number(p.lat), lng: Number(p.lng) }));
        onDataChanged();
      } else {
        alert('Invalid JSON format. Expected an array of {name, lat, lng}');
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

  $('#btnAdd').onclick = () => {
    const name = $('#placeName').value.trim();
    const lat = parseFloat($('#placeLat').value);
    const lng = parseFloat($('#placeLng').value);
    if (!name) { alert('Please enter a place name.'); return; }
    if (Number.isNaN(lat) || Number.isNaN(lng)) { alert('Please enter valid latitude and longitude.'); return; }
    addPlace(name, lat, lng);
    $('#placeName').value = ''; $('#placeLat').value = ''; $('#placeLng').value = '';
  };


// Always load from data/places.json
try {
    const resp = await fetch("data/places.json");
    const json = await resp.json();

    places = json.map(p => ({
        name: String(p.name || "Unnamed"),
        lat: Number(p.lat),
        lng: Number(p.lng)
    })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
} catch (e) {
    console.error("Failed to load data/places.json:", e);
    places = [];
}


  onDataChanged();
});
