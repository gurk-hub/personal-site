// Populates the "By the numbers" band from stats.json.
//
// stats.json is refreshed once a day by a GitHub Action and published via
// GitHub Pages. Point STATS_REMOTE at that Pages URL once it's live; until
// then (and as a fallback) it reads the local stats.json bundled with the site.
//
//   STATS_REMOTE example: 'https://YOUR_GH_USERNAME.github.io/portfolio-stats/stats.json'
const STATS_REMOTE = '';            // <-- paste your GitHub Pages stats URL here
const STATS_LOCAL  = 'stats.json';  // bundled fallback

async function fetchStats() {
    const urls = [STATS_REMOTE, STATS_LOCAL].filter(Boolean);
    for (const url of urls) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) return await res.json();
        } catch (_) { /* try next */ }
    }
    return null;
}

function animateCount(el, target) {
    const duration = 1200;
    const start = performance.now();
    function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        el.textContent = Math.round(target * eased).toLocaleString();
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function renderStats(data) {
    if (!data) return;
    const m = data.modrinth || {};
    const f = data.fortnite || {};
    const values = {
        downloads: m.downloads,
        followers: m.followers,
        plays_7d:  f.plays_7d,
        hours_7d:  f.hours_7d,
    };
    document.querySelectorAll('#stats [data-stat]').forEach(el => {
        const v = values[el.getAttribute('data-stat')];
        if (typeof v === 'number') animateCount(el, v);
        else el.textContent = '—';
    });
}

fetchStats().then(renderStats);
