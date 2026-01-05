
// --- Simple JavaScript driver for the sugar fill ---
(() => {
  const sugarEl = document.getElementById('sugar');
  const coffeeEl = document.getElementById('coffee');
  const addBtn   = document.getElementById('addBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Config: how long to fill (ms) and target sugar percentage
  const FILL_DURATION_MS = 10_000;  // 10 seconds
  const TARGET_SUGAR_PCT = 35;      // sugar will rise up to 35% of cup height
  const COFFEE_START_PCT = 55;      // matches CSS starting coffee height

  let startTime = null;
  let rafId = null;

  function setHeights(sugarPct) {
    // Ensure sugar sits on top of coffee layer, and coffee stays constant
    coffeeEl.style.height = COFFEE_START_PCT + '%';
    sugarEl.style.bottom = COFFEE_START_PCT + '%';
    sugarEl.style.height = Math.max(0, Math.min(100, sugarPct)) + '%';
  }

  function animateFill(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(1, elapsed / FILL_DURATION_MS);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const sugarPct = ease * TARGET_SUGAR_PCT;

    setHeights(sugarPct);

    if (progress < 1) {
      rafId = requestAnimationFrame(animateFill);
    } else {
      addBtn.disabled = false;
      startTime = null;
      rafId = null;
    }
  }

  function startFill() {
    // Prevent double starts
    if (rafId) return;
    addBtn.disabled = true;
    startTime = null;
    rafId = requestAnimationFrame(animateFill);
  }

  function reset() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    startTime = null;
    setHeights(0);
    addBtn.disabled = false;
  }

  addBtn.addEventListener('click', startFill);
  resetBtn.addEventListener('click', reset);

  // Initialize
  setHeights(0);
})();
