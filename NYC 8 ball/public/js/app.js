/* NYC 8 Ball — front-end logic */
(function () {
  'use strict';

  const ball = document.getElementById('ball');
  const idle = document.getElementById('idle');
  const answer = document.getElementById('answer');
  const thinking = document.getElementById('thinking');
  const answerCost = document.getElementById('answerCost');
  const answerTitle = document.getElementById('answerTitle');
  const answerMeta = document.getElementById('answerMeta');
  const detail = document.getElementById('detail');
  const detailDesc = document.getElementById('detailDesc');
  const detailLink = document.getElementById('detailLink');
  const again = document.getElementById('again');
  const errorEl = document.getElementById('error');
  const stats = document.getElementById('stats');

  let busy = false;
  let lastId = null;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function formatCost(a) {
    if (!a.cost || a.cost <= 0) return { text: 'Free', free: true };
    const n = Number.isInteger(a.cost) ? a.cost : a.cost.toFixed(2);
    return { text: '$' + n + ' / person', free: false };
  }

  function show(el, on) { el.hidden = !on; }

  async function shake() {
    if (busy) return;
    busy = true;
    errorEl.hidden = true;

    // animate
    if (!prefersReduced) {
      ball.classList.remove('shaking');
      void ball.offsetWidth; // reflow to restart animation
      ball.classList.add('shaking');
    }
    show(idle, false);
    show(answer, false);
    show(thinking, true);

    const minDelay = prefersReduced ? 150 : 650;
    const started = Date.now();

    try {
      let a = await fetchRandom();
      // avoid repeating the same answer twice in a row when possible
      if (a && a.id === lastId) {
        const retry = await fetchRandom();
        if (retry && retry.id !== lastId) a = retry;
      }

      const wait = Math.max(0, minDelay - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));

      if (!a) throw new Error('No active responses yet — add some in the admin panel.');
      render(a);
      lastId = a.id;
    } catch (err) {
      show(thinking, false);
      show(idle, true);
      errorEl.textContent = err.message || 'Something went wrong.';
      errorEl.hidden = false;
    } finally {
      ball.classList.remove('shaking');
      busy = false;
    }
  }

  async function fetchRandom() {
    const res = await fetch('/api/random', { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Could not reach the 8 ball server.');
    return res.json();
  }

  function render(a) {
    const cost = formatCost(a);
    answerCost.textContent = cost.text;
    answerCost.classList.toggle('is-free', cost.free);
    answerTitle.textContent = a.title;
    answerMeta.textContent = [a.borough, a.category].filter(Boolean).join(' · ');

    show(thinking, false);
    show(idle, false);
    show(answer, true);

    // detail panel
    let desc = a.description || '';
    if (a.costNote) desc += (desc ? '  ' : '') + '(' + a.costNote + ')';
    detailDesc.textContent = desc;
    if (a.url) {
      detailLink.href = a.url;
      detailLink.hidden = false;
    } else {
      detailLink.hidden = true;
    }
    show(detail, true);
    show(again, true);
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/meta', { cache: 'no-store' });
      if (!res.ok) return;
      const m = await res.json();
      stats.textContent = `${m.active} ideas ready · max $${m.maxCost}/person`;
    } catch (_) { /* non-critical */ }
  }

  ball.addEventListener('click', shake);
  again.addEventListener('click', shake);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      if (document.activeElement === ball) return; // button handles it
      e.preventDefault();
      shake();
    }
  });

  loadStats();
})();
