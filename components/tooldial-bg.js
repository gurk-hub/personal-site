/*
 * tooldial-bg.js — a full-page background of slowly drifting white speckles on black, echoing the
 * app's XMB "stars" but monochrome (the site has no theme colour). Lightweight 2D canvas particle
 * system: density scales with viewport area, motion is gentle, and it pauses when the tab is hidden
 * or the user prefers reduced motion.
 */
(function () {
    "use strict";

    const canvas = document.getElementById("td-stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0, h = 0, dpr = 1, particles = [], raf = null, last = 0;

    function rand(a, b) { return a + Math.random() * (b - a); }

    function build() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        w = window.innerWidth; h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.min(220, Math.round(w * h / 9000));
        particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({
                x: rand(0, w), y: rand(0, h),
                r: rand(0.4, 1.8),
                base: rand(0.12, 0.7),       // base opacity
                vy: rand(-3, -10),           // px/sec, drifting up
                drift: rand(-4, 4),          // horizontal sway amplitude (px)
                tw: rand(0, Math.PI * 2),    // twinkle phase
                tws: rand(0.4, 1.1),         // twinkle speed
            });
        }
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (document.hidden) { last = now; return; }
        const dt = Math.min(0.05, (now - last) / 1000) || 0;
        last = now;
        ctx.clearRect(0, 0, w, h);
        for (const p of particles) {
            p.y += p.vy * dt;
            p.tw += p.tws * dt;
            if (p.y < -4) { p.y = h + 4; p.x = rand(0, w); }
            const op = p.base * (0.6 + 0.4 * Math.sin(p.tw));
            const x = p.x + Math.sin(p.tw * 0.5) * p.drift;
            ctx.beginPath();
            ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255," + op.toFixed(3) + ")";
            ctx.fill();
        }
    }

    function drawStatic() {
        ctx.clearRect(0, 0, w, h);
        for (const p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255," + p.base.toFixed(3) + ")";
            ctx.fill();
        }
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { build(); if (reduced) drawStatic(); }, 200);
    });

    build();
    if (reduced) { drawStatic(); }
    else { last = performance.now(); raf = requestAnimationFrame(frame); }
})();
