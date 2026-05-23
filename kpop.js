const DATA_URL = 'data/kpop.json';

const EXACT_CASE_ARTISTS = new Set(['æspa']);

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
          <h2 class="artist-name">${displayArtist(concert.artist)}</h2>
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

fetch(DATA_URL)
  .then(r => r.json())
  .then(concerts => {
    const upcoming = concerts
      .filter(c => c.upcoming || daysUntil(c.date) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const past = concerts
      .filter(c => !c.upcoming && daysUntil(c.date) <= 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById('stat-shows').textContent = past.length;
    document.getElementById('stat-artists').textContent = new Set(past.map(c => c.artist)).size;
    document.getElementById('stat-upcoming').textContent = upcoming.length;

    const upcomingSection = document.getElementById('upcoming-section');
    const pastSection = document.getElementById('past-section');
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
  })
  .catch(() => {
    document.getElementById('past-grid').innerHTML =
      '<p class="empty-state">Could not load concert data.</p>';
  });
