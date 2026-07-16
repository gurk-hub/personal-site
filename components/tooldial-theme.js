/*
 * tooldial-theme.js — the Shared Integration Contract (version 1), ported to JS so codes made in
 * the Android app load here byte-for-byte and vice versa.
 *
 *   • Schema defaults mirror the app's Theme.kt / ThemeAppearance at app v0.0.6 (179 fields).
 *   • Share code = "DTN1-" + Base64url( gzip( minified-UTF8-JSON ) )  (ThemeCodec.kt).
 *     "TDT1-" codes and the legacy "tooldial-theme" format still decode; we always emit the new ones.
 *   • Colour/date logic mirrors XmbColor.kt (HSV gradient, 12-month palette, time brightness).
 *
 * Exposed as window.ToolDialTheme. Decode is fully tolerant: any failure returns null, unknown
 * keys are ignored, missing fields default-fill. Numerics are NOT clamped — the app lets a user
 * type any value into a slider's box, so codes legitimately carry out-of-range numbers and the
 * documented ranges are only a slider's default track (see RANGES).
 */
(function () {
    "use strict";

    const FORMAT = "detune-theme";
    const LEGACY_FORMATS = ["tooldial-theme"];  // still decode codes from before the rebrand
    const PREFIX = "DTN1-";

    // Valid enum values (from data/Config.kt). Unknown -> first entry (the app's fallback).
    // MONO, LIST and FAN are retired from the app's pickers but remain valid data — keep rendering them.
    const ENUMS = {
        font: ["SELAWIK", "SANS", "SERIF", "MONO", "CURSIVE"],
        appNameCase: ["NORMAL", "UPPER", "LOWER", "TITLE"],
        bgColor1Position: ["TOP_LEFT", "TOP_RIGHT", "CENTER", "BOTTOM_LEFT", "BOTTOM_RIGHT"],
        bgColor2Position: ["TOP_LEFT", "TOP_RIGHT", "CENTER", "BOTTOM_LEFT", "BOTTOM_RIGHT"],
        ribbonStyle: ["WISP", "WAVE", "RIBBON"],
        dateFormat: ["FULL", "ABBREVIATED", "NUMERIC_DMY", "NUMERIC_MDY", "ISO", "DAY_MONTH"],
        clockTextEffect: ["NONE", "SHADOW", "OUTLINE"],   // legacy, superseded by the *Shadow/*Outline flags
        dateTextEffect: ["NONE", "SHADOW", "OUTLINE"],    // legacy
        dialPosition: ["RIGHT", "LEFT", "CENTER"],
        dialSize: ["SMALL", "MEDIUM", "LARGE"],
        dialLayout: ["DIAL", "LIST", "WHEEL", "FAN", "CAROUSEL"],
        scrollAnimation: ["NONE", "SMOOTH", "SHARP", "GLIDE"],
    };

    // Per-element font fields. The enum ones are legacy and may be null ("inherit the master font"),
    // so they can't go through the ENUMS branch — an unknown value becomes null, not SELAWIK.
    const FONT_ENUM_FIELDS = ["clockFont", "dateFont", "screenTimeFont", "stepsFont", "batteryFont", "dialFont"];
    // Free-text Google Fonts family names. Never rejected — the app fetches any family by name.
    const FONT_NAME_FIELDS = ["fontName", "clockFontName", "dateFontName", "screenTimeFontName",
        "stepsFontName", "batteryFontName", "dialFontName"];

    // The eleven extra home widgets all share this nested shape (Theme.kt's WidgetStyle).
    const WIDGET_DEFAULTS = {
        shown: false, horizontalPosition: 50, position: 35, size: 14, opacity: 100,
        customColor: false, hue: 210, colorSat: 70, colorBright: 100, fontName: null,
    };
    const WIDGET_RANGES = {
        horizontalPosition: [0, 100], position: [0, 100], size: [8, 60],
        opacity: [0, 100], hue: [0, 360], colorSat: [0, 100], colorBright: [0, 100],
    };
    // key -> per-widget default overrides
    const WIDGET_KEYS = {
        greetingWidget: { size: 18 }, alarmWidget: {}, customTextWidget: {}, quoteWidget: {},
        countdownWidget: {}, nowPlayingWidget: {}, musicControlsWidget: { size: 22 },
        calendarWidget: {}, distanceWidget: {}, caloriesWidget: {}, batteryTempWidget: {},
    };
    const widgetDefault = key => Object.assign({}, WIDGET_DEFAULTS, WIDGET_KEYS[key]);

    // Default appearance — mirrors ThemeAppearance() defaults in Theme.kt as of app v0.0.6.
    const DEFAULTS = {
        // --- general ---
        font: "SELAWIK", fontName: null, appNameCase: "NORMAL", showHomeHints: true,
        selectionGlow: true, backgroundDepth: true, fluidTransitions: true,
        hideStatusBar: true, drawerBlur: false,
        // --- background ---
        animatedBackground: false, useWallpaper: false,
        bgColor1Hue: 210, bgColor1Sat: 85, bgColor1Bright: 70,
        bgColor2Hue: 280, bgColor2Sat: 70, bgColor2Bright: 45,
        bgColor1Position: "TOP_LEFT", bgColor2Position: "BOTTOM_RIGHT",
        backgroundOpacity: 100, featureOpacity: 100,
        colorFromMonth: false, brightnessFromTime: false, glowIntensity: 44,
        // --- ribbons ---
        ribbonStyle: "RIBBON", ribbonDefinition: 60, ribbonCount: 3, ribbonShine: 60,
        ribbonThickness: 50, ribbonWaveSize: 50, ribbonEdgeGradient: 28,
        effectPosition: 40, effectHeight: 40, ribbonSway: 50,
        strongerFlowOnOpen: true, idleMotion: 20, scrollReaction: 45,
        // --- speckles ---
        speckles: true, speckleAmount: 25, speckleSizeMin: 15, speckleSizeMax: 45,
        speckleOpacityMin: 35, speckleOpacityMax: 90,
        // --- bokeh ---
        bokeh: false, bokehAmount: 30, bokehSizeMin: 25, bokehSizeMax: 65,
        bokehOpacityMin: 20, bokehOpacityMax: 55,
        // --- feature colours ---
        ribbonCustomColor: false, ribbonHue: 210, ribbonColorSat: 70, ribbonColorBright: 100,
        speckleCustomColor: false, speckleHue: 210, speckleColorSat: 70, speckleColorBright: 100,
        bokehCustomColor: false, bokehHue: 210, bokehColorSat: 70, bokehColorBright: 100,
        // --- clock ---
        showClock: true, showDate: true, clock24h: true, dateFormat: "FULL",
        clockHorizontalPosition: 50, clockVerticalPosition: 50,
        clockSize: 84, clockOpacity: 100,
        clockCustomColor: false, clockHue: 210, clockColorSat: 70, clockColorBright: 100,
        clockTextEffect: "NONE",
        clockShadow: false, clockOutline: false, clockBold: false, clockItalic: false,
        clockShadowCustomColor: false, clockShadowHue: 210, clockShadowColorSat: 85, clockShadowColorBright: 95,
        clockOutlineCustomColor: false, clockOutlineHue: 210, clockOutlineColorSat: 85, clockOutlineColorBright: 25,
        clockFont: null, clockFontName: null,
        // --- date ---
        dateHorizontalPosition: 50, dateVerticalPosition: 57,
        dateSize: 18, dateOpacity: 100,
        dateCustomColor: false, dateHue: 210, dateColorSat: 70, dateColorBright: 100,
        dateTextEffect: "NONE",
        dateShadow: false, dateOutline: false, dateBold: false, dateItalic: false,
        dateShadowCustomColor: false, dateShadowHue: 210, dateShadowColorSat: 85, dateShadowColorBright: 95,
        dateOutlineCustomColor: false, dateOutlineHue: 210, dateOutlineColorSat: 85, dateOutlineColorBright: 25,
        dateFont: null, dateFontName: null,
        // --- screen time ---
        showScreenTime: false, screenTimeSize: 14,
        screenTimePosition: 95, screenTimeHorizontalPosition: 50, screenTimeOpacity: 100,
        screenTimeCustomColor: false, screenTimeHue: 210, screenTimeColorSat: 70, screenTimeColorBright: 100,
        screenTimeShowActive: false, screenTimeAsIcon: true,
        screenTimeFont: null, screenTimeFontName: null,
        // --- steps ---
        showSteps: false, stepsSize: 16,
        stepsPosition: 90, stepsHorizontalPosition: 50, stepsOpacity: 100,
        stepsCustomColor: false, stepsHue: 210, stepsColorSat: 70, stepsColorBright: 100,
        stepsAsIcon: true, stepsFont: null, stepsFontName: null,
        // --- battery ---
        showBattery: false, batterySize: 16,
        batteryPosition: 82, batteryHorizontalPosition: 50, batteryOpacity: 100,
        batteryCustomColor: false, batteryHue: 210, batteryColorSat: 70, batteryColorBright: 100,
        batteryAsIcon: true, batteryFont: null, batteryFontName: null,
        // --- dial ---
        dialPosition: "RIGHT", dialSize: "MEDIUM", dialScale: 100, dialLayout: "DIAL",
        swipeDistance: 40, showAppIcons: true, showAppNames: true, dialOnlySelectedName: false,
        dialTextSize: 26, scrollAnimation: "SMOOTH", scrollStrength: 1,
        dialFont: null, dialFontName: null,
        dialRadius: null, dialEdgeDistance: null, dialVerticalOffset: null,
        dialVisibleItems: null, dialItemSpacing: null,
        dialItemRotation: 0, dialCarouselVerticalSpacing: 0,
    };
    // The eleven WidgetStyle objects.
    Object.keys(WIDGET_KEYS).forEach(k => { DEFAULTS[k] = widgetDefault(k); });

    // [min, max] — the app's documented ranges (Theme.kt / §8 of the spec). These are NOT enforced
    // on load: the app lets a user type any number into a slider's value field, so a code may carry
    // values well outside them and must render as-is. They are kept as metadata (a slider's default
    // track) and to order the paired *Min/*Max fields.
    const RANGES = {
        bgColor1Hue: [0, 360], bgColor1Sat: [0, 100], bgColor1Bright: [0, 100],
        bgColor2Hue: [0, 360], bgColor2Sat: [0, 100], bgColor2Bright: [0, 100],
        backgroundOpacity: [0, 100], featureOpacity: [0, 100], glowIntensity: [0, 100],
        ribbonDefinition: [0, 100], ribbonCount: [0, 6], ribbonShine: [0, 100],
        ribbonThickness: [0, 100], ribbonWaveSize: [0, 100], ribbonEdgeGradient: [0, 100],
        effectPosition: [0, 100], effectHeight: [0, 100], ribbonSway: [0, 100],
        idleMotion: [0, 100], scrollReaction: [0, 100],
        speckleAmount: [0, 100], speckleSizeMin: [0, 100], speckleSizeMax: [0, 100],
        speckleOpacityMin: [0, 100], speckleOpacityMax: [0, 100],
        bokehAmount: [0, 100], bokehSizeMin: [0, 100], bokehSizeMax: [0, 100],
        bokehOpacityMin: [0, 100], bokehOpacityMax: [0, 100],
        ribbonHue: [0, 360], ribbonColorSat: [0, 100], ribbonColorBright: [0, 100],
        speckleHue: [0, 360], speckleColorSat: [0, 100], speckleColorBright: [0, 100],
        bokehHue: [0, 360], bokehColorSat: [0, 100], bokehColorBright: [0, 100],
        clockHorizontalPosition: [0, 100], clockVerticalPosition: [0, 100],
        clockSize: [40, 160], clockOpacity: [0, 100],
        clockHue: [0, 360], clockColorSat: [0, 100], clockColorBright: [0, 100],
        clockShadowHue: [0, 360], clockShadowColorSat: [0, 100], clockShadowColorBright: [0, 100],
        clockOutlineHue: [0, 360], clockOutlineColorSat: [0, 100], clockOutlineColorBright: [0, 100],
        dateHorizontalPosition: [0, 100], dateVerticalPosition: [0, 100],
        dateSize: [10, 40], dateOpacity: [0, 100],
        dateHue: [0, 360], dateColorSat: [0, 100], dateColorBright: [0, 100],
        dateShadowHue: [0, 360], dateShadowColorSat: [0, 100], dateShadowColorBright: [0, 100],
        dateOutlineHue: [0, 360], dateOutlineColorSat: [0, 100], dateOutlineColorBright: [0, 100],
        screenTimeSize: [10, 32], screenTimePosition: [0, 100], screenTimeHorizontalPosition: [0, 100],
        screenTimeOpacity: [0, 100], screenTimeHue: [0, 360],
        screenTimeColorSat: [0, 100], screenTimeColorBright: [0, 100],
        stepsSize: [10, 40], stepsPosition: [0, 100], stepsHorizontalPosition: [0, 100],
        stepsOpacity: [0, 100], stepsHue: [0, 360], stepsColorSat: [0, 100], stepsColorBright: [0, 100],
        batterySize: [10, 40], batteryPosition: [0, 100], batteryHorizontalPosition: [0, 100],
        batteryOpacity: [0, 100], batteryHue: [0, 360], batteryColorSat: [0, 100], batteryColorBright: [0, 100],
        dialScale: [50, 150], swipeDistance: [6, 72], dialTextSize: [14, 48], scrollStrength: [0, 2],
        dialRadius: [100, 360], dialEdgeDistance: [0, 160], dialVerticalOffset: [-400, 400],
        dialVisibleItems: [3, 9], dialItemSpacing: [12, 40],
        dialItemRotation: [-45, 45], dialCarouselVerticalSpacing: [-100, 100],
    };
    const NULLABLE = new Set(["dialRadius", "dialEdgeDistance", "dialVerticalOffset", "dialVisibleItems", "dialItemSpacing"]);

    // Paired fields the app keeps ordered (min <= max).
    const MIN_MAX_PAIRS = [
        ["speckleSizeMin", "speckleSizeMax"], ["speckleOpacityMin", "speckleOpacityMax"],
        ["bokehSizeMin", "bokehSizeMax"], ["bokehOpacityMin", "bokehOpacityMax"],
    ];

    // 12-month palette (Jan..Dec) baked from XmbColor.MONTH_COLORS.
    const MONTH_COLORS = [
        [0x1B, 0x2E, 0x55], [0x27, 0x4B, 0x8C], [0x2E, 0x7E, 0x84], [0x3E, 0x9B, 0x5F],
        [0x7B, 0xB2, 0x3C], [0xC2, 0xB5, 0x3A], [0xE0, 0xA2, 0x2B], [0xD9, 0x6E, 0x26],
        [0xBE, 0x43, 0x27], [0x93, 0x32, 0x57], [0x4E, 0x31, 0x87], [0x22, 0x2C, 0x6E],
    ].map(c => c.map(v => v / 255));

    function clampNum(v, lo, hi) {
        v = Math.round(Number(v));
        if (!isFinite(v)) v = lo;
        return Math.min(hi, Math.max(lo, v));
    }

    const toBool = v => (v === true || v === "true");
    // Numerics are deliberately NOT clamped — see the RANGES comment.
    const toNum = (v, dflt) => { const n = Number(v); return Number.isFinite(n) ? n : dflt; };
    // A Google Fonts family name, or null to inherit. Any name is legal; we only guard the shape.
    function fontName(v) {
        if (typeof v !== "string") return null;
        // Family names keep their spaces ("Bebas Neue"); strip only control/invisible characters
        // and whatever could break out of the CSS font-family string.
        const s = v.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g, "")
            .replace(/["'<>;{}\\]/g, "").trim().slice(0, 64);
        return s || null;
    }
    const fontEnum = v => (ENUMS.font.includes(v) ? v : null);   // null = inherit, not SELAWIK

    /** Coerce an arbitrary parsed WidgetStyle into a complete one. */
    function clampWidget(key, raw) {
        const dflt = widgetDefault(key);
        const src = (raw && typeof raw === "object") ? raw : {};
        const out = {};
        for (const k of Object.keys(dflt)) {
            if (k === "fontName") out[k] = fontName(src[k]);
            else if (typeof dflt[k] === "boolean") out[k] = toBool(k in src ? src[k] : dflt[k]);
            else out[k] = toNum(k in src ? src[k] : dflt[k], dflt[k]);
        }
        return out;
    }

    /**
     * Coerce an arbitrary parsed object into a complete appearance: unknown keys are dropped,
     * missing keys default-fill, enums fall back to their first entry, booleans coerce. Numerics
     * are passed through as-is (the app permits typed out-of-range values).
     */
    function clampAppearance(raw) {
        const a = Object.assign({}, DEFAULTS, raw || {});
        const out = {};
        for (const key of Object.keys(DEFAULTS)) {
            const v = a[key];
            if (key in WIDGET_KEYS) {
                out[key] = clampWidget(key, v);
            } else if (FONT_NAME_FIELDS.indexOf(key) >= 0) {
                out[key] = fontName(v);
            } else if (FONT_ENUM_FIELDS.indexOf(key) >= 0) {
                out[key] = fontEnum(v);
            } else if (key in ENUMS) {
                out[key] = ENUMS[key].includes(v) ? v : ENUMS[key][0];
            } else if (key in RANGES) {
                if (NULLABLE.has(key) && (v === null || v === undefined)) out[key] = null;
                else out[key] = toNum(v, DEFAULTS[key]);
            } else if (typeof DEFAULTS[key] === "boolean") {
                out[key] = toBool(v);
            } else {
                out[key] = v;
            }
        }
        // Keep paired ranges ordered (min <= max), matching the app's intent.
        for (const [lo, hi] of MIN_MAX_PAIRS) {
            if (out[lo] > out[hi]) { const t = out[lo]; out[lo] = out[hi]; out[hi] = t; }
        }
        return out;
    }

    /** Build a full, valid Theme from any parsed JSON (default-fills + clamps). */
    function normalizeTheme(obj) {
        if (!obj || (obj.format !== FORMAT && LEGACY_FORMATS.indexOf(obj.format) < 0)) return null;
        return {
            format: FORMAT,
            version: Number(obj.version) || 1,
            name: typeof obj.name === "string" ? obj.name : "Theme",
            author: (obj.author === null || obj.author === undefined) ? null : String(obj.author),
            appearance: clampAppearance(obj.appearance),
        };
    }

    // ---- Base64url (no padding) ----
    function bytesToB64url(bytes) {
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    function b64urlToBytes(str) {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) str += "=";
        const bin = atob(str);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    // ---- gzip / gunzip: native Compression Streams, lazy pako fallback for old browsers ----
    let pakoPromise = null;
    function loadPako() {
        if (!pakoPromise) {
            pakoPromise = new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js";
                s.onload = () => resolve(window.pako);
                s.onerror = () => reject(new Error("pako load failed"));
                document.head.appendChild(s);
            });
        }
        return pakoPromise;
    }
    async function streamThrough(bytes, kind) {
        const cs = kind === "gzip" ? new CompressionStream("gzip") : new DecompressionStream("gzip");
        const stream = new Response(new Blob([bytes]).stream().pipeThrough(cs));
        return new Uint8Array(await stream.arrayBuffer());
    }
    async function gzip(bytes) {
        if (typeof CompressionStream !== "undefined") return streamThrough(bytes, "gzip");
        return (await loadPako()).gzip(bytes);
    }
    async function gunzip(bytes) {
        if (typeof DecompressionStream !== "undefined") return streamThrough(bytes, "gunzip");
        return (await loadPako()).ungzip(bytes);
    }

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    /** Theme -> "DTN1-..." share code. */
    async function encode(theme) {
        const json = JSON.stringify(theme);
        const gz = await gzip(enc.encode(json));
        return PREFIX + bytesToB64url(gz);
    }

    /** "DTN1-..." share code -> normalized Theme, or null on any problem (never throws). */
    async function decode(raw) {
        try {
            if (typeof raw !== "string") return null;
            let body = raw.trim();
            for (const pfx of ["DTN1-", "TDT1-"]) { if (body.startsWith(pfx)) { body = body.slice(pfx.length); break; } }
            body = body.trim();
            const gzipped = b64urlToBytes(body);
            const jsonBytes = await gunzip(gzipped);
            const obj = JSON.parse(dec.decode(jsonBytes));
            return normalizeTheme(obj);
        } catch (_) {
            return null;
        }
    }

    // ---- Colour resolution (XmbColor.kt) ----
    function hsvToRgb(h, s, v) { // h 0..360, s/v 0..1 -> [r,g,b] 0..1
        h = ((h % 360) + 360) % 360;
        const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return [r + m, g + m, b + m];
    }
    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

    function daysInMonth(year, month0) { return new Date(year, month0 + 1, 0).getDate(); }
    function monthBlend(day, dim) {
        const holdUntil = 18;
        if (day <= holdUntil) return 0;
        return Math.min(1, Math.max(0, (day - holdUntil) / (dim - holdUntil)));
    }
    function dateColor(now) {
        const m = now.getMonth();
        const b = monthBlend(now.getDate(), daysInMonth(now.getFullYear(), m));
        return lerpRgb(MONTH_COLORS[m], MONTH_COLORS[(m + 1) % 12], b);
    }
    function smooth(x, a, b) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    function timeBrightness(now) {
        const h = now.getHours() + now.getMinutes() / 60;
        const night = 0.35;
        const day = Math.min(smooth(h, 2, 4), 1 - smooth(h, 17, 21));
        return night + (1 - night) * day;
    }
    const ANCHORS = {
        TOP_LEFT: [0, 0], TOP_RIGHT: [1, 0], CENTER: [0.5, 0.5],
        BOTTOM_LEFT: [0, 1], BOTTOM_RIGHT: [1, 1],
    };

    /** Resolve the two gradient colours, anchors and brightness for `now` (default: live date). */
    function resolveColors(a, now) {
        now = now || new Date();
        let ca, cb;
        if (a.colorFromMonth) {
            const base = dateColor(now);
            ca = base;
            cb = [base[0] * 0.45, base[1] * 0.45, base[2] * 0.45];
        } else {
            ca = hsvToRgb(a.bgColor1Hue, a.bgColor1Sat / 100, a.bgColor1Bright / 100);
            cb = hsvToRgb(a.bgColor2Hue, a.bgColor2Sat / 100, a.bgColor2Bright / 100);
        }
        // The shader ties the derived ribbon glow to colour A's own HSV value/saturation (bfac), so
        // the Brightness slider still bites on greyscale themes. Derive them from the *resolved*
        // colour so colorFromMonth themes get the month's value, not the unused bgColor1* sliders.
        const mx = Math.max(ca[0], ca[1], ca[2]), mn = Math.min(ca[0], ca[1], ca[2]);
        return {
            colorA: ca, colorB: cb,
            posA: ANCHORS[a.bgColor1Position] || [0, 0],
            posB: ANCHORS[a.bgColor2Position] || [1, 1],
            brightness: a.brightnessFromTime ? timeBrightness(now) : 1,
            baseVal: mx,
            baseSat: mx > 1e-4 ? (mx - mn) / mx : 0,
        };
    }

    /**
     * Colour for a home text element / feature layer. `custom` off is WHITE for text elements and
     * for speckles; the ribbon and bokeh layers instead fall back to a tint derived from background
     * colour A (see the renderer's derivedTint) — that fallback lives in the shader, not here.
     */
    function elementRgb(custom, hue, sat, bright) {
        if (!custom) return [1, 1, 1];
        return hsvToRgb(Number(hue) || 0, (Number(sat) || 0) / 100, (Number(bright) || 0) / 100);
    }
    const rgbToCss = rgb => "rgb(" + rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(",") + ")";
    /** CSS colour for a text element, e.g. elementColor(a, "clock") -> "rgb(...)" or white. */
    function elementColor(a, prefix) {
        return rgbToCss(elementRgb(a[prefix + "CustomColor"], a[prefix + "Hue"],
            a[prefix + "ColorSat"], a[prefix + "ColorBright"]));
    }

    /** Dominant hue (0..360) for colour filtering — month colour when colorFromMonth. */
    function dominantHue(a, now) {
        let rgb;
        if (a.colorFromMonth) rgb = dateColor(now || new Date());
        else return ((a.bgColor1Hue % 360) + 360) % 360;
        const [r, g, b] = rgb;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        if (d < 1e-4) return 0;
        let h;
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        return (h + 360) % 360;
    }

    // ---- Name / author sanitization (mirrors the app's section 9 rules) ----
    // Strip control (C0/C1), zero-width, BOM, and bidi override/isolate codepoints.
    const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
    const URL_RE = /https?:\/\/|www\.|\.[a-z]{2,}\//i;
    function sanitizeName(input) {
        if (typeof input !== "string") return { ok: false, value: "", error: "Name required." };
        const s = input.normalize("NFKC").replace(INVISIBLE, "").trim();
        if (!s) return { ok: false, value: "", error: "Name can't be empty." };
        if (s.length > 24) return { ok: false, value: s, error: "Name must be 24 characters or fewer." };
        if (URL_RE.test(s)) return { ok: false, value: s, error: "Name can't contain a URL." };
        if (!/^[\p{L}\p{N} .,!?'"&()\-_+:#]+$/u.test(s)) return { ok: false, value: s, error: "Name has unsupported characters." };
        return { ok: true, value: s };
    }
    function sanitizeAuthor(input) {
        if (!input) return { ok: true, value: "" };
        let s = String(input).normalize("NFKC").replace(INVISIBLE, "").trim().replace(/^@+/, "");
        if (!s) return { ok: true, value: "" };
        if (s.length > 24) return { ok: false, value: s, error: "Author handle is too long." };
        if (!/^[\p{L}\p{N}_]+$/u.test(s)) return { ok: false, value: s, error: "Author handle: letters, numbers and underscore only." };
        return { ok: true, value: s };
    }

    window.ToolDialTheme = {
        FORMAT, PREFIX, DEFAULTS, ENUMS, RANGES, MONTH_COLORS,
        WIDGET_DEFAULTS, WIDGET_RANGES, WIDGET_KEYS, widgetDefault,
        clampAppearance, clampWidget, normalizeTheme, encode, decode,
        resolveColors, dominantHue, hsvToRgb, elementRgb, elementColor, rgbToCss,
        sanitizeName, sanitizeAuthor,
    };
})();
