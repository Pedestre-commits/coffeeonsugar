// ===== CONFIG =====
const DATA_URL = 'data/places.json';

// ===== STATE =====
let TRIPS      = {};
let activeYear = null;
let places     = [];
let map, markersLayer, routeLine, arrowsDecorator;

// ===== COUNTRY → ISO MAP =====
const COUNTRY_ISO = {
  'Afghanistan':'af','Albania':'al','Algeria':'dz','Andorra':'ad','Angola':'ao',
  'Argentina':'ar','Armenia':'am','Australia':'au','Austria':'at','Azerbaijan':'az',
  'Bahrain':'bh','Bangladesh':'bd','Belarus':'by','Belgium':'be','Bolivia':'bo',
  'Bosnia':'ba','Brazil':'br','Bulgaria':'bg','Cambodia':'kh','Cameroon':'cm',
  'Canada':'ca','Chile':'cl','China':'cn','Colombia':'co','Croatia':'hr',
  'Cuba':'cu','Czech Republic':'cz','Denmark':'dk','Ecuador':'ec','Egypt':'eg',
  'Estonia':'ee','Ethiopia':'et','Finland':'fi','France':'fr','Georgia':'ge',
  'Germany':'de','Ghana':'gh','Greece':'gr','Guatemala':'gt','Honduras':'hn',
  'Hungary':'hu','Iceland':'is','India':'in','Indonesia':'id','Iran':'ir',
  'Iraq':'iq','Ireland':'ie','Israel':'il','Italy':'it','Jamaica':'jm',
  'Japan':'jp','Jordan':'jo','Kazakhstan':'kz','Kenya':'ke','Kosovo':'xk',
  'Kuwait':'kw','Latvia':'lv','Lebanon':'lb','Libya':'ly','Lithuania':'lt',
  'Luxembourg':'lu','Malaysia':'my','Malta':'mt','Mexico':'mx','Moldova':'md',
  'Monaco':'mc','Mongolia':'mn','Montenegro':'me','Morocco':'ma','Myanmar':'mm',
  'Nepal':'np','Netherlands':'nl','New Zealand':'nz','Nicaragua':'ni',
  'Nigeria':'ng','North Macedonia':'mk','Norway':'no','Oman':'om','Pakistan':'pk',
  'Palestine':'ps','Panama':'pa','Paraguay':'py','Peru':'pe','Philippines':'ph',
  'Poland':'pl','Portugal':'pt','Qatar':'qa','Romania':'ro','Russia':'ru',
  'Saudi Arabia':'sa','Senegal':'sn','Serbia':'rs','Singapore':'sg','Slovakia':'sk',
  'Slovenia':'si','Somalia':'so','South Africa':'za','South Korea':'kr',
  'Spain':'es','Sri Lanka':'lk','Sudan':'sd','Sweden':'se','Switzerland':'ch',
  'Syria':'sy','Taiwan':'tw','Tanzania':'tz','Thailand':'th','Tunisia':'tn',
  'Turkey':'tr','Turkiye':'tr','Uganda':'ug','Ukraine':'ua',
  'UAE':'ae','United Arab Emirates':'ae',
  'UK':'gb','United Kingdom':'gb',
  'USA':'us','United States':'us',
  'Uruguay':'uy','Uzbekistan':'uz','Venezuela':'ve','Vietnam':'vn','Yemen':'ye',
  'Zimbabwe':'zw',
};

// ===== UTILS =====
const $ = sel => document.querySelector(sel);

function haversineKm(a, b) {
  const R = 6371, r = d => d * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}

function totalDistanceKm(pts) {
  let d = 0;
  for (let i = 0; i < pts.length - 1; i++) d += haversineKm(pts[i], pts[i+1]);
  return d;
}

function fmtKm(km) {
  return km >= 1000 ? (km / 1000).toFixed(1) + 'k km' : Math.round(km) + ' km';
}

function extractCountry(name) {
  const p = name.split(',');
  return p[p.length - 1].trim();
}

function getAllCountries() {
  const s = new Set();
  Object.values(TRIPS).forEach(list => list.forEach(p => s.add(extractCountry(p.name))));
  return [...s].sort();
}

function getYearCountries(y) {
  const s = new Set();
  (TRIPS[y] || []).forEach(p => s.add(extractCountry(p.name)));
  return [...s];
}

