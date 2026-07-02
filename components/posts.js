// Shared loader + renderer for the posts feed.
// posts.json is served from GitHub Pages so adding a post = git push (no Porkbun
// re-upload). Falls back to the local copy bundled with the site.
const POSTS_REMOTE = 'https://gurk-hub.github.io/personal-site/posts.json';
const POSTS_LOCAL  = 'posts.json';

async function loadPosts() {
    for (const url of [POSTS_REMOTE, POSTS_LOCAL]) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) return await res.json();
        } catch (_) { /* try next */ }
    }
    return [];
}

function formatPostDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderPostBody(body) {
    if (!body) return '';
    if (window.marked) return marked.parse(body);
    return body.replace(/\n/g, '<br>');
}

// gameTitle: human label for the post's game tag (falls back to the slug)
function postCardHTML(post, gameTitle) {
    const media = post.image
        ? `<div class="post-media"><img src="${post.image}" alt="" loading="lazy"></div>`
        : '';
    const tag = post.game
        ? `<a class="post-game-tag" href="game.html?id=${post.game}">🎮 ${gameTitle || post.game}</a>`
        : '';
    return `
        <article class="post-card">
            ${media}
            <div class="post-body">
                <div class="post-meta">
                    <span class="post-date">${formatPostDate(post.date)}</span>
                    ${tag}
                </div>
                <h3 class="post-title">${post.title || ''}</h3>
                <div class="post-content">${renderPostBody(post.body)}</div>
            </div>
        </article>`;
}
