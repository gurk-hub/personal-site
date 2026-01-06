fetch('components/portfolioItems.json')
.then(response => response.json())
.then(portfolioItems => {
    const container = document.getElementById('portfolio-container');
    const modalContainer = document.getElementById('modal-container');

    portfolioItems.forEach((item, index) => {
        // Generate a unique ID for modal
        const modalId = `modal-${index}`;

        // Create portfolio card
        const card = document.createElement('div');
        card.className = 'project';
        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}" loading="lazy" style="cursor:pointer"/>
        `;

        // Open modal when clicking image or card
        card.addEventListener('click', () => {
            const modal = document.getElementById(modalId);
            modal.style.display = 'flex';

            // Initialize the gallery inside this modal
            const gallery = modal.querySelector('.image-gallery');
            if (gallery) {
                initializeGallery(gallery);
            }
        });

        container.appendChild(card);

        // Create modal element
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.style.display = 'none'; // hidden by default

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${item.title}</h2>
                    <span class="close">&times;</span>
                </div>
                ${item.modalContent}
            </div>
        `;

        modalContainer.appendChild(modal);

        // Close button handler
        modal.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Close modal when clicking outside modal content
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
})
.catch(err => console.error('Error loading portfolio:', err));
