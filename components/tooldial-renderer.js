/*
 * tooldial-renderer.js — a WebGL port of the app's XMB background (XmbBackground.kt's AGSL shader),
 * so a theme looks "clearly the same" on the web as on the phone. Exact pixel parity isn't the bar.
 *
 * Performance: ONE shared WebGL context renders into a single offscreen canvas, then blits the
 * result into each preview's own 2D <canvas>. Only on-screen previews draw (IntersectionObserver),
 * the loop is frame-capped, and it fully pauses when the tab is hidden. This scales to a whole
 * gallery of cards without hitting the browser's per-page WebGL-context limit.
 *
 * Exposed as window.ToolDialPreview:
 *   const handle = ToolDialPreview.create(canvasEl, appearance, { interactive: true });
 *   handle.update(appearance);  handle.destroy();
 */
(function () {
    "use strict";

    const T = window.ToolDialTheme;

    const VERT = "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }";

    const FRAG = `precision highp float;
uniform vec2  resolution;
uniform float phase;
uniform float colorPhase;
uniform float intensity;
uniform float sharpness;
uniform float ribbonCount;
uniform float focusY;
uniform float focusH;
uniform float scaleX;
uniform float girth;
uniform float wispStyle;
uniform float innerSpan;
uniform float roam;
uniform float shine;
uniform float starsOn;
uniform float starThreshold;
uniform float starMinSize;
uniform float starMaxSize;
uniform float starMinOp;
uniform float starMaxOp;
uniform float effectOn;         // 0 = animatedBackground off: no shader at all (NOT a bare gradient)
uniform float featureOpacity;   // ribbons + speckles + bokeh together
uniform vec3  baseColor;
uniform vec3  colorB;
uniform vec2  posA;
uniform vec2  posB;
uniform float brightness;
uniform float backgroundDepthOn; // subtle dark radial when the animated bg is off
// bokeh
uniform float bokehOn;
uniform float bokehThreshold;
uniform float bokehMinSize;
uniform float bokehMaxSize;
uniform float bokehMinOp;
uniform float bokehMaxOp;
// per-layer colours; "off" is NOT white for ribbons/bokeh (they take colour A lifted to white)
uniform float ribbonColorOn;  uniform vec3 ribbonColorRGB;
uniform float speckleColorOn; uniform vec3 speckleColorRGB;
uniform float bokehColorOn;   uniform vec3 bokehColorRGB;
uniform float baseVal;        // colour A's HSV value / saturation, for bfac
uniform float baseSat;
// translucency: backgroundOpacity < 100 || useWallpaper puts the shader on the over-wallpaper path
uniform float overWallpaper;
uniform float bgTintOpacity;
uniform vec3  placeholder;    // the web has no wallpaper — composite over this instead

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float silkH(vec2 q, float t){
    float h = sin(q.x + q.y * 0.7 + t);
    h += 0.55 * sin(q.x * 1.9 - q.y * 1.3 + t * 0.8);
    h += 0.28 * sin(q.x * 3.3 + q.y * 0.6 - t * 0.6);
    return h;
}

void main(){
    // y flipped so uv.y = 0 is the top, matching the app's AGSL coordinate space.
    vec2 uv = vec2(gl_FragCoord.x / resolution.x, 1.0 - gl_FragCoord.y / resolution.y);
    float p = phase;

    // animatedBackground off => the app paints NO shader: black, a subtle dark radial if
    // backgroundDepth, or the wallpaper. Falling back to a colour A->B gradient here is wrong
    // (it was a real bug in the app's own theme cards).
    if (effectOn < 0.5) {
        vec3 plain = vec3(0.0);
        if (overWallpaper > 0.5) {
            plain = placeholder;                      // wallpaper stand-in on the web
        } else if (backgroundDepthOn > 0.5) {
            vec2 dd = uv - vec2(0.5, 0.42);
            plain = vec3(0.07, 0.07, 0.09) * exp(-dot(dd, dd) * 2.2);
        }
        gl_FragColor = vec4(plain * brightness, 1.0);
        return;
    }

    float s = 0.5 + 0.5 * sin(colorPhase);
    float dA = distance(uv, posA);
    float dB = distance(uv, posB);
    float tb = dA / (dA + dB + 0.0001);
    vec3 col = mix(baseColor, colorB, smoothstep(0.0, 1.0, tb));
    col *= 0.85 + 0.15 * s;
    vec2 d = uv - vec2(0.5, focusY);
    col += mix(baseColor, vec3(1.0), 0.4) * exp(-dot(d, d) * 3.0) * 0.10;

    float hh = max(focusH, 0.04);
    float dy = (uv.y - focusY) / hh;
    float focus = exp(-dy * dy * 2.0);

    float core = mix(0.055, 0.014, sharpness) * girth;
    float ampV = hh * mix(0.05, 0.60, roam);
    float spread = focusH * mix(0.08, 0.85, roam);
    float xx = uv.x - 0.5;
    float wisps = 0.0;
    for (int i = 0; i < 6; i++) {
        if (float(i) >= ribbonCount) break;
        float fi = float(i);
        float t = (ribbonCount <= 1.0) ? 0.5 : fi / (ribbonCount - 1.0);
        float slope = sin(fi * 1.7 + 0.6) * 0.22;
        float freq = (1.1 + fi * 0.6) * scaleX;
        float spd = 0.4 + fi * 0.18;
        float w1 = sin(uv.x * freq + p * spd + fi) * ampV;
        float w2 = sin(uv.x * freq * 2.1 - p * 0.3) * ampV * 0.4;
        float w3 = sin(uv.x * freq * 0.5 + p * 0.2 + fi * 2.0) * ampV * 0.6;
        float cen = focusY + (t - 0.5) * spread + slope * xx + w1 + w2 + w3;
        float th = core * 4.0 * (0.6 + 0.4 * sin(uv.x * 2.5 * scaleX + fi * 1.7 + p * 0.2));
        th = max(th, core);
        float below = uv.y - cen;
        float td = below / th;

        float filled = exp(-td * td * 2.2);

        float env = exp(-td * td * 1.7);
        float threadFreq = 1.3 + (1.0 - innerSpan) * 1.6;
        float r = sin((td * threadFreq + uv.x * 0.8 + fi * 1.3 + p * 0.12) * 3.14159265);
        float threads = pow(1.0 - abs(r), mix(5.0, 26.0, sharpness));
        float wave = env * (0.14 + threads);

        float ribbon = 0.0;
        if (wispStyle > 1.5) {
            float rcen = focusY + (t - 0.5) * focusH * 0.80 + slope * xx + w1 + w2 + w3;
            float rbHalf = (focusH / max(ribbonCount, 1.0)) * 0.55 * girth;
            rbHalf *= 0.7 + 0.3 * sin(uv.x * 2.0 * scaleX + fi * 1.7 + p * 0.2);
            rbHalf = max(rbHalf, 0.02);
            float vv = (uv.y - rcen) / rbHalf;
            float av = abs(vv);
            float mask = 1.0 - smoothstep(0.95, 1.0, av);
            float foldY = mix(2.0, 5.5, sharpness);
            vec2 q = vec2(uv.x * 2.2 * scaleX + p * 0.3 + fi * 3.0, vv * foldY);
            float e = 0.02;
            float h0 = silkH(q, p);
            float hx = silkH(q + vec2(e, 0.0), p);
            float hy = silkH(q + vec2(0.0, e), p);
            vec3 nrm = normalize(vec3((h0 - hx) / e, (h0 - hy) / e, 1.0));
            vec3 L = normalize(vec3(0.22, -0.5, 0.84));
            float diff = max(dot(nrm, L), 0.0);
            vec3 R = reflect(-L, nrm);
            float spec = pow(max(R.z, 0.0), mix(14.0, 48.0, sharpness));
            float surface = 0.16 + (0.5 + 0.45 * sharpness) * diff + spec * shine * 2.2;
            float innerFall = 1.0 - smoothstep(0.0, 1.0, av);
            float innerGrad = mix(1.0, 0.25 + 0.75 * innerFall, innerSpan);
            float rim = smoothstep(0.90, 0.95, av) * (1.0 - smoothstep(0.95, 1.0, av));
            ribbon = mask * surface * innerGrad + rim * 0.6;
        }

        float line;
        if (wispStyle < 0.5) line = filled;
        else if (wispStyle < 1.5) line = wave;
        else line = ribbon;
        wisps += line * (1.0 - fi * 0.08);
    }
    wisps = min(wisps, 1.8);
    wisps *= focus;

    vec2 sp = uv * vec2(resolution.x / resolution.y, 1.0) * 90.0;
    vec2 cell = floor(sp);
    float h = hash(cell);
    float h2 = hash(cell + 7.3);
    float h3 = hash(cell + 3.1);
    vec2 f = fract(sp) - 0.5;
    float sz = mix(starMinSize, starMaxSize, h2);
    float star = step(starThreshold, h) * (1.0 - smoothstep(0.0, sz, length(f)));
    float twinkle = 0.6 + 0.4 * sin(colorPhase * 3.0 + h * 31.0);
    float starOp = mix(0.35, 1.0, focus);
    float baseOp = mix(starMinOp, starMaxOp, h3);
    float starLight = star * twinkle * baseOp * starOp * starsOn;

    // ---- bokeh: out-of-focus discs, soft body + brighter aperture rim, additive overlap ----
    // Coarse grid (~6 cells tall) with a 3x3 neighbourhood per pixel, so a disc can spill across
    // cell borders instead of being clipped into a square.
    vec3 derivedTint = mix(baseColor, vec3(1.0), 0.6);   // colour A, lifted 60% to white
    vec3 bokehBase = (bokehColorOn > 0.5) ? bokehColorRGB : derivedTint;
    vec3 bokehLight = vec3(0.0);
    if (bokehOn > 0.5 && featureOpacity > 0.001) {
        vec2 bp = uv * vec2(resolution.x / resolution.y, 1.0) * 6.0;
        vec2 bcell = floor(bp);
        vec2 bfr = fract(bp);
        for (int oy = -1; oy <= 1; oy++) {
            for (int ox = -1; ox <= 1; ox++) {
                vec2 nb = bcell + vec2(float(ox), float(oy));
                if (hash(nb + 13.7) < bokehThreshold) continue;   // no disc in this cell
                float hs = hash(nb + 21.3);   // size + blur
                float ho = hash(nb + 5.9);    // brightness + tint
                float hx = hash(nb + 31.1);
                float hy = hash(nb + 47.5);
                vec2 c = vec2(float(ox), float(oy)) + vec2(0.15 + 0.7 * hx, 0.15 + 0.7 * hy);
                c += vec2(sin(p * 0.16 + hx * 40.0), cos(p * 0.13 + hy * 33.0)) * 0.2;
                float rad = mix(bokehMinSize, bokehMaxSize, hs);
                float dist = length(bfr - c) / max(rad, 0.001);
                if (dist > 1.25) continue;
                float soft = mix(0.25, 0.9, hs);                   // bigger disc = blurrier
                float body = 1.0 - smoothstep(1.0 - soft, 1.0, dist);
                float ring = (1.0 - smoothstep(0.0, 0.18, abs(dist - 0.82))) * body;
                float whiten = (bokehColorOn > 0.5) ? (0.05 + 0.35 * ho) : (0.25 + 0.5 * ho);
                vec3 tint = mix(bokehBase, vec3(1.0), whiten);
                bokehLight += tint * (body * 0.55 + ring * 0.6) * mix(bokehMinOp, bokehMaxOp, ho);
            }
        }
    }

    // ---- final mix ----
    vec3 ribbonGlow = (ribbonColorOn > 0.5) ? ribbonColorRGB : derivedTint;
    vec3 speckleRGB = (speckleColorOn > 0.5) ? speckleColorRGB : vec3(1.0);  // speckles alone default to white

    // bfac ties the derived glow to colour A's brightness so the Brightness slider still bites on
    // greyscale themes. It is deliberately NOT applied on the paint path below.
    float bfac = mix(0.15 + 0.85 * baseVal, 1.0, baseSat);

    vec3 light;
    float ribbonCov = 0.0;
    if (ribbonColorOn > 0.5) {
        // Ribbons with a colour of their own PAINT it over the background: added light can only
        // brighten, so a dark colour would merely add less of itself and its Brightness would act
        // like an opacity slider. Painting lets dark read as dark; a smaller additive bloom rides
        // along so they still glow instead of going flat.
        ribbonCov = clamp(wisps * intensity * 2.6, 0.0, 1.0) * featureOpacity;
        col = mix(col, ribbonColorRGB, ribbonCov);
        light = (ribbonColorRGB * wisps * intensity * 0.4
                 + speckleRGB * starLight + bokehLight) * featureOpacity;
    } else {
        // Classic path, deliberately unchanged — touching it would alter every existing theme.
        light = ((ribbonGlow * wisps * intensity * 1.4) * bfac
                 + speckleRGB * starLight + bokehLight) * featureOpacity;
    }

    if (overWallpaper > 0.5) {
        // Translucent path: the gradient becomes a tint over the wallpaper rather than an opaque
        // fill. A painted ribbon carries its own coverage on top, so a translucent background
        // doesn't thin it the way it thins the gradient wash.
        vec3 ov = light * brightness;
        vec3 tint = col * brightness;
        float tintOp = clamp(bgTintOpacity + ribbonCov * (1.0 - bgTintOpacity), 0.0, 1.0);
        vec3 outc = tint * tintOp + ov;                       // premultiplied by tintOp
        float aa = clamp(tintOp + max(ov.r, max(ov.g, ov.b)), 0.0, 1.0);
        // No wallpaper on the web: composite the premultiplied result over a neutral placeholder,
        // otherwise a dimmed background would look identical to a full one.
        gl_FragColor = vec4(outc + placeholder * (1.0 - aa), 1.0);
        return;
    }

    col = max(col + light, vec3(0.0)) * brightness;
    gl_FragColor = vec4(col, 1.0);
}`;

    // ---- Shared GL context (lazy) ----
    let gl = null, glCanvas = null, program = null, uniforms = {}, glFailed = false;

    function initGL() {
        if (gl || glFailed) return gl;
        glCanvas = document.createElement("canvas");
        glCanvas.width = 64; glCanvas.height = 64;
        gl = glCanvas.getContext("webgl", { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true })
            || glCanvas.getContext("experimental-webgl");
        if (!gl) { glFailed = true; return null; }

        const vs = compile(gl.VERTEX_SHADER, VERT);
        const fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) { glFailed = true; gl = null; return null; }
        program = gl.createProgram();
        gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn("ToolDialPreview: program link failed", gl.getProgramInfoLog(program));
            glFailed = true; gl = null; return null;
        }
        gl.useProgram(program);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, "a");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        [
            "resolution", "phase", "colorPhase", "intensity", "sharpness", "ribbonCount",
            "focusY", "focusH", "scaleX", "girth", "wispStyle", "innerSpan", "roam", "shine",
            "starsOn", "starThreshold", "starMinSize", "starMaxSize", "starMinOp", "starMaxOp",
            "effectOn", "featureOpacity", "baseColor", "colorB", "posA", "posB", "brightness",
            "backgroundDepthOn",
            "bokehOn", "bokehThreshold", "bokehMinSize", "bokehMaxSize", "bokehMinOp", "bokehMaxOp",
            "ribbonColorOn", "ribbonColorRGB", "speckleColorOn", "speckleColorRGB",
            "bokehColorOn", "bokehColorRGB", "baseVal", "baseSat",
            "overWallpaper", "bgTintOpacity", "placeholder",
        ].forEach(n => { uniforms[n] = gl.getUniformLocation(program, n); });
        return gl;
    }

    function compile(type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.warn("ToolDialPreview: shader compile failed", gl.getShaderInfoLog(sh));
            return null;
        }
        return sh;
    }

    // The app's theme cards composite the translucent path over this neutral dark card colour.
    const PLACEHOLDER = [0x2B / 255, 0x2B / 255, 0x31 / 255];

    // ---- appearance (0..100 sliders) -> shader settings (mirrors xmbSettingsFromPercents) ----
    function deriveSettings(a) {
        const styleIdx = T.ENUMS.ribbonStyle.indexOf(a.ribbonStyle); // WISP0 WAVE1 RIBBON2
        const feat = a.featureOpacity / 100;
        // A dimmed background and an explicit wallpaper both trigger the translucent path. Passing
        // bgTintOpacity without this flag silently does nothing — a real bug in the app's previews.
        const overWallpaper = (a.backgroundOpacity < 100 || a.useWallpaper) ? 1 : 0;
        return {
            effectOn: a.animatedBackground ? 1 : 0,
            featureOpacity: feat,
            backgroundDepthOn: a.backgroundDepth ? 1 : 0,
            intensity: a.glowIntensity / 100 * 0.5,
            sharpness: a.ribbonDefinition / 100,
            ribbonCount: a.ribbonCount,   // 0 is legal and means "no ribbons" (Style = None)
            focusY: a.effectPosition / 100,
            focusH: Math.min(1, Math.max(0.05, a.effectHeight / 100)),
            scaleX: 0.4 + a.ribbonWaveSize / 100 * 1.6,
            girth: 0.4 + a.ribbonThickness / 100 * 1.8,
            wispStyle: styleIdx < 0 ? 2 : styleIdx,
            innerSpan: 0.06 + a.ribbonEdgeGradient / 100 * 0.94,
            roam: a.ribbonSway / 100,
            shine: a.ribbonShine / 100,
            starsOn: (a.speckles && a.animatedBackground) ? 1 : 0,
            starThreshold: 1 - a.speckleAmount / 100 * 0.09,
            starMinSize: 0.05 + a.speckleSizeMin / 100 * 0.55,
            starMaxSize: 0.05 + a.speckleSizeMax / 100 * 0.55,
            starMinOp: a.speckleOpacityMin / 100,
            starMaxOp: a.speckleOpacityMax / 100,
            // Bokeh — note the amount factor is 0.9, NOT the speckles' 0.09.
            bokehOn: (a.bokeh && a.animatedBackground) ? 1 : 0,
            bokehThreshold: 1 - a.bokehAmount / 100 * 0.9,
            bokehMinSize: 0.10 + a.bokehSizeMin / 100 * 0.5,
            bokehMaxSize: 0.10 + a.bokehSizeMax / 100 * 0.5,
            bokehMinOp: a.bokehOpacityMin / 100 * 0.8,
            bokehMaxOp: a.bokehOpacityMax / 100 * 0.8,
            // Feature colours. "Off" is handled in the shader: ribbons/bokeh fall back to colour A
            // lifted toward white, only speckles fall back to plain white.
            ribbonColorOn: a.ribbonCustomColor ? 1 : 0,
            ribbonColorRGB: T.hsvToRgb(a.ribbonHue, a.ribbonColorSat / 100, a.ribbonColorBright / 100),
            speckleColorOn: a.speckleCustomColor ? 1 : 0,
            speckleColorRGB: T.hsvToRgb(a.speckleHue, a.speckleColorSat / 100, a.speckleColorBright / 100),
            bokehColorOn: a.bokehCustomColor ? 1 : 0,
            bokehColorRGB: T.hsvToRgb(a.bokehHue, a.bokehColorSat / 100, a.bokehColorBright / 100),
            overWallpaper,
            bgTintOpacity: a.backgroundOpacity / 100,
            idleSpeed: a.idleMotion / 100 * 0.30,
        };
    }

    // ---- Preview registry + animation loop ----
    const previews = new Set();
    let rafId = null;
    let lastFrame = 0;
    const FRAME_MS = 1000 / 30; // cap ~30fps across the whole page
    const MAX_DPR = 1.5;

    const io = ("IntersectionObserver" in window)
        ? new IntersectionObserver(entries => {
            entries.forEach(e => {
                const pv = canvasToPreview.get(e.target);
                if (pv) pv.visible = e.isIntersecting;
            });
        }, { rootMargin: "120px" })
        : null;
    const canvasToPreview = new WeakMap();

    function loop(now) {
        rafId = requestAnimationFrame(loop);
        if (document.hidden) return;
        if (now - lastFrame < FRAME_MS) return;
        const dt = Math.min(0.1, (now - lastFrame) / 1000);
        lastFrame = now;

        const g = initGL();
        previews.forEach(pv => {
            if (!pv.visible || !pv.canvas.isConnected) return;
            // advance motion
            const sp = pv.settings.idleSpeed + pv.nudge;
            if (sp > 1e-4) pv.phase += dt * sp;
            pv.colorPhase += dt * 0.02; // gentle breathe/twinkle drift (colorSpeed)
            if (pv.nudge > 0) pv.nudge = Math.max(0, pv.nudge - pv.nudge * dt * 3.0);
            // refresh date-driven colours about once a minute
            if (pv.dynamicColor && now - pv.lastColorAt > 60000) {
                pv.colors = T.resolveColors(pv.appearance);
                pv.lastColorAt = now;
            }
            if (g) drawPreview(g, pv); else drawFallback(pv);
        });
    }

    function ensureLoop() {
        if (rafId == null) { lastFrame = performance.now(); rafId = requestAnimationFrame(loop); }
    }

    function targetSize(canvas) {
        const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(2, Math.round((rect.width || canvas.clientWidth || 320) * dpr));
        const h = Math.max(2, Math.round((rect.height || canvas.clientHeight || 200) * dpr));
        return { w, h };
    }

    function drawPreview(g, pv) {
        const { w, h } = targetSize(pv.canvas);
        if (glCanvas.width !== w || glCanvas.height !== h) {
            glCanvas.width = w; glCanvas.height = h;
        }
        if (pv.canvas.width !== w || pv.canvas.height !== h) {
            pv.canvas.width = w; pv.canvas.height = h;
        }
        g.viewport(0, 0, w, h);
        const s = pv.settings, c = pv.colors;
        g.uniform2f(uniforms.resolution, w, h);
        g.uniform1f(uniforms.phase, pv.phase);
        g.uniform1f(uniforms.colorPhase, pv.colorPhase);
        g.uniform1f(uniforms.intensity, s.intensity);
        g.uniform1f(uniforms.sharpness, s.sharpness);
        g.uniform1f(uniforms.ribbonCount, s.ribbonCount);
        g.uniform1f(uniforms.focusY, s.focusY);
        g.uniform1f(uniforms.focusH, s.focusH);
        g.uniform1f(uniforms.scaleX, s.scaleX);
        g.uniform1f(uniforms.girth, s.girth);
        g.uniform1f(uniforms.wispStyle, s.wispStyle);
        g.uniform1f(uniforms.innerSpan, s.innerSpan);
        g.uniform1f(uniforms.roam, s.roam);
        g.uniform1f(uniforms.shine, s.shine);
        g.uniform1f(uniforms.starsOn, s.starsOn);
        g.uniform1f(uniforms.starThreshold, s.starThreshold);
        g.uniform1f(uniforms.starMinSize, s.starMinSize);
        g.uniform1f(uniforms.starMaxSize, s.starMaxSize);
        g.uniform1f(uniforms.starMinOp, s.starMinOp);
        g.uniform1f(uniforms.starMaxOp, s.starMaxOp);
        g.uniform1f(uniforms.effectOn, s.effectOn);
        g.uniform1f(uniforms.featureOpacity, s.featureOpacity);
        g.uniform1f(uniforms.backgroundDepthOn, s.backgroundDepthOn);
        g.uniform1f(uniforms.bokehOn, s.bokehOn);
        g.uniform1f(uniforms.bokehThreshold, s.bokehThreshold);
        g.uniform1f(uniforms.bokehMinSize, s.bokehMinSize);
        g.uniform1f(uniforms.bokehMaxSize, s.bokehMaxSize);
        g.uniform1f(uniforms.bokehMinOp, s.bokehMinOp);
        g.uniform1f(uniforms.bokehMaxOp, s.bokehMaxOp);
        g.uniform1f(uniforms.ribbonColorOn, s.ribbonColorOn);
        g.uniform3fv(uniforms.ribbonColorRGB, s.ribbonColorRGB);
        g.uniform1f(uniforms.speckleColorOn, s.speckleColorOn);
        g.uniform3fv(uniforms.speckleColorRGB, s.speckleColorRGB);
        g.uniform1f(uniforms.bokehColorOn, s.bokehColorOn);
        g.uniform3fv(uniforms.bokehColorRGB, s.bokehColorRGB);
        g.uniform1f(uniforms.overWallpaper, s.overWallpaper);
        g.uniform1f(uniforms.bgTintOpacity, s.bgTintOpacity);
        g.uniform3fv(uniforms.placeholder, PLACEHOLDER);
        g.uniform1f(uniforms.baseVal, c.baseVal);
        g.uniform1f(uniforms.baseSat, c.baseSat);
        g.uniform3f(uniforms.baseColor, c.colorA[0], c.colorA[1], c.colorA[2]);
        g.uniform3f(uniforms.colorB, c.colorB[0], c.colorB[1], c.colorB[2]);
        g.uniform2f(uniforms.posA, c.posA[0], c.posA[1]);
        g.uniform2f(uniforms.posB, c.posB[0], c.posB[1]);
        g.uniform1f(uniforms.brightness, c.brightness);
        g.drawArrays(g.TRIANGLES, 0, 3);

        const ctx = pv.ctx || (pv.ctx = pv.canvas.getContext("2d"));
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(glCanvas, 0, 0);
    }

    // CSS-gradient fallback when WebGL is unavailable.
    function drawFallback(pv) {
        const { w, h } = targetSize(pv.canvas);
        if (pv.canvas.width !== w || pv.canvas.height !== h) { pv.canvas.width = w; pv.canvas.height = h; }
        const ctx = pv.ctx || (pv.ctx = pv.canvas.getContext("2d"));
        const c = pv.colors, s = pv.settings;
        // Same rule as the shader: animatedBackground off means no gradient at all.
        if (!s.effectOn) {
            ctx.fillStyle = s.overWallpaper ? "#2B2B31" : (s.backgroundDepthOn ? "#0e0e12" : "#000");
            ctx.fillRect(0, 0, w, h);
            return;
        }
        const toCss = (rgb, m) => `rgb(${rgb.map(v => Math.round(Math.min(1, v * (m || 1) * c.brightness) * 255)).join(",")})`;
        if (s.overWallpaper) { ctx.fillStyle = "#2B2B31"; ctx.fillRect(0, 0, w, h); }
        const grad = ctx.createLinearGradient(c.posA[0] * w, c.posA[1] * h, c.posB[0] * w, c.posB[1] * h);
        grad.addColorStop(0, toCss(c.colorA));
        grad.addColorStop(1, toCss(c.colorB));
        ctx.globalAlpha = s.overWallpaper ? s.bgTintOpacity : 1;
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
    }

    function create(canvas, appearance, opts) {
        opts = opts || {};
        const pv = {
            canvas,
            ctx: null,
            appearance,
            settings: deriveSettings(appearance),
            colors: T.resolveColors(appearance),
            dynamicColor: !!(appearance.colorFromMonth || appearance.brightnessFromTime),
            lastColorAt: performance.now(),
            phase: 0,
            colorPhase: 0,
            nudge: 0,
            visible: io ? false : true,
        };
        previews.add(pv);
        canvasToPreview.set(canvas, pv);
        if (io) io.observe(canvas);

        // Optional pointer nudge (modal / interactive previews).
        if (opts.interactive) {
            const onMove = () => { pv.nudge = Math.min(0.8, pv.nudge + 0.18); };
            canvas.addEventListener("pointermove", onMove);
            pv._onMove = onMove;
        }

        // Draw one frame immediately so static themes (idleMotion 0) still show.
        const g = initGL();
        if (g) drawPreview(g, { ...pv, visible: true }); else drawFallback(pv);
        ensureLoop();

        return {
            update(next) {
                pv.appearance = next;
                pv.settings = deriveSettings(next);
                pv.colors = T.resolveColors(next);
                pv.dynamicColor = !!(next.colorFromMonth || next.brightnessFromTime);
                pv.lastColorAt = performance.now();
            },
            destroy() {
                previews.delete(pv);
                canvasToPreview.delete(canvas);
                if (io) io.unobserve(canvas);
                if (pv._onMove) canvas.removeEventListener("pointermove", pv._onMove);
            },
        };
    }

    document.addEventListener("visibilitychange", () => { if (!document.hidden) lastFrame = performance.now(); });

    window.ToolDialPreview = { create, deriveSettings };
})();
