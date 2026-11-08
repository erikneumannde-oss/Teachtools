(function () {
    'use strict';

    const NR = window.NR;
    const MAX_NAME = 60, MAX_GROUPS = 40, MAX_STUDENTS = 200, MAX_CATS = 12, MAX_SUBS = 8, MAX_SLOTS = 20;
    const LS_KEY = 'notenrechner.v1', LS_AUTO = 'notenrechner.auto';

    let groups = [];
    let cur = 0;
    let selId = null;
    let dirty = false;
    let savedOnce = false;
    let autoOn = false;
    let statusNote = '';
    let kpInput = null;
    let layoutSegs = [];

    const $ = id => document.getElementById(id);

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

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const uid = () => 'i' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const cleanStr = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
    const isInt = v => typeof v === 'number' && isFinite(v) && Math.floor(v) === v;
    const fmt2 = x => x.toFixed(2).replace('.', ',');
    const fmtT = x => String(Math.round(x * 100) / 100).replace('.', ',');
    const G = () => groups[cur];
    const isCoarse = () => window.matchMedia('(pointer: coarse)').matches;

    function announce(msg) {
        const live = $('live');
        live.textContent = '';
        setTimeout(() => { live.textContent = msg; }, 30);
    }

    /* =========================================================
       Dialoge
       ========================================================= */

    function modal(opts) {
        return new Promise(resolve => {
            const root = $('modal-root');
            const previous = document.activeElement;
            const input = opts.input != null
                ? el('input', { type: 'text', class: 'field', maxlength: String(MAX_NAME), 'aria-label': opts.title })
                : null;
            if (input) input.value = opts.input;
            const ok = el('button', { type: 'button', class: 'btn primary', text: opts.ok || 'OK' });
            const cancel = opts.cancel === false ? null : el('button', { type: 'button', class: 'btn', text: opts.cancel || 'Abbrechen' });
            const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title }, [
                el('h2', { text: opts.title })
            ]);
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
                if (opts.collect) { const r = opts.collect(); if (r) close(r); return; }
                if (input) {
                    const v = input.value.replace(/\s+/g, ' ').trim();
                    close(v || null);
                } else close(true);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); close(input || opts.collect ? null : false); }
                else if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') { e.preventDefault(); accept(); }
            }
            ok.addEventListener('click', accept);
            if (cancel) cancel.addEventListener('click', () => close(input || opts.collect ? null : false));
            document.addEventListener('keydown', onKey, true);
            root.textContent = '';
            root.append(box);
            root.hidden = false;
            const first = input || (opts.body && opts.body.querySelector('input')) || ok;
            first.focus();
            if (input) input.select();
        });
    }

    const confirmDialog = (title, text, okLabel) => modal({ title: title, text: text, ok: okLabel || 'OK' });
    const promptDialog = (title, value) => modal({ title: title, input: value, ok: 'Speichern' });
    const infoDialog = (title, text) => modal({ title: title, text: text, cancel: false });

    /* =========================================================
       Datenmodell
       ========================================================= */

    function newGroup(name, stufe) {
        if (stufe === 'sek2') {
            return {
                id: uid(), name: name, stufe: 'sek2', course: 'gk',
                atWeights: { m: 50, s: 50 }, slots: { m: 3, s: 3, k: 2 }, adviceTarget: 'punkt', students: []
            };
        }
        return {
            id: uid(), name: name, stufe: 'sek1', tendency: true, grenze: 0.5,
            categories: [
                { id: 'c' + uid().slice(1, 7), name: 'Schriftlich', weight: 50, slots: 3 },
                { id: 'c' + uid().slice(1, 7), name: 'Mündlich', weight: 50, slots: 3 }
            ],
            students: []
        };
    }

    // Spalten mit Noten: Kategorien ohne Unterkategorien und alle Unterkategorien
    function leaves(g) {
        const out = [];
        g.categories.forEach(c => { if (c.subs && c.subs.length) c.subs.forEach(s => out.push(s)); else out.push(c); });
        return out;
    }

    function fullName(g, id) {
        if (g.stufe === 'sek1') {
            for (const c of g.categories) {
                if (c.id === id) return c.name;
                for (const s of (c.subs || [])) if (s.id === id) return c.name + ' › ' + s.name;
            }
        }
        const x = catList(g).find(k => k.id === id);
        return x ? x.name : '';
    }

    // Alle Notenspalten einer Gruppe als Liste { id, name, slots }
    function catList(g) {
        if (g.stufe === 'sek1') return leaves(g);
        return [
            { id: 'm', name: 'Mündlich', slots: g.slots.m },
            { id: 's', name: 'Sonstige', slots: g.slots.s },
            { id: 'k', name: 'Klausur', slots: g.slots.k }
        ];
    }

    const gradeMode = g => g.stufe === 'sek2' ? 'points' : (g.tendency ? 'tend' : 'plain');

    function slotsOf(g, id) {
        const c = catList(g).find(x => x.id === id);
        return c ? c.slots : 0;
    }

    function ensureGrades(g, st, catId) {
        if (!st.grades) st.grades = {};
        const n = slotsOf(g, catId);
        const arr = st.grades[catId] || (st.grades[catId] = []);
        while (arr.length < n) arr.push('');
        return arr;
    }

    function findStudent(id) { return G().students.find(s => s.id === id); }

    function markDirty() {
        dirty = true;
        updateStatus();
        scheduleAuto();
    }

    /* =========================================================
       Speichern, Laden, Prüfen
       ========================================================= */

    function sanitizeGroups(raw) {
        let list = null;
        if (Array.isArray(raw)) list = raw;
        else if (raw && Array.isArray(raw.groups)) list = raw.groups;
        if (!list || !list.length) return null;
        const out = [];
        list.slice(0, MAX_GROUPS).forEach((src, idx) => {
            if (!src || typeof src !== 'object') return;
            const stufe = src.stufe === 'sek2' ? 'sek2' : 'sek1';
            const g = newGroup(cleanStr(src.name, MAX_NAME) || 'Gruppe ' + (idx + 1), stufe);
            if (stufe === 'sek1') {
                g.tendency = src.tendency !== false;
                g.grenze = 0.5;
                if (Array.isArray(src.categories) && src.categories.length) {
                    const used = new Set();
                    const mk = (c, i, fallback) => {
                        c = c && typeof c === 'object' ? c : {};
                        const id = typeof c.id === 'string' && /^[A-Za-z0-9]{1,24}$/.test(c.id) && !used.has(c.id) ? c.id : 'c' + uid().slice(1, 8);
                        used.add(id);
                        return {
                            id: id,
                            name: cleanStr(c.name, 30) || fallback + ' ' + (i + 1),
                            weight: typeof c.weight === 'number' && isFinite(c.weight) ? clamp(Math.round(c.weight * 10) / 10, 0, 100) : 0,
                            slots: clamp(isInt(c.slots) ? c.slots : 3, 1, MAX_SLOTS)
                        };
                    };
                    g.categories = src.categories.slice(0, MAX_CATS).map((c, i) => {
                        const cat = mk(c, i, 'Kategorie');
                        if (c && Array.isArray(c.subs) && c.subs.length) cat.subs = c.subs.slice(0, MAX_SUBS).map((s, j) => mk(s, j, 'Unterkategorie'));
                        return cat;
                    });
                }
            } else {
                g.course = src.course === 'lk13' ? 'lk13' : 'gk';
                const m = src.atWeights && typeof src.atWeights.m === 'number' && isFinite(src.atWeights.m) ? clamp(Math.round(src.atWeights.m), 0, 100) : 50;
                g.atWeights = { m: m, s: 100 - m };
                const sl = src.slots && typeof src.slots === 'object' ? src.slots : {};
                g.slots = {
                    m: clamp(isInt(sl.m) ? sl.m : 3, 1, MAX_SLOTS),
                    s: clamp(isInt(sl.s) ? sl.s : 3, 1, MAX_SLOTS),
                    k: g.course === 'lk13' ? 2 : clamp(isInt(sl.k) ? sl.k : 2, 1, MAX_SLOTS)
                };
                g.adviceTarget = src.adviceTarget === 'note' ? 'note' : 'punkt';
            }
            const mode = gradeMode(g);
            const dval = v => v === 'up' || v === 'down' ? v : undefined;
            (Array.isArray(src.students) ? src.students : []).slice(0, MAX_STUDENTS).forEach(s => {
                if (!s || typeof s !== 'object') return;
                const name = cleanStr(s.name, MAX_NAME);
                if (!name) return;
                const st = { id: uid(), name: name, grades: {} };
                const sg = s.grades && typeof s.grades === 'object' ? s.grades : {};
                catList(g).forEach(c => {
                    const arr = Array.isArray(sg[c.id]) ? sg[c.id] : [];
                    st.grades[c.id] = [];
                    for (let i = 0; i < c.slots; i++) {
                        const v = NR.normalizeGrade(mode, arr[i]);
                        st.grades[c.id].push(v === null ? '' : v);
                    }
                });
                if (stufe === 'sek1') {
                    const f = isInt(s.final) && s.final >= 1 && s.final <= 6 ? s.final : null;
                    if (f != null) st.final = f;
                } else if (s.dec && typeof s.dec === 'object') {
                    st.dec = {};
                    ['at', 'kl', 'final'].forEach(k => { const v = dval(s.dec[k]); if (v) st.dec[k] = v; });
                }
                g.students.push(st);
            });
            out.push(g);
        });
        return out.length ? out : null;
    }

    const serialize = () => JSON.stringify({ format: 'notenrechner', version: 1, groups: groups });

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* nichts */ } }

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
    function scheduleAuto() {
        if (!autoOn || !savedOnce) return;
        clearTimeout(autoTimer);
        autoTimer = setTimeout(() => saveLocal(false), 800);
    }
    function flushAuto() {
        if (autoOn && savedOnce && dirty) { clearTimeout(autoTimer); saveLocal(false); }
    }

    function updateStatus() {
        const s = $('status');
        if (!s) return;
        if (dirty) { s.textContent = autoOn && savedOnce ? 'Wird gespeichert …' : 'Nicht gespeichert'; s.className = 'status dirty'; }
        else { s.textContent = statusNote; s.className = 'status'; }
    }

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

    const today = () => new Date().toLocaleDateString('sv-SE');

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
        saveBytes(serialize(), 'Notenrechner-' + today() + '.json', 'application/json');
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
        try { raw = JSON.parse(await f.text()); } catch (err) { infoDialog('Datei nicht lesbar', 'Das ist keine gültige Notenrechner-Datei.'); return; }
        const list = sanitizeGroups(raw);
        if (!list) { infoDialog('Datei nicht lesbar', 'In der Datei wurden keine Lerngruppen gefunden.'); return; }
        if (groups.some(g => g.students.length) && !(await confirmDialog('Datei laden?', 'Die aktuell geöffneten Lerngruppen werden ersetzt.', 'Laden'))) return;
        groups = list;
        cur = 0;
        selId = null;
        markDirty();
        statusNote = 'Datei geladen';
        renderAll();
    });

    window.addEventListener('beforeunload', e => {
        flushAuto();
        if (dirty && groups.some(g => g.students.length)) { e.preventDefault(); e.returnValue = ''; }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushAuto(); });
    window.addEventListener('pagehide', flushAuto);

    /* =========================================================
       Gruppen
       ========================================================= */

    function renderTabs() {
        const t = $('tabs');
        t.textContent = '';
        groups.forEach((g, i) => {
            const b = el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': i === cur ? 'true' : 'false' });
            b.append(document.createTextNode(g.name));
            b.append(el('small', { text: g.stufe === 'sek2' ? 'Sek II' : 'Sek I' }));
            b.addEventListener('click', () => { cur = i; selId = null; closeKeypad(); renderAll(); });
            t.append(b);
        });
    }

    async function addGroup() {
        if (groups.length >= MAX_GROUPS) { infoDialog('Höchstgrenze erreicht', 'Es sind höchstens ' + MAX_GROUPS + ' Lerngruppen möglich.'); return; }
        const name = el('input', { type: 'text', class: 'field', maxlength: '60', 'aria-label': 'Name der Lerngruppe', placeholder: 'z. B. 8b Deutsch' });
        const r1 = el('input', { type: 'radio', name: 'stufe', value: 'sek1' });
        const r2 = el('input', { type: 'radio', name: 'stufe', value: 'sek2' });
        r1.checked = true;
        const body = el('div', {}, [
            name,
            el('label', { class: 'radio' }, [r1, document.createTextNode('Sek I (Noten 1 bis 6)')]),
            el('label', { class: 'radio' }, [r2, document.createTextNode('Sek II (Punkte 0 bis 15)')])
        ]);
        const res = await modal({
            title: 'Neue Lerngruppe', body: body, ok: 'Anlegen',
            collect: () => { const n = name.value.replace(/\s+/g, ' ').trim(); if (!n) { name.focus(); return null; } return { name: n, stufe: r2.checked ? 'sek2' : 'sek1' }; }
        });
        if (!res) return;
        groups.push(newGroup(res.name, res.stufe));
        cur = groups.length - 1;
        selId = null;
        markDirty();
        renderAll();
        $('det-names').open = true;
        $('det-rating').open = true;
    }

    $('edit-rating').addEventListener('click', () => {
        const d = $('det-rating');
        d.open = true;
        d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('tab-add').addEventListener('click', addGroup);
    $('empty-add').addEventListener('click', addGroup);

    function renderGroupSettings() {
        const box = $('group-settings');
        box.textContent = '';
        const g = G();
        if (!g) return;
        const name = el('input', { type: 'text', class: 'field', maxlength: '60', value: g.name });
        name.addEventListener('change', () => {
            const v = name.value.replace(/\s+/g, ' ').trim();
            if (v) { g.name = v; markDirty(); renderTabs(); } else name.value = g.name;
        });
        box.append(el('label', { text: 'Name der Lerngruppe' }, [name]));
        box.append(el('p', { class: 'small-text', text: g.stufe === 'sek2' ? 'Stufe: Sek II (Punkte 0 bis 15)' : 'Stufe: Sek I (Noten 1 bis 6)' }));
        const dup = el('button', { type: 'button', class: 'btn small', text: 'Duplizieren' });
        const del = el('button', { type: 'button', class: 'btn small danger', text: 'Lerngruppe löschen' });
        dup.addEventListener('click', () => {
            if (groups.length >= MAX_GROUPS) return;
            const copy = JSON.parse(JSON.stringify(g));
            copy.id = uid();
            copy.name = (g.name + ' (Kopie)').slice(0, MAX_NAME);
            copy.students.forEach(s => { s.id = uid(); });
            groups.splice(cur + 1, 0, copy);
            cur++;
            selId = null;
            markDirty();
            renderAll();
        });
        del.addEventListener('click', async () => {
            if (!(await confirmDialog('Lerngruppe löschen?', '„' + g.name + '“ wird mit allen Namen und Noten entfernt.', 'Löschen'))) return;
            groups.splice(cur, 1);
            cur = clamp(cur, 0, groups.length - 1);
            selId = null;
            markDirty();
            renderAll();
        });
        box.append(el('div', { class: 'btn-row' }, [dup, del]));
    }

    /* =========================================================
       Bewertung (Einstellungen)
       ========================================================= */

    function stripTendency(g) {
        g.students.forEach(st => {
            Object.keys(st.grades || {}).forEach(k => {
                st.grades[k] = st.grades[k].map(v => v ? v.replace(/[+-]/g, '') : v);
            });
            delete st.final;
        });
    }

    function hasTendencyGrades(g) {
        return g.students.some(st => Object.keys(st.grades || {}).some(k => st.grades[k].some(v => /[+-]/.test(v))));
    }

    function numField(value, min, max, label, onChange) {
        const f = el('input', { type: 'number', class: 'field', min: String(min), max: String(max), inputmode: 'numeric', 'aria-label': label });
        f.value = value;
        f.addEventListener('change', () => {
            const n = parseFloat(String(f.value).replace(',', '.'));
            if (!isFinite(n)) { f.value = value; return; }
            onChange(clamp(n, min, max), f);
        });
        return f;
    }

    function radio(name, value, label, checked, onSel) {
        const r = el('input', { type: 'radio', name: name, value: value });
        r.checked = checked;
        r.addEventListener('change', () => { if (r.checked) onSel(); });
        return el('label', { class: 'radio' }, [r, document.createTextNode(label)]);
    }

    function renderRating() {
        const box = $('rating-settings');
        box.textContent = '';
        const g = G();
        if (!g) return;
        if (g.stufe === 'sek1') renderRatingSek1(box, g); else renderRatingSek2(box, g);
    }

    function renderRatingSek1(box, g) {
        box.append(el('div', { class: 'section-title', text: 'Notenform' }));
        const setTend = async t => {
            if (t === g.tendency) return;
            if (!t && hasTendencyGrades(g)) {
                if (!(await confirmDialog('Ohne Tendenz rechnen?', 'Vorhandene Tendenzen werden entfernt: aus 2- wird 2, aus 3+ wird 3. Gewählte Endnoten werden zurückgesetzt.', 'Umstellen'))) { renderRating(); return; }
                stripTendency(g);
            }
            g.tendency = t;
            markDirty();
            renderAll();
        };
        box.append(radio('tend', '1', 'Mit Tendenz (1+, 1, 1-, 2+ …)', g.tendency, () => setTend(true)));
        box.append(radio('tend', '0', 'Ohne Tendenz (1 bis 6)', !g.tendency, () => setTend(false)));

        box.append(el('div', { class: 'section-title', text: 'Kategorien und Wertung' }));
        box.append(el('div', { class: 'cathead' }, [el('span', { text: 'Name' }), el('span', { text: 'Wertung' }), el('span')]));

        const hasGradesIn = c => leavesOf(c).some(l => g.students.some(st => (st.grades[l.id] || []).some(v => v)));
        const leavesOf = c => (c.subs && c.subs.length ? c.subs : [c]);

        const row = (c, list, isSub, parent) => {
            const name = el('input', { type: 'text', class: 'field', maxlength: '30', value: c.name, 'aria-label': (isSub ? 'Name der Unterkategorie' : 'Name der Kategorie') });
            name.addEventListener('change', () => {
                const v = name.value.replace(/\s+/g, ' ').trim();
                if (v) { c.name = v; markDirty(); renderTable(); renderAdvice(); } else name.value = c.name;
            });
            const w = numField(c.weight, 0, 100, 'Wertung von ' + c.name, v => { c.weight = Math.round(v * 10) / 10; markDirty(); renderRating(); renderTable(); renderAdvice(); });
            const del = el('button', { type: 'button', class: 'btn icon danger', 'aria-label': c.name + ' entfernen', text: '×' });
            del.addEventListener('click', async () => {
                if (!isSub && g.categories.length <= 1) { infoDialog('Nicht möglich', 'Es muss mindestens eine Kategorie bleiben.'); return; }
                if (hasGradesIn(c) && !(await confirmDialog((isSub ? 'Unterkategorie' : 'Kategorie') + ' entfernen?', 'Die Noten in „' + c.name + '“ gehen verloren.', 'Entfernen'))) return;
                const doomed = leavesOf(c).map(l => l.id);
                g.students.forEach(st => doomed.forEach(id => { delete st.grades[id]; }));
                const idx = list.indexOf(c);
                list.splice(idx, 1);
                if (isSub && !list.length) { delete parent.subs; parent.slots = 3; }
                markDirty();
                renderAll();
            });
            return el('div', { class: 'catrow' + (isSub ? ' sub' : '') }, [name, w, del]);
        };

        g.categories.forEach(c => {
            box.append(row(c, g.categories, false, null));
            (c.subs || []).forEach(s => box.append(row(s, c.subs, true, c)));
            const addSub = el('button', { type: 'button', class: 'btn small subadd', text: '+ Unterkategorie in „' + c.name + '“' });
            addSub.addEventListener('click', () => {
                if (c.subs && c.subs.length >= MAX_SUBS) return;
                if (!c.subs || !c.subs.length) {
                    // Die bisherigen Noten der Kategorie wandern in die erste Unterkategorie
                    const first = { id: 'c' + uid().slice(1, 8), name: 'Teil 1', weight: 50, slots: c.slots };
                    g.students.forEach(st => { if (st.grades[c.id]) { st.grades[first.id] = st.grades[c.id]; delete st.grades[c.id]; } });
                    c.subs = [first];
                    c.subs.push({ id: 'c' + uid().slice(1, 8), name: 'Teil 2', weight: 50, slots: 3 });
                } else {
                    c.subs.push({ id: 'c' + uid().slice(1, 8), name: 'Teil ' + (c.subs.length + 1), weight: 0, slots: 3 });
                }
                markDirty();
                renderAll();
            });
            box.append(addSub);
        });
        const sum = g.categories.reduce((a, c) => a + c.weight, 0);
        box.append(el('p', { class: 'small-text', text: 'Summe der Hauptkategorien: ' + fmtT(sum) + '. Wertungen werden je Ebene automatisch auf 100 % umgerechnet. Eine Hauptkategorie mit Unterkategorien berechnet sich aus deren Noten. Eine Wertung von 0 nimmt den Eintrag aus der Berechnung.' }));
        const add = el('button', { type: 'button', class: 'btn small', text: 'Kategorie hinzufügen' });
        add.addEventListener('click', () => {
            if (g.categories.length >= MAX_CATS) return;
            g.categories.push({ id: 'c' + uid().slice(1, 8), name: 'Kategorie ' + (g.categories.length + 1), weight: 0, slots: 3 });
            markDirty();
            renderAll();
        });
        box.append(el('div', { class: 'btn-row' }, [add]));
    }

    function renderRatingSek2(box, g) {
        box.append(el('div', { class: 'section-title', text: 'Kursart' }));
        const setCourse = async c => {
            if (c === g.course) return;
            if (c === 'lk13' && g.students.some(st => (st.grades.k || []).slice(2).some(v => v))) {
                if (!(await confirmDialog('Kursart ändern?', 'Für Leistungskurse im 1. bis 3. Kurshalbjahr zählen genau zwei Klausuren. Weitere Klausurnoten werden entfernt.', 'Ändern'))) { renderRating(); return; }
            }
            g.course = c;
            if (c === 'lk13') {
                g.slots.k = 2;
                g.students.forEach(st => { st.grades.k = (st.grades.k || []).slice(0, 2); delete st.dec; });
            } else g.students.forEach(st => { delete st.dec; });
            markDirty();
            renderAll();
        };
        box.append(radio('course', 'gk', 'Grundkurs, Sport oder Leistungskurs im 4. Kurshalbjahr (Tabelle a)', g.course !== 'lk13', () => setCourse('gk')));
        box.append(radio('course', 'lk13', 'LK im 1. bis 3. Kurshalbjahr (Tabelle b, zwei Klausuren)', g.course === 'lk13', () => setCourse('lk13')));

        box.append(el('div', { class: 'section-title', text: 'Allgemeiner Teil (AT)' }));
        const wm = numField(g.atWeights.m, 0, 100, 'Anteil mündlicher Teil in Prozent', v => {
            g.atWeights.m = Math.round(v);
            g.atWeights.s = 100 - g.atWeights.m;
            markDirty();
            renderRating();
            renderTable();
            renderAdvice();
        });
        box.append(el('label', { text: 'Mündlicher Teil in %' }, [wm]));
        box.append(el('p', { class: 'small-text', text: 'Sonstiger Teil: ' + g.atWeights.s + ' %' }));

        box.append(el('div', { class: 'section-title', text: 'Beratung' }));
        const sel = el('select', { class: 'field', 'aria-label': 'Ziel der Beratung' }, [
            el('option', { value: 'punkt', text: 'Nächsthöherer Punkt' }),
            el('option', { value: 'note', text: 'Nächste ganze Notenstufe' })
        ]);
        sel.value = g.adviceTarget;
        sel.addEventListener('change', () => { g.adviceTarget = sel.value; markDirty(); renderAdvice(); });
        box.append(sel);
    }

    /* =========================================================
       Namen
       ========================================================= */

    function parseNames(text) {
        const clean = text.replace(/^﻿/, '');
        let lines = clean.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
        if (lines.length === 1) lines = lines[0].split(/[;,\t]+/);
        return lines
            .map(l => l.replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME))
            .filter(l => l.length);
    }

    function addNames(names) {
        const g = G();
        if (!g || !names.length) return;
        let added = 0;
        names.forEach(n => {
            if (g.students.length < MAX_STUDENTS) {
                const st = { id: uid(), name: n, grades: {} };
                catList(g).forEach(c => ensureGrades(g, st, c.id));
                g.students.push(st);
                added++;
            }
        });
        markDirty();
        renderTable();
        renderAdvice();
        renderTabs();
        announce(added + ' Namen hinzugefügt');
        if (added < names.length) infoDialog('Höchstgrenze erreicht', 'Pro Lerngruppe sind höchstens ' + MAX_STUDENTS + ' Namen möglich.');
    }

    $('names-add').addEventListener('click', () => {
        const names = parseNames($('names-input').value);
        if (!names.length) { $('names-input').focus(); return; }
        addNames(names);
        $('names-input').value = '';
    });

    $('names-file').addEventListener('click', () => $('names-file-input').click());
    $('names-file-input').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            const buf = await f.arrayBuffer();
            let text;
            try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
            catch (err) { text = new TextDecoder('windows-1252').decode(buf); }
            const names = parseNames(text);
            if (!names.length) { infoDialog('Keine Namen gefunden', 'Die Datei enthält keinen Text.'); return; }
            addNames(names);
        } catch (err) {
            infoDialog('Datei nicht lesbar', 'Die Datei konnte nicht gelesen werden.');
        }
    });

    $('names-sort').addEventListener('click', () => {
        const g = G();
        if (!g) return;
        g.students.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        markDirty();
        renderTable();
    });


    /* =========================================================
       Noten aus der Klassenarbeits-Auswertung
       ========================================================= */

    const NOTE_PTS = {
        '1+': 15, '1': 14, '1-': 13, '2+': 12, '2': 11, '2-': 10, '3+': 9, '3': 8, '3-': 7,
        '4+': 6, '4': 5, '4-': 4, '5+': 3, '5': 2, '5-': 1, '6': 0
    };
    const nameKey = n => n.toLowerCase().replace(/\s+/g, ' ').trim();
    // Auch „Nachname, Vorname“ wird als „Vorname Nachname“ erkannt
    const nameKeys = n => {
        const k = [nameKey(n)];
        const m = /^([^,]+),\s*(.+)$/.exec(n);
        if (m) k.push(nameKey(m[2] + ' ' + m[1]));
        return k;
    };

    function convertNote(g, note) {
        const mode = gradeMode(g);
        if (mode === 'points') return String(NOTE_PTS[note]);
        return NR.normalizeGrade(mode, note);
    }

    $('grades-import2').addEventListener('click', () => $('grades-import').click());
    $('grades-import').addEventListener('click', () => {
        const g = G();
        if (!g) { infoDialog('Keine Lerngruppe', 'Legen Sie zuerst eine Lerngruppe an.'); return; }
        $('grades-input').click();
    });

    $('grades-input').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        const g = G();
        if (!f || !g) return;
        let raw;
        try { raw = JSON.parse(await f.text()); } catch (err) { raw = null; }
        const list = raw && raw.format === 'teachtools-noten' && Array.isArray(raw.grades)
            ? raw.grades.filter(x => x && typeof x.name === 'string' && typeof x.note === 'string' && NOTE_PTS[x.note] != null).slice(0, MAX_STUDENTS)
            : null;
        if (!list || !list.length) { infoDialog('Datei nicht lesbar', 'Das ist keine Noten-Datei aus der Klassenarbeits-Auswertung.'); return; }

        // Zuordnung über die Namen
        const byKey = new Map();
        g.students.forEach(st => nameKeys(st.name).forEach(k => { if (!byKey.has(k)) byKey.set(k, st); }));
        const matched = [], missing = [];
        list.forEach(x => {
            const name = x.name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
            const st = nameKeys(name).map(k => byKey.get(k)).find(Boolean);
            if (st) matched.push({ st: st, note: x.note }); else missing.push({ name: name, note: x.note });
        });

        const cols = catList(g);
        const colSel = el('select', { class: 'field', 'aria-label': 'Spalte' });
        cols.forEach(c => colSel.append(el('option', { value: c.id, text: fullName(g, c.id) || c.name })));
        const slotSel = el('select', { class: 'field', 'aria-label': 'Platz' });
        function fillSlots() {
            const c = cols.find(x => x.id === colSel.value);
            slotSel.textContent = '';
            // Erster Platz, der bei allen zugeordneten Personen frei ist
            let firstFree = -1;
            for (let i = 0; i < c.slots; i++) {
                if (matched.every(m => !((m.st.grades[c.id] || [])[i]))) { firstFree = i; break; }
            }
            for (let i = 0; i < c.slots; i++) slotSel.append(el('option', { value: String(i), text: 'Note ' + (i + 1) }));
            const canNew = c.slots < MAX_SLOTS && !(g.course === 'lk13' && c.id === 'k');
            if (canNew) slotSel.append(el('option', { value: 'new', text: 'Neuer Platz am Ende' }));
            slotSel.value = firstFree >= 0 ? String(firstFree) : (canNew ? 'new' : '0');
        }
        colSel.addEventListener('change', fillSlots);
        fillSlots();

        const addMissing = el('input', { type: 'checkbox' });
        const body = el('div', { class: 'import-box' }, [
            el('p', { class: 'small-text', text: (raw.name ? '„' + String(raw.name).slice(0, 60) + '“: ' : '') + matched.length + ' von ' + list.length + ' Personen gefunden.' }),
            el('label', {}, ['Spalte', colSel]),
            el('label', {}, ['Platz', slotSel])
        ]);
        if (missing.length) {
            body.append(el('p', { class: 'small-text', text: 'Nicht in der Lerngruppe: ' + missing.map(m => m.name).join(', ') }));
            body.append(el('label', { class: 'check' }, [addMissing, ' Diese Namen neu hinzufügen']));
        }
        const ok = await modal({ title: 'Noten übernehmen', body: body, ok: 'Übernehmen', collect: () => ({ col: colSel.value, slot: slotSel.value, add: addMissing.checked }) });
        if (!ok) return;

        const c = cols.find(x => x.id === ok.col);
        let slot;
        if (ok.slot === 'new') { slot = c.slots; changeSlotsDirect(g, c, c.slots + 1); } else slot = parseInt(ok.slot, 10);
        const targets = matched.slice();
        if (ok.add) {
            missing.forEach(m => {
                if (g.students.length >= MAX_STUDENTS) return;
                const st = { id: uid(), name: m.name, grades: {} };
                catList(g).forEach(k => ensureGrades(g, st, k.id));
                g.students.push(st);
                targets.push({ st: st, note: m.note });
            });
        }
        let overwritten = 0;
        targets.forEach(t => {
            const arr = ensureGrades(g, t.st, c.id);
            if (arr[slot]) overwritten++;
            arr[slot] = convertNote(g, t.note);
            delete t.st.dec;
        });
        markDirty();
        renderTable();
        renderAdvice();
        renderTabs();
        announce(targets.length + ' Noten übernommen');
        if (overwritten) infoDialog('Hinweis', overwritten + ' vorhandene Noten wurden überschrieben.');
    });

    // Anzahl der Plätze einer Spalte setzen (ohne Rückfrage)
    function changeSlotsDirect(g, c, n) {
        if (g.stufe === 'sek1') c.slots = n;
        else g.slots[c.id] = n;
        g.students.forEach(st => ensureGrades(g, st, c.id));
    }

    /* =========================================================
       Tabelle
       ========================================================= */

    function buildSegs(g) {
        const segs = [];
        if (g.stufe === 'sek1') {
            g.categories.forEach(c => {
                if (c.subs && c.subs.length) {
                    c.subs.forEach(s => { segs.push({ t: 'cat', cat: s }); segs.push({ t: 'mean', cat: s }); });
                    segs.push({ t: 'mean', cat: c, main: true });
                } else { segs.push({ t: 'cat', cat: c }); segs.push({ t: 'mean', cat: c }); }
            });
            segs.push({ t: 'tot' }, { t: 'calc' }, { t: 'fin' });
        } else {
            const cl = catList(g);
            segs.push({ t: 'cat', cat: cl[0] }, { t: 'mean', cat: cl[0] }, { t: 'cat', cat: cl[1] }, { t: 'mean', cat: cl[1] },
                { t: 'at' }, { t: 'cat', cat: cl[2] }, { t: 'kl' }, { t: 'pts' }, { t: 'note' });
        }
        return segs;
    }

    function catHeadLabel(g, c) {
        if (g.stufe === 'sek1') {
            const sum = g.categories.reduce((a, x) => a + (x.weight > 0 ? x.weight : 0), 0);
            const pct = sum > 0 && c.weight > 0 ? Math.round(c.weight / sum * 100) : 0;
            return c.name + ' · ' + pct + ' %';
        }
        if (c.id === 'm') return 'Mündlich · ' + g.atWeights.m + ' %';
        if (c.id === 's') return 'Sonstige · ' + g.atWeights.s + ' %';
        return g.course === 'lk13' ? 'Klausuren (Σ)' : 'Klausuren';
    }

    const CALC_LABEL = { tot: 'Ø', calc: 'Rechn. Note', fin: 'Note', at: 'AT', kl: 'Klausurteil', pts: 'Punkte', note: 'Note' };

    function renderTable() {
        const wrap = $('tablewrap');
        wrap.textContent = '';
        const g = G();
        if (!g) return;
        const segs = buildSegs(g);
        layoutSegs = segs;
        const coarse = isCoarse();
        const mode = gradeMode(g);

        const sek1 = g.stufe === 'sek1';
        const hasSubs = sek1 && g.categories.some(c => c.subs && c.subs.length);
        const nRows = hasSubs ? 3 : 2;
        const rows = [];
        for (let i = 0; i < nRows; i++) rows.push(el('tr'));
        rows[0].append(el('th', { class: 'name', rowspan: String(nRows), text: 'Name' }));

        const pctOf = (list, c) => {
            const sum = list.reduce((a, x) => a + (x.weight > 0 ? x.weight : 0), 0);
            return sum > 0 && c.weight > 0 ? Math.round(c.weight / sum * 100) : 0;
        };
        const slotCtl = c => {
            const ctl = el('span', { class: 'ctl' });
            const minus = el('button', { type: 'button', 'aria-label': 'Eine Spalte weniger in ' + c.name, text: '−' });
            const plus = el('button', { type: 'button', 'aria-label': 'Eine Spalte mehr in ' + c.name, text: '+' });
            minus.addEventListener('click', () => changeSlots(c.id, -1));
            plus.addEventListener('click', () => changeSlots(c.id, 1));
            ctl.append(minus, ' ', plus);
            return ctl;
        };
        const numbers = (c, row, withMean) => {
            for (let k = 1; k <= c.slots; k++) row.append(el('th', { text: String(k) }));
            if (withMean) row.append(el('th', { text: 'Ø' }));
        };
        const calcHead = s => {
            let label = CALC_LABEL[s.t];
            if (s.t === 'kl' && g.course === 'lk13') label = 'Σ Klausuren';
            const th = el('th', { rowspan: String(nRows), text: label });
            if (s.t === 'tot' || s.t === 'at' || s.t === 'kl' || s.t === 'pts') th.className = 'sep';
            rows[0].append(th);
        };

        if (sek1) {
            g.categories.forEach(c => {
                if (c.subs && c.subs.length) {
                    const width = c.subs.reduce((a, s) => a + s.slots + 1, 0) + 1;
                    rows[0].append(el('th', { class: 'cat main', colspan: String(width), text: c.name + ' · ' + pctOf(g.categories, c) + ' %' }));
                    c.subs.forEach(s => {
                        const th = el('th', { class: 'cat sub', colspan: String(s.slots + 1) });
                        th.append(document.createTextNode(s.name + ' · ' + pctOf(c.subs, s) + ' %'), slotCtl(s));
                        rows[1].append(th);
                        numbers(s, rows[2], true);
                    });
                    rows[1].append(el('th', { class: 'cat main', rowspan: '2', text: 'Ø' }));
                } else {
                    const th = el('th', { class: 'cat', colspan: String(c.slots + 1), rowspan: String(nRows - 1) });
                    th.append(document.createTextNode(c.name + ' · ' + pctOf(g.categories, c) + ' %'), slotCtl(c));
                    rows[0].append(th);
                    numbers(c, rows[nRows - 1], true);
                }
            });
            segs.forEach(s => { if (s.t !== 'cat' && s.t !== 'mean') calcHead(s); });
        } else {
            segs.forEach((s, i) => {
                if (s.t === 'cat') {
                    const hasMean = segs[i + 1] && segs[i + 1].t === 'mean';
                    const th = el('th', { class: 'cat', colspan: String(s.cat.slots + (hasMean ? 1 : 0)) });
                    th.append(document.createTextNode(catHeadLabel(g, s.cat)));
                    if (!(g.course === 'lk13' && s.cat.id === 'k')) th.append(slotCtl(s.cat));
                    rows[0].append(th);
                    numbers(s.cat, rows[1], hasMean);
                } else if (s.t !== 'mean') calcHead(s);
            });
        }
        const table = el('table', { class: 'nt' }, [el('thead', {}, rows)]);
        const tb = el('tbody');
        g.students.forEach(st => tb.append(buildRow(g, st, segs, coarse, mode)));
        table.append(tb);
        wrap.append(table);

        const hint = g.stufe === 'sek2'
            ? 'Punkte von 0 bis 15 eintragen. Bei genau x,5 im AT, im Klausurteil oder in der Tabelle b wird die Entscheidung per Knopf getroffen.'
            : (g.tendency ? 'Noten mit Tendenz eintragen, zum Beispiel 2+, 3 oder 4-.' : 'Noten von 1 bis 6 eintragen.');
        $('hint').textContent = g.students.length ? hint + ' Auf einen Namen tippen zeigt die Beratung für diese Person.' : 'Noch keine Namen. Rechts unter „Namen hinzufügen“ Namen eintragen oder eine CSV- oder TXT-Datei importieren.';
    }

    function buildRow(g, st, segs, coarse, mode) {
        const tr = el('tr', { 'data-sid': st.id });
        if (st.id === selId) tr.className = 'sel';
        const nb = el('button', { type: 'button', class: 'nmb', text: st.name });
        nb.addEventListener('click', () => selectStudent(st.id));
        tr.append(el('td', { class: 'name' }, [nb]));
        segs.forEach(s => {
            if (s.t === 'cat') {
                const arr = ensureGrades(g, st, s.cat.id);
                for (let i = 0; i < s.cat.slots; i++) {
                    const inp = el('input', {
                        type: 'text', class: 'gi', maxlength: '2', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
                        'data-sid': st.id, 'data-cat': s.cat.id, 'data-i': String(i),
                        'aria-label': st.name + ', ' + s.cat.name + ' ' + (i + 1)
                    });
                    if (coarse) { inp.setAttribute('readonly', ''); inp.setAttribute('inputmode', 'none'); }
                    else inp.setAttribute('inputmode', mode === 'points' ? 'numeric' : 'text');
                    inp.value = arr[i] || '';
                    tr.append(el('td', { class: 'g' }, [inp]));
                }
            } else {
                const td = el('td', { class: 'calc', 'data-k': s.t + (s.cat ? ':' + s.cat.id : '') });
                if (s.t === 'tot' || s.t === 'at' || s.t === 'kl' || s.t === 'pts') td.classList.add('sep');
                if (s.t === 'fin' || s.t === 'note' || s.t === 'pts') td.classList.add('strong');
                if (s.t === 'fin' || s.t === 'note') td.classList.add('final');
                tr.append(td);
            }
        });
        fillCalc(tr, st);
        return tr;
    }

    function decButtons(st, kind, lo, hi) {
        const wrapEl = el('span', { class: 'dec' });
        const d = (st.dec && st.dec[kind]) || null;
        [['down', lo], ['up', hi]].forEach(p => {
            const b = el('button', { type: 'button', 'data-dec': kind, 'data-v': p[0], 'data-sid': st.id, text: String(p[1]), 'aria-label': 'Entscheidung ' + p[1] });
            if (d === p[0]) b.className = 'on';
            wrapEl.append(b);
        });
        return wrapEl;
    }

    function fillCalc(tr, st) {
        const g = G();
        const tds = tr.querySelectorAll('td.calc');
        if (g.stufe === 'sek1') {
            const c = NR.calcSek1(g, st);
            tds.forEach(td => {
                const k = td.dataset.k;
                td.textContent = '';
                if (k.indexOf('mean:') === 0) {
                    const cc = c.byId[k.slice(5)];
                    td.textContent = cc && cc.note != null ? fmt2(cc.note) : '';
                } else if (k === 'tot') td.textContent = c.total == null ? '' : fmt2(c.total);
                else if (k === 'calc') td.textContent = c.grade == null ? '' : String(c.grade);
                else if (k === 'fin') {
                    const opts = NR.sek1Options(g, c);
                    if (opts.length > 1) {
                        const sel = el('select', { class: 'fin', 'aria-label': 'Endnote für ' + st.name });
                        opts.forEach(o => sel.append(el('option', { value: String(o), text: String(o) })));
                        sel.value = String(NR.sek1Final(g, st, c));
                        sel.addEventListener('change', () => { st.final = parseInt(sel.value, 10); markDirty(); });
                        td.append(sel);
                    } else if (opts.length === 1) td.textContent = String(opts[0]);
                }
            });
        } else {
            const r = NR.calcSek2(g, st);
            const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
            tds.forEach(td => {
                const k = td.dataset.k;
                td.textContent = '';
                td.classList.remove('pending');
                if (k === 'mean:m') { const a = avg(r.m); td.textContent = a == null ? '' : fmtT(a); }
                else if (k === 'mean:s') { const a = avg(r.s); td.textContent = a == null ? '' : fmtT(a); }
                else if (k === 'at' || (k === 'kl' && g.course !== 'lk13')) {
                    const x = k === 'at' ? r.at : r.kl;
                    if (!x) return;
                    if (x.half) {
                        td.append(document.createTextNode(fmtT(x.exact)), decButtons(st, k, x.floor, x.floor + 1));
                        if (x.value == null) td.classList.add('pending');
                    } else td.textContent = String(x.value);
                } else if (k === 'kl') {
                    td.textContent = r.kl ? String(r.kl.value) : '';
                } else if (k === 'pts') {
                    if (r.tieFinal) {
                        td.append(decButtons(st, 'final', r.tieFinal.lo, r.tieFinal.hi));
                        if (r.points == null) td.classList.add('pending');
                    } else td.textContent = r.points == null ? '' : String(r.points);
                } else if (k === 'note') td.textContent = r.note == null ? '' : r.note;
            });
        }
    }

    function refreshRow(st) {
        const tr = $('tablewrap').querySelector('tr[data-sid="' + st.id + '"]');
        if (tr) fillCalc(tr, st);
    }

    async function changeSlots(catId, d) {
        const g = G();
        const c = catList(g).find(x => x.id === catId);
        const n = c.slots + d;
        if (n < 1 || n > MAX_SLOTS) return;
        if (d < 0) {
            const used = g.students.some(st => (st.grades[catId] || [])[c.slots - 1]);
            if (used && !(await confirmDialog('Spalte entfernen?', 'Die letzte Spalte von „' + c.name + '“ enthält Noten. Sie gehen verloren.', 'Entfernen'))) return;
            g.students.forEach(st => { if (st.grades[catId]) st.grades[catId].length = n; });
        }
        if (g.stufe === 'sek1') c.slots = n; else g.slots[catId] = n;
        markDirty();
        renderTable();
        renderAdvice();
    }

    function selectStudent(id) {
        selId = id;
        document.querySelectorAll('#tablewrap tr.sel').forEach(r => r.classList.remove('sel'));
        const tr = $('tablewrap').querySelector('tr[data-sid="' + id + '"]');
        if (tr) tr.classList.add('sel');
        renderAdvice();
    }

    /* ---------- Eingabe ---------- */

    function applyInput(inp, final) {
        const g = G();
        const st = findStudent(inp.dataset.sid);
        if (!st) return;
        const norm = NR.normalizeGrade(gradeMode(g), inp.value);
        const arr = ensureGrades(g, st, inp.dataset.cat);
        const i = parseInt(inp.dataset.i, 10);
        if (norm === null) {
            if (final) {
                inp.classList.add('bad');
                setTimeout(() => inp.classList.remove('bad'), 900);
                inp.value = arr[i] || '';
                announce('Ungültige Eingabe');
            }
            return;
        }
        if (final) inp.value = norm;
        if (arr[i] !== norm) {
            arr[i] = norm;
            markDirty();
            refreshRow(st);
            if (st.id === selId) renderAdvice();
        }
    }

    function moveFocus(inp, dr, dc) {
        const tr = inp.closest('tr');
        const row = Array.from(tr.querySelectorAll('input.gi'));
        const idx = row.indexOf(inp);
        let target = null;
        if (dr) {
            const nb = dr > 0 ? tr.nextElementSibling : tr.previousElementSibling;
            if (nb) target = nb.querySelectorAll('input.gi')[idx];
        } else if (dc) {
            target = row[idx + dc];
            if (!target) {
                const nb = dc > 0 ? tr.nextElementSibling : tr.previousElementSibling;
                if (nb) { const r2 = nb.querySelectorAll('input.gi'); target = dc > 0 ? r2[0] : r2[r2.length - 1]; }
            }
        }
        if (target) { target.focus(); if (!isCoarse()) target.select(); }
        return !!target;
    }

    const tw = $('tablewrap');
    tw.addEventListener('input', e => { if (e.target.classList.contains('gi') && !e.target.hasAttribute('readonly')) applyInput(e.target, false); });
    tw.addEventListener('change', e => { if (e.target.classList.contains('gi') && !e.target.hasAttribute('readonly')) applyInput(e.target, true); });
    tw.addEventListener('focusin', e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains('gi')) return;
        if (t.dataset.sid !== selId) selectStudent(t.dataset.sid);
        if (isCoarse()) openKeypad(t); else t.select();
    });
    tw.addEventListener('keydown', e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains('gi')) return;
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); applyInput(t, true); moveFocus(t, 1, 0); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); applyInput(t, true); moveFocus(t, -1, 0); }
    });
    tw.addEventListener('click', e => {
        const b = e.target.closest('button[data-dec]');
        if (!b) return;
        const st = findStudent(b.dataset.sid);
        if (!st) return;
        if (!st.dec) st.dec = {};
        st.dec[b.dataset.dec] = b.dataset.v;
        markDirty();
        refreshRow(st);
        if (st.id === selId) renderAdvice();
    });

    /* ---------- Eingabetastatur (Touch-Geräte) ---------- */

    function closeKeypad() {
        kpInput = null;
        $('keypad').hidden = true;
        document.documentElement.style.removeProperty('--kp');
        document.body.style.paddingBottom = '';
    }

    function kpSet(v) {
        if (!kpInput) return;
        kpInput.value = v;
        applyInput(kpInput, true);
    }

    function openKeypad(inp) {
        kpInput = inp;
        const g = G();
        const mode = gradeMode(g);
        const kp = $('keypad');
        kp.textContent = '';
        const st = findStudent(inp.dataset.sid);
        const cname = fullName(g, inp.dataset.cat);
        kp.append(el('div', { class: 'kp-who', text: (st ? st.name : '') + ' · ' + cname + ' ' + (parseInt(inp.dataset.i, 10) + 1) }));
        const cols = mode === 'points' ? 8 : 6;
        const grid = el('div', { class: 'kp-grid' });
        grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        const btn = (label, span, fn, cls, aria) => {
            const b = el('button', { type: 'button', class: cls || '', text: label });
            if (aria) b.setAttribute('aria-label', aria);
            if (span > 1) b.style.gridColumn = 'span ' + span;
            b.addEventListener('mousedown', ev => ev.preventDefault());
            b.addEventListener('click', fn);
            grid.append(b);
        };
        const down = () => { if (!moveFocus(kpInput, 1, 0)) closeKeypad(); };
        if (mode === 'points') {
            for (let p = 0; p <= 15; p++) btn(String(p), 1, () => { kpSet(String(p)); down(); }, '');
        } else if (mode === 'plain') {
            for (let n = 1; n <= 6; n++) btn(String(n), 1, () => { kpSet(String(n)); down(); }, '');
        } else {
            for (let n = 1; n <= 6; n++) btn(String(n), 1, () => kpSet(String(n)), '');
            const sign = ch => () => {
                const base = (kpInput.value || '').replace(/[+-]/g, '');
                if (base && base !== '6') kpSet(base + ch);
            };
            btn('+', 2, sign('+'), 'act', 'Plus');
            btn('−', 2, sign('-'), 'act', 'Minus');
            btn('Löschen', 2, () => kpSet(''), 'act');
        }
        if (mode !== 'tend') btn('Löschen', mode === 'points' ? 2 : 3, () => kpSet(''), 'act');
        btn('←', 1, () => moveFocus(kpInput, 0, -1), 'act', 'Nach links');
        btn('↑', 1, () => moveFocus(kpInput, -1, 0), 'act', 'Nach oben');
        btn('↓', 1, () => moveFocus(kpInput, 1, 0), 'act', 'Nach unten');
        btn('→', 1, () => moveFocus(kpInput, 0, 1), 'act', 'Nach rechts');
        btn('Fertig', mode === 'points' ? 2 : (mode === 'tend' ? 2 : 2), () => { const i = kpInput; closeKeypad(); if (i) i.blur(); }, 'done');
        kp.append(grid);
        kp.hidden = false;
        const h = kp.offsetHeight;
        document.documentElement.style.setProperty('--kp', h + 'px');
        document.body.style.paddingBottom = h + 'px';
        inp.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    document.addEventListener('pointerdown', e => {
        if (!kpInput) return;
        if (e.target.closest('#keypad') || e.target.closest('input.gi')) return;
        closeKeypad();
    });

    /* =========================================================
       Beratung
       ========================================================= */

    function renderAdvice() {
        const g = G();
        const box = $('advice');
        box.textContent = '';
        if (!g) return;
        let st = findStudent(selId);
        if (!st && g.students.length) { st = g.students[0]; selId = st.id; const tr = $('tablewrap').querySelector('tr[data-sid="' + st.id + '"]'); if (tr) tr.classList.add('sel'); }
        $('advice-who').textContent = st ? '· ' + st.name : '';
        if (!st) { box.append(el('p', { class: 'none', text: 'Sobald Namen vorhanden sind, zeigt die Beratung, welche Note für die nächstbessere Zeugnisnote nötig ist.' })); return; }

        if (g.stufe === 'sek1') adviceSek1View(box, g, st); else adviceSek2View(box, g, st);

        const ren = el('button', { type: 'button', class: 'btn small', text: 'Umbenennen' });
        const del = el('button', { type: 'button', class: 'btn small danger', text: 'Entfernen' });
        ren.addEventListener('click', async () => {
            const v = await promptDialog('Name ändern', st.name);
            if (!v) return;
            st.name = v.slice(0, MAX_NAME);
            markDirty();
            renderTable();
            renderAdvice();
        });
        del.addEventListener('click', async () => {
            if (!(await confirmDialog('Entfernen?', '„' + st.name + '“ wird mit allen Noten aus dieser Lerngruppe entfernt.', 'Entfernen'))) return;
            g.students = g.students.filter(x => x !== st);
            selId = null;
            markDirty();
            renderTable();
            renderAdvice();
            renderTabs();
        });
        box.append(el('div', { class: 'btn-row' }, [ren, del]));
    }

    function adviceTable(heads, rows) {
        const t = el('table');
        t.append(el('thead', {}, [el('tr', {}, heads.map(h => el('th', { text: h })))]));
        const tb = el('tbody');
        rows.forEach(r => tb.append(el('tr', {}, r.map((c, i) => {
            const td = el('td', { text: c.text });
            if (c.cls) td.className = c.cls;
            return td;
        }))));
        t.append(tb);
        return t;
    }

    function adviceSek1View(box, g, st) {
        const a = NR.adviceSek1(g, st);
        if (a.status === 'empty') { box.append(el('p', { class: 'none', text: 'Für die Beratung wird mindestens eine Note benötigt.' })); return; }
        const c = a.calc;
        if (a.status === 'best') { box.append(el('p', { text: 'Rechnerisch Ø ' + fmt2(c.total) + ' und damit bereits Note 1.' })); return; }
        box.append(el('p', { text: 'Rechnerisch Ø ' + fmt2(c.total) + ', Note ' + c.grade + '. Für Note ' + a.targetGrade + ' muss der Durchschnitt bei höchstens ' + fmt2(a.maxAvg) + ' liegen.' }));
        const rows = a.rows.map(r => [
            { text: r.name },
            r.needed ? { text: (g.tendency ? r.needed : r.needed) + ' oder besser', cls: 'need' } : { text: 'mit einer weiteren Note nicht erreichbar', cls: 'none' },
            { text: r.needed ? fmt2(r.resultAvg) : '' }
        ]);
        if (!rows.length) { box.append(el('p', { class: 'none', text: 'Keine Kategorie mit Wertung vorhanden.' })); return; }
        box.append(adviceTable(['Kategorie', 'Eine weitere Note von', 'ergibt Ø'], rows));
    }

    function adviceSek2View(box, g, st) {
        const a = NR.adviceSek2(g, st);
        if (a.status === 'empty') { box.append(el('p', { class: 'none', text: 'Für die Beratung werden Noten im AT und in den Klausuren benötigt.' })); return; }
        if (a.status === 'pending') { box.append(el('p', { class: 'none', text: 'Bitte zuerst die Entscheidung bei x,5 in der Tabelle treffen. Danach erscheint die Beratung.' })); return; }
        const c = a.calc;
        if (a.status === 'best') { box.append(el('p', { text: 'Aktuell 15 Punkte (1+). Mehr ist nicht möglich.' })); return; }
        const lbl = p => p + ' Punkte (' + NR.pointsToNote(p) + ')';
        box.append(el('p', { text: 'Aktuell ' + lbl(a.current) + '. Für ' + lbl(a.target) + ' wird benötigt:' }));
        const rows = a.rows.map(r => [
            { text: r.name },
            r.needed != null ? { text: 'mindestens ' + r.needed + ' Punkte', cls: 'need' } : { text: r.reason || 'mit einer weiteren Note nicht erreichbar', cls: 'none' }
        ]);
        box.append(adviceTable(['Bereich', 'Eine weitere Note von'], rows));
        box.append(el('p', { class: 'small-text', text: 'Bei einem Ergebnis von genau x,5 wird dabei zugunsten der Person aufgerundet.' }));
    }

    /* =========================================================
       PDF
       ========================================================= */

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Skript nicht ladbar: ' + src));
            document.head.append(s);
        });
    }

    let exportReady = null;
    async function exportPdf(which) {
        if (!groups.length) return;
        const btns = [$('pdf-group'), $('pdf-all')];
        btns.forEach(b => { b.disabled = true; });
        try {
            if (!exportReady) exportReady = loadScript('export.js');
            await exportReady;
            const list = which === 'all' ? groups : [G()];
            const bytes = await window.NRExport.build(list);
            const name = which === 'all' ? 'Notenuebersicht-' + today() + '.pdf' : 'Noten-' + G().name.replace(/[^\w\-äöüÄÖÜß]+/g, '_') + '-' + today() + '.pdf';
            saveBytes(bytes, name, 'application/pdf');
        } catch (err) {
            exportReady = null;
            infoDialog('PDF nicht erstellt', 'Beim Erstellen der PDF ist ein Fehler aufgetreten. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.');
        }
        btns.forEach(b => { b.disabled = false; });
    }

    $('pdf-group').addEventListener('click', () => exportPdf('one'));
    $('pdf-all').addEventListener('click', () => exportPdf('all'));

    /* =========================================================
       Start
       ========================================================= */

    function renderAll() {
        renderTabs();
        const has = groups.length > 0;
        $('empty').hidden = has;
        $('main').hidden = !has;
        renderGroupSettings();
        renderRating();
        renderTable();
        renderAdvice();
        updateStatus();
        ['det-group', 'det-rating', 'det-names'].forEach(id => { $(id).hidden = !has; });
    }

    function init() {
        autoOn = lsGet(LS_AUTO) === '1';
        $('auto-save').checked = autoOn;
        const stored = lsGet(LS_KEY);
        if (stored) {
            try {
                const list = sanitizeGroups(JSON.parse(stored));
                if (list) { groups = list; savedOnce = true; statusNote = 'Gespeicherte Daten geladen'; }
            } catch (e) { /* beschädigt: ignorieren */ }
        }
        const wide = window.matchMedia('(min-width: 1000px)').matches;
        document.querySelectorAll('.side details').forEach(d => { d.open = wide; });
        if (!groups.length) $('det-group').open = false;
        if (window.matchMedia('(max-width: 699px)').matches) $('advice-card').open = false;
        renderAll();
    }

    init();
})();
