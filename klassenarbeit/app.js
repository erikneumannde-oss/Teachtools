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
                if (input) { const v = input.value.replace(/\s+/g, ' ').trim(); close(v || null); } else close(true);
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

    function newWork(name) {
        return {
            id: uid(), name: name, max: 30, tend: true, useNumbers: false, unit: 'percent', tendEdited: false,
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
            a.unit = src.unit === 'points' ? 'points' : 'percent';
            a.tendEdited = src.tendEdited === true;
            const okArr = (arr, n) => Array.isArray(arr) && arr.length === n && arr.every(v => num(v) && v >= 0 && v <= 10000);
            if (src.thr && okArr(src.thr.plain, 5)) a.thr.plain = src.thr.plain.map(KA.round2);
            if (src.thr && okArr(src.thr.tend, 15)) a.thr.tend = src.thr.tend.map(KA.round2);
            (Array.isArray(src.students) ? src.students : []).slice(0, MAX_STUDENTS).forEach(s => {
                if (!s || typeof s !== 'object') return;
                a.students.push({ id: uid(), name: cleanStr(s.name, MAX_NAME), pts: num(s.pts) && s.pts >= 0 && s.pts <= 9999 ? KA.round2(s.pts) : null });
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
        const name = await promptDialog('Neue Arbeit', '');
        if (!name) return;
        works.push(newWork(name.slice(0, MAX_NAME)));
        cur = works.length - 1;
        markDirty();
        renderAll();
        $('det-arbeit').open = true;
        $('det-key').open = true;
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

    function renderKey() {
        const box = $('key-settings');
        box.textContent = '';
        const a = A();
        if (!a) return;
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
            if (a.students.length < MAX_STUDENTS) { a.students.push({ id: uid(), name: n, pts: null }); added++; }
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

    function renderTable() {
        const wrap = $('tablewrap');
        wrap.textContent = '';
        const a = A();
        if (!a) return;
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
        if (nb) { const i = nb.querySelector('input.pi'); if (i) i.focus(); }
    }

    /* ---------- Auswertung ---------- */

    function renderResult() {
        const box = $('result');
        box.textContent = '';
        const a = A();
        if (!a) return;
        const ev = KA.evaluate(a);
        const grid = el('div', { class: 'result-grid' });
        const sp = el('div', { class: 'spiegel' });
        const mx = Math.max(1, ...Object.values(ev.counts));
        for (let n = 1; n <= 6; n++) {
            const c = ev.counts[n];
            const pct = ev.n ? Math.round(c / ev.n * 100) : 0;
            const fill = el('div', { class: 'sp-fill' });
            fill.style.width = (c / mx * 100) + '%';
            fill.style.background = NOTE_COLORS[n];
            const badge = el('div', { class: 'sp-note', text: String(n) });
            badge.style.background = NOTE_COLORS[n];
            const val = el('div', { class: 'sp-val', text: String(c) });
            val.append(el('small', { text: ' · ' + pct + ' %' }));
            sp.append(el('div', { class: 'sp-row' }, [badge, el('div', { class: 'sp-bar' }, [fill]), val]));
        }
        const left = el('div', {}, [el('h2', { text: 'Notenspiegel · ' + a.name }), sp]);
        if (a.tend) left.append(el('p', { class: 'small-text', text: 'Im Notenspiegel zählen Tendenzen zur ganzen Note (aus 2+ und 2- wird 2).' }));
        const avg = el('div', { class: 'avgbox' }, [
            el('div', { class: 'big', text: ev.avg == null ? '–' : fmt(ev.avg, 2) }),
            el('div', { class: 'lbl', text: 'Notendurchschnitt' }),
            el('div', { class: 'meta', text: ev.n + ' von ' + a.students.length + ' bewertet' + (ev.avgPts == null ? '' : ' · Ø ' + fmt(ev.avgPts, 1) + ' von ' + fmtT(a.max) + ' Punkten') })
        ]);
        grid.append(left, avg);
        box.append(grid);
    }

    /* ---------- JPEG ---------- */

    function drawSpiegel(a, ev) {
        const W = 1200, H = 800, S = 2;
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
        c.fillText('Notenspiegel · ' + new Date().toLocaleDateString('de-DE') + (a.tend ? ' · Tendenzen zählen zur ganzen Note' : ''), 50, 118);

        const mx = Math.max(1, ...Object.values(ev.counts));
        const x0 = 50, barX = 130, barW = 720, rowH = 74, y0 = 160;
        for (let n = 1; n <= 6; n++) {
            const y = y0 + (n - 1) * rowH;
            c.fillStyle = NOTE_COLORS[n];
            roundRect(c, x0, y, 62, 56, 12); c.fill();
            c.fillStyle = '#fff'; c.font = font('700', 32); c.textAlign = 'center';
            c.fillText(String(n), x0 + 31, y + 40);
            c.textAlign = 'left';
            c.fillStyle = '#e4e9ee'; roundRect(c, barX + 20, y, barW, 56, 12); c.fill();
            const cnt = ev.counts[n];
            if (cnt > 0) {
                c.fillStyle = NOTE_COLORS[n];
                roundRect(c, barX + 20, y, Math.max(24, barW * cnt / mx), 56, 12); c.fill();
            }
            c.fillStyle = '#2c3e50'; c.font = font('700', 30);
            c.fillText(String(cnt), barX + 20 + barW + 24, y + 40);
            c.fillStyle = '#6b7885'; c.font = font('400', 22);
            c.fillText((ev.n ? Math.round(cnt / ev.n * 100) : 0) + ' %', barX + 20 + barW + 24 + 56, y + 38);
        }
        // Durchschnitt
        const by = 620;
        c.fillStyle = '#2c3e50'; roundRect(c, 50, by, W - 100, 124, 16); c.fill();
        c.fillStyle = '#cfd8e1'; c.font = font('400', 22);
        c.fillText('Notendurchschnitt', 80, by + 40);
        c.fillStyle = '#ffffff'; c.font = font('800', 52);
        c.fillText(ev.avg == null ? '–' : fmt(ev.avg, 2), 80, by + 94);
        c.textAlign = 'right'; c.fillStyle = '#e8eef4'; c.font = font('400', 24);
        c.fillText(ev.n + ' von ' + a.students.length + ' bewertet', W - 80, by + 50);
        if (ev.avgPts != null) c.fillText('Ø ' + fmt(ev.avgPts, 1) + ' von ' + fmtT(a.max) + ' Punkten', W - 80, by + 90);
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
        const cv = drawSpiegel(a, KA.evaluate(a));
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
        const ev = KA.evaluate(a);
        const grades = [];
        a.students.forEach((s, i) => {
            const g = ev.rows[i].grade;
            if (g != null && s.name.trim()) grades.push({ name: s.name.trim(), note: g });
        });
        if (!grades.length) { infoDialog('Keine Noten vorhanden', 'Es gibt noch keine Person mit Namen und Punkten.'); return; }
        const data = { format: 'teachtools-noten', version: 1, name: a.name, tend: !!a.tend, grades: grades };
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
            const bytes = await window.KAExport.build(a, KA.evaluate(a));
            saveBytes(bytes, 'Auswertung-' + safeName(a.name) + '-' + today() + '.pdf', 'application/pdf');
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
