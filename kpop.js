const DATA_URL = 'data/kpop.json?v=6';
const LASTFM_KEY = '1269f913a8f04b71e848ecf0718dbe5a';
const LASTFM_USER = 'Pedestre95';

const EXACT_CASE_ARTISTS = new Set([]);

function displayArtist(name) {
  return EXACT_CASE_ARTISTS.has(name) ? name : name.toUpperCase();
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(dateStr) {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function renderStars(rating) {
  if (!rating) return '';
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < rating ? 'star-filled' : 'star-empty'}">★</span>`
  ).join('');
}

function renderCard(concert) {
  const upcoming = concert.upcoming || daysUntil(concert.date) > 0;
  const days = daysUntil(concert.date);

  const photosHtml = concert.photos && concert.photos.length
    ? `<div class="photos-row">
        ${concert.photos.map(p => `<img class="photo-thumb" src="${p}" alt="" loading="lazy">`).join('')}
      </div>`
    : '';

  const ticketHtml = concert.ticket_stub
    ? `<img class="ticket-stub" src="${concert.ticket_stub}" alt="Ticket stub">`
    : '<div class="stub-placeholder"></div>';

  const setlistHtml = concert.setlist && concert.setlist.length
    ? `<div class="setlist-wrap">
        <button class="setlist-toggle" aria-expanded="false">
          Setlist <span class="setlist-count">(${concert.setlist.length})</span>
          <span class="setlist-arrow">▼</span>
        </button>
        <ol class="setlist-list">
          ${concert.setlist.map((s, i) => `<li><span class="setlist-num">${i + 1}</span>${s}</li>`).join('')}
        </ol>
      </div>`
    : '';

  const notesHtml = concert.notes
    ? `<p class="notes">"${concert.notes}"</p>`
    : '';

  const countdownHtml = upcoming && days > 0
    ? `<div class="countdown">
        <span class="countdown-num">${days}</span>
        <span class="countdown-label">days to go</span>
      </div>`
    : '';

  const ratingHtml = !upcoming && concert.rating
    ? `<div class="detail"><span class="detail-icon"></span><div class="rating">${renderStars(concert.rating)}</div></div>`
    : '';

  const wentWithHtml = concert.went_with && concert.went_with.length
    ? `<div class="detail"><span class="detail-icon">👥</span>${concert.went_with.join(', ')}</div>`
    : '';

  const tourHtml = concert.tour
    ? `<p class="tour-name">${concert.tour}</p>`
    : '';

  return `
    <article class="concert-card ${upcoming ? 'is-upcoming' : ''}">
      ${ticketHtml}
      <div class="card-body">
        <div class="card-top">
          <time class="concert-date">${formatDate(concert.date)}</time>
          <span class="badge ${upcoming ? 'badge-upcoming' : 'badge-attended'}">
            ${upcoming ? 'Upcoming' : 'Attended'}
          </span>
        </div>
        <div>
          <h2 class="artist-name${concert.artist === 'æspa' ? ' compact' : ''}">${displayArtist(concert.artist)}</h2>
          ${tourHtml}
        </div>
        <div class="details">
          <div class="detail"><span class="detail-icon">📍</span>${concert.venue}, ${concert.city}</div>
          ${wentWithHtml}
          ${ratingHtml}
        </div>
        ${countdownHtml}
        ${photosHtml}
        ${setlistHtml}
        ${notesHtml}
      </div>
    </article>`;
}

function initSetlistToggles(container) {
  container.querySelectorAll('.setlist-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = btn.nextElementSibling;
      const open = list.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
    });
  });
}

function initPhotoLightbox(container) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');

  container.querySelectorAll('.photo-thumb').forEach(img => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightbox.classList.add('open');
    });
  });
}

document.getElementById('lightbox-close').addEventListener('click', () => {
  document.getElementById('lightbox').classList.remove('open');
});
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// ── LAST.FM TOP ARTISTS ──
const artistTracksCache = {};

