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
    TABS.forEach(t => $('tab-' + t).addEventListener('click', () => showTab(t)));

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
    }

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
       Ampel
       ========================================================= */

    const A = { color: 'green', auto: false, endAt: 0, warnAt: 0, timer: null };

    function setLamp(c) {
        A.color = c;
        ['red', 'yellow', 'green'].forEach(k => {
            const l = $('lamp-' + k);
            l.classList.toggle('on', k === c);
            l.setAttribute('aria-pressed', String(k === c));
        });
    }

    function aStop() {
        clearInterval(A.timer);
        A.auto = false;
        $('a-start').textContent = 'Mit Zeit starten';
        $('a-time').hidden = true;
        ['a-min', 'a-warn'].forEach(id => { $(id).disabled = false; });
        running.ampel = false;
        updateWake();
    }

    function aTick() {
        const now = Date.now();
        const left = A.endAt - now;
        if (left <= 0) {
            setLamp('red');
            $('a-time').textContent = '00:00';
            aStop();
            $('a-time').hidden = false;
            announce('Rot. Die Zeit ist um');
            return;
        }
        $('a-time').textContent = fmtCountdown(left);
        const c = A.warnAt > 0 && now >= A.endAt - A.warnAt ? 'yellow' : 'green';
        if (c !== A.color) { setLamp(c); if (c === 'yellow') announce('Gelb'); }
    }

    ['red', 'yellow', 'green'].forEach(k => $('lamp-' + k).addEventListener('click', () => {
        if (A.auto) aStop();
        setLamp(k);
    }));

    $('a-start').addEventListener('click', () => {
        if (A.auto) { aStop(); return; }
        const min = Math.max(1, Math.min(999, parseInt($('a-min').value, 10) || 0));
        const warn = Math.max(0, Math.min(999, parseInt($('a-warn').value, 10) || 0));
        if (!parseInt($('a-min').value, 10)) { $('a-min').focus(); return; }
        A.endAt = Date.now() + min * 60000;
        A.warnAt = Math.min(warn, min) * 60000;
        A.auto = true;
        $('a-start').textContent = 'Beenden';
        ['a-min', 'a-warn'].forEach(id => { $(id).disabled = true; });
        $('a-time').hidden = false;
        running.ampel = true;
        updateWake();
        setLamp('green');
        aTick();
        clearInterval(A.timer);
        A.timer = setInterval(aTick, 250);
    });

    $('a-note').addEventListener('input', () => { $('a-text').textContent = $('a-note').value; });

    setLamp('green');
    sShow();
})();
