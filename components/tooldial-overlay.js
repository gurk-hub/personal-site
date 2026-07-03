/*
 * tooldial-overlay.js — renders the home-screen text overlay (clock, date, screen time,
 * steps, battery) on top of a theme preview. Shared by the gallery cards, the expanded
 * modal, and the submit page so they all stay in sync with the Detune app's home layout.
 * Returns an HTML string for a <div class="td-overlay">…</div>.
 *
 * Every element is an independent wrap-content item placed by a 2-axis bias:
 *   x = hpos/50 - 1,  y = vpos/50 - 1   (-1 = anchored to that edge, 0 = centre, +1 = opposite edge)
 * with a ~20dp side margin. Positions are NOT clamped — values outside 0..100 push the element
 * partly past the screen edge (bias beyond ±1), which is intentional. In CSS this bias is exactly
 * `left:hpos%; translateX(-hpos%)` (and the vertical equivalent), which naturally handles values
 * below 0 / above 100. Text scales in cqw against a ~380dp reference phone.
 */
(function () {
    "use strict";

    const REF = 3.8;   // 380dp reference width -> cqw = dp / REF
    const PAD = 5.3;   // ~20dp side margin, in cqw

    // Element colour: white by default, else hsv(hue, 0.7, 1.0) == hsl(hue, 100%, 65%).
    const elColor = (custom, hue) => (custom ? `hsl(${hue} 100% 65%)` : "#fff");
    const cqw = px => (Number(px) / REF).toFixed(2) + "cqw";

    const ICONS = {
        schedule: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 1.7"/></svg>',
        steps: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="8" cy="8.5" rx="2.6" ry="4"/><ellipse cx="15.5" cy="15" rx="2.6" ry="4"/></svg>',
        battery: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="15" height="9" rx="1.5"/><path d="M20.5 11.5v2" stroke-linecap="round"/><rect x="5" y="10" width="8.5" height="5" rx="0.5" fill="currentColor" stroke="none"/></svg>'
    };

    const iconValue = (icon, asIcon, value, worded) =>
        (asIcon ? `${icon}<span>${value}</span>` : `<span>${worded}</span>`);

    // Independent element placed by (hpos, vpos), 0..100 (50 = centre); unclamped.
    function el(vpos, hpos, cls, style, content) {
        return `<div class="td-ovrow" style="top:${vpos}%; transform:translateY(-${vpos}%); padding:0 ${PAD}cqw;">`
            + `<span class="${cls}" style="position:relative; left:${hpos}%; transform:translateX(-${hpos}%); ${style}">${content}</span>`
            + `</div>`;
    }

    function html(a) {
        const now = new Date();
        const hh = a.clock24h ? now.getHours() : (now.getHours() % 12 || 12);
        const clock = `${String(hh).padStart(a.clock24h ? 2 : 1, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

        let out = `<div class="td-overlay">`;

        if (a.showClock) {
            out += el(a.clockVerticalPosition, a.clockHorizontalPosition, "td-clock",
                `opacity:${a.clockOpacity / 100}; color:${elColor(a.clockCustomColor, a.clockHue)}; font-size:${cqw(a.clockSize)};`,
                clock);
        }
        if (a.showDate) {
            out += el(a.dateVerticalPosition, a.dateHorizontalPosition, "td-date",
                `opacity:${a.dateOpacity / 100}; color:${elColor(a.dateCustomColor, a.dateHue)}; font-size:${cqw(a.dateSize)};`,
                date);
        }
        if (a.showScreenTime) {
            const t = "2h 14m";
            out += el(a.screenTimePosition, a.screenTimeHorizontalPosition, "td-ovtext",
                `opacity:${a.screenTimeOpacity / 100}; color:${elColor(a.screenTimeCustomColor, a.screenTimeHue)}; font-size:${cqw(a.screenTimeSize)};`,
                iconValue(ICONS.schedule, a.screenTimeAsIcon, t, t));
        }
        if (a.showSteps) {
            const n = (4213).toLocaleString();
            out += el(a.stepsPosition, a.stepsHorizontalPosition, "td-ovtext",
                `opacity:${a.stepsOpacity / 100}; color:${elColor(a.stepsCustomColor, a.stepsHue)}; font-size:${cqw(a.stepsSize)};`,
                iconValue(ICONS.steps, a.stepsAsIcon, n, n + " steps"));
        }
        if (a.showBattery) {
            const pct = "76%";
            out += el(a.batteryPosition, a.batteryHorizontalPosition, "td-ovtext",
                `opacity:${a.batteryOpacity / 100}; color:${elColor(a.batteryCustomColor, a.batteryHue)}; font-size:${cqw(a.batterySize)};`,
                iconValue(ICONS.battery, a.batteryAsIcon, pct, pct));
        }

        out += `</div>`;
        return out;
    }

    window.ToolDialOverlay = { html };
})();
