/*
 * tooldial-submit.js — account-free submission. The user pastes a DTN1 share code; we decode it
 * (blocking submit if invalid), show a live preview of exactly what they're sharing, sanitize the
 * name/author client-side, and POST to the Google Form via no-cors. A hidden honeypot field traps
 * bots. Submissions are queued for owner review — nothing publishes instantly.
 */
(function () {
    "use strict";

    const CFG = window.TOOLDIAL_CONFIG || {};
    const T = window.ToolDialTheme;

    const form = document.getElementById("td-submit-form");
    const codeInput = document.getElementById("td-code");
    const nameInput = document.getElementById("td-name");
    const authorInput = document.getElementById("td-author");
    const honeypot = document.getElementById("td-hp");
    const previewWrap = document.getElementById("td-preview-wrap");
    const previewNote = document.getElementById("td-preview-note");
    const submitBtn = document.getElementById("td-submit-btn");
    const codeError = document.getElementById("td-code-error");
    const formMsg = document.getElementById("td-form-msg");
    const noticeEl = document.getElementById("td-config-notice");

    let handle = null;
    let decodedTheme = null;
    let decodeSeq = 0;

    // Prefill the code from ?code= or ?d= (deep-link share) so "Share from app" lands ready.
    const params = new URLSearchParams(location.search);
    const prefill = params.get("code") || decodeDParam(params.get("d"));
    if (prefill) codeInput.value = prefill;

    function decodeDParam(d) {
        if (!d) return "";
        try {
            let s = d.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
            return decodeURIComponent(escape(atob(s)));
        } catch (_) { return ""; }
    }

    if (!CFG.FORM_ACTION_URL && noticeEl) {
        noticeEl.style.display = "block";
        noticeEl.textContent = "Heads up: submissions aren't wired to a destination yet, so the Submit button is disabled. You can still paste a code to preview it. (Owner: set FORM_ACTION_URL in tooldial-config.js.)";
    }

    async function refreshPreview() {
        const raw = codeInput.value.trim();
        const seq = ++decodeSeq;
        if (!raw) { setDecoded(null, ""); return; }
        const theme = await T.decode(raw);
        if (seq !== decodeSeq) return; // a newer keystroke superseded this decode
        if (!theme) { setDecoded(null, "Invalid theme code — check you copied the whole DTN1-… string."); return; }
        setDecoded(theme, "");
        // Suggest the theme's own name if the name field is empty.
        if (!nameInput.value && theme.name && theme.name !== "Theme") nameInput.value = theme.name;
        if (!authorInput.value && theme.author) authorInput.value = theme.author;
        validate(); // re-check now that name/author may have been auto-filled
    }

    function setDecoded(theme, error) {
        decodedTheme = theme;
        codeError.textContent = error || "";
        codeError.style.display = error ? "" : "none";
        codeInput.classList.toggle("is-invalid", !!error);

        if (theme) {
            previewNote.style.display = "none";
            // Rebuild the phone mock each time so the clock/dial reflect the latest code.
            previewWrap.innerHTML = "";
            const canvas = document.createElement("canvas");
            canvas.className = "td-canvas td-canvas--big";
            previewWrap.appendChild(canvas);
            previewWrap.appendChild(buildOverlay(theme.appearance));
            const scrim = document.createElement("div"); scrim.className = "td-scrim"; scrim.style.display = "none";
            const dialHost = document.createElement("div");
            const hint = document.createElement("span"); hint.className = "td-tap-hint"; hint.textContent = "Tap to see the dial";
            previewWrap.appendChild(scrim); previewWrap.appendChild(dialHost); previewWrap.appendChild(hint);
            handle = window.ToolDialPreview.create(canvas, theme.appearance, { interactive: true });

            let showingDial = false;
            previewWrap.onclick = () => {
                showingDial = !showingDial;
                scrim.style.display = showingDial ? "" : "none";
                hint.textContent = showingDial ? "Tap to see the home screen" : "Tap to see the dial";
                const ov = previewWrap.querySelector(".td-overlay");
                if (ov) ov.style.opacity = showingDial ? "0.5" : "1";
                if (showingDial) {
                    const rect = previewWrap.getBoundingClientRect();
                    window.ToolDialDial.render(dialHost, theme.appearance, { w: rect.width, h: rect.height });
                } else {
                    dialHost.innerHTML = "";
                }
            };
        } else {
            if (handle) { handle.destroy(); handle = null; }
            previewWrap.innerHTML = "";
            previewWrap.onclick = null;
            previewNote.style.display = "";
        }
        validate();
    }

    function buildOverlay(a) {
        const div = document.createElement("div");
        const now = new Date();
        const hh = a.clock24h ? now.getHours() : (now.getHours() % 12 || 12);
        const clock = `${String(hh).padStart(a.clock24h ? 2 : 1, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        const align = a.clockAlignment === "LEFT" ? "flex-start" : a.clockAlignment === "RIGHT" ? "flex-end" : "center";
        const clockCqw = (a.clockSize / 3.8).toFixed(2);
        const dateCqw = (a.dateSize / 3.8).toFixed(2);
        div.className = "td-overlay";
        div.style.alignItems = align;
        div.innerHTML = `<div class="td-ovstack" style="margin-top:${a.clockVerticalPosition}%;">
            ${a.showClock ? `<div class="td-clock" style="opacity:${a.clockOpacity / 100}; color:${a.clockCustomColor ? `hsl(${a.clockHue} 80% 65%)` : "#fff"}; font-size:${clockCqw}cqw;">${clock}</div>` : ""}
            ${a.showDate ? `<div class="td-date" style="opacity:${a.dateOpacity / 100}; color:${a.dateCustomColor ? `hsl(${a.dateHue} 80% 70%)` : "#fff"}; font-size:${dateCqw}cqw;">${date}</div>` : ""}
        </div>`;
        return div;
    }

    function validate() {
        const nameOk = T.sanitizeName(nameInput.value).ok;
        const authorOk = T.sanitizeAuthor(authorInput.value).ok;
        const canSend = !!CFG.FORM_ACTION_URL;
        submitBtn.disabled = !(decodedTheme && nameOk && authorOk && canSend);
        return decodedTheme && nameOk && authorOk;
    }

    function showFieldErrors() {
        const n = T.sanitizeName(nameInput.value);
        const a = T.sanitizeAuthor(authorInput.value);
        document.getElementById("td-name-error").textContent = n.ok ? "" : n.error;
        document.getElementById("td-author-error").textContent = a.ok ? "" : a.error;
        if (!decodedTheme) { codeError.textContent = "Paste a valid theme code first."; codeError.style.display = ""; }
    }

    async function onSubmit(ev) {
        ev.preventDefault();
        formMsg.textContent = "";
        formMsg.className = "td-form-msg";
        if (honeypot && honeypot.value.trim()) { return; } // bot trap: silently drop
        if (!validate()) { showFieldErrors(); return; }
        if (!CFG.FORM_ACTION_URL) return;

        const name = T.sanitizeName(nameInput.value).value;
        const author = T.sanitizeAuthor(authorInput.value).value;
        const code = codeInput.value.trim();

        const body = new URLSearchParams();
        if (CFG.FORM_ENTRY_NAME) body.set(CFG.FORM_ENTRY_NAME, name);
        if (CFG.FORM_ENTRY_AUTHOR) body.set(CFG.FORM_ENTRY_AUTHOR, author);
        if (CFG.FORM_ENTRY_CODE) body.set(CFG.FORM_ENTRY_CODE, code);
        if (CFG.FORM_ENTRY_HONEYPOT && honeypot) body.set(CFG.FORM_ENTRY_HONEYPOT, "");

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting…";
        try {
            await fetch(CFG.FORM_ACTION_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
            // no-cors => opaque response; a non-throwing fetch means it was queued.
            form.reset();
            setDecoded(null, "");
            formMsg.textContent = "Submitted for review! Themes are checked before they appear in the gallery — thanks for sharing.";
            formMsg.classList.add("is-ok");
        } catch (_) {
            formMsg.textContent = "Couldn't submit right now. Please try again in a moment.";
            formMsg.classList.add("is-error");
        } finally {
            submitBtn.textContent = "Submit for review";
            validate();
        }
    }

    let debounce = null;
    codeInput.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(refreshPreview, 250); });
    nameInput.addEventListener("input", () => { document.getElementById("td-name-error").textContent = ""; validate(); });
    authorInput.addEventListener("input", () => { document.getElementById("td-author-error").textContent = ""; validate(); });
    form.addEventListener("submit", onSubmit);

    if (prefill) refreshPreview();
    validate();
})();
