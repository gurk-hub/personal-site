// Populates the homepage "Featured" projects and "From the feed" strips.
(async function () {
    let items = [];
    try {
        items = await (await fetch('components/portfolioItems.json', { cache: 'no-store' })).json();
    } catch (_) { /* sections just stay empty */ }
    const titleBySlug = Object.fromEntries(items.map(it => [it.slug, it.title]));

    // Featured projects
    const featuredWrap = document.getElementById('home-featured');
    if (featuredWrap) {
        const featured = items.filter(it => it.featured);
        featuredWrap.innerHTML = featured.map(it => {
            const href = (it.hasPage && it.slug) ? `game.html?id=${it.slug}` : 'projects.html';
            return `
                <a class="paper-card" href="${href}">
                    <div class="pc-media"><img src="${it.image}" alt="${it.title}" loading="lazy"></div>
                    <div class="pc-body">
                        <h3 class="pc-title">${it.title}</h3>
                        <p class="pc-desc">${it.description || ''}</p>
                        ${it.highlight ? `<p class="pc-proof"><i>✓</i> ${it.highlight}</p>` : ''}
                        <div class="pc-tags">${(it.tags || []).map(t => `<span class="pc-tag">${t}</span>`).join('')}</div>
                    </div>
                </a>`;
        }).join('');
    }

    // Latest posts
    const feedWrap = document.getElementById('home-feed');
    if (feedWrap) {
        const posts = (await loadPosts())
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, 3);
        if (!posts.length) {
            feedWrap.innerHTML = `<p class="pc-desc" style="padding:0 6%;">No posts yet — check back soon!</p>`;
            return;
        }
        feedWrap.innerHTML = posts.map(p => {
            const tag = p.game ? `<span class="feed-row-tag">🎮 ${titleBySlug[p.game] || p.game}</span>` : '';
            return `
                <a class="feed-row" href="devlog.html">
                    <span class="feed-row-date">${formatPostDate(p.date)}</span>
                    <span class="feed-row-title">${p.title || ''}</span>
                    ${tag}
                </a>`;
        }).join('');
    }
})();
