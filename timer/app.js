(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const pad = n => String(n).padStart(2, '0');

    function announce(msg) {
        const live = $('live');
        live.textContent = '';
        setTimeout(() => { live.textContent = msg; }, 30);
    }

    /* ---------- Reiter ---------- */

    const TABS = ['timer', 'stopp', 'ampel'];
    function showTab(which) {
        TABS.forEach(t => {
            const on = t === which;
            $('tab-' + t).setAttribute('aria-selected', String(on));
            $('panel-' + t).hidden = !on;
        });
    }
    TABS.forEach(t => $('tab-' + t).addEventListener('click', () => {
        if (t !== 'ampel' && typeof setMode === 'function' && A.mode === 'mic') setMode('hand');
        showTab(t);
    }));

    /* ---------- Ton ---------- */

    let audio = null;
    function unlockAudio() {
        try {
            if (!audio) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) audio = new AC();
            }
            if (audio && audio.state === 'suspended') audio.resume();
        } catch (e) { /* kein Ton möglich */ }
    }
    function beep(times) {
        if (!audio) return;
        try {
            const t0 = audio.currentTime + 0.05;
            for (let i = 0; i < times; i++) {
                const o = audio.createOscillator();
                const g = audio.createGain();
                o.type = 'sine';
                o.frequency.value = 880;
                const t = t0 + i * 0.45;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
                o.connect(g);
                g.connect(audio.destination);
                o.start(t);
                o.stop(t + 0.35);
            }
        } catch (e) { /* kein Ton möglich */ }
    }

    /* ---------- Bildschirm wach halten ---------- */

    let wake = null;
    const running = { timer: false, stopp: false, ampel: false };
    async function updateWake() {
        const need = running.timer || running.stopp || running.ampel;
        try {
            if (need && !wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
                wake = await navigator.wakeLock.request('screen');
                wake.addEventListener('release', () => { wake = null; });
            } else if (!need && wake) {
                const w = wake; wake = null; await w.release();
            }
        } catch (e) { wake = null; }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateWake(); });

    /* ---------- Vollbild ---------- */

    const fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
    document.querySelectorAll('.fs').forEach(b => {
        if (!fsSupported) { b.hidden = true; return; }
        b.addEventListener('click', () => {
            const panel = $(b.dataset.target);
            if (fsElement()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
            try { (panel.requestFullscreen || panel.webkitRequestFullscreen).call(panel); } catch (e) { /* nicht möglich */ }
        });
    });
    function fsLabels() {
        document.querySelectorAll('.fs').forEach(b => { b.textContent = fsElement() ? 'Vollbild beenden' : 'Vollbild'; });
    }
    document.addEventListener('fullscreenchange', fsLabels);
    document.addEventListener('webkitfullscreenchange', fsLabels);

    /* =========================================================
       Timer
       ========================================================= */

    const T = { state: 'idle', total: 0, remain: 0, endAt: 0, timer: null };

    function fmtCountdown(ms) {
        const s = Math.max(0, Math.ceil(ms / 1000 - 1e-9));
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return h ? h + ':' + pad(m) + ':' + pad(sec) : pad(m) + ':' + pad(sec);
    }

    function readTimerInputs() {
        const m = Math.max(0, Math.min(999, parseInt($('t-min').value, 10) || 0));
        const s = Math.max(0, Math.min(59, parseInt($('t-sec').value, 10) || 0));
        return (m * 60 + s) * 1000;
    }

    function tShow() {
        const d = $('t-display');
        const ms = T.state === 'idle' ? readTimerInputs() : T.remain;
        d.textContent = fmtCountdown(ms);
        d.classList.toggle('warn', T.state !== 'idle' && T.state !== 'done' && ms <= 10000 && ms > 0);
        d.classList.toggle('done', T.state === 'done');
        tLamp(ms);
    }

    function tLamp(ms) {
        const on = $('t-ampel-on').checked;
        $('t-ampel').hidden = !on;
        if (!on) return;
        const warn = Math.max(0, parseInt($('t-warn').value, 10) || 0) * 60000;
        let c = 'green';
        if (T.state === 'done') c = 'red';
        else if (T.state !== 'idle' && warn > 0 && ms <= warn) c = 'yellow';
        if (c !== tLamp.last) {
            tLamp.last = c;
            document.querySelectorAll('#t-ampel .lamp').forEach(l => l.classList.toggle('on', l.dataset.c === c));
            if (T.state !== 'idle') announce(c === 'red' ? 'Rot. Die Zeit ist um' : (c === 'yellow' ? 'Gelb' : 'Grün'));
        }
    }
    tLamp.last = '';
    $('t-ampel-on').addEventListener('change', () => {
        $('t-warn-wrap').hidden = !$('t-ampel-on').checked;
        $('t-ampel-note').hidden = !$('t-ampel-on').checked;
        tLamp.last = ''; tShow();
    });
    $('t-warn').addEventListener('input', () => { tLamp.last = ''; tShow(); });

    function tSetButtons() {
        const run = T.state === 'running';
        $('t-start').textContent = run ? 'Pause' : (T.state === 'paused' ? 'Weiter' : 'Start');
        const locked = T.state === 'running' || T.state === 'paused';
        $('t-min').disabled = locked;
        $('t-sec').disabled = locked;
        document.querySelectorAll('#t-presets .btn').forEach(b => { b.disabled = locked; });
        running.timer = run;
        updateWake();
    }

    function tTick() {
        T.remain = T.endAt - Date.now();
        if (T.remain <= 0) {
            clearInterval(T.timer);
            T.remain = 0;
            T.state = 'done';
            tSetButtons();
            tShow();
            if ($('t-sound').checked) beep(3);
            announce('Die Zeit ist um');
            return;
        }
        tShow();
    }

    $('t-start').addEventListener('click', () => {
        unlockAudio();
        if (T.state === 'running') {
            clearInterval(T.timer);
            T.remain = T.endAt - Date.now();
            T.state = 'paused';
        } else {
            if (T.state === 'idle' || T.state === 'done') {
                T.total = readTimerInputs();
                if (T.total <= 0) { $('t-min').focus(); return; }
                T.remain = T.total;
            }
            T.state = 'running';
            T.endAt = Date.now() + T.remain;
            clearInterval(T.timer);
            T.timer = setInterval(tTick, 200);
        }
        tSetButtons();
        tShow();
    });

    $('t-reset').addEventListener('click', () => {
        clearInterval(T.timer);
        T.state = 'idle';
        tSetButtons();
        tShow();
    });

    ['t-min', 't-sec'].forEach(id => $(id).addEventListener('input', () => { if (T.state === 'idle') tShow(); }));

    [1, 2, 3, 5, 10, 15, 20, 30].forEach(m => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.textContent = m + ' min';
        b.addEventListener('click', () => {
            $('t-min').value = m;
            $('t-sec').value = 0;
            T.state = 'idle';
            tShow();
        });
        $('t-presets').append(b);
    });
    tShow();

    /* =========================================================
       Stoppuhr
       ========================================================= */

    const S = { state: 'idle', base: 0, startedAt: 0, laps: [], timer: null };

    function fmtWatch(ms) {
        const cs = Math.floor(ms / 10) % 100;
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return { main: h ? h + ':' + pad(m) + ':' + pad(sec) : pad(m) + ':' + pad(sec), cs: pad(cs) };
    }
    const sElapsed = () => S.base + (S.state === 'running' ? Date.now() - S.startedAt : 0);

    function sShow() {
        const f = fmtWatch(sElapsed());
        const d = $('s-display');
        d.textContent = f.main;
        const small = document.createElement('small');
        small.textContent = ',' + f.cs;
        d.append(small);
    }

    function sButtons() {
        $('s-start').textContent = S.state === 'running' ? 'Stopp' : (S.state === 'paused' ? 'Weiter' : 'Start');
        $('s-lap').disabled = S.state !== 'running';
        $('s-reset').disabled = S.state === 'idle' || S.state === 'running';
        running.stopp = S.state === 'running';
        updateWake();
    }

    function lapText(ms) { const f = fmtWatch(ms); return f.main + ',' + f.cs; }

    $('s-start').addEventListener('click', () => {
        if (S.state === 'running') {
            S.base = sElapsed();
            S.state = 'paused';
            clearInterval(S.timer);
        } else {
            S.startedAt = Date.now();
            S.state = 'running';
            clearInterval(S.timer);
            S.timer = setInterval(sShow, 40);
        }
        sButtons();
        sShow();
    });

    $('s-lap').addEventListener('click', () => {
        const total = sElapsed();
        const prev = S.laps.length ? S.laps[S.laps.length - 1] : 0;
        S.laps.push(total);
        const tr = document.createElement('tr');
        [String(S.laps.length), lapText(total - prev), lapText(total)].forEach(t => {
            const td = document.createElement('td');
            td.textContent = t;
            tr.append(td);
        });
        const body = $('s-laps').querySelector('tbody');
        body.insertBefore(tr, body.firstChild);
        $('s-laps').hidden = false;
    });

    $('s-reset').addEventListener('click', () => {
        S.state = 'idle';
        S.base = 0;
        S.laps = [];
        $('s-laps').querySelector('tbody').textContent = '';
        $('s-laps').hidden = true;
        sButtons();
        sShow();
    });

    /* =========================================================
       Geräuschampel
       ========================================================= */

    const A = { color: 'green', mode: 'hand', stream: null, ctx: null, an: null, buf: null, raf: 0,
                base: -55, smooth: -90, lastAbove: 0, calibUntil: 0, calibSum: 0, calibN: 0 };

    function setLamp(c) {
        A.color = c;
        ['red', 'yellow', 'green'].forEach(k => {
            const l = $('lamp-' + k);
            l.classList.toggle('on', k === c);
            l.setAttribute('aria-pressed', String(k === c));
        });
    }

    ['red', 'yellow', 'green'].forEach(k => $('lamp-' + k).addEventListener('click', () => {
        if (A.mode === 'mic') setMode('hand');
        setLamp(k);
    }));

    $('a-note').addEventListener('input', () => { $('a-text').textContent = $('a-note').value; });

    /* Schwellen in dB (relativ zu Vollaussteuerung); Empfindlichkeit 1 (unempfindlich) bis 9 */
    function thresholds() {
        const s = parseInt($('a-sens').value, 10) || 5;
        const shift = (5 - s) * 2.5;            // empfindlicher = Schwellen näher am Ruhepegel
        const y = A.base + 10 + shift;
        return { y, r: y + 10 };
    }
    const DB_MIN = -80, DB_MAX = -10;
    const pct = db => Math.max(0, Math.min(100, (db - DB_MIN) / (DB_MAX - DB_MIN) * 100));
    function drawMarks() {
        const t = thresholds();
        $('a-mark-y').style.left = pct(t.y) + '%';
        $('a-mark-r').style.left = pct(t.r) + '%';
    }
    $('a-sens').addEventListener('input', drawMarks);

    function micLoop() {
        A.raf = requestAnimationFrame(micLoop);
        A.an.getFloatTimeDomainData(A.buf);
        let sum = 0;
        for (let i = 0; i < A.buf.length; i++) sum += A.buf[i] * A.buf[i];
        const db = 20 * Math.log10(Math.sqrt(sum / A.buf.length) + 1e-7);
        const now = performance.now();
        A.smooth = A.smooth + (db - A.smooth) * (db > A.smooth ? 0.35 : 0.08);
        $('a-bar').style.width = pct(A.smooth) + '%';
        if (now < A.calibUntil) {
            A.calibSum += db; A.calibN++;
            return;
        }
        if (A.calibUntil) {
            A.calibUntil = 0;
            if (A.calibN > 0) A.base = Math.max(-75, Math.min(-35, A.calibSum / A.calibN));
            drawMarks();
            $('a-calib').disabled = false;
            $('a-status').textContent = 'Das Mikrofon ist aktiv.';
        }
        const t = thresholds();
        const want = A.smooth >= t.r ? 'red' : (A.smooth >= t.y ? 'yellow' : 'green');
        const rank = { green: 0, yellow: 1, red: 2 };
        if (rank[want] >= rank[A.color]) {
            A.lastAbove = now;
            if (want !== A.color) { setLamp(want); announce(want === 'red' ? 'Rot. Zu laut' : 'Gelb'); }
        } else if (now - A.lastAbove > 1800) {
            setLamp(want);
            A.lastAbove = now;
        }
    }

    function stopMic() {
        cancelAnimationFrame(A.raf);
        if (A.stream) A.stream.getTracks().forEach(t => t.stop());
        if (A.ctx) { try { A.ctx.close(); } catch (e) { /* egal */ } }
        A.stream = A.ctx = A.an = null;
        A.calibUntil = 0;
        running.ampel = false;
        updateWake();
    }

    async function startMic() {
        $('a-status').textContent = 'Mikrofon wird angefragt …';
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            $('a-status').textContent = 'Dieser Browser bietet keinen Zugriff auf das Mikrofon.';
            setMode('hand', true);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
            if (A.mode !== 'mic') { stream.getTracks().forEach(t => t.stop()); return; }
            const AC = window.AudioContext || window.webkitAudioContext;
            A.ctx = new AC();
            if (A.ctx.state === 'suspended') await A.ctx.resume();
            A.stream = stream;
            const src = A.ctx.createMediaStreamSource(stream);
            A.an = A.ctx.createAnalyser();
            A.an.fftSize = 2048;
            A.buf = new Float32Array(A.an.fftSize);
            src.connect(A.an);
            A.smooth = -90; A.lastAbove = performance.now();
            running.ampel = true;
            updateWake();
            setLamp('green');
            $('a-status').textContent = 'Das Mikrofon ist aktiv.';
            drawMarks();
            micLoop();
        } catch (e) {
            const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
            $('a-status').textContent = denied
                ? 'Der Zugriff auf das Mikrofon wurde nicht erlaubt. Er lässt sich in den Einstellungen des Browsers freigeben.'
                : 'Es wurde kein Mikrofon gefunden.';
            setMode('hand', true);
        }
    }

    function setMode(m, keepStatus) {
        if (A.mode === 'mic' && m === 'hand') stopMic();
        A.mode = m;
        const mic = m === 'mic';
        $('a-mode-hand').setAttribute('aria-checked', String(!mic));
        $('a-mode-mic').setAttribute('aria-checked', String(mic));
        $('a-mic-ctrl').hidden = !mic;
        $('a-meter').hidden = !mic;
        $('a-privacy').hidden = !mic;
        $('a-help').hidden = mic;
        if (!keepStatus) $('a-status').textContent = '';
        if (mic) startMic();
    }
    $('a-mode-hand').addEventListener('click', () => setMode('hand'));
    $('a-mode-mic').addEventListener('click', () => { if (A.mode !== 'mic') setMode('mic'); });

    $('a-calib').addEventListener('click', () => {
        if (!A.an) return;
        A.calibSum = 0; A.calibN = 0; A.calibUntil = performance.now() + 4000;
        $('a-calib').disabled = true;
        $('a-status').textContent = 'Der Ruhepegel wird gemessen. Bitte vier Sekunden Ruhe.';
    });

    window.addEventListener('pagehide', () => { if (A.mode === 'mic') setMode('hand'); });

    setLamp('green');
    sShow();
})();
