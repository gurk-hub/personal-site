/*
 * tooldial-theme.js — the Shared Integration Contract (version 1), ported to JS so codes made in
 * the Android app load here byte-for-byte and vice versa.
 *
 *   • Schema defaults + range clamps mirror the app's Theme.kt / ThemeAppearance exactly.
 *   • Share code = "DTN1-" + Base64url( gzip( minified-UTF8-JSON ) )  (ThemeCodec.kt).
 *   • Colour/date logic mirrors XmbColor.kt (HSV gradient, 12-month palette, time brightness).
 *
 * Exposed as window.ToolDialTheme. Decode is fully tolerant: any failure returns null, unknown
 * keys are ignored, missing fields default-fill, every numeric is clamped on load.
 */
(function () {
    "use strict";

    const FORMAT = "detune-theme";
    const LEGACY_FORMATS = ["tooldial-theme"];  // still decode codes from before the rebrand
    const PREFIX = "DTN1-";

    // Valid enum values (from data/Config.kt). Unknown -> first entry (the app's fallback).
    const ENUMS = {
        font: ["SELAWIK", "SANS", "SERIF", "MONO", "CURSIVE"],
        appNameCase: ["NORMAL", "UPPER", "LOWER", "TITLE"],
        bgColor1Position: ["TOP_LEFT", "TOP_RIGHT", "CENTER", "BOTTOM_LEFT", "BOTTOM_RIGHT"],
        bgColor2Position: ["TOP_LEFT", "TOP_RIGHT", "CENTER", "BOTTOM_LEFT", "BOTTOM_RIGHT"],
        ribbonStyle: ["WISP", "WAVE", "RIBBON"],
        clockAlignment: ["LEFT", "CENTER", "RIGHT"],
        dateFormat: ["FULL", "ABBREVIATED", "NUMERIC_DMY", "NUMERIC_MDY", "ISO", "DAY_MONTH"],
        dialPosition: ["RIGHT", "LEFT", "CENTER"],
        dialSize: ["SMALL", "MEDIUM", "LARGE"],
        dialLayout: ["DIAL", "LIST", "WHEEL", "FAN", "CAROUSEL"],
        scrollAnimation: ["NONE", "SMOOTH", "SHARP", "GLIDE"],
    };

    // Default appearance — mirrors ThemeAppearance() defaults in Theme.kt.
    const DEFAULTS = {
        font: "SELAWIK", appNameCase: "NORMAL", showHomeHints: true, selectionGlow: true,
        backgroundDepth: true, fluidTransitions: true,
        animatedBackground: false, useWallpaper: false,
        bgColor1Hue: 210, bgColor1Sat: 85, bgColor1Bright: 70,
        bgColor2Hue: 280, bgColor2Sat: 70, bgColor2Bright: 45,
        bgColor1Position: "TOP_LEFT", bgColor2Position: "BOTTOM_RIGHT",
        colorFromMonth: false, brightnessFromTime: false, glowIntensity: 44,
        ribbonStyle: "RIBBON", ribbonDefinition: 60, ribbonCount: 3, ribbonShine: 60,
        ribbonThickness: 50, ribbonWaveSize: 50, ribbonEdgeGradient: 28,
        effectPosition: 40, effectHeight: 40, ribbonSway: 50,
        strongerFlowOnOpen: true, idleMotion: 20, scrollReaction: 45,
        speckles: true, speckleAmount: 25, speckleSizeMin: 15, speckleSizeMax: 45,
        speckleOpacityMin: 35, speckleOpacityMax: 90,
        clock24h: true, showClock: true, showDate: true, clockAlignment: "CENTER",
        dateFormat: "FULL", clockVerticalPosition: 50, clockSize: 84, clockOpacity: 92,
        clockCustomColor: false, clockHue: 210,
        dateSize: 18, dateOpacity: 62, dateCustomColor: false, dateHue: 210,
        showScreenTime: false, screenTimeSize: 14, screenTimePosition: 95, screenTimeOpacity: 50,
        screenTimeCustomColor: false, screenTimeHue: 210, screenTimeShowActive: false,
        showSteps: false, stepsSize: 16, stepsPosition: 90, stepsOpacity: 70,
        stepsCustomColor: false, stepsHue: 210,
        dialPosition: "RIGHT", dialSize: "MEDIUM", dialLayout: "DIAL", swipeDistance: 18,
        showAppIcons: false, showAppNames: true, dialTextSize: 26, drawerBlur: false,
        scrollAnimation: "SMOOTH", scrollStrength: 1,
        dialRadius: null, dialEdgeDistance: null, dialVerticalOffset: null,
        dialVisibleItems: null, dialItemSpacing: null,
    };

    // [min, max] clamp ranges — mirror AppConfig.withAppearance() in Theme.kt. Nullable fields
    // keep null when absent. glowIntensity / idleMotion / scrollReaction are the strobe ceilings.
    const RANGES = {
        bgColor1Hue: [0, 360], bgColor1Sat: [0, 100], bgColor1Bright: [0, 100],
        bgColor2Hue: [0, 360], bgColor2Sat: [0, 100], bgColor2Bright: [0, 100],
        glowIntensity: [0, 100],
        ribbonDefinition: [0, 100], ribbonCount: [1, 6], ribbonShine: [0, 100],
        ribbonThickness: [0, 100], ribbonWaveSize: [0, 100], ribbonEdgeGradient: [0, 100],
        effectPosition: [0, 100], effectHeight: [10, 100], ribbonSway: [0, 100],
        idleMotion: [0, 100], scrollReaction: [0, 100],
        speckleAmount: [0, 100], speckleSizeMin: [0, 100], speckleSizeMax: [0, 100],
        speckleOpacityMin: [0, 100], speckleOpacityMax: [0, 100],
        clockVerticalPosition: [0, 100], clockSize: [40, 160], clockOpacity: [0, 100], clockHue: [0, 360],
        dateSize: [10, 40], dateOpacity: [0, 100], dateHue: [0, 360],
        screenTimeSize: [10, 32], screenTimePosition: [0, 100], screenTimeOpacity: [0, 100], screenTimeHue: [0, 360],
        stepsSize: [10, 40], stepsPosition: [0, 100], stepsOpacity: [0, 100], stepsHue: [0, 360],
        swipeDistance: [6, 72], dialTextSize: [14, 48], scrollStrength: [0, 2],
        dialRadius: [100, 360], dialEdgeDistance: [0, 160], dialVerticalOffset: [-400, 400],
        dialVisibleItems: [3, 9], dialItemSpacing: [12, 40],
    };
    const NULLABLE = new Set(["dialRadius", "dialEdgeDistance", "dialVerticalOffset", "dialVisibleItems", "dialItemSpacing"]);

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

    /** Coerce an arbitrary parsed object into a complete, clamped appearance object. */
    function clampAppearance(raw) {
        const a = Object.assign({}, DEFAULTS, raw || {});
        const out = {};
        for (const key of Object.keys(DEFAULTS)) {
            let v = a[key];
            if (key in ENUMS) {
                out[key] = ENUMS[key].includes(v) ? v : ENUMS[key][0];
            } else if (key in RANGES) {
                if (NULLABLE.has(key) && (v === null || v === undefined)) {
                    out[key] = null;
                } else {
                    out[key] = clampNum(v, RANGES[key][0], RANGES[key][1]);
                }
            } else if (typeof DEFAULTS[key] === "boolean") {
                out[key] = (v === true || v === "true");
            } else {
                out[key] = v;
            }
        }
        // Keep paired ranges ordered (min <= max), matching the app's intent.
        if (out.speckleSizeMin > out.speckleSizeMax) { const t = out.speckleSizeMin; out.speckleSizeMin = out.speckleSizeMax; out.speckleSizeMax = t; }
        if (out.speckleOpacityMin > out.speckleOpacityMax) { const t = out.speckleOpacityMin; out.speckleOpacityMin = out.speckleOpacityMax; out.speckleOpacityMax = t; }
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
            if (body.startsWith(PREFIX)) body = body.slice(PREFIX.length);
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
        return {
            colorA: ca, colorB: cb,
            posA: ANCHORS[a.bgColor1Position] || [0, 0],
            posB: ANCHORS[a.bgColor2Position] || [1, 1],
            brightness: a.brightnessFromTime ? timeBrightness(now) : 1,
        };
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
    const INVISIBLE = /[ --​-‏‪-‮⁦-⁩﻿]/g;
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
        clampAppearance, normalizeTheme, encode, decode,
        resolveColors, dominantHue, hsvToRgb,
        sanitizeName, sanitizeAuthor,
    };
})();
