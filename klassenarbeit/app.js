(function () {
    'use strict';

    const KA = window.KA;
    const MAX_NAME = 60, MAX_WORKS = 40, MAX_STUDENTS = 200;
    const LS_KEY = 'klassenarbeit.v1', LS_AUTO = 'klassenarbeit.auto';
    const NOTE_COLORS = { 1: '#27ae60', 2: '#7bb661', 3: '#d4ac0d', 4: '#e69138', 5: '#d35400', 6: '#c0392b' };

    let works = [];
    let cur = 0;
    let dirty = false, savedOnce = false, autoOn = false, statusNote = '';

    const $ = id => document.getElementById(id);
    const A = () => works[cur];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const uid = () => 'i' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const cleanStr = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
    const num = v => typeof v === 'number' && isFinite(v);
    const isInt = v => typeof v === 'number' && Number.isInteger(v);
    const fmt = (x, d) => x.toFixed(d).replace('.', ',');
    const fmtT = x => String(Math.round(x * 100) / 100).replace('.', ',');

    function el(tag, props, kids) {
        const e = document.createElement(tag);
        props = props || {};
        Object.keys(props).forEach(k => {
            if (k === 'class') e.className = props[k];
            else if (k === 'text') e.textContent = props[k];
            else e.setAttribute(k, props[k]);
        });
        (kids || []).forEach(c => e.append(c));
        return e;
    }

    function announce(msg) {
        const live = $('live');
        live.textContent = '';
        setTimeout(() => { live.textContent = msg; }, 30);
    }

    /* ---------- Dialoge ---------- */

    function modal(opts) {
        return new Promise(resolve => {
            const root = $('modal-root');
            const previous = document.activeElement;
            const input = opts.input != null ? el('input', { type: 'text', class: 'field', maxlength: String(MAX_NAME), 'aria-label': opts.title }) : null;
            if (input) input.value = opts.input;
            const ok = el('button', { type: 'button', class: 'btn primary', text: opts.ok || 'OK' });
            const cancel = opts.cancel === false ? null : el('button', { type: 'button', class: 'btn', text: 'Abbrechen' });
            const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title }, [el('h2', { text: opts.title })]);
            if (opts.text) box.append(el('p', { text: opts.text }));
            if (opts.body) box.append(opts.body);
            if (input) box.append(input);
            box.append(el('div', { class: 'modal-actions' }, cancel ? [cancel, ok] : [ok]));
            function close(val) {
                document.removeEventListener('keydown', onKey, true);
                root.textContent = '';
                root.hidden = true;
                if (previous && previous.focus) previous.focus();
                resolve(val);
            }
            function accept() {
                if (input) { const v = input.value.replace(/\s+/g, ' ').trim(); close(v ? (opts.collect ? opts.collect(v) : v) : null); } else close(true);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); close(input ? null : false); }
                else if (e.key === 'Enter' && input && document.activeElement === input) { e.preventDefault(); accept(); }
            }
            ok.addEventListener('click', accept);
            if (cancel) cancel.addEventListener('click', () => close(input ? null : false));
            document.addEventListener('keydown', onKey, true);
            root.textContent = '';
            root.append(box);
            root.hidden = false;
            (input || ok).focus();
            if (input) input.select();
        });
    }
    const confirmDialog = (title, text, okLabel) => modal({ title: title, text: text, ok: okLabel || 'OK' });
    const promptDialog = (title, value) => modal({ title: title, input: value, ok: 'Anlegen' });
    const infoDialog = (title, text) => modal({ title: title, text: text, cancel: false });

    /* ---------- Datenmodell ---------- */

    const isK = a => !!a && a.type === 'klausur';
    const AFB_DEFAULT = ['Anforderungsbereich I', 'Anforderungsbereich II', 'Anforderungsbereich III'];
    const newStudent = (name) => ({ id: uid(), name: name, pts: null, be: null, spr: null, afb: [null, null, null] });

    function newWork(name, type) {
        return {
            id: uid(), name: name, max: 30, tend: true, useNumbers: false, unit: 'percent', tendEdited: false,
            type: type === 'klausur' ? 'klausur' : 'arbeit',
            variant: 'be', beMax: 100, wSpr: 20, afbNames: AFB_DEFAULT.slice(), afbW: [20, 40, 20],
            thr: { plain: KA.DEFAULT_PLAIN.slice(), tend: KA.tendFromPlain(KA.DEFAULT_PLAIN) },
            students: []
        };
    }

    function sanitize(raw) {
        const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.works) ? raw.works : null);
        if (!list || !list.length) return null;
        const out = [];
        list.slice(0, MAX_WORKS).forEach((src, i) => {
            if (!src || typeof src !== 'object') return;
            const a = newWork(cleanStr(src.name, MAX_NAME) || 'Arbeit ' + (i + 1));
            a.max = num(src.max) ? clamp(KA.round2(src.max), 1, 1000) : 30;
            a.tend = src.tend !== false;
            a.useNumbers = src.useNumbers === true;
            a.type = src.type === 'klausur' ? 'klausur' : 'arbeit';
            a.variant = src.variant === 'ab' ? 'ab' : 'be';
            a.beMax = num(src.beMax) ? clamp(KA.round2(src.beMax), 1, 1000) : 100;
            a.wSpr = num(src.wSpr) ? clamp(KA.round2(src.wSpr), 0, 100) : 20;
            if (Array.isArray(src.afbNames) && src.afbNames.length === 3) a.afbNames = src.afbNames.map((n, k) => cleanStr(n, 30) || AFB_DEFAULT[k]);
            if (Array.isArray(src.afbW) && src.afbW.length === 3 && src.afbW.every(num)) a.afbW = src.afbW.map(v => clamp(KA.round2(v), 0, 100));
            a.unit = src.unit === 'points' ? 'points' : 'percent';
            a.tendEdited = src.tendEdited === true;
            const okArr = (arr, n) => Array.isArray(arr) && arr.length === n && arr.every(v => num(v) && v >= 0 && v <= 10000);
            if (src.thr && okArr(src.thr.plain, 5)) a.thr.plain = src.thr.plain.map(KA.round2);
            if (src.thr && okArr(src.thr.tend, 15)) a.thr.tend = src.thr.tend.map(KA.round2);
            (Array.isArray(src.students) ? src.students : []).slice(0, MAX_STUDENTS).forEach(s => {
                if (!s || typeof s !== 'object') return;
                const np = v => (isInt(v) && v >= 0 && v <= 15 ? v : null);
                a.students.push({
                    id: uid(), name: cleanStr(s.name, MAX_NAME),
                    pts: num(s.pts) && s.pts >= 0 && s.pts <= 9999 ? KA.round2(s.pts) : null,
                    be: num(s.be) && s.be >= 0 && s.be <= 9999 ? KA.round2(s.be) : null,
                    spr: np(s.spr),
                    afb: Array.isArray(s.afb) && s.afb.length === 3 ? s.afb.map(np) : [null, null, null]
                });
            });
            out.push(a);
        });
        return out.length ? out : null;
    }

    const serialize = () => JSON.stringify({ format: 'klassenarbeit', version: 1, works: works });

    /* ---------- Speichern und Laden ---------- */

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* nichts */ } }

    function markDirty() { dirty = true; updateStatus(); scheduleAuto(); }

    function saveLocal(manual) {
        if (lsSet(LS_KEY, serialize())) {
            dirty = false;
            savedOnce = true;
            const t = new Date();
            statusNote = 'Im Browser gespeichert um ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ' Uhr';
            updateStatus();
            if (manual) announce('Gespeichert');
            return true;
        }
        if (manual) infoDialog('Speichern nicht möglich', 'Der Browser erlaubt hier kein Speichern, zum Beispiel im privaten Modus. Bitte sichern Sie stattdessen eine Datei.');
        return false;
    }

    let autoTimer = null;
    function scheduleAuto() { if (autoOn && savedOnce) { clearTimeout(autoTimer); autoTimer = setTimeout(() => saveLocal(false), 800); } }
    function flushAuto() { if (autoOn && savedOnce && dirty) { clearTimeout(autoTimer); saveLocal(false); } }

    function updateStatus() {
        const s = $('status');
        if (dirty) { s.textContent = autoOn && savedOnce ? 'Wird gespeichert …' : 'Nicht gespeichert'; s.className = 'status dirty'; }
        else { s.textContent = statusNote; s.className = 'status'; }
    }

    function saveBytes(data, name, type) {
        const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: type }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    const today = () => new Date().toLocaleDateString('sv-SE');
    const safeName = s => s.replace(/[^\w\-äöüÄÖÜß]+/g, '_');

    $('save-local').addEventListener('click', () => saveLocal(true));
    $('save-local2').addEventListener('click', () => saveLocal(true));
    $('forget-local').addEventListener('click', async () => {
        if (!lsGet(LS_KEY)) { infoDialog('Nichts gespeichert', 'Im Browser sind keine gespeicherten Daten vorhanden.'); return; }
        if (!(await confirmDialog('Gespeicherte Daten löschen?', 'Die im Browser gespeicherte Kopie wird gelöscht. Was gerade geöffnet ist, bleibt bis zum Schließen der Seite sichtbar.', 'Löschen'))) return;
        lsDel(LS_KEY);
        savedOnce = false;
        statusNote = 'Gespeicherte Daten gelöscht';
        dirty = true;
        updateStatus();
    });
    $('auto-save').addEventListener('change', e => {
        autoOn = e.target.checked;
        if (autoOn) lsSet(LS_AUTO, '1'); else lsDel(LS_AUTO);
        if (autoOn && !savedOnce) saveLocal(true);
        updateStatus();
    });
    $('save-json').addEventListener('click', () => {
        saveBytes(serialize(), 'Klassenarbeiten-' + today() + '.json', 'application/json');
        dirty = false;
        statusNote = 'Datei gesichert';
        updateStatus();
    });
    $('load-json').addEventListener('click', () => $('load-json-input').click());
    $('load-json-input').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        let raw;
        try { raw = JSON.parse(await f.text()); } catch (err) { infoDialog('Datei nicht lesbar', 'Das ist keine gültige Datei dieser Auswertung.'); return; }
        const list = sanitize(raw);
        if (!list) { infoDialog('Datei nicht lesbar', 'In der Datei wurden keine Arbeiten gefunden.'); return; }
        if (works.some(w => w.students.length) && !(await confirmDialog('Datei laden?', 'Die aktuell geöffneten Arbeiten werden ersetzt.', 'Laden'))) return;
        works = list;
        cur = 0;
        markDirty();
        statusNote = 'Datei geladen';
        renderAll();
    });
    window.addEventListener('beforeunload', e => {
        flushAuto();
        if (dirty && works.some(w => w.students.length)) { e.preventDefault(); e.returnValue = ''; }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushAuto(); });
    window.addEventListener('pagehide', flushAuto);

    /* ---------- Arbeiten (Reiter) ---------- */

    function renderTabs() {
        const t = $('tabs');
        t.textContent = '';
        works.forEach((w, i) => {
            const b = el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': i === cur ? 'true' : 'false', text: w.name });
            b.addEventListener('click', () => { cur = i; renderAll(); });
            t.append(b);
        });
    }

    async function addWork() {
        if (works.length >= MAX_WORKS) { infoDialog('Höchstgrenze erreicht', 'Es sind höchstens ' + MAX_WORKS + ' Arbeiten möglich.'); return; }
        let kind = 'arbeit';
        const body = el('div', { class: 'kind-pick' }, [
            radio('kind', 'a', 'Klassenarbeit (Sek I, Noten 1 bis 6)', true, () => { kind = 'arbeit'; }),
            radio('kind', 'k', 'Klausur (Oberstufe, Notenpunkte)', false, () => { kind = 'klausur'; })
        ]);
        const picked = await modal({ title: 'Neue Arbeit', input: '', body: body, ok: 'Anlegen', collect: v => ({ name: v, kind: kind }) });
        if (!picked) return;
        works.push(newWork(picked.name.slice(0, MAX_NAME), picked.kind));
        cur = works.length - 1;
        markDirty();
        renderAll();
        $('det-arbeit').open = true;
        $('det-key').open = !(isK(A()) && A().variant === 'ab');
        $('det-names').open = true;
    }
    $('tab-add').addEventListener('click', addWork);
    $('empty-add').addEventListener('click', addWork);

    /* ---------- Einstellungen ---------- */

    function radio(name, value, label, checked, onSel) {
        const r = el('input', { type: 'radio', name: name, value: value });
        r.checked = checked;
        r.addEventListener('change', () => { if (r.checked) onSel(); });
        return el('label', { class: 'radio' }, [r, document.createTextNode(label)]);
    }

    function renderArbeit() {
        const box = $('arbeit-settings');
        box.textContent = '';
        const a = A();
        if (!a) return;
        const name = el('input', { type: 'text', class: 'field', maxlength: '60', value: a.name });
        name.addEventListener('change', () => {
            const v = name.value.replace(/\s+/g, ' ').trim();
            if (v) { a.name = v; markDirty(); renderTabs(); renderResult(); } else name.value = a.name;
        });
        box.append(el('label', { text: 'Name der Arbeit' }, [name]));

        if (isK(a)) { renderArbeitK(box, a); return; }

        const max = el('input', { type: 'text', class: 'field', inputmode: 'decimal', value: fmtT(a.max), 'aria-label': 'Gesamtpunktzahl' });
        max.addEventListener('change', () => {
            const v = KA.parsePoints(max.value);
            if (v === '' || v === null || v < 1) { max.value = fmtT(a.max); return; }
            a.max = v;
            markDirty();
            renderAll();
        });
        box.append(el('label', { text: 'Gesamtpunktzahl' }, [max]));

        box.append(el('div', { class: 'section-title', text: 'Notenform' }));
        const setTend = t => {
            if (t === a.tend) return;
            a.tend = t;
            if (t && !a.tendEdited) a.thr.tend = KA.tendFromPlain(a.thr.plain, a.unit === 'points' ? a.max : 100);
            markDirty();
            renderAll();
        };
        box.append(radio('tend', '1', 'Mit Tendenz (1+, 1, 1-, 2+ … 5-, 6)', a.tend, () => setTend(true)));
        box.append(radio('tend', '0', 'Ohne Tendenz (1 bis 6)', !a.tend, () => setTend(false)));

        box.append(el('div', { class: 'section-title', text: 'Anzeige' }));
        const setNum = n => { a.useNumbers = n; markDirty(); renderTable(); };
        box.append(radio('disp', 'n', 'Namen', !a.useNumbers, () => setNum(false)));
        box.append(radio('disp', 'z', 'Nummern statt Namen', a.useNumbers, () => setNum(true)));

        const dup = el('button', { type: 'button', class: 'btn small', text: 'Duplizieren' });
        const del = el('button', { type: 'button', class: 'btn small danger', text: 'Arbeit löschen' });
        dup.addEventListener('click', () => {
            if (works.length >= MAX_WORKS) return;
            const copy = JSON.parse(JSON.stringify(a));
            copy.id = uid();
            copy.name = (a.name + ' (Kopie)').slice(0, MAX_NAME);
            copy.students.forEach(s => { s.id = uid(); });
            works.splice(cur + 1, 0, copy);
            cur++;
            markDirty();
            renderAll();
        });
        del.addEventListener('click', async () => {
            if (!(await confirmDialog('Arbeit löschen?', '„' + a.name + '“ wird mit allen Namen und Punkten entfernt.', 'Löschen'))) return;
            works.splice(cur, 1);
            cur = clamp(cur, 0, works.length - 1);
            markDirty();
            renderAll();
        });
        box.append(el('div', { class: 'btn-row' }, [dup, del]));
    }

    function pctInput(label, get, set, extra) {
        const inp = el('input', { type: 'text', class: 'field', inputmode: 'decimal', value: fmtT(get()), 'aria-label': label });
        inp.addEventListener('change', () => {
            const v = KA.parsePoints(inp.value);
            if (v === '' || v === null || v > 100) { inp.value = fmtT(get()); return; }
            set(v);
            markDirty();
            renderAll();
        });
        return el('label', { text: label }, [inp]);
    }

    function renderArbeitK(box, a) {
        box.append(el('div', { class: 'section-title', text: 'Fachlicher Teil' }));
        const setVar = v => { if (a.variant !== v) { a.variant = v; markDirty(); renderAll(); } };
        box.append(radio('variant', 'be', 'BE vergeben (Notenpunkte aus dem BE-Anteil)', a.variant === 'be', () => setVar('be')));
        box.append(radio('variant', 'ab', 'Notenpunkte je Anforderungsbereich', a.variant === 'ab', () => setVar('ab')));

        if (a.variant === 'be') {
            const max = el('input', { type: 'text', class: 'field', inputmode: 'decimal', value: fmtT(a.beMax), 'aria-label': 'Gesamt-BE' });
            max.addEventListener('change', () => {
                const v = KA.parsePoints(max.value);
                if (v === '' || v === null || v < 1) { max.value = fmtT(a.beMax); return; }
                a.beMax = v;
                markDirty();
                renderAll();
            });
            box.append(el('label', { text: 'Gesamt-BE der Klausur' }, [max]));
            box.append(pctInput('Anteil sprachlicher Teil in Prozent', () => a.wSpr, v => { a.wSpr = v; }));
            box.append(el('p', { class: 'small-text', text: 'Fachlicher Teil: ' + fmtT(100 - a.wSpr) + ' %. Aus den BE werden Notenpunkte nach dem Schlüssel der VOGO berechnet, danach mit den sprachlichen Notenpunkten verrechnet. Ab ,5 wird aufgerundet.' }));
        } else {
            box.append(el('div', { class: 'section-title', text: 'Anteile in Prozent' }));
            a.afbNames.forEach((n, k) => {
                const name = el('input', { type: 'text', class: 'field afb-name', maxlength: '30', value: n, 'aria-label': 'Name Anforderungsbereich ' + (k + 1) });
                name.addEventListener('change', () => {
                    const v = name.value.replace(/\s+/g, ' ').trim();
                    a.afbNames[k] = v || AFB_DEFAULT[k];
                    markDirty();
                    renderAll();
                });
                const w = el('input', { type: 'text', class: 'field afb-w', inputmode: 'decimal', value: fmtT(a.afbW[k]), 'aria-label': 'Anteil ' + a.afbNames[k] });
                w.addEventListener('change', () => {
                    const v = KA.parsePoints(w.value);
                    if (v === '' || v === null || v > 100) { w.value = fmtT(a.afbW[k]); return; }
                    a.afbW[k] = v;
                    markDirty();
                    renderAll();
                });
                box.append(el('div', { class: 'afb-row' }, [name, w, el('span', { class: 'info', text: '%' })]));
            });
            const spr = el('input', { type: 'text', class: 'field afb-w', inputmode: 'decimal', value: fmtT(a.wSpr), 'aria-label': 'Anteil sprachlicher Teil' });
            spr.addEventListener('change', () => {
                const v = KA.parsePoints(spr.value);
                if (v === '' || v === null || v > 100) { spr.value = fmtT(a.wSpr); return; }
                a.wSpr = v;
                markDirty();
                renderAll();
            });
            box.append(el('div', { class: 'afb-row' }, [el('span', { class: 'afb-fix', text: 'Sprachlicher Teil' }), spr, el('span', { class: 'info', text: '%' })]));
            const sum = KA.round2(a.afbW.reduce((x, y) => x + y, 0) + a.wSpr);
            box.append(el('p', { class: 'small-text' + (sum !== 100 ? ' warn-text' : ''), text: sum === 100
                ? 'Die Notenpunkte der Bereiche werden gewichtet gemittelt und ab ,5 aufgerundet. Danach werden sie mit dem sprachlichen Teil verrechnet.'
                : 'Die Anteile ergeben zusammen ' + fmtT(sum) + ' %. Sie werden im Verhältnis zueinander verrechnet.' }));
        }

        box.append(el('div', { class: 'section-title', text: 'Anzeige' }));
        box.append(radio('disp', 'n', 'Namen', !a.useNumbers, () => { a.useNumbers = false; markDirty(); renderTable(); }));
        box.append(radio('disp', 'z', 'Nummern statt Namen', a.useNumbers, () => { a.useNumbers = true; markDirty(); renderTable(); }));
        box.append(workButtons(a));
    }

    function workButtons(a) {
        const dup = el('button', { type: 'button', class: 'btn small', text: 'Duplizieren' });
        const del = el('button', { type: 'button', class: 'btn small danger', text: 'Arbeit löschen' });
        dup.addEventListener('click', () => {
            if (works.length >= MAX_WORKS) return;
            const copy = JSON.parse(JSON.stringify(a));
            copy.id = uid();
            copy.name = (a.name + ' (Kopie)').slice(0, MAX_NAME);
            copy.students.forEach(s => { s.id = uid(); });
            works.splice(cur + 1, 0, copy);
            cur++;
            markDirty();
            renderAll();
        });
        del.addEventListener('click', async () => {
            if (!(await confirmDialog('Arbeit löschen?', '„' + a.name + '“ wird mit allen Namen und Punkten entfernt.', 'Löschen'))) return;
            works.splice(cur, 1);
            cur = clamp(cur, 0, works.length - 1);
            markDirty();
            renderAll();
        });
        return el('div', { class: 'btn-row' }, [dup, del]);
    }

    function renderKey() {
        const box = $('key-settings');
        box.textContent = '';
        const a = A();
        if (!a) return;
        if (isK(a)) {
            box.append(el('p', { class: 'small-text', text: 'Notenpunkte aus dem Anteil der erreichten BE (VOGO, gültig ab 2019/2020).' }));
            for (let p = 15; p >= 1; p--) {
                const need = KA.beNeeded(p, a.beMax);
                box.append(el('div', { class: 'keyrow' }, [el('span', { class: 'kn', text: String(p) }), el('span', { class: 'info', text: 'ab ' + KA.BE_PCT[15 - p] + ' %' }), el('span', { class: 'info', text: fmtT(need) + ' BE' })]));
            }
            box.append(el('div', { class: 'keyrow' }, [el('span', { class: 'kn', text: '0' }), el('span', { class: 'info', text: 'darunter' }), el('span')]));
            return;
        }
        const vals = a.tend ? a.thr.tend : a.thr.plain;
        const lab = KA.labels(a.tend);

        box.append(el('div', { class: 'section-title', text: 'Eingabe in' }));
        const setUnit = u => {
            if (u === a.unit) return;
            const conv = v => u === 'points' ? KA.round2(v * a.max / 100) : KA.round2(v / a.max * 100);
            a.thr.plain = a.thr.plain.map(conv);
            a.thr.tend = a.thr.tend.map(conv);
            a.unit = u;
            markDirty();
            renderKey();
        };
        box.append(radio('unit', 'p', 'Prozent', a.unit === 'percent', () => setUnit('percent')));
        box.append(radio('unit', 'z', 'Punkten (von ' + fmtT(a.max) + ')', a.unit === 'points', () => setUnit('points')));

        box.append(el('div', { class: 'section-title', text: 'Mindestens für die Note' }));
        box.append(el('div', { class: 'keyhead' }, [el('span', { text: 'Note' }), el('span', { text: a.unit === 'points' ? 'ab Punkten' : 'ab Prozent' }), el('span', { text: a.unit === 'points' ? 'entspricht' : 'entspricht' })]));
        const desc = KA.isDescending(vals);
        vals.forEach((v, i) => {
            const inp = el('input', { type: 'text', class: 'field' + (!desc && i > 0 && !(v < vals[i - 1]) ? ' warn' : ''), inputmode: 'decimal', value: fmtT(v), 'aria-label': 'Schwelle für Note ' + lab[i] });
            inp.addEventListener('change', () => {
                const p = KA.parsePoints(inp.value);
                if (p === '' || p === null) { inp.value = fmtT(v); return; }
                vals[i] = p;
                if (a.tend) a.tendEdited = true;
                markDirty();
                renderKey();
                renderTable();
                renderResult();
            });
            const other = a.unit === 'points' ? fmtT(v / a.max * 100) + ' %' : fmtT(v * a.max / 100) + ' Punkte';
            box.append(el('div', { class: 'keyrow' }, [el('span', { class: 'kn', text: lab[i] }), inp, el('span', { class: 'info', text: other })]));
        });
        box.append(el('div', { class: 'keyrow' }, [el('span', { class: 'kn', text: lab[lab.length - 1] }), el('span', { class: 'info', text: 'darunter' }), el('span')]));
        if (!desc) box.append(el('p', { class: 'small-text', text: 'Die Grenzen sollten von oben nach unten kleiner werden. Markierte Felder liegen nicht darunter.' }));
        if (a.unit === 'percent') box.append(el('p', { class: 'small-text', text: 'Die Prozentwerte werden auf die Gesamtpunktzahl umgerechnet. Prozentwerte mit Nachkommastellen sind möglich.' }));
        const reset = el('button', { type: 'button', class: 'btn small', text: 'Voreinstellung (92 / 81 / 67 / 50 / 30 %)' });
        reset.addEventListener('click', async () => {
            if (!(await confirmDialog('Voreinstellung laden?', 'Der Notenschlüssel dieser Arbeit wird auf 92 / 81 / 67 / 50 / 30 Prozent gesetzt. Bei Tendenz werden die Stufen gedrittelt.', 'Laden'))) return;
            const conv = v => a.unit === 'points' ? KA.round2(v * a.max / 100) : v;
            a.thr.plain = KA.DEFAULT_PLAIN.map(conv);
            a.thr.tend = KA.tendFromPlain(KA.DEFAULT_PLAIN).map(conv);
            a.tendEdited = false;
            markDirty();
            renderKey();
            renderTable();
            renderResult();
        });
        box.append(el('div', { class: 'btn-row' }, [reset]));
    }

    /* ---------- Namen und Zeilen ---------- */

    function parseNames(text) {
        const clean = text.replace(/^﻿/, '');
        let lines = clean.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
        if (lines.length === 1) lines = lines[0].split(/[;,\t]+/);
        return lines.map(l => l.replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)).filter(l => l.length);
    }

    function addStudents(names) {
        const a = A();
        if (!a || !names.length) return;
        let added = 0;
        names.forEach(n => {
            if (a.students.length < MAX_STUDENTS) { a.students.push(newStudent(n)); added++; }
        });
        markDirty();
        renderTable();
        renderResult();
        announce(added + ' Zeilen hinzugefügt');
        if (added < names.length) infoDialog('Höchstgrenze erreicht', 'Pro Arbeit sind höchstens ' + MAX_STUDENTS + ' Zeilen möglich.');
    }

    $('names-add').addEventListener('click', () => {
        const names = parseNames($('names-input').value);
        if (!names.length) { $('names-input').focus(); return; }
        addStudents(names);
        $('names-input').value = '';
    });
    $('rows-add').addEventListener('click', () => {
        const n = clamp(parseInt($('rows-count').value, 10) || 0, 1, MAX_STUDENTS);
        addStudents(new Array(n).fill(''));
    });
    $('names-file').addEventListener('click', () => $('names-file-input').click());
    $('names-file-input').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            const buf = await f.arrayBuffer();
            let text;
            try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (err) { text = new TextDecoder('windows-1252').decode(buf); }
            const names = parseNames(text);
            if (!names.length) { infoDialog('Keine Namen gefunden', 'Die Datei enthält keinen Text.'); return; }
            addStudents(names);
        } catch (err) {
            infoDialog('Datei nicht lesbar', 'Die Datei konnte nicht gelesen werden.');
        }
    });
    $('names-sort').addEventListener('click', () => {
        const a = A();
        if (!a) return;
        a.students.sort((x, y) => (!x.name ? 1 : !y.name ? -1 : x.name.localeCompare(y.name, 'de')));
        markDirty();
        renderTable();
    });

    /* ---------- Tabelle ---------- */

    function noteCell(td, grade) {
        td.textContent = grade || '';
        td.style.background = grade ? NOTE_COLORS[KA.baseNote(grade)] : '';
        td.style.color = grade ? '#fff' : '';
    }

    function fillRow(tr, s) {
        const a = A();
        const g = KA.gradeFor(a, s.pts);
        tr.querySelector('.pc').textContent = s.pts == null ? '' : fmt(s.pts / a.max * 100, 1) + ' %';
        noteCell(tr.querySelector('.nt-note'), g);
        const inp = tr.querySelector('input.pi');
        inp.classList.toggle('over', s.pts != null && s.pts > a.max + 1e-9);
    }

    const npColor = p => NOTE_COLORS[KA.npBase(p)];

    function fillRowK(tr, s) {
        const a = A();
        const r = KA.klausurRow(a, s);
        const f = tr.querySelector('.k-fach'), g = tr.querySelector('.k-ges');
        if (f) f.textContent = r.fach == null ? '' : String(r.fach);
        g.textContent = r.gesamt == null ? '' : String(r.gesamt);
        g.style.background = r.gesamt == null ? '' : npColor(r.gesamt);
        g.style.color = r.gesamt == null ? '' : '#fff';
        const be = tr.querySelector('input[data-f="be"]');
        if (be) be.classList.toggle('over', s.be != null && s.be > a.beMax + 1e-9);
    }

    function renderTableK(a) {
        const wrap = $('tablewrap');
        const be = a.variant === 'be';
        const head = el('tr', {}, [el('th', { text: 'Nr.' })]);
        if (!a.useNumbers) head.append(el('th', { class: 'name', text: 'Name' }));
        if (be) head.append(el('th', { text: 'BE (von ' + fmtT(a.beMax) + ')' }));
        else a.afbNames.forEach(n => head.append(el('th', { class: 'afbh', text: n })));
        head.append(el('th', { text: 'Fachlich' }), el('th', { text: 'Sprachlich' }), el('th', { text: 'Gesamt' }));
        if (be) head.append(el('th', { 'aria-label': 'BE-Bedarf' }));
        head.append(el('th', { 'aria-label': 'Zeile entfernen' }));
        const sub = el('tr', { class: 'subhead' }, [el('th')]);
        if (!a.useNumbers) sub.append(el('th'));
        if (be) sub.append(el('th'));
        else a.afbNames.forEach(() => sub.append(el('th', { text: 'NP' })));
        sub.append(el('th', { text: 'NP' }), el('th', { text: 'NP' }), el('th', { text: 'NP' }));
        sub.append(el('th'));
        if (be) sub.append(el('th'));
        const tb = el('tbody');
        a.students.forEach((s, i) => {
            const tr = el('tr', { 'data-sid': s.id });
            const who = () => (a.useNumbers ? 'Nr. ' + (i + 1) : (s.name || 'Nr. ' + (i + 1)));
            tr.append(el('td', { class: 'num', text: String(i + 1) }));
            if (!a.useNumbers) {
                const ni = el('input', { type: 'text', class: 'ni', maxlength: String(MAX_NAME), value: s.name, 'aria-label': 'Name ' + (i + 1), autocomplete: 'off' });
                ni.addEventListener('input', () => { s.name = ni.value.slice(0, MAX_NAME); markDirty(); });
                ni.addEventListener('change', () => { s.name = ni.value.replace(/\s+/g, ' ').trim(); ni.value = s.name; });
                tr.append(el('td', { class: 'name-in' }, [ni]));
            }
            const field = (label, f, get, set, parse, show, ml) => {
                const inp = el('input', { type: 'text', class: 'pi', 'data-f': f, inputmode: 'decimal', autocomplete: 'off', maxlength: String(ml), 'aria-label': label + ' ' + who() });
                inp.value = get() == null ? '' : show(get());
                inp.addEventListener('input', () => {
                    const v = parse(inp.value);
                    if (v === null) return;
                    set(v === '' ? null : v);
                    markDirty();
                    fillRowK(tr, s);
                    renderResult();
                });
                inp.addEventListener('change', () => {
                    const v = parse(inp.value);
                    if (v === null) {
                        inp.classList.add('bad');
                        setTimeout(() => inp.classList.remove('bad'), 900);
                        inp.value = get() == null ? '' : show(get());
                        announce('Ungültige Eingabe');
                    } else inp.value = v === '' ? '' : show(v);
                });
                inp.addEventListener('focus', () => inp.select());
                inp.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); moveFocus(tr, 1); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(tr, -1); }
                });
                return el('td', { class: 'g pc-in' }, [inp]);
            };
            const npShow = v => String(v);
            if (be) tr.append(field('BE', 'be', () => s.be, v => { s.be = v; }, KA.parsePoints, fmtT, 7));
            else a.afbNames.forEach((n, k) => tr.append(field(n, 'afb' + k, () => s.afb[k], v => { s.afb[k] = v; }, KA.parseNP, npShow, 2)));
            tr.append(el('td', { class: 'calc strong k-fach' }));
            tr.append(field('Sprachliche Notenpunkte', 'spr', () => s.spr, v => { s.spr = v; }, KA.parseNP, npShow, 2));
            tr.append(el('td', { class: 'calc strong k-ges' }));
            if (be) {
                const nb = el('button', { type: 'button', class: 'need-btn', 'aria-label': 'Benötigte BE für ' + who(), title: 'Benötigte BE anzeigen', text: 'BE?' });
                nb.addEventListener('click', () => showNeed(a, s));
                tr.append(el('td', { class: 'rm' }, [nb]));
            }
            const rm = el('button', { type: 'button', 'aria-label': 'Zeile ' + (i + 1) + ' entfernen', text: '×' });
            rm.addEventListener('click', async () => {
                if ((s.name || s.be != null || s.spr != null) && !(await confirmDialog('Zeile entfernen?', 'Die Zeile ' + (i + 1) + (s.name ? ' („' + s.name + '“)' : '') + ' wird mit ihren Punkten entfernt.', 'Entfernen'))) return;
                a.students = a.students.filter(x => x !== s);
                markDirty();
                renderTable();
                renderResult();
            });
            tr.append(el('td', { class: 'rm' }, [rm]));
            fillRowK(tr, s);
            tb.append(tr);
        });
        wrap.append(el('table', { class: 'nt nt-k' }, [el('thead', {}, [head, sub]), tb]));
        $('hint').textContent = a.students.length
            ? (be ? 'BE mit Komma oder Punkt eintragen, Notenpunkte als ganze Zahl von 0 bis 15. Eine Zeile zählt, sobald fachlicher und sprachlicher Teil eingetragen sind. „BE?“ zeigt, wie viele BE für welche Gesamt-Notenpunkte nötig gewesen wären.'
                : 'Notenpunkte als ganze Zahl von 0 bis 15 eintragen. Eine Zeile zählt, sobald alle drei Bereiche und der sprachliche Teil eingetragen sind.')
            : 'Noch keine Zeilen. Rechts unter „Schülerinnen und Schüler“ Namen eintragen, eine CSV- oder TXT-Datei importieren oder leere Zeilen für Nummern hinzufügen.';
    }

    // Was wäre im fachlichen Teil nötig gewesen? Abhängig von der sprachlichen Leistung der Person.
    function showNeed(a, s) {
        if (s.spr == null) { infoDialog('Sprachliche Notenpunkte fehlen', 'Bitte zuerst die sprachlichen Notenpunkte eintragen.'); return; }
        const t = KA.needTable(a, s.spr);
        const cur = KA.klausurRow(a, s).gesamt;
        const rows = [];
        for (let p = 15; p >= 1; p--) {
            const r = t[p];
            const tr = el('tr', { class: cur === p ? 'now' : '' }, [
                el('td', { text: String(p) }),
                el('td', { text: r ? String(r.fach) : '–' }),
                el('td', { text: r ? fmtT(r.be) : 'nicht erreichbar' })
            ]);
            rows.push(tr);
        }
        const body = el('div', { class: 'need-box' }, [
            el('p', { class: 'small-text', text: (s.name ? s.name + ': ' : '') + 'sprachlich ' + s.spr + ' Notenpunkte, fachlicher Anteil ' + fmtT(100 - a.wSpr) + ' % von ' + fmtT(a.beMax) + ' BE.' + (cur != null ? ' Erreicht: ' + cur + ' Gesamt-Notenpunkte.' : '') }),
            el('table', { class: 'need-table' }, [
                el('thead', {}, [el('tr', {}, [el('th', { text: 'Gesamt' }), el('th', { text: 'Fachlich (NP)' }), el('th', { text: 'Mindestens BE' })])]),
                el('tbody', {}, rows)
            ])
        ]);
        modal({ title: 'Benötigte BE', body: body, ok: 'Schließen', cancel: false });
    }

    function renderTable() {
        const wrap = $('tablewrap');
        wrap.textContent = '';
        const a = A();
        if (!a) return;
        if (isK(a)) { renderTableK(a); return; }
        const head = el('tr', {}, [el('th', { text: 'Nr.' })]);
        if (!a.useNumbers) head.append(el('th', { class: 'name', text: 'Name' }));
        head.append(el('th', { text: 'Punkte (von ' + fmtT(a.max) + ')' }), el('th', { text: '%' }), el('th', { text: 'Note' }), el('th', { 'aria-label': 'Zeile entfernen' }));
        const tb = el('tbody');
        a.students.forEach((s, i) => {
            const tr = el('tr', { 'data-sid': s.id });
            tr.append(el('td', { class: 'num', text: String(i + 1) }));
            if (!a.useNumbers) {
                const ni = el('input', { type: 'text', class: 'ni', maxlength: String(MAX_NAME), value: s.name, 'aria-label': 'Name ' + (i + 1), autocomplete: 'off' });
                ni.addEventListener('input', () => { s.name = ni.value.slice(0, MAX_NAME); markDirty(); });
                ni.addEventListener('change', () => { s.name = ni.value.replace(/\s+/g, ' ').trim(); ni.value = s.name; });
                tr.append(el('td', { class: 'name-in' }, [ni]));
            }
            const pi = el('input', { type: 'text', class: 'pi', inputmode: 'decimal', autocomplete: 'off', maxlength: '7', 'aria-label': 'Punkte ' + (a.useNumbers ? 'Nr. ' + (i + 1) : (s.name || 'Nr. ' + (i + 1))) });
            pi.value = s.pts == null ? '' : fmtT(s.pts);
            pi.addEventListener('input', () => {
                const v = KA.parsePoints(pi.value);
                if (v === null) return;
                s.pts = v === '' ? null : v;
                markDirty();
                fillRow(tr, s);
                renderResult();
            });
            pi.addEventListener('change', () => {
                const v = KA.parsePoints(pi.value);
                if (v === null) {
                    pi.classList.add('bad');
                    setTimeout(() => pi.classList.remove('bad'), 900);
                    pi.value = s.pts == null ? '' : fmtT(s.pts);
                    announce('Ungültige Eingabe');
                } else pi.value = v === '' ? '' : fmtT(v);
            });
            pi.addEventListener('focus', () => pi.select());
            pi.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); moveFocus(tr, 1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(tr, -1); }
            });
            tr.append(el('td', { class: 'g pc-in' }, [pi]));
            tr.append(el('td', { class: 'calc pc' }));
            tr.append(el('td', { class: 'calc strong nt-note' }));
            const rm = el('button', { type: 'button', 'aria-label': 'Zeile ' + (i + 1) + ' entfernen', text: '×' });
            rm.addEventListener('click', async () => {
                if ((s.name || s.pts != null) && !(await confirmDialog('Zeile entfernen?', 'Die Zeile ' + (i + 1) + (s.name ? ' („' + s.name + '“)' : '') + ' wird mit ihrer Punktzahl entfernt.', 'Entfernen'))) return;
                a.students = a.students.filter(x => x !== s);
                markDirty();
                renderTable();
                renderResult();
            });
            tr.append(el('td', { class: 'rm' }, [rm]));
            fillRow(tr, s);
            tb.append(tr);
        });
        wrap.append(el('table', { class: 'nt' }, [el('thead', {}, [head]), tb]));
        $('hint').textContent = a.students.length
            ? 'Punkte mit Komma oder Punkt eintragen. Leere Felder zählen nicht mit, zum Beispiel bei Fehlenden. Mit der Eingabetaste geht es zur nächsten Zeile.'
            : 'Noch keine Zeilen. Rechts unter „Schülerinnen und Schüler“ Namen eintragen, eine CSV- oder TXT-Datei importieren oder leere Zeilen für Nummern hinzufügen.';
    }

    function moveFocus(tr, d) {
        const nb = d > 0 ? tr.nextElementSibling : tr.previousElementSibling;
        if (!nb) return;
        const idx = Array.prototype.indexOf.call(tr.querySelectorAll('input.pi'), document.activeElement);
        const i = nb.querySelectorAll('input.pi')[Math.max(0, idx)];
        if (i) i.focus();
    }

    /* ---------- Auswertung ---------- */

    const evalA = a => (isK(a) ? KA.evaluateKlausur(a) : KA.evaluate(a));

    function renderResult() {
        const box = $('result');
        box.textContent = '';
        const a = A();
        if (!a) return;
        const ev = evalA(a);
        const K = isK(a);
        const grid = el('div', { class: 'result-grid' });
        const sp = el('div', { class: 'spiegel' + (K ? ' spiegel-k' : '') });
        const mx = Math.max(1, ...Object.values(ev.counts));
        const keys = K ? [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [1, 2, 3, 4, 5, 6];
        for (const n of keys) {
            const c = ev.counts[n];
            const pct = ev.n ? Math.round(c / ev.n * 100) : 0;
            const col = K ? npColor(n) : NOTE_COLORS[n];
            const fill = el('div', { class: 'sp-fill' });
            fill.style.width = (c / mx * 100) + '%';
            fill.style.background = col;
            const badge = el('div', { class: 'sp-note', text: String(n) });
            badge.style.background = col;
            const val = el('div', { class: 'sp-val', text: String(c) });
            val.append(el('small', { text: ' · ' + pct + ' %' }));
            sp.append(el('div', { class: 'sp-row' }, [badge, el('div', { class: 'sp-bar' }, [fill]), val]));
        }
        const left = el('div', {}, [el('h2', { text: (K ? 'Notenpunkte · ' : 'Notenspiegel · ') + a.name }), sp]);
        if (a.tend && !K) left.append(el('p', { class: 'small-text', text: 'Im Notenspiegel zählen Tendenzen zur ganzen Note (aus 2+ und 2- wird 2).' }));
        const avg = el('div', { class: 'avgbox' }, [
            el('div', { class: 'big', text: ev.avg == null ? '–' : fmt(ev.avg, 2) }),
            el('div', { class: 'lbl', text: K ? 'Notenpunkte-Durchschnitt' : 'Notendurchschnitt' }),
            el('div', { class: 'meta', text: ev.n + ' von ' + a.students.length + ' bewertet' + (K || ev.avgPts == null ? '' : ' · Ø ' + fmt(ev.avgPts, 1) + ' von ' + fmtT(a.max) + ' Punkten') })
        ]);
        grid.append(left, avg);
        box.append(grid);
    }

    /* ---------- JPEG ---------- */

    function drawSpiegel(a, ev) {
        const K = isK(a);
        const keys = K ? [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [1, 2, 3, 4, 5, 6];
        const rowH = K ? 38 : 74, rowBox = K ? 30 : 56, y0 = 160;
        const by = y0 + keys.length * rowH + 16;
        const W = 1200, H = by + 124 + 56, S = 2;
        const cv = document.createElement('canvas');
        cv.width = W * S; cv.height = H * S;
        const c = cv.getContext('2d');
        c.scale(S, S);
        const font = (w, px) => w + ' ' + px + 'px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#2c3e50'; c.fillRect(0, 0, W, 8);
        c.textBaseline = 'alphabetic';
        c.fillStyle = '#2c3e50'; c.font = font('700', 42);
        let title = a.name;
        while (c.measureText(title).width > W - 100 && title.length > 4) title = title.slice(0, -2);
        if (title !== a.name) title += '…';
        c.fillText(title, 50, 82);
        c.fillStyle = '#6b7885'; c.font = font('400', 22);
        c.fillText((K ? 'Notenpunkte · ' : 'Notenspiegel · ') + new Date().toLocaleDateString('de-DE') + (a.tend && !K ? ' · Tendenzen zählen zur ganzen Note' : ''), 50, 118);

        const mx = Math.max(1, ...Object.values(ev.counts));
        const x0 = 50, barX = 130, barW = 720;
        const fs1 = K ? 22 : 32, fs2 = K ? 20 : 30, fs3 = K ? 17 : 22, ty = K ? 22 : 40;
        keys.forEach((n, idx) => {
            const y = y0 + idx * rowH;
            const col = K ? npColor(n) : NOTE_COLORS[n];
            c.fillStyle = col;
            roundRect(c, x0, y, 62, rowBox, K ? 8 : 12); c.fill();
            c.fillStyle = '#fff'; c.font = font('700', fs1); c.textAlign = 'center';
            c.fillText(String(n), x0 + 31, y + ty);
            c.textAlign = 'left';
            c.fillStyle = '#e4e9ee'; roundRect(c, barX + 20, y, barW, rowBox, K ? 8 : 12); c.fill();
            const cnt = ev.counts[n];
            if (cnt > 0) {
                c.fillStyle = col;
                roundRect(c, barX + 20, y, Math.max(24, barW * cnt / mx), rowBox, K ? 8 : 12); c.fill();
            }
            c.fillStyle = '#2c3e50'; c.font = font('700', fs2);
            c.fillText(String(cnt), barX + 20 + barW + 24, y + ty);
            c.fillStyle = '#6b7885'; c.font = font('400', fs3);
            c.fillText((ev.n ? Math.round(cnt / ev.n * 100) : 0) + ' %', barX + 20 + barW + 24 + 56, y + ty - 2);
        });
        // Durchschnitt
        c.fillStyle = '#2c3e50'; roundRect(c, 50, by, W - 100, 124, 16); c.fill();
        c.fillStyle = '#cfd8e1'; c.font = font('400', 22);
        c.fillText(K ? 'Notenpunkte-Durchschnitt' : 'Notendurchschnitt', 80, by + 40);
        c.fillStyle = '#ffffff'; c.font = font('800', 52);
        c.fillText(ev.avg == null ? '–' : fmt(ev.avg, 2), 80, by + 94);
        c.textAlign = 'right'; c.fillStyle = '#e8eef4'; c.font = font('400', 24);
        c.fillText(ev.n + ' von ' + a.students.length + ' bewertet', W - 80, by + 50);
        if (!K && ev.avgPts != null) c.fillText('Ø ' + fmt(ev.avgPts, 1) + ' von ' + fmtT(a.max) + ' Punkten', W - 80, by + 90);
        c.textAlign = 'left';
        return cv;
    }

    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    $('jpg').addEventListener('click', () => {
        const a = A();
        if (!a) return;
        const cv = drawSpiegel(a, evalA(a));
        cv.toBlob(blob => {
            if (!blob) { infoDialog('JPEG nicht erstellt', 'Das Bild konnte nicht erzeugt werden.'); return; }
            saveBytes(blob, 'Notenspiegel-' + safeName(a.name) + '-' + today() + '.jpg', 'image/jpeg');
        }, 'image/jpeg', 0.92);
    });

    /* ---------- Noten für den Notenrechner ---------- */

    $('grades-file').addEventListener('click', () => {
        const a = A();
        if (!a) return;
        if (a.useNumbers) { infoDialog('Nur mit Namen möglich', 'Die Noten lassen sich nur mit Namen weitergeben, weil der Notenrechner sie darüber zuordnet. Stellen Sie unter „Arbeit“ die Anzeige auf Namen um.'); return; }
        const ev = evalA(a);
        const grades = [];
        a.students.forEach((s, i) => {
            if (isK(a)) {
                const p = ev.rows[i].gesamt;
                if (p != null && s.name.trim()) grades.push({ name: s.name.trim(), note: KA.npLabel(p), points: p });
                return;
            }
            const g = ev.rows[i].grade;
            if (g != null && s.name.trim()) grades.push({ name: s.name.trim(), note: g });
        });
        if (!grades.length) { infoDialog('Keine Noten vorhanden', 'Es gibt noch keine Person mit Namen und vollständigen Punkten.'); return; }
        const data = { format: 'teachtools-noten', version: 1, name: a.name, tend: isK(a) ? true : !!a.tend, grades: grades };
        saveBytes(JSON.stringify(data), 'Noten-' + safeName(a.name) + '-' + today() + '.json', 'application/json');
    });

    /* ---------- PDF ---------- */

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Skript nicht ladbar'));
            document.head.append(s);
        });
    }
    let exportReady = null;
    $('pdf').addEventListener('click', async () => {
        const a = A();
        if (!a) return;
        const btn = $('pdf');
        btn.disabled = true;
        try {
            if (!exportReady) exportReady = loadScript('export.js');
            await exportReady;
            const bytes = isK(a) ? await window.KAExport.buildKlausur(a, KA.evaluateKlausur(a)) : await window.KAExport.build(a, KA.evaluate(a));
            saveBytes(bytes, 'Auswertung-' + safeName(a.name) + '-' + today() + '.pdf', 'application/pdf');
        } catch (err) {
            exportReady = null;
            infoDialog('PDF nicht erstellt', 'Beim Erstellen der PDF ist ein Fehler aufgetreten. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.');
        }
        btn.disabled = false;
    });

    $('bedarf').addEventListener('click', async () => {
        const a = A();
        if (!a || !isK(a) || a.variant !== 'be') return;
        const btn = $('bedarf');
        btn.disabled = true;
        try {
            if (!exportReady) exportReady = loadScript('export.js');
            await exportReady;
            const bytes = await window.KAExport.buildBedarf(a);
            saveBytes(bytes, 'BE-Uebersicht-' + safeName(a.name) + '-' + today() + '.pdf', 'application/pdf');
        } catch (err) {
            exportReady = null;
            infoDialog('PDF nicht erstellt', 'Beim Erstellen der PDF ist ein Fehler aufgetreten. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.');
        }
        btn.disabled = false;
    });

    /* ---------- Start ---------- */

    function renderAll() {
        renderTabs();
        const has = works.length > 0;
        $('empty').hidden = has;
        $('main').hidden = !has;
        ['det-arbeit', 'det-key', 'det-names'].forEach(id => { $(id).hidden = !has; });
        const a = A();
        $('bedarf').hidden = !(isK(a) && a.variant === 'be');
        $('det-key').hidden = !has || (isK(a) && a.variant === 'ab');
        $('det-key').querySelector('summary').textContent = isK(a) ? 'Notenpunkte aus BE' : 'Notenschlüssel';
        renderArbeit();
        renderKey();
        renderTable();
        renderResult();
        updateStatus();
    }

    function init() {
        autoOn = lsGet(LS_AUTO) === '1';
        $('auto-save').checked = autoOn;
        const stored = lsGet(LS_KEY);
        if (stored) {
            try {
                const list = sanitize(JSON.parse(stored));
                if (list) { works = list; savedOnce = true; statusNote = 'Gespeicherte Daten geladen'; }
            } catch (e) { /* beschädigt: ignorieren */ }
        }
        const wide = window.matchMedia('(min-width: 1000px)').matches;
        document.querySelectorAll('.side details').forEach(d => { d.open = wide; });
        renderAll();
    }

    init();
})();