async function fetchArtistTracks(artistName) {
  if (artistTracksCache[artistName]) return artistTracksCache[artistName];
  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTracks&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_KEY}&format=json&limit=5&autocorrect=1`;
  const data = await fetch(url).then(r => r.json());
  const tracks = data.toptracks?.track || [];
  artistTracksCache[artistName] = tracks;
  return tracks;
}

async function loadTopArtists(period = '7day') {
  const list = document.getElementById('top-artists-list');
  list.innerHTML = '<p class="empty-state">Loading…</p>';
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${LASTFM_USER}&api_key=${LASTFM_KEY}&format=json&limit=15&period=${period}`;
    const data = await fetch(url).then(r => r.json());
    if (data.error) throw new Error(`Last.fm: ${data.message}`);
    const raw = data.topartists?.artist;
    if (!raw) throw new Error('No data returned');
    // Last.fm returns an object (not array) when there is only 1 result
    const artists = Array.isArray(raw) ? raw : [raw];
    if (!artists.length) { list.innerHTML = '<p class="empty-state">No listening data for this period.</p>'; return; }
    const max = parseInt(artists[0].playcount);
    list.innerHTML = artists.map((a, i) => `
      <div class="artist-item">
        <div class="artist-row" data-artist="${a.name}">
          <span class="artist-rank">${i + 1}</span>
          <span class="artist-row-name">${a.name}</span>
          <div class="artist-bar-wrap">
            <div class="artist-bar" style="width:${Math.round(parseInt(a.playcount) / max * 100)}%"></div>
          </div>
          <span class="artist-plays">${parseInt(a.playcount).toLocaleString()} plays</span>
          <button class="artist-tracks-toggle" aria-label="Show top tracks">▼</button>
        </div>
        <div class="artist-tracks-dropdown"></div>
      </div>`).join('');

    list.querySelectorAll('.artist-tracks-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.artist-row');
        const dropdown = row.nextElementSibling;
        const artistName = row.dataset.artist;
        const isOpen = dropdown.classList.contains('open');

        if (isOpen) {
          dropdown.classList.remove('open');
          row.classList.remove('tracks-open');
          btn.classList.remove('open');
          return;
        }

        dropdown.classList.add('open');
        row.classList.add('tracks-open');
        btn.classList.add('open');

        if (!dropdown.innerHTML) {
          dropdown.innerHTML = '<p class="track-loading">Loading…</p>';
          const tracks = await fetchArtistTracks(artistName);
          dropdown.innerHTML = tracks.length
            ? tracks.map((t, i) => `
                <div class="track-item">
                  <span class="track-num">${i + 1}</span>
                  <span>${t.name}</span>
                </div>`).join('')
            : '<p class="track-loading">No tracks found.</p>';
        }
      });
    });
  } catch(e) {
    console.error('Last.fm error:', e);
    list.innerHTML = `<p class="empty-state">Could not load Last.fm data — ${e.message}</p>`;
  }
}

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadTopArtists(btn.dataset.period);
  });
});

loadTopArtists('7day');

// ── GROUPS I FOLLOW ──
function renderGroups(groups) {
  const grid      = document.getElementById('groups-grid');
  const alsoEl    = document.getElementById('groups-also');
  const alsoGrid  = document.getElementById('groups-also-grid');
  const countEl   = document.getElementById('groups-count');
  if (!groups || !groups.length) return;

  // Support legacy flat-string format
  if (typeof groups[0] === 'string') {
    countEl.textContent = groups.length;
    grid.innerHTML = groups.map(n => `<span class="group-chip"><span>${n}</span></span>`).join('');
    return;
  }

  const mainGroups = groups.filter(g => g.tier !== 3).sort((a, b) => b.songs - a.songs);
  const alsoGroups = groups.filter(g => g.tier === 3).sort((a, b) => a.name.localeCompare(b.name));

  countEl.textContent = groups.length;

  // sqrt scale: 0.65rem (min) → 1.45rem (max)
  const maxSongs = Math.max(...mainGroups.map(g => g.songs || 1));
  function chipSize(songs) {
    const s = Math.max(0, ((songs || 1) - 1) / (maxSongs - 1));
    return (0.65 + Math.sqrt(s) * 0.80).toFixed(3) + 'rem';
  }

  grid.innerHTML = mainGroups.map(g =>
    `<span class="group-chip" style="--chip-size:${chipSize(g.songs)}" title="${g.songs} songs in the mix">` +
    `<span>${g.name}</span></span>`
  ).join('');

  if (alsoGroups.length) {
    alsoEl.hidden = false;
    alsoGrid.innerHTML = alsoGroups.map(g =>
      `<span class="group-chip group-chip--muted" style="--chip-size:0.65rem">` +
      `<span>${g.name}</span></span>`
    ).join('');
  }
}