// ===== GALLERY =====
let galleryPlaceIdx = 0;
let galleryPhotoIdx = 0;

function openGallery(placeIdx) {
  galleryPlaceIdx = placeIdx;
  galleryPhotoIdx = 0;
  renderGallery();
  document.getElementById('galleryModal').classList.add('open');
}

function closeGallery() {
  document.getElementById('galleryModal').classList.remove('open');
}

function galleryNav(dir) {
  const photos = places[galleryPlaceIdx].photos || [];
  galleryPhotoIdx = (galleryPhotoIdx + dir + photos.length) % photos.length;
  renderGallery();
}

function renderGallery() {
  const p       = places[galleryPlaceIdx];
  const photos  = p.photos || [];
  const country = extractCountry(p.name);
  const code    = COUNTRY_ISO[country];

  document.getElementById('galleryFlag').src        = code ? `https://flagcdn.com/w40/${code}.png` : '';
  document.getElementById('galleryLocation').textContent = p.name;
  document.getElementById('galleryImg').src         = photos[galleryPhotoIdx];
  document.getElementById('galleryCounter').textContent  = `${galleryPhotoIdx + 1} / ${photos.length}`;

  const thumbs = document.getElementById('galleryThumbs');
  thumbs.innerHTML = photos.map((src, i) =>
    `<img src="${src}" class="gallery-thumb${i === galleryPhotoIdx ? ' active' : ''}" onclick="galleryPhotoIdx=${i};renderGallery()" />`
  ).join('');
}

document.addEventListener('keydown', e => {
  const modal = document.getElementById('galleryModal');
  if (!modal.classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  galleryNav(-1);
  if (e.key === 'ArrowRight') galleryNav(1);
  if (e.key === 'Escape')     closeGallery();
});

// ===== COUNTRY MODAL =====
function openCountryModal(country) {
  const code = COUNTRY_ISO[country];
  const img  = document.getElementById('modalFlag');
  img.src    = code ? `https://flagcdn.com/w320/${code}.png` : '';
  img.alt    = country;
  document.getElementById('modalName').textContent = country;
  document.getElementById('countryModal').classList.add('open');
}

function closeCountryModal(e) {
  if (e && e.target !== document.getElementById('countryModal')) return;
  document.getElementById('countryModal').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('countryModal').classList.remove('open');
  // Gallery keydown is handled in its own listener above
});

function toast(msg, dur = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), dur);
}

