// Renders a single game page from ?id=<slug>, reusing portfolioItems.json,
// then appends that game's posts from the feed.
(async function () {
    const id = new URLSearchParams(location.search).get('id');
    const hero = document.getElementById('game-hero');
    const content = document.getElementById('game-content');
    const feedEl = document.getElementById('game-feed');

    let items = [];
    try {
        items = await (await fetch('components/portfolioItems.json')).json();
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