// ── MARGIN LOGOS ──
function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Normalise artist names for comparison (handles æspa ↔ aespa etc.)
function normalizeArtist(name) {
  return name.toLowerCase().replace(/æ/g, 'ae').replace(/[^a-z0-9]/g, '');
}

function renderMarginLogos(groups, attendedArtists = new Set()) {
  // 12 fixed viewport slots — 6 per side, staggered vertically
  const slots = [
    { side: 'left',  top: '8%',  px: 20, size: 60, rot: -8 },
    { side: 'left',  top: '24%', px: 36, size: 50, rot:  6 },
    { side: 'left',  top: '42%', px: 16, size: 64, rot: -4 },
    { side: 'left',  top: '58%', px: 30, size: 52, rot:  7 },
    { side: 'left',  top: '75%', px: 22, size: 56, rot: -6 },
    { side: 'left',  top: '88%', px: 38, size: 46, rot:  5 },
    { side: 'right', top: '14%', px: 30, size: 56, rot:  7 },
    { side: 'right', top: '31%', px: 14, size: 64, rot: -5 },
    { side: 'right', top: '47%', px: 38, size: 48, rot:  4 },
    { side: 'right', top: '63%', px: 20, size: 60, rot: -7 },
    { side: 'right', top: '79%', px: 36, size: 52, rot:  8 },
    { side: 'right', top: '92%', px: 18, size: 58, rot: -4 },
  ];

  // Top tier-1 groups by song count fill the slots
  // File naming: slugify(group.name) + '.png'
  // e.g. NMIXX → nmixx.png, KISS OF LIFE → kiss-of-life.png, (G)I-DLE → gi-dle.png
  const topGroups = groups
    .filter(g => g.tier !== 3)
    .sort((a, b) => b.songs - a.songs)
    .slice(0, slots.length);

  topGroups.forEach((group, i) => {
    const s = slots[i];
    const img = document.createElement('img');
    img.src = `assets/logos/${slugify(group.name)}.svg`;
    img.alt = group.name;
    const seen = attendedArtists.has(normalizeArtist(group.name));
    img.className = 'margin-logo' + (seen ? ' margin-logo--seen' : '');
    img.style.top = s.top;
    img.style[s.side] = s.px + 'px';
    img.style.width = s.size + 'px';
    img.style.transform = `rotate(${s.rot}deg)`;
    img.onerror = () => {
      if (img.src.includes('.svg')) {
        img.src = img.src.replace('.svg', '.png');
      } else {
        img.style.display = 'none';
      }
    };
    document.body.appendChild(img);
  });
}

// ── CONCERTS ──
fetch(DATA_URL)
  .then(r => r.json())
  .then(data => {
    // Support both old flat-array format and new { concerts, groups } format
    const concerts = Array.isArray(data) ? data : (data.concerts || []);
    const groups   = Array.isArray(data) ? []   : (data.groups   || []);

    const upcoming = concerts
      .filter(c => c.upcoming || daysUntil(c.date) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const past = concerts
      .filter(c => !c.upcoming && daysUntil(c.date) <= 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById('stat-shows').textContent = concerts.length;
    document.getElementById('stat-artists').textContent = new Set(concerts.map(c => c.artist)).size;
    document.getElementById('stat-upcoming').textContent = upcoming.length;

    const upcomingSection = document.getElementById('upcoming-section');
    const upcomingGrid = document.getElementById('upcoming-grid');
    const pastGrid = document.getElementById('past-grid');

    if (upcoming.length) {
      upcomingGrid.innerHTML = upcoming.map(renderCard).join('');
      initSetlistToggles(upcomingGrid);
      initPhotoLightbox(upcomingGrid);
    } else {
      upcomingSection.style.display = 'none';
    }

    if (past.length) {
      pastGrid.innerHTML = past.map(renderCard).join('');
      initSetlistToggles(pastGrid);
      initPhotoLightbox(pastGrid);
    } else {
      pastGrid.innerHTML = '<p class="empty-state">No concerts yet.</p>';
    }

    renderGroups(groups);
    const attendedArtists = new Set(past.map(c => normalizeArtist(c.artist)));
    renderMarginLogos(groups, attendedArtists);
  })
  .catch(() => {
    document.getElementById('past-grid').innerHTML =
      '<p class="empty-state">Could not load concert data.</p>';
  });
