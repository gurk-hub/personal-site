
async function loadComponent(id, file) {
    const res = await fetch(file, { cache: 'no-store' });
    const html = await res.text();
    document.getElementById(id).innerHTML = html;
}

loadComponent("header", "components/header.html").then(setupLogoHover);
loadComponent("footer", "components/footer.html");

// ---- Gurkis logo: randomly swap to a variation on hover ----
// Easter egg: clicking the logo goes home, UNLESS it's currently showing the
// "...2" variation — then it opens the secret page.
function setupLogoHover() {
    const logo = document.querySelector('.gurkis img');
    if (!logo) return;
    const DEFAULT = 'assets/gurkstamp_nobg.png';
    const VARIATIONS = [
        'assets/gurkstamp_nobg1.png',
        'assets/gurkstamp_nobg2.png',
        'assets/gurkstamp_nobg3.png',
    ];
    VARIATIONS.forEach(src => { const img = new Image(); img.src = src; }); // preload

    logo.addEventListener('mouseenter', () => {
        logo.src = VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];
    });
    logo.addEventListener('mouseleave', () => {
        logo.src = DEFAULT;
    });

    const brand = logo.closest('a');
    if (brand) {
        brand.addEventListener('click', (e) => {
            if (logo.src.includes('gurkstamp_nobg2')) {
                e.preventDefault();
                window.location.href = 'gurkis.html';
            }
        });
    }
}

// ---- Private visitor analytics (GoatCounter) ----
// Loads on every page (this script is included site-wide). The dashboard is
// private; nothing is shown on the site. Replace YOURCODE with your GoatCounter
// subdomain, e.g. https://gurkis.goatcounter.com/count
(function loadGoatCounter() {
    const GOATCOUNTER_URL = 'https://gurkis.goatcounter.com/count';
    if (GOATCOUNTER_URL.includes('YOURCODE')) return; // not configured yet
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', GOATCOUNTER_URL);
    document.head.appendChild(s);
})();

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

const projectImages = document.querySelectorAll('.project img');

projectImages.forEach(img => {
    img.addEventListener('mouseenter', () => {
        // Generate random scale and rotate values
        const randomScale = (Math.random() * 0.08) + 1.05;  // Random scale
        const randomRotate = (Math.random() * 7) - 5;  // Random rotate
        
        // Apply the random transform to the image
        img.style.transform = `scale(${randomScale}) rotate(${randomRotate}deg)`;
        img.style.zIndex = "10";
    });

    img.addEventListener('mouseleave', () => {
        // Reset the transform when the mouse leaves
        img.style.transform = 'scale(1) rotate(0deg)';
        img.style.zIndex = "5";
    });
});

// Show the button when scrolling down 100px or more
window.onscroll = function() {
    let button = document.getElementById('backToTop');
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
        button.style.display = "block"; // Show button
    } else {
        button.style.display = "none"; // Hide button
    }
};

// Smooth scroll to the top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth' // Smooth scrolling
    });
}

