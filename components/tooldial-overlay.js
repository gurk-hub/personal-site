/*
 * tooldial-overlay.js — renders the home-screen text overlay (clock, date, screen time,
 * steps, battery) on top of a theme preview. Shared by the gallery cards, the expanded
 * modal, and the submit page so they all stay in sync with the Detune app's home layout.
 * Returns an HTML string for a <div class="td-overlay">…</div>.
 *
 * Positioning mirrors the app: each element is a full-width row with ~24dp side padding,
 * placed vertically by its 0–100 position (0 = top, 100 = bottom) and aligned horizontally
 * by its HAlign ("LEFT"/"CENTER"/"RIGHT"). Text scales in cqw against a ~380dp reference
 * phone so it looks identical in a small card and the big modal.
 */
(function () {
    "use strict";

    const REF = 3.8;   // 380dp reference width -> cqw = dp / REF
    const PAD = 6.3;   // ~24dp side padding, in cqw

    const alignCss = v => (v === "LEFT" ? "left" : v === "RIGHT" ? "right" : "center");
    // Element colour: white by default, else hsv(hue, 0.7, 1.0) == hsl(hue, 100%, 65%).
    const elColor = (custom, hue) => (custom ? `hsl(${hue} 100% 65%)` : "#fff");
    const cqw = px => (Number(px) / REF).toFixed(2) + "cqw";

    const ICONS = {
        schedule: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 1.7"/></svg>',
        steps: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="8" cy="8.5" rx="2.6" ry="4"/><ellipse cx="15.5" cy="15" rx="2.6" ry="4"/></svg>',
        battery: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="15" height="9" rx="1.5"/><path d="M20.5 11.5v2" stroke-linecap="round"/><rect x="5" y="10" width="8.5" height="5" rx="0.5" fill="currentColor" stroke="none"/></svg>'
    };

    // A full-width row anchored at pos% (0 top -> 100 bottom), kept in bounds via translateY.
    function row(pos, align, style, inner) {
        return `<div class="td-ovrow" style="top:${pos}%; transform:translateY(-${pos}%); padding:0 ${PAD}cqw; text-align:${alignCss(align)}; ${style}">${inner}</div>`;
    }

    function element(icon, asIcon, value, worded) {
        const body = asIcon ? `${icon}<span>${value}</span>` : `<span>${worded}</span>`;
        return `<span class="td-ovtext">${body}</span>`;
    }

    function html(a) {
        const now = new Date();
        const hh = a.clock24h ? now.getHours() : (now.getHours() % 12 || 12);
        const clock = `${String(hh).padStart(a.clock24h ? 2 : 1, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

        let out = `<div class="td-overlay">`;

        // Clock + date block, positioned by clockVerticalPosition; each line aligned on its own.
        if (a.showClock || a.showDate) {
            const p = a.clockVerticalPosition;
            let block = `<div class="td-ovrow" style="top:${p}%; transform:translateY(-${p}%); padding:0 ${PAD}cqw;">`;
            if (a.showClock) {
                block += `<div class="td-clock" style="text-align:${alignCss(a.clockAlign)}; opacity:${a.clockOpacity / 100}; color:${elColor(a.clockCustomColor, a.clockHue)}; font-size:${cqw(a.clockSize)};">${clock}</div>`;
            }
            if (a.showDate) {
                block += `<div class="td-date" style="text-align:${alignCss(a.dateAlign)}; margin-top:${cqw(a.clockDateGap)}; opacity:${a.dateOpacity / 100}; color:${elColor(a.dateCustomColor, a.dateHue)}; font-size:${cqw(a.dateSize)};">${date}</div>`;
            }
            block += `</div>`;
            out += block;
        }

        // Screen time (worded and value are both the time string).
        if (a.showScreenTime) {
            const t = "2h 14m";
            out += row(a.screenTimePosition, a.screenTimeAlign,
                `opacity:${a.screenTimeOpacity / 100}; color:${elColor(a.screenTimeCustomColor, a.screenTimeHue)}; font-size:${cqw(a.screenTimeSize)};`,
                element(ICONS.schedule, a.screenTimeAsIcon, t, t));
        }

        // Steps: worded "{n} steps", value "{n}".
        if (a.showSteps) {
            const n = (4213).toLocaleString();
            out += row(a.stepsPosition, a.stepsAlign,
                `opacity:${a.stepsOpacity / 100}; color:${elColor(a.stepsCustomColor, a.stepsHue)}; font-size:${cqw(a.stepsSize)};`,
                element(ICONS.steps, a.stepsAsIcon, n, n + " steps"));
        }

        // Battery: worded and value both "{pct}%".
        if (a.showBattery) {
            const pct = "76%";
            out += row(a.batteryPosition, a.batteryAlign,
                `opacity:${a.batteryOpacity / 100}; color:${elColor(a.batteryCustomColor, a.batteryHue)}; font-size:${cqw(a.batterySize)};`,
                element(ICONS.battery, a.batteryAsIcon, pct, pct));
        }

        out += `</div>`;
        return out;
    }

    window.ToolDialOverlay = { html };
})();
