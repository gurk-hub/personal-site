// Renders a single game page from ?id=<slug>, reusing portfolioItems.json,
// then appends that game's posts from the feed.
(async function () {
    const id = new URLSearchParams(location.search).get('id');
    const hero = document.getElementById('game-hero');
    const content = document.getElementById('game-content');
    const feedEl = document.getElementById('game-feed');

    let items = [];
    try {
        items = await (await fetch('components/portfolioItems.json', { cache: 'no-store' })).json();
    } catch (_) { /* handled below */ }

    const game = items.find(it => it.slug === id);

    if (!game) {
        document.title = 'Game not found';
        hero.innerHTML = `
            <p class="Kanit-Title">Not found</p>
            <p class="Main-Subtitle Center-Text">No game called "${id || ''}". <a href="projects.html" class="text-link">Back to projects</a></p>`;
        return;
    }

    document.title = game.title;

    // Per-game personality: banner image + accent colour
    hero.style.setProperty('--accent', game.accent || 'var(--green)');
    const banner = game.banner || game.image;
    if (banner) {
        hero.style.backgroundImage =
            `linear-gradient(rgba(12, 22, 6, 0.55), rgba(12, 22, 6, 0.72)), url('${banner}')`;
    }

    hero.innerHTML = `
        <p class="Kanit-Title">${game.title}</p>
        <p class="Main-Subtitle Center-Text">${game.description || ''}</p>
        <div class="game-tags">${(game.tags || []).map(t => `<span class="aero-tag">${t}</span>`).join('')}</div>`;

    content.innerHTML = `<div class="game-content-inner">${game.modalContent || ''}</div>`;

    const gallery = content.querySelector('.image-gallery');
    if (gallery && typeof initializeGallery === 'function') initializeGallery(gallery);

    // Posts tagged to this game
    const posts = (await loadPosts())
        .filter(p => p.game === id)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (posts.length) {
        feedEl.innerHTML = `
            <p class="Secondary-Title">📰 Updates</p>
            <div class="post-list">${posts.map(p => postCardHTML(p, game.title)).join('')}</div>`;
    }
})();
