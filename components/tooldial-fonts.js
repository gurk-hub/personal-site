/*
 * tooldial-fonts.js — resolves a theme's fonts the way the app does (FontCatalog.kt).
 *
 * Every font field is doubled: a legacy AppFont enum and a Google Fonts family NAME. The name
 * wins, then the enum, then the master font — a null per-element font means "inherit the master",
 * NOT "Selawik". Unknown family names are never rejected: the app fetches any Google family by
 * name on apply, so the site loads it too and simply falls back to a system sans if it 404s.
 *
 * Exposed as window.ToolDialFonts:
 *   ToolDialFonts.stack(appearance, "clock")  -> a CSS font-family string (and lazily loads it)
 *   ToolDialFonts.preload(appearance)         -> load every family a theme references
 */
(function () {
    "use strict";

    // Selawik is bundled in the app; on the web we substitute a clean system sans.
    // NOTE: these stacks get inlined into style="..." attributes, so every family name is quoted
    // with SINGLE quotes — a double quote would terminate the attribute and drop the declaration.
    const GENERIC = {
        SELAWIK: "'Segoe UI', 'Selawik', system-ui, -apple-system, sans-serif",
        SANS: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        SERIF: "Georgia, 'Times New Roman', serif",
        MONO: "ui-monospace, 'JetBrains Mono', Consolas, monospace",   // retired from the app's picker, still valid data
        CURSIVE: "'Segoe Script', 'Brush Script MT', cursive",
    };
    const FALLBACK = GENERIC.SANS;

    // Families the app bundles — still fetched from Google Fonts here, but worth knowing about.
    const BUNDLED = ["Inter", "Bebas Neue", "Orbitron", "JetBrains Mono", "Quicksand"];

    const loaded = new Set();

    /** Lazily add a Google Fonts <link> for `family`. Safe to call repeatedly. */
    function load(family) {
        if (!family || loaded.has(family)) return;
        loaded.add(family);
        if (typeof document === "undefined") return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        // Ask for the weights/styles the previews actually use (regular/bold, upright/italic).
        // Google ignores axes a family doesn't have, so this is safe for any name.
        link.href = "https://fonts.googleapis.com/css2?family="
            + encodeURIComponent(family).replace(/%20/g, "+")
            + ":ital,wght@0,400;0,700;1,400;1,700&display=swap";
        // A 404 just means the family stays unresolved and the CSS fallback below takes over.
        link.addEventListener("error", () => console.warn("ToolDialFonts: no Google font named", family));
        document.head.appendChild(link);
    }

    /** CSS font-family for a family name, always with a system fallback behind it. */
    function familyStack(name) {
        if (!name) return null;
        load(name);
        // Single quotes: this lands inside style="..." (theme.js already strips quotes from names).
        return "'" + name + "', " + FALLBACK;
    }

    /**
     * Resolve one element's font stack: name -> legacy enum -> master font.
     * `prefix` is "clock" | "date" | "screenTime" | "steps" | "battery" | "dial", or "" for the master.
     */
    function stack(a, prefix) {
        if (!a) return FALLBACK;
        if (prefix) {
            const named = familyStack(a[prefix + "FontName"]);
            if (named) return named;
            const legacy = a[prefix + "Font"];
            if (legacy && GENERIC[legacy]) return GENERIC[legacy];
        }
        return master(a);
    }

    /** The theme-wide font: fontName -> font enum -> Selawik's substitute. */
    function master(a) {
        const named = familyStack(a && a.fontName);
        if (named) return named;
        return GENERIC[a && a.font] || GENERIC.SELAWIK;
    }

    /** A nested WidgetStyle only has a fontName; null inherits the master font. */
    function widgetStack(a, w) {
        return familyStack(w && w.fontName) || master(a);
    }

    /** Warm every family a theme mentions, so previews don't pop in one element at a time. */
    function preload(a) {
        if (!a) return;
        load(a.fontName);
        ["clock", "date", "screenTime", "steps", "battery", "dial"]
            .forEach(p => load(a[p + "FontName"]));
        Object.keys(window.ToolDialTheme ? window.ToolDialTheme.WIDGET_KEYS : {})
            .forEach(k => { const w = a[k]; if (w) load(w.fontName); });
    }

    window.ToolDialFonts = { stack, master, widgetStack, familyStack, preload, load, GENERIC, BUNDLED };
})();
