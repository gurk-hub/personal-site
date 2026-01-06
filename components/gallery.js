function initializeGallery(gallery) {
    if (gallery._intervalId) {  
        clearInterval(gallery._intervalId);
    }
    let currentIndex = 0;
    const wrappers = gallery.querySelectorAll('.gallery-image-wrapper');
    const totalImages = wrappers.length;
    let progressInterval;
    const cycleTime = 5000; // 1 second = 1000

    function resetProgressBar(wrapper) {
        const bar = wrapper.querySelector('.progress-bar');
        bar.style.transition = 'none';
        bar.style.width = '0%';
        setTimeout(() => {
        bar.style.transition = `width ${cycleTime}ms linear`;
        bar.style.width = '100%';
        }, 50); // delay to allow reset
    }

    function showImage(index) {
        wrappers.forEach((wrapper, i) => {
        wrapper.classList.remove('active');
        if (i === index) {
            wrapper.classList.add('active');
            resetProgressBar(wrapper);
        }
        });
    }


    // Force a delayed progress bar animation to allow DOM to paint first
    setTimeout(() => {
    resetProgressBar(wrappers[currentIndex]);
    }, 100); // Slight delay (e.g., 100ms) to let it apply transition

    function nextImage() {
        currentIndex = (currentIndex + 1) % totalImages;
        showImage(currentIndex);
    }

    wrappers.forEach(wrapper => {
        const img = wrapper.querySelector('img.gallery-image');
        if (img) {
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => {
                clearInterval(gallery._intervalId);  // Clear current timer
                nextImage();                         // Advance immediately
                gallery._intervalId = setInterval(nextImage, cycleTime);  // Restart timer
            });
        }
    });

    showImage(currentIndex);
    gallery._intervalId = setInterval(nextImage, cycleTime);
}