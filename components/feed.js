// Renders the full feed with per-game filter chips.
(async function () {
    const listEl = document.getElementById('feed-list');
    const filterEl = document.getElementById('feed-filter');

    let items = [];
    try {
        items = await (await fetch('components/portfolioItems.json', { cache: 'no-store' })).json();
    } catch (_) { /* feed still works without game titles */ }
    const titleBySlug = Object.fromEntries(items.map(it => [it.slug, it.title]));

    const posts = (await loadPosts())
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (!posts.length) {
        filterEl.style.display = 'none';
        listEl.innerHTML = `<p class="Main-Subtitle Center-Text">No posts yet — check back soon!</p>`;
        return;
    }

    const usedGames = [...new Set(posts.map(p => p.game).filter(Boolean))];
    filterEl.innerHTML =
        `<button class="filter-chip active" data-filter="all">All</button>` +
        usedGames.map(slug => `<button class="filter-chip" data-filter="${slug}">${titleBySlug[slug] || slug}</button>`).join('');

    function render(filter) {
        const shown = filter === 'all' ? posts : posts.filter(p => p.game === filter);
        listEl.innerHTML = shown.map(p => postCardHTML(p, titleBySlug[p.game])).join('');
    }
    render('all');

    filterEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;
        filterEl.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render(btn.dataset.filter);
    });
})();