// ===== MAP INIT =====
function initMap() {
  map = L.map('map', {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 14,
    zoomControl: true,
    worldCopyJump: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    subdomains: 'abc', maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// ===== MARKER ICON =====
function markerIcon(num, role) {
  const color = role === 'start' ? '#4ade80' : role === 'end' ? '#f87171' : '#fbbf24';
  const border = role === 'start' ? '#4ade80' : role === 'end' ? '#f87171' : '#fbbf24';
  return L.divIcon({
    html: `<div class="marker-pin" style="--mc:${color};--mb:${border}"><span>${num}</span></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30]
  });
}

// ===== RENDER MAP =====
function renderMapData() {
  markersLayer.clearLayers();
  if (routeLine)       { map.removeLayer(routeLine);       routeLine = null; }
  if (arrowsDecorator) { map.removeLayer(arrowsDecorator); arrowsDecorator = null; }

  if (!places.length) return;

  const latlngs = places.map(p => [p.lat, p.lng]);

  // Route line
  routeLine = L.polyline(latlngs, {
    color: '#5eead4', weight: 2.5, opacity: 0.75, dashArray: '6 4'
  }).addTo(map);

  // Arrow decorators
  if (L.polylineDecorator) {
    arrowsDecorator = L.polylineDecorator(routeLine, {
      patterns: [{
        offset: '6%', repeat: '15%',
        symbol: L.Symbol.arrowHead({
          pixelSize: 8, polygon: false,
          pathOptions: { color: '#5eead4', weight: 2, opacity: 0.65 }
        })
      }]
    }).addTo(map);
  }

  // Markers
  places.forEach((p, i) => {
    const role   = i === 0 ? 'start' : i === places.length - 1 ? 'end' : 'mid';
    const marker = L.marker([p.lat, p.lng], { icon: markerIcon(i + 1, role) });
    const country  = extractCountry(p.name);
    const code     = COUNTRY_ISO[country];
    const flagHtml = code
      ? `<img src="https://flagcdn.com/w40/${code}.png" style="height:14px;border-radius:2px;vertical-align:middle;margin-right:6px;">`
      : '';
    const hasPhotos = p.photos && p.photos.length > 0;
    const popupHtml = `
      <div style="display:flex;align-items:center;gap:0;margin-bottom:${hasPhotos ? '8px' : '0'}">${flagHtml}<strong>${p.name}</strong></div>
      ${hasPhotos ? `<button onclick="openGallery(${i})" style="width:100%;padding:5px 10px;background:#5eead422;border:1px solid #5eead455;border-radius:6px;color:#5eead4;font-size:0.78rem;cursor:pointer;">&#128247; View ${p.photos.length} photos</button>` : ''}
    `;
    marker.bindPopup(popupHtml, { minWidth: 160 });
    marker.addTo(markersLayer);
  });

  // Fit bounds
  if (latlngs.length === 1) {
    map.setView(latlngs[0], 7);
  } else {
    map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], maxZoom: 9 });
  }
}

// ===== FLY TO STOP =====
function flyToStop(i) {
  const p = places[i];
  map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 6), { duration: 0.8 });
  // Briefly highlight list item
  document.querySelectorAll('.place-item').forEach((el, j) => {
    el.classList.toggle('active-stop', j === i);
  });
  // Open popup after fly
  setTimeout(() => {
    const layers = markersLayer.getLayers();
    if (layers[i]) layers[i].openPopup();
  }, 850);
}

// ===== RENDER SIDEBAR =====
function syncPlaces() {
  places = TRIPS[activeYear] ? [...TRIPS[activeYear]] : [];
}

function renderAll() {
  syncPlaces();
  renderYearButtons();
  renderStats();
  renderPlacesList();
  renderMapData();
  updateGlobalStats();
}

function renderYearButtons() {
  const row = $('#yearRow');
  const years = Object.keys(TRIPS).sort();
  row.innerHTML = years.map(y =>
    `<button class="btn-year${y === activeYear ? ' active' : ''}" onclick="switchYear('${y}')">${y}</button>`
  ).join('');
}

function renderStats() {
  const n  = places.length;
  const km = n >= 2 ? totalDistanceKm(places) : 0;
  const countries = getYearCountries(activeYear);

  $('#statStops').textContent = n || '—';
  $('#statDist').textContent  = n >= 2 ? fmtKm(km) : '—';
  $('#statCtry').textContent  = countries.length || '—';

  $('#countriesRow').innerHTML = countries.length
    ? countries.map(c => `<span class="country-chip" onclick="openCountryModal('${c}')">${c}</span>`).join('')
    : `<span style="color:var(--text-faint);font-size:0.75rem">No data</span>`;
}

function renderPlacesList() {
  const ul = $('#placesList');
  if (!places.length) {
    ul.innerHTML = `<div class="empty-state"><div class="emoji">🗺️</div>No stops in this trip.</div>`;
    return;
  }
  ul.innerHTML = places.map((p, i) => {
    const cls = i === 0 ? 'is-start' : i === places.length - 1 ? 'is-end' : '';
    return `<div class="place-item" onclick="flyToStop(${i})">
      <div class="place-idx ${cls}">${i + 1}</div>
      <div class="place-name" title="${p.name}">${p.name}</div>
    </div>`;
  }).join('');
}

function updateGlobalStats() {
  const all   = getAllCountries();
  const stops = Object.values(TRIPS).reduce((a, t) => a + t.length, 0);
  $('#hdrCountries').textContent = all.length   || '—';
  $('#hdrStops').textContent     = stops         || '—';
  $('#hdrYears').textContent     = Object.keys(TRIPS).length || '—';
}

// ===== YEAR MGMT =====
function switchYear(y) {
  activeYear = y;
  renderAll();
}

// ===== EXPORT / IMPORT =====
function exportJSON() {
  const blob = new Blob([JSON.stringify(TRIPS, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'places.json';
  a.click();
  toast('Exported places.json');
}

// ===== INIT =====
async function init() {
  let data = null;
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (res.ok) data = await res.json();
  } catch {}

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    TRIPS = data;
  } else {
    TRIPS = { [new Date().getFullYear()]: [] };
  }

  const years = Object.keys(TRIPS).sort();
  activeYear  = years[years.length - 1];

  initMap();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
