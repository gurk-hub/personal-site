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
 *
 * Icons are Google's Material Icons (Apache 2.0), the same set the app draws:
 * https://github.com/google/material-design-icons
 */
(function () {
    "use strict";

    const T = window.ToolDialTheme;
    const F = window.ToolDialFonts;

    const REF = 3.8;   // 380dp reference width -> cqw = dp / REF
    const PAD = 5.3;   // ~20dp side margin, in cqw

    const cqw = px => (Number(px) / REF).toFixed(2) + "cqw";
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // Stand-in readings for the live values the phone would supply. They never leave the device,
    // so a preview just shows something plausible and stable.
    const SAMPLE_STEPS = 4213;
    const SAMPLE_BATTERY = 76;
    const SAMPLE_CHARGING = false;

    /**
     * Google's Material Icons (classic Filled/baseline set, Apache 2.0) -- the same ones the app
     * draws, taken from google/material-design-icons so the previews match it exactly rather than
     * approximating. All are 24x24; inlined rather than loaded from the icon font so they can't
     * flash in late or go missing offline.
     */
    const ICON_PATHS = {
        schedule: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z",
        directions_walk: "M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7",
        battery_charging_full: "M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4zM11 20v-5.5H9L13 7v5.5h2L11 20z",
        battery_full: "M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z",
        battery_6_bar: "M17,5v16c0,0.55-0.45,1-1,1H8c-0.55,0-1-0.45-1-1V5c0-0.55,0.45-1,1-1h2V2h4v2h2C16.55,4,17,4.45,17,5z M15,6H9v2h6V6z",
        battery_5_bar: "M17,5v16c0,0.55-0.45,1-1,1H8c-0.55,0-1-0.45-1-1V5c0-0.55,0.45-1,1-1h2V2h4v2h2C16.55,4,17,4.45,17,5z M15,6H9v4h6V6z",
        battery_4_bar: "M17,5v16c0,0.55-0.45,1-1,1H8c-0.55,0-1-0.45-1-1V5c0-0.55,0.45-1,1-1h2V2h4v2h2C16.55,4,17,4.45,17,5z M15,6H9v6h6V6z",
        battery_3_bar: "M17,5v16c0,0.55-0.45,1-1,1H8c-0.55,0-1-0.45-1-1V5c0-0.55,0.45-1,1-1h2V2h4v2h2C16.55,4,17,4.45,17,5z M15,6H9v8h6V6z",
        battery_2_bar: "M17,5v16c0,0.55-0.45,1-1,1H8c-0.55,0-1-0.45-1-1V5c0-0.55,0.45-1,1-1h2V2h4v2h2C16.55,4,17,4.45,17,5z M15,6H9v10h6V6z",
        battery_1_bar: "M17,5v16c0,0.55-0.45,1-1,1H8c-0.55,0-1-0.45-1-1V5c0-0.55,0.45-1,1-1h2V2h4v2h2C16.55,4,17,4.45,17,5z M15,6H9v12h6V6z",
        battery_0_bar: "M17,5v16c0,0.55-0.45,1-1,1H8c-0.55,0-1-0.45-1-1V5c0-0.55,0.45-1,1-1h2V2h4v2h2C16.55,4,17,4.45,17,5z M15,6H9v14h6V6z",
        skip_previous: "M6 6h2v12H6zm3.5 6l8.5 6V6z",
        play_arrow: "M8 5v14l11-7z",
        pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
        skip_next: "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z",
    };
    const icon = (name, cls) =>
        '<svg class="' + (cls || "td-ovicon") + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
        + '<path d="' + ICON_PATHS[name] + '"/></svg>';

    /**
     * The battery icon follows the level, matching the app's ladder (HomeScreen.kt). Our sample is
     * a static 76% and never charging, but keep it data-driven so the icon stays honest if that
     * sample ever changes.
     */
    function batteryIcon(pct, charging) {
        if (charging) return "battery_charging_full";
        if (pct >= 96) return "battery_full";
        if (pct >= 85) return "battery_6_bar";
        if (pct >= 70) return "battery_5_bar";
        if (pct >= 55) return "battery_4_bar";
        if (pct >= 40) return "battery_3_bar";
        if (pct >= 25) return "battery_2_bar";
        if (pct >= 10) return "battery_1_bar";
        return "battery_0_bar";
    }

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
            // prev / play-pause / next, sized size*1.4 / size*1.9 / size*1.4. The middle icon is
            // play_arrow vs pause depending on playback; a static preview isn't playing anything.
            ? `<span class="td-ovmusic-row">`
                + `<span style="font-size:${cqw(w.size * 1.4)}">${icon("skip_previous", "td-ovmusic")}</span>`
                + `<span style="font-size:${cqw(w.size * 1.9)}">${icon("play_arrow", "td-ovmusic")}</span>`
                + `<span style="font-size:${cqw(w.size * 1.4)}">${icon("skip_next", "td-ovmusic")}</span>`
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
            out += statEl(a, "screenTime", icon("schedule"), value, value);
        }
        if (a.showSteps) {
            const n = SAMPLE_STEPS.toLocaleString("en-US");
            out += statEl(a, "steps", icon("directions_walk"), n, n + " steps");
        }
        if (a.showBattery) {
            const pct = SAMPLE_BATTERY + "%";
            out += statEl(a, "battery", icon(batteryIcon(SAMPLE_BATTERY, SAMPLE_CHARGING)), pct, pct);
        }

        for (const key of Object.keys(T.WIDGET_KEYS)) {
            const w = a[key];
            if (w && w.shown) out += styleWidget(a, key, w);
        }

        out += `</div>`;
        return out;
    }

    window.ToolDialOverlay = { html, formatDate, batteryIcon, icon, ICON_PATHS, WIDGET_TEXT };
})();
