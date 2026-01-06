
async function loadComponent(id, file) {
    const res = await fetch(file);
    const html = await res.text();
    document.getElementById(id).innerHTML = html;
}

loadComponent("header", "components/header.html");
loadComponent("footer", "components/footer.html");

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

