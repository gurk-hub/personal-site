/*
 * tooldial-dial.js — a DOM mock of the launcher's radial dial, ported from the app's
 * DialGeometry.kt / DialOverlay.kt so a theme's dial settings (position, size, layout, text size,
 * icons/names, selection glow) render the way they do on the phone. Placeholder app labels stand
 * in for the user's real apps. Exposed as window.ToolDialDial.render(overlayEl, appearance, {w,h}).
 */
(function () {
    "use strict";

    const APPS = ["Phone", "Messages", "Camera", "Clock", "Calendar", "Settings", "Browser", "Photos", "Music", "Maps", "Files", "Store"];
    const REF_WIDTH_DP = 380; // reference phone width; everything scales from the preview's px width

    const SIZE_PRESET = { SMALL: [150, 30], MEDIUM: [210, 26], LARGE: [280, 22] };

    // dialItemSpacing means different things per layout: an arc angle in degrees on DIAL/LIST/
    // CAROUSEL, but a horizontal shift on WHEEL, where 22 is neutral (apps line up straight) and
    // each slot is offset by (spacing - 22) * 1.5dp. When it's null on a Wheel the default must be
    // 22, NOT the size preset — using the preset skews the wheel (DialGeometry.WHEEL_NEUTRAL_SPACING).
    const WHEEL_NEUTRAL_SPACING = 22;

    function nameCase(label, c) {
        if (c === "UPPER") return label.toUpperCase();
        if (c === "LOWER") return label.toLowerCase();
        if (c === "TITLE") return label.replace(/\b\w/g, m => m.toUpperCase());
        return label;
    }

    function render(overlay, a, dims) {
        overlay.innerHTML = "";
        overlay.classList.add("td-dial");
        const W = dims.w, H = dims.h;
        if (!W || !H) return;
        // dialScale (50..150) zooms the whole dial around its anchor.
        const scale = (W / REF_WIDTH_DP) * ((Number(a.dialScale) || 100) / 100);

        const preset = SIZE_PRESET[a.dialSize] || SIZE_PRESET.MEDIUM;
        const r = (a.dialRadius != null ? a.dialRadius : preset[0]) * scale;
        const wheel = a.dialLayout === "WHEEL";
        const spacingDefault = wheel ? WHEEL_NEUTRAL_SPACING : preset[1];
        const step = (a.dialItemSpacing != null ? a.dialItemSpacing : spacingDefault);
        const half = a.dialVisibleItems != null ? Math.max(1, Math.floor(a.dialVisibleItems / 2)) : 2;
        const edge = (a.dialEdgeDistance != null ? a.dialEdgeDistance : 28) * scale;
        const vOff = (a.dialVerticalOffset != null ? a.dialVerticalOffset : 0) * scale;
        const pos = a.dialPosition, layout = a.dialLayout;
        const ts = a.dialTextSize;

        const anchorDeg = pos === "RIGHT" ? 180 : pos === "LEFT" ? 0 : -90;
        const centerX = pos === "RIGHT" ? W - edge + r : pos === "LEFT" ? edge - r : W / 2;
        const centerY = H / 2 + vOff;
        const fullCircle = layout === "DIAL" && pos === "CENTER";
        const n = APPS.length, h = Math.floor(n / 2);

        const rad = d => d * Math.PI / 180;
        const anchorX = centerX + r * Math.cos(rad(anchorDeg));
        const listSpacing = r * rad(step);
        const wheelSpan = r * 0.95;
        const carouselSpacing = 140 * scale;
        const fanDir = pos === "LEFT" ? -1 : 1;

        // Selection glow behind the highlighted item.
        if (a.selectionGlow) {
            let gx, gy;
            if (layout === "DIAL") { gx = anchorX; gy = centerY + r * Math.sin(rad(anchorDeg)); }
            else if (layout === "CAROUSEL") { gx = W / 2; gy = centerY; }
            else { gx = anchorX; gy = centerY; }
            const glowW = r * 0.95;
            if (layout !== "CAROUSEL") {
                if (pos === "RIGHT") gx -= glowW * 0.30;
                else if (pos === "LEFT") gx += glowW * 0.30;
            }
            const glow = document.createElement("div");
            glow.className = "td-dial-glow";
            glow.style.width = glow.style.height = (glowW * 2) + "px";
            glow.style.left = (gx - glowW) + "px";
            glow.style.top = (gy - glowW) + "px";
            overlay.appendChild(glow);
        }

        // Build placements (itemIndex, slotOffset).
        const placements = [];
        if (fullCircle) {
            for (let i = 0; i < n; i++) {
                let d = i - h;
                if (d > n / 2) d -= n;
                if (d < -n / 2) d += n;
                placements.push([i, d]);
            }
        } else {
            for (let d = -half; d <= half; d++) {
                const idx = ((h + d) % n + n) % n;
                placements.push([idx, d]);
            }
        }

        for (const [idx, d] of placements) {
            const slot = d;
            let x, y, rotX = 0, rotZ = 0;
            if (layout === "DIAL") {
                const angle = fullCircle ? anchorDeg + slot * (360 / n) : anchorDeg + slot * step;
                x = centerX + r * Math.cos(rad(angle));
                y = centerY + r * Math.sin(rad(angle));
            } else if (layout === "LIST") {
                x = anchorX; y = centerY + slot * listSpacing;
            } else if (layout === "WHEEL") {
                const ang = Math.max(-1.45, Math.min(1.45, slot * 0.40));
                // On a Wheel the spacing is a horizontal shift per slot, not an arc angle.
                x = anchorX + slot * (step - WHEEL_NEUTRAL_SPACING) * 1.5 * scale;
                y = centerY + wheelSpan * Math.sin(ang);
                rotX = -(ang * 180 / Math.PI) * 0.7;
            } else if (layout === "FAN") {
                x = anchorX; y = centerY + slot * listSpacing * 0.78;
                rotZ = slot * 7 * fanDir;
            } else { // CAROUSEL
                x = W / 2 + slot * carouselSpacing;
                y = centerY + slot * (Number(a.dialCarouselVerticalSpacing) || 0) * scale;
            }
            // dialItemRotation adds a Z-rotation to every app — this recreates the old FAN look
            // on any layout.
            rotZ += (Number(a.dialItemRotation) || 0);
            overlay.appendChild(makeItem(APPS[idx], d === 0, Math.abs(slot), a, x, y, pos, layout, ts, scale, rotX, rotZ));
        }
    }

    function makeItem(label, selected, distance, a, x, y, pos, layout, ts, scale, rotX, rotZ) {
        const scl = Math.max(0.55, Math.min(1, 1 - 0.16 * distance));
        const alpha = Math.max(0.12, Math.min(1, 1 - 0.30 * distance));
        const carousel = layout === "CAROUSEL";

        const item = document.createElement("div");
        item.className = "td-dial-item" + (selected ? " is-sel" : "") + (carousel ? " is-carousel" : "");
        item.style.left = x + "px";
        item.style.top = y + "px";

        let tx;
        if (carousel || pos === "CENTER") { item.style.transformOrigin = "center center"; tx = "-50%"; }
        else if (pos === "RIGHT") { item.style.transformOrigin = "right center"; tx = "-100%"; }
        else { item.style.transformOrigin = "left center"; tx = "0"; }
        item.style.transform = `translate(${tx}, -50%) scale(${scl}) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
        item.style.opacity = alpha;
        item.style.color = selected ? "#fff" : "rgba(255,255,255,0.6)";

        const fontPx = ((carousel ? (selected ? ts - 4 : ts - 8) : (selected ? ts : ts - 4)) * scale);
        const iconPx = (carousel ? 56 : 36) * scale;

        const icon = (sz) => {
            const ic = document.createElement("div");
            ic.className = "td-dial-icon";
            ic.style.width = ic.style.height = sz + "px";
            ic.style.fontSize = (sz * 0.5) + "px";
            ic.textContent = label[0];
            return ic;
        };
        const text = () => {
            const t = document.createElement("span");
            t.className = "td-dial-label";
            t.style.fontSize = Math.max(7, fontPx) + "px";
            t.style.fontWeight = selected ? "500" : "400";
            if (window.ToolDialFonts) t.style.fontFamily = window.ToolDialFonts.stack(a, "dial");
            t.textContent = nameCase(label, a.appNameCase);
            return t;
        };
        // With icons on, dialOnlySelectedName hides every label except the selected app's.
        const wantsName = a.showAppNames && !(a.dialOnlySelectedName && a.showAppIcons && !selected);

        if (carousel) {
            item.style.flexDirection = "column";
            if (a.showAppIcons !== false) item.appendChild(icon(iconPx)); // carousel always shows an icon card
            if (wantsName) item.appendChild(text());
        } else {
            item.style.justifyContent = pos === "LEFT" ? "flex-start" : pos === "CENTER" ? "center" : "flex-end";
            if (a.showAppIcons) item.appendChild(icon(iconPx));
            if (wantsName) item.appendChild(text());
            if (!a.showAppIcons && !wantsName) item.appendChild(text()); // never render an empty dial
        }
        return item;
    }

    window.ToolDialDial = { render, APPS };
})();
