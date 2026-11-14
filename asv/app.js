/* ASV-Blätter: Klassenleitungsmodus (Schüler, Angaben, Einschätzungen des Kollegiums, Kreuze, PDF/Word) und Kollegiumsmodus (Einschätzungen abgeben).
   Alles bleibt im Speicher des Browsers. Gespeichert wird nur, was ausdrücklich als Datei heruntergeladen wird. */
(function () {
    'use strict';
    const { CRIT, LEVELS, normBirth } = window.ASVData;
    const $ = id => document.getElementById(id);
    const MAX = 250, MAX_NAME = 80, NC = CRIT.length;
    const F_KLASSE = 'asv-klasse', F_EINSCH = 'asv-einschaetzung';

    let students = [];
    let klasse = '';
    let step = 1;
    let cur = null; // Kind im Formular (Klassenleitung)
    const info = { half: '', stufe: '', date: '', head: '', klass: '' };
    let mode = 'kl';

    function uid() {
        try { return Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join(''); }
        catch (e) { return (Math.random().toString(16) + Math.random().toString(16)).replace(/\./g, '').slice(0, 16); }
    }
    function el(tag, attrs, kids) {
        const e = document.createElement(tag);
        Object.keys(attrs || {}).forEach(k => {
            if (k === 'text') e.textContent = attrs[k];
            else e.setAttribute(k, attrs[k]);
        });
        (kids || []).forEach(c => e.append(c));
        return e;
    }
    const announce = t => { $('live').textContent = ''; setTimeout(() => { $('live').textContent = t; }, 30); };
    const levelName = k => (LEVELS[k][0] ? LEVELS[k][0] + ' ' : '') + LEVELS[k][1];
    const fmt1 = x => (Math.round(x * 100) / 100).toString().replace('.', ',');

    function dialog(title, text, list) {
        return new Promise(resolve => {
            const root = $('modal-root');
            const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
            box.append(el('h2', { text: title }), el('p', { text: text }));
            if (list && list.length) box.append(el('ul', {}, list.map(t => el('li', { text: t }))));
            const ok = el('button', { type: 'button', class: 'btn primary', text: 'OK' });
            box.append(el('div', { class: 'modal-actions' }, [ok]));
            root.textContent = '';
            root.append(box);
            root.hidden = false;
            const done = () => { root.hidden = true; root.textContent = ''; document.removeEventListener('keydown', key, true); resolve(); };
            const key = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(); } };
            document.addEventListener('keydown', key, true);
            ok.addEventListener('click', done);
            ok.focus();
        });
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Skript nicht ladbar: ' + src));
            document.head.append(s);
        });
    }
    const loaded = {};
    const need = (key, src, test) => test() ? Promise.resolve() : (loaded[key] || (loaded[key] = loadScript(src).catch(e => { delete loaded[key]; throw e; })));

    function saveBytes(data, name, type) {
        const url = URL.createObjectURL(new Blob([data], { type: type }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    const safe = s => String(s || '').trim().replace(/[^A-Za-z0-9ÄÖÜäöüß_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

    /* ---------- Gemeinsam: Bogen zum Ankreuzen ---------- */

    function renderBogen(t, marks) {
        t.textContent = '';
        const head = el('tr', {}, [el('th', { class: 'bg-lab', scope: 'col', text: '' })]);
        LEVELS.forEach((l, k) => head.append(el('th', { scope: 'col', text: levelName(k) })));
        t.append(el('thead', {}, [head]));
        const body = el('tbody');
        CRIT.forEach((c, i) => {
            const lab = el('th', { class: 'bg-lab', scope: 'row' }, [el('b', { text: c.t })].concat(c.l.map(x => el('span', { text: x }))));
            const tr = el('tr', {}, [lab]);
            LEVELS.forEach((l, k) => {
                const b = el('button', { type: 'button', class: 'cell', 'aria-pressed': String(marks[i] === k), 'aria-label': c.t + ': ' + levelName(k) }, [el('span', { class: 'box' })]);
                b.addEventListener('click', () => {
                    marks[i] = marks[i] === k ? -1 : k;
                    tr.querySelectorAll('.cell').forEach((x, j) => x.setAttribute('aria-pressed', String(marks[i] === j)));
                });
                const td = el('td', {}, [b]);
                td.addEventListener('click', e => { if (e.target === td) b.click(); });
                tr.append(td);
            });
            body.append(tr);
        });
        t.append(body);
    }
    const doneCount = marks => marks.filter(m => m >= 0).length;

    /* ---------- Dateien lesen und prüfen ---------- */

    async function readJsonFile(f) {
        if (f.size > 2 * 1024 * 1024) throw new Error('zu groß');
        const buf = await f.arrayBuffer();
        return JSON.parse(new TextDecoder('utf-8').decode(buf).replace(/^﻿/, ''));
    }
    const cleanStr = (s, n) => typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '';
    function cleanMarks(m) {
        const out = [];
        for (let i = 0; i < NC; i++) {
            const v = Array.isArray(m) ? m[i] : -1;
            out.push(Number.isInteger(v) && v >= 0 && v < 4 ? v : -1);
        }
        return out;
    }
    // Prüft eine Datei der Klassenleitung (asv-klasse) oder des Kollegiums (asv-einschaetzung)
    function sanitizeFile(raw) {
        if (!raw || typeof raw !== 'object' || (raw.format !== F_KLASSE && raw.format !== F_EINSCH) || raw.version !== 1 || !Array.isArray(raw.students)) return null;
        const seen = new Set();
        const list = [];
        raw.students.slice(0, MAX).forEach(s => {
            if (!s || typeof s !== 'object') return;
            const name = cleanStr(s.name, MAX_NAME);
            if (!name) return;
            let id = typeof s.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(s.id) && !seen.has(s.id) ? s.id : uid();
            seen.add(id);
            list.push({ id: id, name: name, birth: normBirth(cleanStr(s.b, 10)), marks: cleanMarks(s.m) });
        });
        if (!list.length) return null;
        const inf = raw.info && typeof raw.info === 'object' ? raw.info : {};
        const clInfo = {
            half: inf.half === '1' || inf.half === '2' ? inf.half : '',
            stufe: ['7', '8', '9', '10'].includes(inf.stufe) ? inf.stufe : '',
            date: typeof inf.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inf.date) ? inf.date : '',
            head: cleanStr(inf.head, 60), klass: cleanStr(inf.klass, 60)
        };
        return { type: raw.format, klasse: cleanStr(raw.klasse, 30), von: cleanStr(raw.von, 60), students: list, info: clInfo };
    }

    /* ---------- Moduswechsel ---------- */

    function setMode(m) {
        mode = m;
        $('start').hidden = m !== 'start';
        $('kl').hidden = m !== 'kl';
        $('kg').hidden = m !== 'kg';
        $('modebar').hidden = m === 'start';
        $('mode-label').textContent = m === 'kl' ? 'Modus: Klassenleitung' : m === 'kg' ? 'Modus: Kollegium' : '';
        window.scrollTo(0, 0);
    }
    document.querySelectorAll('.startcard').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    $('mode-switch').addEventListener('click', () => setMode('start'));

    /* =====================================================================
       KLASSENLEITUNG
       ===================================================================== */

    function show(n) {
        step = n;
        ['s1', 's2', 's3', 's4'].forEach((id, i) => { $(id).hidden = i + 1 !== n; });
        document.querySelectorAll('.step').forEach(b => {
            if (Number(b.dataset.step) === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        });
        if (n === 3) renderRatings();
        if (n === 4) { cur = null; renderOverview(); }
        window.scrollTo(0, 0);
    }

    function problemsStudents() {
        const out = [];
        if (!klasse.trim()) out.push('Klassenbezeichnung');
        if (!students.length) out.push('Mindestens eine Person in der Liste');
        else if (students.some(s => !s.name.trim())) out.push('Ein Name fehlt in der Liste');
        return out;
    }
    function problemsInfo() {
        const out = [];
        if (!info.half) out.push('Schulhalbjahr');
        if (!info.stufe) out.push('Jahrgangsstufe');
        if (!info.date) out.push('Datum der Ausstellung');
        if (!info.head.trim()) out.push('Name der Schulleitung');
        if (!info.klass.trim()) out.push('Name der Klassenleitung');
        return out;
    }
    async function goto(n) {
        if (n >= 2) {
            const p = problemsStudents();
            if (p.length) { await dialog('Es fehlen noch Angaben', 'Bitte ergänzen Sie:', p); show(1); return false; }
        }
        if (n >= 3) {
            const p = problemsInfo();
            if (p.length) { await dialog('Es fehlen noch Angaben', 'Bitte ergänzen Sie:', p); show(2); return false; }
        }
        if (n >= 4 && !(await applyRatings())) { show(3); return false; }
        show(n);
        return true;
    }
    document.querySelectorAll('.step').forEach(b => b.addEventListener('click', () => goto(Number(b.dataset.step))));
    $('to2').addEventListener('click', () => goto(2));
    $('to3').addEventListener('click', () => goto(3));
    $('to4').addEventListener('click', () => goto(4));
    $('back1').addEventListener('click', () => show(1));
    $('back3').addEventListener('click', () => show(3));
    $('back3b').addEventListener('click', () => show(2));

    /* ---------- Schritt 1: Namen ---------- */

    function newStudent(name, birth) {
        return { id: uid(), name: name, birth: birth, marks: CRIT.map(() => -1) };
    }

    const DATE_RE = /(\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})|\d{4}-\d{1,2}-\d{1,2})/;
    function clean(s) { return s.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').slice(0, MAX_NAME); }

    function splitRow(line, d) {
        const out = [];
        let cell = '', q = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { if (q && line[i + 1] === '"') { cell += '"'; i++; } else q = !q; }
            else if (c === d && !q) { out.push(cell); cell = ''; }
            else cell += c;
        }
        out.push(cell);
        return out.map(clean);
    }

    function swapComma(name, order) {
        const m = order === 'nv' && /^([^,]+),([^,]+)$/.exec(name);
        return m ? m[2].trim() + ' ' + m[1].trim() : name;
    }

    function parseText(text, order) {
        const lines = text.replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) return [];
        const count = (s, c) => s.split(c).length - 1;
        let delim = null;
        [';', '\t', ','].forEach(c => { if (!delim && count(lines[0], c) > 0) delim = c; });
        if (!delim) [';', '\t', ','].forEach(c => { if (!delim && lines.some(l => count(l, c) > 0)) delim = c; });
        const rows = lines.map(l => delim ? splitRow(l, delim) : [clean(l)]);
        let cols = null;
        const h = rows[0].map(c => c.toLowerCase());
        if (rows.length > 1 && !h.some(c => DATE_RE.test(c)) && h.some(c => /name|geb/.test(c))) {
            cols = {
                first: h.findIndex(c => /^(vorname|rufname)/.test(c)),
                last: h.findIndex(c => /^(nachname|familienname)/.test(c)),
                full: h.findIndex(c => /^(name|sch[üu]ler|sch[üu]lername|sch[üu]lerin)/.test(c)),
                birth: h.findIndex(c => /geb/.test(c))
            };
            rows.shift();
        }
        const out = [];
        rows.forEach(r => {
            let name = '', birth = '';
            if (cols && (cols.first >= 0 || cols.last >= 0 || cols.full >= 0)) {
                const first = cols.first >= 0 ? r[cols.first] || '' : '', last = cols.last >= 0 ? r[cols.last] || '' : '';
                name = first || last ? (first + ' ' + last).trim() : (r[cols.full] || '');
                if (!(first || last)) name = swapComma(name, order);
                birth = cols.birth >= 0 ? r[cols.birth] || '' : '';
                if (!birth) { const f = r.find(c => DATE_RE.test(c)); if (f) birth = DATE_RE.exec(f)[1]; }
            } else {
                const texts = [];
                r.forEach(c => {
                    const m = DATE_RE.exec(c);
                    if (m && !birth) {
                        birth = m[1];
                        const rest = clean(c.replace(m[1], ''));
                        if (rest) texts.push(rest);
                    } else if (c) texts.push(c);
                });
                if (texts.length === 2 && order === 'nv') name = texts[1] + ' ' + texts[0];
                else if (texts.length === 1) name = swapComma(texts[0], order);
                else name = texts.join(' ');
            }
            name = clean(name);
            if (name) out.push({ name: name, birth: normBirth(birth) });
        });
        return out;
    }

    function addPeople(list) {
        let added = 0;
        list.forEach(p => {
            if (students.length < MAX) { students.push(newStudent(p.name, p.birth)); added++; }
        });
        renderPeople();
        announce(added + ' Personen hinzugefügt');
        if (added < list.length) dialog('Höchstgrenze erreicht', 'Es sind höchstens ' + MAX + ' Personen möglich.');
    }

    function renderPeople() {
        const box = $('people');
        box.textContent = '';
        students.forEach((s, i) => {
            const name = el('input', { type: 'text', class: 'field', maxlength: String(MAX_NAME), autocomplete: 'off', 'aria-label': 'Name ' + (i + 1), placeholder: 'Vorname Nachname' });
            name.value = s.name;
            name.addEventListener('input', () => { s.name = name.value; });
            const birth = el('input', { type: 'text', class: 'field', maxlength: '10', autocomplete: 'off', inputmode: 'numeric', 'aria-label': 'Geburtstag ' + (i + 1), placeholder: 'TT.MM.JJJJ' });
            birth.value = s.birth;
            birth.addEventListener('input', () => { s.birth = birth.value; });
            birth.addEventListener('blur', () => { s.birth = normBirth(birth.value); birth.value = s.birth; });
            const del = el('button', { type: 'button', class: 'btn small icon danger', 'aria-label': 'Zeile ' + (i + 1) + ' entfernen', title: 'Entfernen', text: '×' });
            del.addEventListener('click', () => { students = students.filter(x => x !== s); renderPeople(); });
            box.append(el('div', { class: 'person' }, [el('span', { class: 'nr', text: String(i + 1) }), name, birth, del]));
        });
        $('empty-list').hidden = students.length > 0;
        $('count').textContent = students.length ? students.length + (students.length === 1 ? ' Person' : ' Personen') : '';
        $('clear-all').disabled = !students.length;
    }

    $('klasse').addEventListener('input', () => { klasse = $('klasse').value; });

    function choose(title, text, okLabel) {
        return new Promise(resolve => {
            const root = $('modal-root');
            const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
            const ok = el('button', { type: 'button', class: 'btn primary', text: okLabel });
            const no = el('button', { type: 'button', class: 'btn', text: 'Abbrechen' });
            box.append(el('h2', { text: title }), el('p', { text: text }), el('div', { class: 'modal-actions' }, [no, ok]));
            root.textContent = '';
            root.append(box);
            root.hidden = false;
            const done = v => { root.hidden = true; root.textContent = ''; document.removeEventListener('keydown', key, true); resolve(v); };
            const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } };
            document.addEventListener('keydown', key, true);
            ok.addEventListener('click', () => done(true));
            no.addEventListener('click', () => done(false));
            no.focus();
        });
    }
    $('kl-load').addEventListener('click', () => $('kl-input').click());
    $('kl-input').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        let d = null;
        try { d = sanitizeFile(await readJsonFile(f)); } catch (err) { d = null; }
        if (!d || d.type !== F_KLASSE) {
            await dialog('Datei nicht passend', 'Das ist keine Datei der Klassenleitung. Gesucht ist die Datei, die in Schritt 2 für das Kollegium erzeugt wurde.');
            return;
        }
        if (students.length && !(await choose('Bisherige Eingaben ersetzen?', 'Die Liste und die Angaben werden durch den Inhalt der Datei ersetzt. Geladene Einschätzungen werden entfernt.', 'Ersetzen'))) return;
        klasse = d.klasse;
        $('klasse').value = klasse;
        students = d.students.map(s => ({ id: s.id, name: s.name, birth: s.birth, marks: CRIT.map(() => -1) }));
        ratings = []; ties = {}; lastSig = '';
        [['i-half', 'half'], ['i-stufe', 'stufe'], ['i-date', 'date'], ['i-head', 'head'], ['i-klass', 'klass']].forEach(p => {
            if (d.info[p[1]]) { info[p[1]] = d.info[p[1]]; $(p[0]).value = d.info[p[1]]; }
        });
        renderPeople();
        announce('Datei geladen: Klasse ' + klasse + ', ' + students.length + ' Personen');
        const missing = d.students.some(s => !s.birth) ? ' Geburtstage fehlen in der Datei, sie lassen sich in der Liste ergänzen.' : '';
        await dialog('Datei geladen', 'Klasse ' + klasse + ' mit ' + students.length + (students.length === 1 ? ' Person' : ' Personen') + ' wurde geladen.' + missing);
    });
    $('paste-add').addEventListener('click', () => {
        const list = parseText($('paste').value, $('csv-order').value);
        if (!list.length) { $('paste').focus(); return; }
        addPeople(list);
        $('paste').value = '';
    });
    $('csv-btn').addEventListener('click', () => $('csv-input').click());
    $('csv-input').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            const buf = await f.arrayBuffer();
            let text;
            try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
            catch (err) { text = new TextDecoder('windows-1252').decode(buf); }
            const list = parseText(text, $('csv-order').value);
            if (!list.length) { dialog('Keine Namen gefunden', 'Die Datei enthält keine Namen.'); return; }
            addPeople(list);
        } catch (err) {
            dialog('Datei nicht lesbar', 'Die Datei konnte nicht gelesen werden.');
        }
    });
    $('add-row').addEventListener('click', () => {
        if (students.length >= MAX) return;
        students.push(newStudent('', ''));
        renderPeople();
        const f = $('people').querySelectorAll('.person');
        f[f.length - 1].querySelector('input').focus();
    });
    $('clear-all').addEventListener('click', () => { students = []; ratings = []; ties = {}; renderPeople(); });

    /* ---------- Schritt 2: Angaben ---------- */

    [['i-half', 'half'], ['i-stufe', 'stufe'], ['i-date', 'date'], ['i-head', 'head'], ['i-klass', 'klass']].forEach(p => {
        const f = $(p[0]);
        const upd = () => { info[p[1]] = f.value; };
        f.addEventListener('input', upd);
        f.addEventListener('change', upd);
    });

    /* ---------- Schritt 3: Einschätzungen des Kollegiums ---------- */

    let ratings = [];   // { fid, von, klasse, students:[{id,name,marks}] }
    let ties = {};      // "kindId|bereich" -> 'b' (besser) oder 's' (schlechter)
    let fidNext = 1;
    let lastSig = '';

    function findStudent(r) {
        const byId = students.find(s => s.id === r.id);
        if (byId) return byId;
        const norm = x => x.toLowerCase().replace(/\s+/g, ' ').trim();
        const same = students.filter(s => norm(s.name) === norm(r.name));
        return same.length === 1 ? same[0] : null;
    }

    // Wertet alle geladenen Dateien aus. Stufen zählen intern 1 (sehr ausgeprägt) bis 4 (gering ausgeprägt).
    function compute() {
        const map = new Map();
        students.forEach(s => map.set(s.id, CRIT.map(() => ({ vals: [] }))));
        let unmatched = 0;
        ratings.forEach(f => f.students.forEach(r => {
            const s = findStudent(r);
            if (!s) { if (doneCount(r.marks)) unmatched++; return; }
            r.marks.forEach((m, i) => { if (m >= 0) map.get(s.id)[i].vals.push(m + 1); });
        }));
        map.forEach((arr, sid) => arr.forEach((c, i) => {
            const k = c.vals.length;
            c.n = k;
            if (!k) { c.grade = null; c.tie = false; return; }
            const sum = c.vals.reduce((a, b) => a + b, 0);
            c.avg = sum / k;
            const lo = Math.floor(sum / k), rem = sum - lo * k;
            if (2 * rem < k) { c.grade = lo; c.tie = false; }
            else if (2 * rem > k) { c.grade = lo + 1; c.tie = false; }
            else {
                c.tie = true; c.lo = lo;
                const d = ties[sid + '|' + i];
                c.grade = d === 'b' ? lo : d === 's' ? lo + 1 : null;
            }
        }));
        return { map: map, unmatched: unmatched };
    }
    const openTies = res => {
        const out = [];
        students.forEach(s => res.map.get(s.id).forEach((c, i) => { if (c.tie && c.grade == null) out.push({ s: s, i: i, c: c }); }));
        return out;
    };
    const allTies = res => {
        const out = [];
        students.forEach(s => res.map.get(s.id).forEach((c, i) => { if (c.tie) out.push({ s: s, i: i, c: c }); }));
        return out;
    };

    async function addRatingFiles(files) {
        const problems = [];
        let added = 0, newTies = false;
        for (const f of files) {
            try {
                const d = sanitizeFile(await readJsonFile(f));
                if (!d || d.type !== F_EINSCH) { problems.push(f.name + ': keine Einschätzungsdatei aus dem Kollegiumsmodus'); continue; }
                if (klasse.trim() && d.klasse && d.klasse.toLowerCase() !== klasse.trim().toLowerCase()) {
                    problems.push(f.name + ': gehört zur Klasse ' + d.klasse + ', nicht zur Klasse ' + klasse.trim());
                    continue;
                }
                ratings.push({ fid: fidNext++, von: d.von, klasse: d.klasse, students: d.students, name: f.name });
                added++;
            } catch (e) { problems.push(f.name + ': Datei nicht lesbar'); }
        }
        renderRatings();
        if (added) announce(added + ' Dateien geladen');
        if (problems.length) await dialog('Nicht alle Dateien konnten geladen werden', 'Diese Dateien wurden übersprungen:', problems);
        if (added) {
            const res = compute();
            const n = openTies(res).length;
            if (n) newTies = true;
            if (res.unmatched) await dialog('Nicht zugeordnet', 'Bei einigen Einschätzungen konnte kein Kind in Ihrer Liste gefunden werden (' + res.unmatched + '). Sie fließen nicht ein. Das passiert, wenn die Datei zu einer anderen Fassung der Liste gehört.');
        }
        if (newTies) {
            const n = openTies(compute()).length;
            await dialog('Entscheidung nötig', 'In ' + n + (n === 1 ? ' Fall liegt' : ' Fällen liegt') + ' der Durchschnitt genau zwischen zwei Stufen. Bitte entscheiden Sie unten, ob die bessere oder die schlechtere Aussage angekreuzt werden soll.');
        }
    }

    function renderRatings() {
        // Liste der Dateien
        const box = $('rfiles');
        box.textContent = '';
        ratings.forEach(f => {
            const n = f.students.filter(r => doneCount(r.marks)).length;
            const label = (f.von || 'ohne Namen') + ' · ' + n + (n === 1 ? ' Kind eingeschätzt' : ' Kinder eingeschätzt');
            const x = el('button', { type: 'button', class: 'btn small icon danger', 'aria-label': 'Datei ' + label + ' entfernen', title: 'Entfernen', text: '×' });
            x.addEventListener('click', () => { ratings = ratings.filter(r => r !== f); renderRatings(); });
            box.append(el('div', { class: 'rfile' }, [el('span', { text: label }), x]));
        });
        $('rempty').hidden = ratings.length > 0;
        $('rres').hidden = !ratings.length;
        if (!ratings.length) return;
        const res = compute();
        // Ergebnistabelle
        const t = $('rtable');
        t.textContent = '';
        const hr = el('tr', {}, [el('th', { scope: 'col', text: 'Name' })]);
        CRIT.forEach((c, i) => hr.append(el('th', { scope: 'col', title: c.t, text: String(i + 1) })));
        t.append(el('thead', {}, [hr]));
        const body = el('tbody');
        students.forEach(s => {
            const tr = el('tr', {}, [el('th', { scope: 'row', text: s.name })]);
            res.map.get(s.id).forEach(c => {
                let txt = '–', cls = '', title = 'keine Angabe';
                if (c.n) {
                    title = c.n + (c.n === 1 ? ' Angabe' : ' Angaben') + ', Durchschnitt ' + fmt1(c.avg);
                    if (c.grade != null) txt = String(c.grade);
                    else { txt = '?'; cls = 'open'; }
                    if (c.tie) cls = cls || 'decided';
                }
                tr.append(el('td', { class: cls, title: title, text: txt }));
            });
            body.append(tr);
        });
        t.append(body);
        // Entscheidungen
        const ties2 = allTies(res);
        const tbox = $('rties');
        tbox.textContent = '';
        $('rties-card').hidden = !ties2.length;
        const open = ties2.filter(x => x.c.grade == null).length;
        $('rties-count').textContent = open ? open + ' offen' : 'alle entschieden';
        $('rbulk').hidden = !open;
        ties2.forEach(x => {
            const key = x.s.id + '|' + x.i;
            const lo = x.c.lo;
            const mk = (which, grade, word) => {
                const b = el('button', { type: 'button', class: 'btn small tiebtn', 'aria-pressed': String(ties[key] === which), text: levelName(grade - 1) + ' (' + word + ')' });
                b.addEventListener('click', () => { ties[key] = which; renderRatings(); });
                return b;
            };
            tbox.append(el('div', { class: 'tie' + (x.c.grade == null ? ' open' : '') }, [
                el('div', { class: 'tie-t' }, [el('b', { text: x.s.name }), document.createTextNode(' · ' + CRIT[x.i].t), el('small', { text: 'Angaben: ' + x.c.vals.slice().sort().join(', ') + ' · Durchschnitt ' + fmt1(x.c.avg) })]),
                el('div', { class: 'tie-b' }, [mk('b', lo, 'besser'), mk('s', lo + 1, 'schlechter')])
            ]));
        });
    }
    $('rbulk-b').addEventListener('click', () => { allTies(compute()).forEach(x => { if (x.c.grade == null) ties[x.s.id + '|' + x.i] = 'b'; }); renderRatings(); });
    $('rbulk-s').addEventListener('click', () => { allTies(compute()).forEach(x => { if (x.c.grade == null) ties[x.s.id + '|' + x.i] = 's'; }); renderRatings(); });

    $('rfile-btn').addEventListener('click', () => $('rfile-input').click());
    $('rfile-input').addEventListener('change', async e => {
        const files = Array.from(e.target.files);
        e.target.value = '';
        if (files.length) await addRatingFiles(files);
    });

    // Übernimmt das Ergebnis in die Kästchen. Gibt false zurück, wenn noch Entscheidungen offen sind.
    async function applyRatings() {
        if (!ratings.length) return true;
        const res = compute();
        const open = openTies(res);
        if (open.length) {
            await dialog('Entscheidung nötig', 'Es sind noch ' + open.length + (open.length === 1 ? ' Fall' : ' Fälle') + ' offen, in denen der Durchschnitt genau zwischen zwei Stufen liegt. Bitte entscheiden Sie zuerst.');
            return false;
        }
        // Nur übernehmen, wenn sich die Einschätzungen seit dem letzten Übernehmen geändert haben, damit Änderungen von Hand erhalten bleiben
        const sig = JSON.stringify(students.map(s => res.map.get(s.id).map(c => c.grade)));
        if (sig !== lastSig) {
            students.forEach(s => res.map.get(s.id).forEach((c, i) => { if (c.n && c.grade != null) s.marks[i] = c.grade - 1; }));
            lastSig = sig;
        }
        return true;
    }

    /* ---------- Schritt 4: Übersicht und Formular ---------- */

    function renderOverview() {
        $('overview').hidden = false;
        $('sheet').hidden = true;
        const box = $('kids');
        box.textContent = '';
        students.forEach(s => {
            const n = doneCount(s.marks);
            const b = el('button', { type: 'button', class: 'kid' + (n === NC ? ' done' : '') }, [
                document.createTextNode(s.name),
                el('small', { text: (s.birth ? 'geboren ' + s.birth + ' · ' : '') + (n === NC ? 'fertig' : n + ' von ' + NC + ' Bereichen') })
            ]);
            b.addEventListener('click', () => openSheet(s));
            box.append(b);
        });
        const fin = students.filter(s => doneCount(s.marks) === NC).length;
        $('over-count').textContent = fin + ' von ' + students.length + ' fertig';
    }

    function openSheet(s) {
        cur = s;
        $('overview').hidden = true;
        $('sheet').hidden = false;
        $('h-sheet').textContent = s.name;
        $('sheet-sub').textContent = (s.birth ? 'Geboren am ' + s.birth + '. ' : '') + info.half + '. Schulhalbjahr, Jahrgangsstufe ' + info.stufe + '. Ein Kästchen erneut antippen nimmt das Kreuz zurück.';
        renderBogen($('bogen'), s.marks);
        const idx = students.indexOf(s);
        $('sh-prev').disabled = idx <= 0;
        $('sh-next').disabled = idx >= students.length - 1;
        window.scrollTo(0, 0);
    }
    $('sh-over').addEventListener('click', () => { cur = null; renderOverview(); window.scrollTo(0, 0); });
    $('sh-prev').addEventListener('click', () => { const i = students.indexOf(cur); if (i > 0) openSheet(students[i - 1]); });
    $('sh-next').addEventListener('click', () => { const i = students.indexOf(cur); if (i < students.length - 1) openSheet(students[i + 1]); });

    /* ---------- Erzeugen und Herunterladen ---------- */

    async function make(kind, filled, btn, statusId) {
        const p = problemsStudents().concat(problemsInfo());
        if (p.length) { await dialog('Es fehlen noch Angaben', 'Bitte ergänzen Sie:', p); return; }
        const status = $(statusId);
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Wird erstellt …';
        status.className = 'status';
        status.textContent = '';
        try {
            const list = students.map(s => ({ name: s.name.trim(), birth: s.birth.trim(), marks: s.marks.slice() }));
            const snap = { half: info.half, stufe: info.stufe, date: info.date, head: info.head.trim(), klass: info.klass.trim() };
            await need('fflate', '../lib/fflate.js', () => !!window.fflate);
            let data, ext, type;
            if (kind === 'pdf') {
                await need('pdflib', '../lib/pdf-lib.min.js', () => !!window.PDFLib);
                await need('fontkit', '../lib/fontkit.umd.min.js', () => !!window.fontkit);
                await need('pdf', 'pdf.js', () => !!window.ASVPdf);
                data = await window.ASVPdf.build(list, snap, filled);
                ext = 'pdf'; type = 'application/pdf';
            } else {
                await need('docx', 'docx.js', () => !!window.ASVDocx);
                data = await window.ASVDocx.build(list, snap, filled);
                ext = 'docx'; type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            }
            const name = 'ASV-' + (filled ? 'ausgefuellt' : 'leer') + '-Stufe' + snap.stufe + '-' + snap.half + 'HJ-' + new Date().toLocaleDateString('sv-SE') + '.' + ext;
            saveBytes(data, name, type);
            status.textContent = name + ' wurde erstellt (' + list.length + (list.length === 1 ? ' Blatt' : ' Blätter') + ').';
        } catch (e) {
            status.className = 'status err';
            status.textContent = 'Das Erstellen hat nicht geklappt. Bitte versuchen Sie es noch einmal.';
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    }
    $('dl-leer-pdf').addEventListener('click', e => make('pdf', false, e.currentTarget, 'status2'));
    $('dl-leer-docx').addEventListener('click', e => make('docx', false, e.currentTarget, 'status2'));
    $('dl-full-pdf').addEventListener('click', e => make('pdf', true, e.currentTarget, 'status4'));
    $('dl-full-docx').addEventListener('click', e => make('docx', true, e.currentTarget, 'status4'));

    // Datei für das Kollegium: Klassenbezeichnung und Namen, ohne Geburtstage
    $('dl-json').addEventListener('click', async () => {
        const p = problemsStudents();
        if (p.length) { await dialog('Es fehlen noch Angaben', 'Bitte ergänzen Sie:', p); return; }
        const withBirth = $('json-birth').checked;
        const data = {
            format: F_KLASSE, version: 1, klasse: klasse.trim(),
            info: { half: info.half, stufe: info.stufe, date: info.date, head: info.head.trim(), klass: info.klass.trim() },
            students: students.map(s => withBirth && s.birth.trim() ? { id: s.id, name: s.name.trim(), b: s.birth.trim() } : { id: s.id, name: s.name.trim() })
        };
        const name = 'ASV-Klasse-' + (safe(klasse) || 'Klasse') + '.json';
        saveBytes(JSON.stringify(data, null, 1), name, 'application/json');
        $('status2').className = 'status';
        $('status2').textContent = name + ' wurde erstellt' + (withBirth ? ' (mit Geburtstagen).' : ' (ohne Geburtstage).');
    });

    /* =====================================================================
       KOLLEGIUM
       ===================================================================== */

    let kclasses = [];   // { key, klasse, students:[{id,name,marks}] }
    let kact = 0;
    let kcur = null;
    let kkey = 1;

    async function addClassFiles(files) {
        const problems = [];
        let added = 0, replaced = 0;
        for (const f of files) {
            try {
                const d = sanitizeFile(await readJsonFile(f));
                if (!d) { problems.push(f.name + ': keine passende Datei'); continue; }
                let nm = d.klasse || f.name.replace(/\.json$/i, '');
                const ids = d.students.map(s => s.id).sort().join(',');
                const twin = d.type === F_EINSCH ? kclasses.find(c => c.base === nm && c.students.map(s => s.id).sort().join(',') === ids) : null;
                if (twin) {
                    if (!(await choose('Bisherige Eingaben ersetzen?', 'Klasse ' + twin.klasse + ' ist schon geladen. Die Kreuze aus der Datei ersetzen Ihre bisherigen Eingaben für diese Klasse.', 'Ersetzen'))) continue;
                    twin.students = d.students;
                    if (d.von) $('von').value = d.von;
                    kact = kclasses.indexOf(twin); kcur = null; added++; replaced++;
                    continue;
                }
                const same = kclasses.filter(c => c.base === nm).length;
                const show = same ? nm + ' (' + (same + 1) + ')' : nm;
                kclasses.push({ key: kkey++, base: nm, klasse: show, students: d.students });
                if (d.type === F_EINSCH && d.von && !$('von').value) $('von').value = d.von;
                added++;
            } catch (e) { problems.push(f.name + ': Datei nicht lesbar'); }
        }
        if (added) { if (added > replaced) kact = kclasses.length - (added - replaced); kcur = null; renderKg(); announce(added + ' Dateien geladen'); }
        if (problems.length) await dialog('Nicht alle Dateien konnten geladen werden', 'Diese Dateien wurden übersprungen:', problems);
    }

    function renderKg() {
        $('kg-empty').hidden = kclasses.length > 0;
        $('kg-main').hidden = !kclasses.length;
        if (!kclasses.length) return;
        const tabs = $('kg-tabs');
        tabs.textContent = '';
        $('kg-tabbar').hidden = kclasses.length < 2;
        kclasses.forEach((c, i) => {
            const b = el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(i === kact), text: c.klasse });
            b.addEventListener('click', () => { kact = i; kcur = null; renderKg(); });
            tabs.append(b);
        });
        const c = kclasses[kact];
        $('kg-title').textContent = 'Klasse ' + c.klasse;
        const box = $('kg-kids');
        box.textContent = '';
        $('kg-over').hidden = !!kcur;
        $('kg-sheet').hidden = !kcur;
        if (kcur) { openKgSheet(kcur); return; }
        c.students.forEach(s => {
            const n = doneCount(s.marks);
            const b = el('button', { type: 'button', class: 'kid' + (n === NC ? ' done' : '') }, [
                document.createTextNode(s.name),
                el('small', { text: n === 0 ? 'noch nicht eingeschätzt' : n === NC ? 'fertig' : n + ' von ' + NC + ' Bereichen' })
            ]);
            b.addEventListener('click', () => { kcur = s; renderKg(); window.scrollTo(0, 0); });
            box.append(b);
        });
        const fin = c.students.filter(s => doneCount(s.marks) > 0).length;
        $('kg-count').textContent = fin + ' von ' + c.students.length + ' eingeschätzt';
    }

    function openKgSheet(s) {
        $('kg-h-sheet').textContent = s.name;
        renderBogen($('kg-bogen'), s.marks);
        const list = kclasses[kact].students;
        const idx = list.indexOf(s);
        $('kg-prev').disabled = idx <= 0;
        $('kg-next').disabled = idx >= list.length - 1;
    }
    $('kg-back').addEventListener('click', () => { kcur = null; renderKg(); window.scrollTo(0, 0); });
    $('kg-prev').addEventListener('click', () => { const l = kclasses[kact].students; const i = l.indexOf(kcur); if (i > 0) { kcur = l[i - 1]; renderKg(); window.scrollTo(0, 0); } });
    $('kg-next').addEventListener('click', () => { const l = kclasses[kact].students; const i = l.indexOf(kcur); if (i < l.length - 1) { kcur = l[i + 1]; renderKg(); window.scrollTo(0, 0); } });

    $('kg-load').addEventListener('click', () => $('kg-input').click());
    $('kg-load2').addEventListener('click', () => $('kg-input').click());
    $('kg-input').addEventListener('change', async e => {
        const files = Array.from(e.target.files);
        e.target.value = '';
        if (files.length) await addClassFiles(files);
    });
    $('kg-remove').addEventListener('click', () => {
        kclasses.splice(kact, 1);
        kact = Math.max(0, kact - 1);
        kcur = null;
        renderKg();
    });
    $('kg-save').addEventListener('click', () => {
        const c = kclasses[kact];
        const data = {
            format: F_EINSCH, version: 1, klasse: c.base, von: cleanStr($('von').value, 60),
            students: c.students.map(s => ({ id: s.id, name: s.name, m: s.marks.slice() }))
        };
        const name = 'ASV-Einschaetzung-' + (safe(c.base) || 'Klasse') + (safe($('von').value) ? '-' + safe($('von').value) : '') + '.json';
        saveBytes(JSON.stringify(data, null, 1), name, 'application/json');
        $('kg-status').textContent = name + ' wurde erstellt. Bitte schicken Sie die Datei an die Klassenleitung.';
    });

    renderPeople();
    renderKg();
    setMode('start');
    window.PinniHooks = Object.assign(window.PinniHooks || {}, {
        asvShow: n => { if (mode !== 'kl') setMode('kl'); show(n); },
        asvMode: m => setMode(m)
    });
})();
