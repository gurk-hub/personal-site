/*
 * tooldial-overlay.js — renders the home-screen overlay (clock, date, screen time, steps, battery
 * and the eleven extra widgets) on top of a theme preview. Shared by the gallery cards, the
 * expanded modal, and the submit page so they all stay in sync with the Detune app's home layout.
 * Returns an HTML string for a <div class="td-overlay">…</div>.
 *
 * Every element is an independent wrap-content item placed by a 2-axis bias:
 *   x = hpos/50 - 1,  y = vpos/50 - 1   (-1 = anchored to that edge, 0 = centre, +1 = opposite edge)
 * with a ~20dp side margin. Positions are NOT clamped — values outside 0..100 push the element
 * partly past the screen edge (bias beyond ±1), which is intentional. In CSS this bias is exactly
 * `left:hpos%; translateX(-hpos%)` (and the vertical equivalent), which naturally handles values
 * below 0 / above 100. Text scales in cqw against a ~380dp reference phone.
 *
 * The eleven widgets carry STYLE ONLY. Their content (the user's name, custom text, countdown
 * date) never leaves the phone, so previews show the same neutral sample strings the app uses.
 */
(function () {
    "use strict";

    const T = window.ToolDialTheme;
    const F = window.ToolDialFonts;

    const REF = 3.8;   // 380dp reference width -> cqw = dp / REF
    const PAD = 5.3;   // ~20dp side margin, in cqw

    const cqw = px => (Number(px) / REF).toFixed(2) + "cqw";
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const ICONS = {
        schedule: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 1.7"/></svg>',
        steps: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="8" cy="8.5" rx="2.6" ry="4"/><ellipse cx="15.5" cy="15" rx="2.6" ry="4"/></svg>',
        battery: '<svg class="td-ovicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="15" height="9" rx="1.5"/><path d="M20.5 11.5v2" stroke-linecap="round"/><rect x="5" y="10" width="8.5" height="5" rx="0.5" fill="currentColor" stroke="none"/></svg>',
        prev: '<svg class="td-ovmusic" viewBox="0 0 24 24" fill="currentColor"><path d="M7 6h2v12H7zM19 6v12l-9-6z"/></svg>',
        play: '<svg class="td-ovmusic" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        next: '<svg class="td-ovmusic" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6h2v12h-2zM5 6l9 6-9 6z"/></svg>',
    };

    // ---- date formatting (dateFormat enum) ----
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const p2 = n => String(n).padStart(2, "0");
    function formatDate(now, fmt) {
        const d = now.getDate(), m = now.getMonth(), y = now.getFullYear();
        switch (fmt) {
            case "ABBREVIATED": return `${DAYS[now.getDay()].slice(0, 3)}, ${MONTHS[m].slice(0, 3)} ${d}`;
            case "NUMERIC_DMY": return `${p2(d)}/${p2(m + 1)}/${y}`;
            case "NUMERIC_MDY": return `${p2(m + 1)}/${p2(d)}/${y}`;
            case "ISO": return `${y}-${p2(m + 1)}-${p2(d)}`;
            case "DAY_MONTH": return `${d} ${MONTHS[m]}`;
            case "FULL":
            default: return `${DAYS[now.getDay()]}, ${MONTHS[m]} ${d}`;
        }
    }

    // ---- colours ----
    // Text elements: customColor off = white. Shadow/outline carry their own colour + fixed alpha.
    function effectColor(a, prefix, kind, dfltRgba, alpha) {
        if (!a[prefix + kind + "CustomColor"]) return dfltRgba;
        const rgb = T.hsvToRgb(a[prefix + kind + "Hue"], a[prefix + kind + "ColorSat"] / 100, a[prefix + kind + "ColorBright"] / 100);
        const c = rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
        return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    }

    /**
     * Clock/date share the shadow/outline/bold/italic set. The single-choice *TextEffect enum is
     * legacy: a v1 theme with clockTextEffect:"SHADOW" must still render a shadow, so the
     * effective value is `flag || enum === THAT_EFFECT`.
     */
    function effects(a, prefix, sizeDp) {
        const legacy = a[prefix + "TextEffect"];
        const shadow = a[prefix + "Shadow"] || legacy === "SHADOW";
        const outline = a[prefix + "Outline"] || legacy === "OUTLINE";
        let css = "";
        if (a[prefix + "Bold"]) css += "font-weight:700;";
        if (a[prefix + "Italic"]) css += "font-style:italic;";
        // Default shadow: rgba(0,0,0,0.6) at offset (0,4) blur 8. A custom colour uses alpha 0.75.
        css += shadow
            ? `text-shadow:0 ${cqw(4)} ${cqw(8)} ${effectColor(a, prefix, "Shadow", "rgba(0,0,0,0.6)", 0.75)};`
            : "text-shadow:none;";
        // The app strokes a layer UNDER the filled text (round joins, stroke = size*0.045, min 1.5px).
        // -webkit-text-stroke paints over the fill, so we render a stroked copy behind it instead.
        // The stroke is centred on the glyph edge, so double the width to leave size*0.045 outside.
        const strokeDp = Math.max(1.5, Math.abs(Number(sizeDp) || 0) * 0.045);
        return {
            css,
            outline,
            strokeCss: outline
                ? `-webkit-text-stroke:${cqw(strokeDp * 2)} ${effectColor(a, prefix, "Outline", "rgba(0,0,0,0.85)", 0.85)};`
                : "",
        };
    }

    // ---- element placement ----
    // An independent item placed by (hpos, vpos), 0..100 (50 = centre); unclamped by design.
    // Negate numerically: a literal `-${pos}` would emit `--30%` for a negative position, which is
    // invalid CSS and silently drops the whole transform.
    const num = v => (Number(v) || 0);
    const neg = v => -num(v);
    function el(vpos, hpos, cls, style, content) {
        return `<div class="td-ovrow" style="top:${num(vpos)}%; transform:translateY(${neg(vpos)}%); padding:0 ${PAD}cqw;">`
            + `<span class="${cls}" style="position:relative; left:${num(hpos)}%; transform:translateX(${neg(hpos)}%); ${style}">${content}</span>`
            + `</div>`;
    }

    // Clock/date: an optional stroked copy sits behind the filled text.
    function textEl(a, prefix, vpos, hpos, cls, sizeDp, content) {
        const fx = effects(a, prefix, sizeDp);
        const style = `opacity:${a[prefix + "Opacity"] / 100}; color:${T.elementColor(a, prefix)};`
            + ` font-size:${cqw(sizeDp)}; font-family:${F.stack(a, prefix)}; ${fx.css}`;
        const inner = fx.outline
            ? `<span class="td-stroke" aria-hidden="true" style="${fx.strokeCss}">${content}</span><span class="td-fill">${content}</span>`
            : content;
        return el(vpos, hpos, cls + (fx.outline ? " has-outline" : ""), style, inner);
    }

    // Screen time / steps / battery: icon+value, or a worded string.
    const iconValue = (icon, asIcon, value, worded) =>
        (asIcon ? `${icon}<span>${esc(value)}</span>` : `<span>${esc(worded)}</span>`);

    function statEl(a, prefix, icon, value, worded) {
        const style = `opacity:${a[prefix + "Opacity"] / 100}; color:${T.elementColor(a, prefix)};`
            + ` font-size:${cqw(a[prefix + "Size"])}; font-family:${F.stack(a, prefix)};`;
        return el(a[prefix + "Position"], a[prefix + "HorizontalPosition"], "td-ovtext", style,
            iconValue(icon, a[prefix + "AsIcon"], value, worded));
    }

    // ---- the eleven WidgetStyle widgets ----
    // Style only — these are the app's own neutral sample strings.
    const WIDGET_TEXT = {
        greetingWidget: "Good morning.",
        alarmWidget: "Alarm in 6h 30m",
        customTextWidget: "Your text",
        quoteWidget: "Your daily quote.",
        countdownWidget: "14 days until Event",
        nowPlayingWidget: "Song Title - Author",
        musicControlsWidget: null,   // three icons, not text
        calendarWidget: "Event name, 12:34",
        distanceWidget: "3.2 km",
        caloriesWidget: "1,845 kcal",
        batteryTempWidget: "31.5°C",
    };

    function styleWidget(a, key, w) {
        const color = T.rgbToCss(T.elementRgb(w.customColor, w.hue, w.colorSat, w.colorBright));
        const style = `opacity:${w.opacity / 100}; color:${color}; font-size:${cqw(w.size)};`
            + ` font-family:${F.widgetStack(a, w)};`;
        const content = (key === "musicControlsWidget")
            // prev / play-pause / next, sized size*1.4 / size*1.9 / size*1.4.
            ? `<span class="td-ovmusic-row">`
                + `<span style="font-size:${cqw(w.size * 1.4)}">${ICONS.prev}</span>`
                + `<span style="font-size:${cqw(w.size * 1.9)}">${ICONS.play}</span>`
                + `<span style="font-size:${cqw(w.size * 1.4)}">${ICONS.next}</span>`
                + `</span>`
            : `<span>${esc(WIDGET_TEXT[key])}</span>`;
        return el(w.position, w.horizontalPosition, "td-ovtext", style, content);
    }

    function html(a) {
        const now = new Date();
        const hh = a.clock24h ? now.getHours() : (now.getHours() % 12 || 12);
        const clock = `${String(hh).padStart(a.clock24h ? 2 : 1, "0")}:${p2(now.getMinutes())}`;
        const date = formatDate(now, a.dateFormat);

        if (F && F.preload) F.preload(a);

        let out = `<div class="td-overlay">`;

        if (a.showClock) out += textEl(a, "clock", a.clockVerticalPosition, a.clockHorizontalPosition, "td-clock", a.clockSize, esc(clock));
        if (a.showDate) out += textEl(a, "date", a.dateVerticalPosition, a.dateHorizontalPosition, "td-date", a.dateSize, esc(date));

        if (a.showScreenTime) {
            // screenTimeShowActive adds a second "active time" figure alongside the total.
            const total = "2h 14m";
            const value = a.screenTimeShowActive ? total + " · 47m active" : total;
            out += statEl(a, "screenTime", ICONS.schedule, value, value);
        }
        if (a.showSteps) {
            const n = (4213).toLocaleString("en-US");
            out += statEl(a, "steps", ICONS.steps, n, n + " steps");
        }
        if (a.showBattery) out += statEl(a, "battery", ICONS.battery, "76%", "76%");

        for (const key of Object.keys(T.WIDGET_KEYS)) {
            const w = a[key];
            if (w && w.shown) out += styleWidget(a, key, w);
        }

        out += `</div>`;
        return out;
    }

    window.ToolDialOverlay = { html, formatDate, WIDGET_TEXT };
})();
