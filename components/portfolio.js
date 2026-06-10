fetch('components/portfolioItems.json')
.then(response => response.json())
.then(portfolioItems => {
    const container = document.getElementById('portfolio-container');
    const portfolio = document.getElementById('portfolio');
    const modalContainer = document.getElementById('modal-container');

    container.className = 'card-grid';

    // --- One modal per project (unchanged behaviour, preserves the gallery) ---
    portfolioItems.forEach((item, index) => {
        const modal = document.createElement('div');
        modal.id = `modal-${index}`;
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${item.title}</h2>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">${item.modalContent}</div>
            </div>
        `;
        modalContainer.appendChild(modal);
        modal.querySelector('.close').addEventListener('click', () => modal.style.display = 'none');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    });

    function openModal(index) {
        const modal = document.getElementById(`modal-${index}`);
        modal.style.display = 'flex';
        const gallery = modal.querySelector('.image-gallery');
        if (gallery) initializeGallery(gallery);
    }

    function tagChips(tags) {
        return (tags || []).map(t => `<span class="aero-tag">${t}</span>`).join('');
    }

    function makeCard(item, index, featured) {
        const card = document.createElement('div');
        card.className = 'aero-card' + (featured ? ' aero-card--featured' : '');
        card.dataset.category = item.category || 'Other';
        card.innerHTML = `
            <div class="aero-card-media">
                <img src="${item.image}" alt="${item.title}" loading="lazy">
                ${item.category ? `<span class="aero-cat">${item.category}</span>` : ''}
            </div>
            <div class="aero-card-body">
                <h3 class="aero-card-title">${item.title}</h3>
                <p class="aero-card-desc">${item.description || ''}</p>
                <div class="aero-tags">${tagChips(item.tags)}</div>
            </div>
        `;
        card.addEventListener('click', () => openModal(index));
        return card;
    }

    // --- Featured spotlight (shown only when filter = All) ---
    const featured = portfolioItems
        .map((item, index) => ({ item, index }))
        .filter(x => x.item.featured);

    let featuredSection = null;
    if (featured.length) {
        featuredSection = document.createElement('div');
        featuredSection.id = 'featured-section';
        featuredSection.innerHTML = `<p class="Secondary-Title">⭐ Featured</p>`;
        const fgrid = document.createElement('div');
        fgrid.className = 'featured-grid';
        featured.forEach(({ item, index }) => fgrid.appendChild(makeCard(item, index, true)));
        featuredSection.appendChild(fgrid);
        portfolio.insertBefore(featuredSection, container);
    }

    // --- Filter bar (only categories that actually exist) ---
    const order = ['Fortnite', 'Minecraft', 'Collabs', 'Other'];
    const present = order.filter(c => portfolioItems.some(it => (it.category || 'Other') === c));
    const filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.innerHTML =
        `<button class="filter-chip active" data-filter="all">All</button>` +
        present.map(c => `<button class="filter-chip" data-filter="${c}">${c}</button>`).join('');
    portfolio.insertBefore(filterBar, container);

    // --- Full catalogue grid ---
    const cards = portfolioItems.map((item, index) => {
        const card = makeCard(item, index, false);
        container.appendChild(card);
        return card;
    });

    // --- Filtering ---
    filterBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;
        filterBar.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.filter;
        cards.forEach(c => {
            c.style.display = (f === 'all' || c.dataset.category === f) ? '' : 'none';
        });
        if (featuredSection) featuredSection.style.display = (f === 'all') ? '' : 'none';
    });
})
.catch(err => console.error('Error loading portfolio:', err));
