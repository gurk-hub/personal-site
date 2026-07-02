/*
 * tooldial-gallery.js — the community theme Gallery. Fetches the manifest (Contract C), decodes
 * each DTN1 code, renders a live animated preview per card, and offers copy-code, QR, heart/save,
 * deep-link, plus client-side sort + colour filter. Degrades gracefully: when MANIFEST_URL is
 * blank it shows a "coming soon" notice alongside a few built-in EXAMPLE themes so the renderer is
 * still demonstrable. CORS-blocked JSON falls back to CSV when MANIFEST_FORMAT === "csv".
 */
(function () {
    "use strict";

    const CFG = window.TOOLDIAL_CONFIG || {};
    const T = window.ToolDialTheme;
    const grid = document.getElementById("td-grid");
    const statusEl = document.getElementById("td-status");
    const sortSel = document.getElementById("td-sort");
    const hueBar = document.getElementById("td-hues");

    // Built-in example themes shown when the manifest isn't configured yet (dev/preview).
    const EXAMPLES = [
        { id: "ex-aurora", name: "Aurora", author: "gurkis", appearance: { animatedBackground: true, ribbonStyle: "RIBBON", ribbonCount: 4, bgColor1Hue: 200, bgColor1Sat: 90, bgColor1Bright: 60, bgColor2Hue: 280, bgColor2Sat: 80, bgColor2Bright: 35, glowIntensity: 55, idleMotion: 28, effectHeight: 55, ribbonShine: 75 } },
        { id: "ex-ember", name: "Ember Wave", author: null, appearance: { animatedBackground: true, ribbonStyle: "WAVE", ribbonCount: 5, bgColor1Hue: 18, bgColor1Sat: 90, bgColor1Bright: 55, bgColor2Hue: 330, bgColor2Sat: 70, bgColor2Bright: 30, glowIntensity: 60, idleMotion: 35, ribbonDefinition: 75, speckleAmount: 40 } },
        { id: "ex-mint", name: "Mint Wisp", author: "demo", appearance: { animatedBackground: true, ribbonStyle: "WISP", ribbonCount: 3, bgColor1Hue: 150, bgColor1Sat: 70, bgColor1Bright: 65, bgColor2Hue: 190, bgColor2Sat: 60, bgColor2Bright: 35, glowIntensity: 40, idleMotion: 18, effectPosition: 55 } },
        { id: "ex-seasonal", name: "Seasonal", author: "gurkis", appearance: { animatedBackground: true, ribbonStyle: "RIBBON", ribbonCount: 4, colorFromMonth: true, brightnessFromTime: true, glowIntensity: 50, idleMotion: 22 } },
        { id: "ex-noir", name: "Midnight", author: null, appearance: { animatedBackground: true, ribbonStyle: "RIBBON", ribbonCount: 2, bgColor1Hue: 230, bgColor1Sat: 60, bgColor1Bright: 22, bgColor2Hue: 260, bgColor2Sat: 50, bgColor2Bright: 12, glowIntensity: 38, idleMotion: 14, ribbonShine: 85, speckleAmount: 55 } },
        { id: "ex-solar", name: "Solar Flare", author: "demo", appearance: { animatedBackground: true, ribbonStyle: "WAVE", ribbonCount: 6, bgColor1Hue: 45, bgColor1Sat: 95, bgColor1Bright: 70, bgColor2Hue: 12, bgColor2Sat: 85, bgColor2Bright: 40, glowIntensity: 65, idleMotion: 40, ribbonWaveSize: 65 } },
    ];

    const HUES = [
        { key: "red", label: "Red", deg: 0 }, { key: "orange", label: "Orange", deg: 35 },
        { key: "yellow", label: "Yellow", deg: 55 }, { key: "green", label: "Green", deg: 130 },
        { key: "teal", label: "Teal", deg: 175 }, { key: "blue", label: "Blue", deg: 215 },
        { key: "purple", label: "Purple", deg: 275 }, { key: "pink", label: "Pink", deg: 320 },
    ];

    const STYLES = [
        { key: "WISP", label: "Wisp" },
        { key: "WAVE", label: "Wave" },
        { key: "RIBBON", label: "Ribbon" },
    ];

    let entries = [];      // { id, name, author, code?, appearance, theme, saves, createdAt, hue }
    let activeHue = "all";
    let activeStyle = "all";
    const handles = new Map(); // id -> renderer handle

    function setStatus(msg, kind) {
        statusEl.textContent = msg || "";
        statusEl.className = "td-status" + (kind ? " td-status--" + kind : "");
        statusEl.style.display = msg ? "" : "none";
    }

    function hueDelta(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

    // ---- Manifest loading ----
    // Returns an array of raw rows, or null if the feed couldn't be loaded at all.
    async function loadManifest() {
        if (!CFG.MANIFEST_URL) return null;
        try {
            const res = await fetch(CFG.MANIFEST_URL, { cache: "no-store" });
            const text = await res.text();
            return CFG.MANIFEST_FORMAT === "csv" ? parseCSV(text) : (JSON.parse(text).themes || []);
        } catch (err) {
            console.warn("Manifest load failed:", err);
            return null;
        }
    }

    function parseCSV(text) {
        const lines = text.replace(/\r/g, "").split("\n").filter(l => l.length);
        if (!lines.length) return [];
        const header = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        return lines.slice(1).map(line => {
            const cells = splitCSVLine(line);
            const row = {};
            header.forEach((h, i) => { row[h] = cells[i]; });
            return { id: row.id, name: row.name, author: row.author || null, code: row.code, createdAt: row.createdat || row.createdAt, saves: Number(row.saves) || 0 };
        });
    }
    function splitCSVLine(line) {
        const out = []; let cur = "", q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (q) {
                if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                else if (ch === '"') q = false;
                else cur += ch;
            } else if (ch === '"') q = true;
            else if (ch === ",") { out.push(cur); cur = ""; }
            else cur += ch;
        }
        out.push(cur);
        return out;
    }

    // ---- Build entry list (decode codes; example themes carry appearance directly) ----
    async function buildEntries(rows) {
        const out = [];
        for (const r of rows) {
            let theme = null;
            if (r.appearance) {
                theme = T.normalizeTheme({ format: T.FORMAT, version: 1, name: r.name, author: r.author, appearance: r.appearance });
            } else if (r.code) {
                theme = await T.decode(r.code);
            }
            if (!theme) continue; // skip undecodable entries rather than failing the whole list
            out.push({
                id: r.id || ("t-" + out.length),
                name: theme.name || r.name || "Theme",
                author: theme.author || r.author || null,
                code: r.code || null,
                appearance: theme.appearance,
                saves: Number(r.saves != null ? r.saves : (r.likes || 0)) || 0,
                createdAt: r.createdAt || null,
                hue: T.dominantHue(theme.appearance),
            });
        }
        return out;
    }

    // ---- Rendering ----
    function sortEntries(list) {
        const mode = sortSel ? sortSel.value : "saved";
        const arr = list.slice();
        if (mode === "newest") arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        else if (mode === "oldest") arr.sort((a, b) => (a.createdAt || "￿").localeCompare(b.createdAt || "￿"));
        else arr.sort((a, b) => b.saves - a.saves); // most saved (aggregated count from the manifest)
        return arr;
    }

    function visibleEntries() {
        let list = entries;
        if (activeHue !== "all") {
            const target = HUES.find(h => h.key === activeHue).deg;
            list = list.filter(e => hueDelta(e.hue, target) <= 30);
        }
        if (activeStyle !== "all") {
            list = list.filter(e => e.appearance && e.appearance.ribbonStyle === activeStyle);
        }
        return sortEntries(list);
    }

    function render() {
        handles.forEach(h => h.destroy());
        handles.clear();
        grid.innerHTML = "";
        const list = visibleEntries();
        if (!list.length) {
            grid.innerHTML = `<p class="td-empty">No themes match this filter.</p>`;
            return;
        }
        for (const e of list) grid.appendChild(makeCard(e));
    }

    function overlayHTML(a) {
        const now = new Date();
        const hh = a.clock24h ? now.getHours() : (now.getHours() % 12 || 12);
        const clock = `${String(hh).padStart(a.clock24h ? 2 : 1, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        const align = a.clockAlignment === "LEFT" ? "flex-start" : a.clockAlignment === "RIGHT" ? "flex-end" : "center";
        const top = a.clockVerticalPosition;
        const clockColor = a.clockCustomColor ? `hsl(${a.clockHue} 80% 65%)` : "#fff";
        const dateColor = a.dateCustomColor ? `hsl(${a.dateHue} 80% 70%)` : "#fff";
        // Size in cqw (% of preview width) from the theme's clockSize/dateSize, against a ~380dp
        // reference phone, so the clock looks identical in a small card and the big modal.
        const clockCqw = (a.clockSize / 3.8).toFixed(2);
        const dateCqw = (a.dateSize / 3.8).toFixed(2);
        let html = `<div class="td-overlay" style="align-items:${align}; justify-content:flex-start; top:0;">`;
        html += `<div class="td-ovstack" style="margin-top:${top}%;">`;
        if (a.showClock) html += `<div class="td-clock" style="opacity:${a.clockOpacity / 100}; color:${clockColor}; font-size:${clockCqw}cqw;">${clock}</div>`;
        if (a.showDate) html += `<div class="td-date" style="opacity:${a.dateOpacity / 100}; color:${dateColor}; font-size:${dateCqw}cqw;">${date}</div>`;
        html += `</div></div>`;
        return html;
    }

    function makeCard(e) {
        const card = document.createElement("div");
        card.className = "td-card";
        card.innerHTML = `
            <div class="td-preview" data-id="${e.id}">
                <canvas class="td-canvas"></canvas>
                ${overlayHTML(e.appearance)}
                <div class="td-scrim" style="display:none;"></div>
                <div class="td-dial-host"></div>
                <span class="td-tap-hint">Tap to see the dial</span>
                <button class="td-expand" title="Open full preview"><span>⤢</span> Expand</button>
            </div>
            <div class="td-card-body">
                <div class="td-card-head">
                    <div>
                        <h3 class="td-card-title">${escapeHtml(e.name)}</h3>
                        ${e.author ? `<p class="td-card-author">by ${escapeHtml(e.author)}</p>` : ""}
                    </div>
                    <span class="td-saves" title="${e.saves} ${e.saves === 1 ? "save" : "saves"} (in the app)">♥ ${e.saves}</span>
                </div>
            </div>`;

        const preview = card.querySelector(".td-preview");
        const canvas = card.querySelector(".td-canvas");
        const scrim = card.querySelector(".td-scrim");
        const dialHost = card.querySelector(".td-dial-host");
        const hint = card.querySelector(".td-tap-hint");
        const overlay = card.querySelector(".td-overlay");
        handles.set(e.id, window.ToolDialPreview.create(canvas, e.appearance, { interactive: false }));

        // Tap the preview itself -> toggle the dial on/off (inline on the card).
        let dialOn = false;
        function toggleDial(force) {
            dialOn = force != null ? force : !dialOn;
            scrim.style.display = dialOn ? "" : "none";
            if (overlay) overlay.style.opacity = dialOn ? "0.5" : "1";
            hint.textContent = dialOn ? "Tap to hide the dial" : "Tap to see the dial";
            if (dialOn) {
                const rect = preview.getBoundingClientRect();
                window.ToolDialDial.render(dialHost, e.appearance, { w: rect.width, h: rect.height });
            } else {
                dialHost.innerHTML = "";
            }
        }
        preview.addEventListener("click", () => toggleDial());

        // Press the bottom "Expand" strip -> open the full-screen modal (don't toggle the dial).
        card.querySelector(".td-expand").addEventListener("click", ev => { ev.stopPropagation(); openModal(e); });
        return card;
    }

    function reportTheme(e) {
        if (!CFG.REPORT_FORM_ACTION_URL || !CFG.REPORT_ENTRY_THEMEID) return;
        const reason = window.prompt(`Report "${e.name}" to the moderators?\n\nOptionally tell us why (e.g. offensive name, spam):`, "");
        if (reason === null) return; // cancelled
        const body = new URLSearchParams();
        body.set(CFG.REPORT_ENTRY_THEMEID, e.id);
        if (CFG.REPORT_ENTRY_REASON) body.set(CFG.REPORT_ENTRY_REASON, reason || "(no reason given)");
        fetch(CFG.REPORT_FORM_ACTION_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }).catch(() => {});
        window.alert("Reported — thanks for flagging it.");
    }

    async function copyCode(code, btn) {
        try { await navigator.clipboard.writeText(code); }
        catch (_) { const ta = document.createElement("textarea"); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
        const old = btn.textContent; btn.textContent = "Copied!"; btn.classList.add("is-ok");
        setTimeout(() => { btn.textContent = old; btn.classList.remove("is-ok"); }, 1400);
    }

    function b64urlOfCode(code) {
        return btoa(unescape(encodeURIComponent(code))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    // ---- Larger phone-shaped modal: home view + dial view ----
    let modalHandle = null;
    function openModal(e) {
        const body = document.getElementById("td-modal-body");
        body.innerHTML = `
            <div class="td-modal-phone">
                <canvas class="td-canvas td-canvas--big"></canvas>
                ${overlayHTML(e.appearance)}
                <div class="td-scrim" style="display:none;"></div>
                <div class="td-dial-host"></div>
                <div class="td-view-toggle">
                    <button data-view="home" class="is-active">Home</button>
                    <button data-view="dial">Dial</button>
                </div>
            </div>
            <div class="td-modal-meta">
                <div>
                    <h3 class="td-modal-title">${escapeHtml(e.name)}</h3>
                    ${e.author ? `<p class="td-card-author">by ${escapeHtml(e.author)}</p>` : ""}
                </div>
                <div class="td-modal-actions">
                    ${e.code && CFG.APP_DEEPLINK_SCHEME ? `<a class="td-btn td-open" href="${CFG.APP_DEEPLINK_SCHEME}://theme?d=${encodeURIComponent(b64urlOfCode(e.code))}">Open in app</a>` : ""}
                    ${e.code ? `<button class="td-btn td-copy">Copy code</button>` : ""}
                    ${e.code && CFG.REPORT_FORM_ACTION_URL ? `<button class="td-btn td-btn-ghost td-report">Report</button>` : ""}
                </div>
            </div>`;
        openModalShell();

        const phone = body.querySelector(".td-modal-phone");
        const canvas = body.querySelector(".td-canvas--big");
        const scrim = body.querySelector(".td-scrim");
        const dialHost = body.querySelector(".td-dial-host");
        const clockOverlay = body.querySelector(".td-overlay");
        if (modalHandle) modalHandle.destroy();
        modalHandle = window.ToolDialPreview.create(canvas, e.appearance, { interactive: true });

        let view = "home";
        function applyView() {
            const dial = view === "dial";
            scrim.style.display = dial ? "" : "none";
            if (clockOverlay) clockOverlay.style.opacity = dial ? "0.5" : "1";
            if (dial) {
                const rect = phone.getBoundingClientRect();
                window.ToolDialDial.render(dialHost, e.appearance, { w: rect.width, h: rect.height });
            } else {
                dialHost.innerHTML = "";
            }
            body.querySelectorAll(".td-view-toggle button").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));
        }
        body.querySelectorAll(".td-view-toggle button").forEach(b => b.addEventListener("click", () => { view = b.dataset.view; applyView(); }));
        // render the dial once layout has settled (phone height is aspect-driven)
        requestAnimationFrame(() => requestAnimationFrame(applyView));

        const cp = body.querySelector(".td-copy"); if (cp) cp.addEventListener("click", () => copyCode(e.code, cp));
        const rp = body.querySelector(".td-report"); if (rp) rp.addEventListener("click", () => reportTheme(e));
    }

    function openModalShell() { document.getElementById("td-modal").classList.add("is-open"); }
    function closeModal() {
        document.getElementById("td-modal").classList.remove("is-open");
        if (modalHandle) { modalHandle.destroy(); modalHandle = null; }
    }

    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

    // ---- Controls ----
    function buildHueBar() {
        if (!hueBar) return;
        const mk = (key, label, css) => `<button class="td-swatch ${key === "all" ? "active" : ""}" data-hue="${key}" title="${label}" style="${css}"></button>`;
        let html = mk("all", "All", "background:conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red);background-origin:border-box;background-repeat:no-repeat;background-size:100% 100%");
        HUES.forEach(h => { html += mk(h.key, h.label, `background:hsl(${h.deg} 80% 55%)`); });
        hueBar.innerHTML = html;
        hueBar.addEventListener("click", ev => {
            const b = ev.target.closest(".td-swatch"); if (!b) return;
            hueBar.querySelectorAll(".td-swatch").forEach(x => x.classList.remove("active"));
            b.classList.add("active");
            activeHue = b.dataset.hue;
            render();
        });
    }

    function buildStyleBar() {
        const bar = document.getElementById("td-styles");
        if (!bar) return;
        const mk = (key, label) => `<button class="td-style-chip ${key === "all" ? "active" : ""}" data-style="${key}">${label}</button>`;
        bar.innerHTML = mk("all", "All") + STYLES.map(s => mk(s.key, s.label)).join("");
        bar.addEventListener("click", ev => {
            const b = ev.target.closest(".td-style-chip"); if (!b) return;
            bar.querySelectorAll(".td-style-chip").forEach(x => x.classList.remove("active"));
            b.classList.add("active");
            activeStyle = b.dataset.style;
            render();
        });
    }

    // ---- Init ----
    async function init() {
        buildHueBar();
        buildStyleBar();
        if (sortSel) sortSel.addEventListener("change", render);
        const closeBtn = document.getElementById("td-modal-close");
        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        document.getElementById("td-modal").addEventListener("click", ev => { if (ev.target.id === "td-modal") closeModal(); });
        document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeModal(); });

        setStatus("Loading themes…");
        const rows = await loadManifest();
        entries = rows ? await buildEntries(rows) : [];
        if (entries.length) {
            setStatus("");
        } else if (rows === null && CFG.MANIFEST_URL) {
            // Configured but unreachable (CORS/network) — show examples with an error note.
            setStatus("Couldn't reach the gallery right now — showing example themes instead.", "error");
            entries = await buildEntries(EXAMPLES);
        } else {
            // Reachable but empty (or not configured) — show examples so the gallery isn't bare.
            setStatus(CFG.MANIFEST_URL
                ? "No community themes have been approved yet — here are a few examples. Made one in the app? Be the first to Submit it!"
                : "The community gallery isn't live yet — here are a few example themes. Made one in the app? You can already Submit it.", "info");
            entries = await buildEntries(EXAMPLES);
        }
        render();
    }

    init();
})();
