(function () {
    'use strict';

    /* =========================================================
       Konstanten und Zustand
       ========================================================= */

    const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    const BASE_W = 96, BASE_H = 58, GAP = 6;       // Kästchengröße bei 100 %
    const MAX_NAME = 60, MAX_ITEMS = 200, MAX_PLANS = 20;
    const COLS_MIN = 4, COLS_MAX = 16, ROWS_MIN = 3, ROWS_MAX = 20;

    let plans = [];
    let cur = 0;
    let selectedId = null;
    let zoom = 1;
    let dirty = false;          // ungesicherte Änderungen
    let suppressClick = false;  // nach einem Ziehen den Klick ignorieren

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
    const key = (r, c) => r * 100 + c;
    const P = () => plans[cur];
    const findItem = (plan, id) => plan.items.find(i => i.id === id);

    function announce(msg) {
        const live = $('live');
        live.textContent = '';
        setTimeout(() => { live.textContent = msg; }, 30);
    }

    /* =========================================================
       Dialoge (statt alert/confirm/prompt)
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
                if (input) {
                    const v = input.value.replace(/\s+/g, ' ').trim();
                    close(v || null);
                } else close(true);
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
    const promptDialog = (title, value) => modal({ title: title, input: value, ok: 'Speichern' });
    const infoDialog = (title, text) => modal({ title: title, text: text, cancel: false });

    /* =========================================================
       Datenmodell
       ========================================================= */

    function newPlan(name) {
        return { id: uid(), name: name, raum: '', klasse: '', cols: 12, rows: 8, items: [], history: [] };
    }

    function snap(plan) {
        plan.history.push(JSON.stringify({ cols: plan.cols, rows: plan.rows, items: plan.items }));
        if (plan.history.length > 60) plan.history.shift();
        dirty = true;
    }

    function undo() {
        const p = P();
        if (!p.history.length) return;
        const s = JSON.parse(p.history.pop());
        p.cols = s.cols; p.rows = s.rows; p.items = s.items;
        selectedId = null;
        renderAll();
        announce('Rückgängig gemacht');
    }

    function footprint(item, r, c) {
        return item.teacher ? [[r, c], [r, c + 1]] : [[r, c]];
    }

    function occupancy(plan, skipId) {
        const m = new Map();
        plan.items.forEach(it => {
            if (it.r == null || it.id === skipId) return;
            footprint(it, it.r, it.c).forEach(rc => m.set(key(rc[0], rc[1]), it));
        });
        return m;
    }

    function fits(plan, item, r, c, skipIds) {
        if (r < 0 || r >= plan.rows || c < 0) return false;
        const occ = new Map();
        plan.items.forEach(it => {
            if (it.r == null || skipIds.indexOf(it.id) !== -1) return;
            footprint(it, it.r, it.c).forEach(rc => occ.set(key(rc[0], rc[1]), it));
        });
        return footprint(item, r, c).every(rc => rc[1] < plan.cols && !occ.has(key(rc[0], rc[1])));
    }

    // Setzt ein Element auf einen Platz. Wer dort sitzt, tauscht den Platz oder geht zurück in die Liste.
    function place(plan, item, r, c) {
        if (item.teacher && c >= plan.cols - 1) c = plan.cols - 2;
        if (r < 0 || r >= plan.rows || c < 0 || c >= plan.cols) return;
        const oldR = item.r, oldC = item.c;
        if (oldR === r && oldC === c) return;
        snap(plan);
        const occ = occupancy(plan, item.id);
        const displaced = [];
        footprint(item, r, c).forEach(rc => {
            const o = occ.get(key(rc[0], rc[1]));
            if (o && displaced.indexOf(o) === -1) displaced.push(o);
        });
        displaced.forEach(o => { o.r = null; o.c = null; });
        item.r = r; item.c = c;
        if (displaced.length === 1 && oldR != null && fits(plan, displaced[0], oldR, oldC, [displaced[0].id])) {
            displaced[0].r = oldR;
            displaced[0].c = oldC;
        }
    }

    function toPool(plan, item) {
        if (item.r == null) return;
        snap(plan);
        item.r = null; item.c = null;
    }

    function removeItem(plan, item) {
        snap(plan);
        plan.items = plan.items.filter(i => i.id !== item.id);
    }

    function resizeGrid(plan, cols, rows) {
        if (cols === plan.cols && rows === plan.rows) return 0;
        snap(plan);
        plan.cols = cols;
        plan.rows = rows;
        let moved = 0;
        plan.items.forEach(it => {
            if (it.r == null) return;
            const right = it.c + (it.teacher ? 1 : 0);
            if (it.r >= rows || right >= cols) { it.r = null; it.c = null; moved++; }
        });
        return moved;
    }

    /* =========================================================
       Textanpassung in den Kästchen
       ========================================================= */

    const measure = document.createElement('canvas').getContext('2d');

    function linesNeeded(text, maxW) {
        const words = text.split(/\s+/);
        let lines = 1, line = '';
        for (let i = 0; i < words.length; i++) {
            if (measure.measureText(words[i]).width > maxW) return -1;
            const test = line ? line + ' ' + words[i] : words[i];
            if (measure.measureText(test).width <= maxW) line = test;
            else { lines++; line = words[i]; }
        }
        return lines;
    }

    // Größte Schrift, bei der der Name in das Kästchen passt (höchstens zwei bis drei Zeilen)
    function fitFont(text, w, h, maxPx) {
        const maxW = w - 14, maxH = h - 8;
        for (let fs = maxPx; fs >= 8; fs -= 0.5) {
            measure.font = '600 ' + fs + 'px ' + FONT;
            const n = linesNeeded(text, maxW);
            if (n > 0 && n * fs * 1.15 <= maxH) return fs;
        }
        return 8;
    }

    /* =========================================================
       Darstellung
       ========================================================= */

    function displayName(plan) {
        return plan.klasse && plan.raum ? plan.klasse + ' · ' + plan.raum : (plan.klasse || plan.name);
    }

    function renderTabs() {
        const box = $('tabs');
        box.textContent = '';
        plans.forEach((plan, i) => {
            const b = el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': i === cur ? 'true' : 'false', text: displayName(plan) });
            b.addEventListener('click', () => switchPlan(i));
            box.append(b);
        });
    }

    function renderMeta() {
        const p = P();
        $('klasse').value = p.klasse;
        $('raum').value = p.raum;
        $('cols').value = p.cols;
        $('rows').value = p.rows;
    }

    function chipLabel(item) {
        return item.name + (item.r != null ? ', Reihe ' + (item.r + 1) + ', Platz ' + (item.c + 1) : ', noch nicht platziert');
    }

    function makeChip(item, w, h, maxFs) {
        const sel = item.id === selectedId;
        const chip = el('div', {
            class: 'chip' + (item.teacher ? ' teacher' : '') + (sel ? ' selected' : ''),
            role: 'button', tabindex: '0', 'aria-pressed': sel ? 'true' : 'false', 'aria-label': chipLabel(item)
        });
        const t = el('span', { class: 'chip-text', text: item.name });
        t.style.fontSize = fitFont(item.name, w, h, maxFs) + 'px';
        chip.append(t);
        chip.addEventListener('click', () => onChipClick(item.id));
        chip.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChipClick(item.id); }
        });
        chip.addEventListener('pointerdown', e => onChipPointerDown(e, item, chip));
        chip.addEventListener('contextmenu', e => e.preventDefault());
        return chip;
    }

    function renderPool() {
        const p = P();
        const pool = $('pool');
        pool.textContent = '';
        const free = p.items.filter(i => i.r == null);
        free.forEach(it => pool.append(makeChip(it, 104, 56, 16)));
        $('pool-count').textContent = free.length ? '(' + free.length + ')' : '';
        if (!free.length) {
            pool.append(el('span', { class: 'pool-empty', text: p.items.length ? 'Alle Namen sind platziert.' : 'Noch keine Namen. Unter „Namen hinzufügen“ eintragen.' }));
        }
    }

    function renderGrid() {
        const p = P();
        const g = $('grid');
        g.textContent = '';
        const cw = BASE_W * zoom, ch = BASE_H * zoom, gap = GAP * zoom;
        g.style.setProperty('--cw', cw + 'px');
        g.style.setProperty('--ch', ch + 'px');
        g.style.setProperty('--gap', gap + 'px');
        g.style.gridTemplateColumns = 'repeat(' + p.cols + ', ' + cw + 'px)';
        g.classList.toggle('has-sel', !!selectedId);

        const anchor = new Map(), covered = new Set();
        p.items.forEach(it => {
            if (it.r == null) return;
            anchor.set(key(it.r, it.c), it);
            if (it.teacher) covered.add(key(it.r, it.c + 1));
        });

        for (let r = 0; r < p.rows; r++) {
            for (let c = 0; c < p.cols; c++) {
                if (covered.has(key(r, c))) continue;
                const cell = el('div', { class: 'cell' });
                cell.dataset.r = r;
                cell.dataset.c = c;
                const it = anchor.get(key(r, c));
                if (it) {
                    cell.classList.add('filled');
                    if (it.teacher) cell.style.gridColumn = 'span 2';
                    cell.append(makeChip(it, it.teacher ? 2 * cw + gap : cw, ch, 18 * zoom));
                } else {
                    cell.setAttribute('aria-label', 'Freier Platz, Reihe ' + (r + 1) + ', Platz ' + (c + 1));
                }
                cell.addEventListener('click', e => onCellClick(e, r, c));
                g.append(cell);
            }
        }
        $('zoom-label').textContent = Math.round(zoom * 100) + ' %';
    }

    function renderSel() {
        const p = P();
        const sel = selectedId ? findItem(p, selectedId) : null;
        $('selbar').hidden = !sel;
        if (sel) {
            $('sel-name').textContent = sel.name;
            $('sel-pool').hidden = sel.r == null;
        }
    }

    function renderButtons() {
        $('undo').disabled = !P().history.length;
        $('plan-del').disabled = plans.length <= 1;
    }

    function renderAll() {
        renderTabs();
        renderMeta();
        renderPool();
        renderGrid();
        renderSel();
        renderButtons();
    }

    /* =========================================================
       Bedienung: Antippen, Ziehen, Tastatur
       ========================================================= */

    function setSelection(id) {
        selectedId = id;
        renderPool();
        renderGrid();
        renderSel();
    }

    function onChipClick(id) {
        if (suppressClick) return;
        const p = P();
        const item = findItem(p, id);
        if (!item) return;
        if (selectedId && selectedId !== id) {
            const sel = findItem(p, selectedId);
            if (sel && item.r != null) {
                place(p, sel, item.r, item.c);
                selectedId = null;
                renderAll();
                announce(sel.name + ' platziert');
                return;
            }
        }
        setSelection(selectedId === id ? null : id);
        if (selectedId) announce(item.name + ' ausgewählt');
    }

    function onCellClick(e, r, c) {
        if (e.target.closest('.chip') || !selectedId) return;
        const p = P();
        const sel = findItem(p, selectedId);
        if (!sel) return;
        place(p, sel, r, c);
        selectedId = null;
        renderAll();
        announce(sel.name + ' auf Reihe ' + (r + 1) + ', Platz ' + (c + 1) + ' gesetzt');
    }

    $('pool-wrap').addEventListener('click', e => {
        if (e.target.closest('.chip') || !selectedId) return;
        const p = P();
        const sel = findItem(p, selectedId);
        if (sel && sel.r != null) {
            toPool(p, sel);
            selectedId = null;
            renderAll();
            announce(sel.name + ' zurück in die Liste');
        }
    });

    // Ziehen: mit der Maus sofort, auf Touch-Geräten nach kurzem Gedrückthalten (sonst bleibt das Scrollen frei).
    let touchDragging = false;
    document.addEventListener('touchmove', ev => { if (touchDragging && ev.cancelable) ev.preventDefault(); }, { passive: false });

    function onChipPointerDown(e, item, chip) {
        const touch = e.pointerType !== 'mouse';
        if (!touch && e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY;
        let lastX = sx, lastY = sy;
        let ghost = null, dragging = false, hover = null, timer = null;

        function target(ev) {
            const t = document.elementFromPoint(ev.clientX, ev.clientY);
            return t && t.closest ? t : null;
        }
        function hoverAt(x, y) {
            ghost.style.left = (x - chip.offsetWidth / 2) + 'px';
            ghost.style.top = (y - chip.offsetHeight / 2) + 'px';
            const t = document.elementFromPoint(x, y);
            const cell = t && t.closest ? t.closest('.cell') : null;
            if (hover && hover !== cell) hover.classList.remove('drop');
            if (cell) cell.classList.add('drop');
            hover = cell;
        }
        function begin() {
            dragging = true;
            suppressClick = true;
            ghost = chip.cloneNode(true);
            ghost.classList.add('ghost');
            ghost.classList.remove('selected');
            ghost.style.width = chip.offsetWidth + 'px';
            ghost.style.height = chip.offsetHeight + 'px';
            document.body.append(ghost);
            chip.classList.add('dragging');
            hoverAt(lastX, lastY);
        }
        function stopListening() {
            clearTimeout(timer);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', end);
            document.removeEventListener('pointercancel', end);
        }
        function move(ev) {
            if (ev.pointerId !== e.pointerId) return;
            lastX = ev.clientX; lastY = ev.clientY;
            if (!dragging) {
                const d = Math.hypot(lastX - sx, lastY - sy);
                if (touch) { if (d > 10) stopListening(); return; }   // Finger bewegt sich vor dem Halten: Scrollen
                if (d < 6) return;
                begin();
                return;
            }
            hoverAt(lastX, lastY);
        }
        function end(ev) {
            if (ev.pointerId !== e.pointerId) return;
            stopListening();
            touchDragging = false;
            if (!dragging) return;
            if (hover) hover.classList.remove('drop');
            ghost.remove();
            chip.classList.remove('dragging');
            const p = P();
            const t = ev.type === 'pointerup' ? target(ev) : null;
            const cell = t ? t.closest('.cell') : null;
            if (cell) {
                place(p, item, parseInt(cell.dataset.r, 10), parseInt(cell.dataset.c, 10));
            } else if (t && t.closest('#pool-wrap')) {
                toPool(p, item);
            }
            selectedId = null;
            renderAll();
            setTimeout(() => { suppressClick = false; }, 0);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', end);
        document.addEventListener('pointercancel', end);
        if (touch) {
            timer = setTimeout(() => {
                touchDragging = true;
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* nichts */ } }
                begin();
            }, 300);
        }
    }

    document.addEventListener('pointerdown', () => { suppressClick = false; }, true);

    document.addEventListener('keydown', e => {
        const tag = (e.target && e.target.tagName) || '';
        const typing = tag === 'INPUT' || tag === 'TEXTAREA';
        if (e.key === 'Escape' && selectedId && $('modal-root').hidden) setSelection(null);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); }
    });

    /* ---------- Auswahlleiste ---------- */

    $('sel-cancel').addEventListener('click', () => setSelection(null));

    $('sel-pool').addEventListener('click', () => {
        const p = P();
        const it = findItem(p, selectedId);
        if (!it) return;
        toPool(p, it);
        selectedId = null;
        renderAll();
    });

    $('sel-del').addEventListener('click', async () => {
        const p = P();
        const it = findItem(p, selectedId);
        if (!it) return;
        if (!(await confirmDialog('„' + it.name + '“ entfernen?', 'Der Eintrag wird aus dem Plan gelöscht. „Rückgängig“ holt ihn zurück.', 'Entfernen'))) return;
        removeItem(p, it);
        selectedId = null;
        renderAll();
    });

    $('sel-rename').addEventListener('click', async () => {
        const p = P();
        const it = findItem(p, selectedId);
        if (!it) return;
        const name = await promptDialog('Neuer Name', it.name);
        if (!name) return;
        snap(p);
        it.name = name.slice(0, MAX_NAME);
        renderAll();
    });

    /* =========================================================
       Pläne (Reiter)
       ========================================================= */

    function switchPlan(i) {
        if (i === cur) return;
        cur = i;
        selectedId = null;
        renderAll();
    }

    $('tab-add').addEventListener('click', () => {
        if (plans.length >= MAX_PLANS) { infoDialog('Zu viele Pläne', 'Es sind höchstens ' + MAX_PLANS + ' Pläne möglich.'); return; }
        plans.push(newPlan('Plan ' + (plans.length + 1)));
        cur = plans.length - 1;
        selectedId = null;
        dirty = true;
        renderAll();
        $('det-names').open = true;
    });

    $('plan-rename').addEventListener('click', async () => {
        const name = await promptDialog('Name des Plans', P().name);
        if (!name) return;
        P().name = name.slice(0, MAX_NAME);
        dirty = true;
        renderTabs();
    });

    $('plan-dup').addEventListener('click', () => {
        if (plans.length >= MAX_PLANS) { infoDialog('Zu viele Pläne', 'Es sind höchstens ' + MAX_PLANS + ' Pläne möglich.'); return; }
        const src = P();
        const copy = newPlan(src.name + ' (Kopie)');
        copy.raum = src.raum; copy.klasse = src.klasse; copy.cols = src.cols; copy.rows = src.rows;
        copy.items = src.items.map(i => ({ id: uid(), name: i.name, teacher: i.teacher, r: i.r, c: i.c }));
        plans.splice(cur + 1, 0, copy);
        cur = cur + 1;
        selectedId = null;
        dirty = true;
        renderAll();
    });

    $('plan-del').addEventListener('click', async () => {
        if (plans.length <= 1) return;
        if (!(await confirmDialog('Plan löschen?', '„' + displayName(P()) + '“ wird samt Namen gelöscht. Das lässt sich nicht rückgängig machen.', 'Löschen'))) return;
        plans.splice(cur, 1);
        cur = Math.max(0, cur - 1);
        selectedId = null;
        dirty = true;
        renderAll();
    });

    ['klasse', 'raum'].forEach(id => {
        $(id).addEventListener('input', () => {
            P()[id] = $(id).value.trim().slice(0, 30);
            dirty = true;
            renderTabs();
        });
    });

    function applySize() {
        const cols = clamp(parseInt($('cols').value, 10) || P().cols, COLS_MIN, COLS_MAX);
        const rows = clamp(parseInt($('rows').value, 10) || P().rows, ROWS_MIN, ROWS_MAX);
        const moved = resizeGrid(P(), cols, rows);
        selectedId = null;
        renderAll();
        if (moved) announce(moved + ' Namen standen außerhalb und sind zurück in der Liste');
    }
    $('cols').addEventListener('change', applySize);
    $('rows').addEventListener('change', applySize);

    /* =========================================================
       Namen hinzufügen
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
        const p = P();
        if (!names.length) return;
        snap(p);
        let added = 0;
        names.forEach(n => {
            if (p.items.length < MAX_ITEMS) {
                p.items.push({ id: uid(), name: n, teacher: false, r: null, c: null });
                added++;
            }
        });
        renderAll();
        announce(added + ' Namen hinzugefügt');
        if (added < names.length) infoDialog('Höchstgrenze erreicht', 'Pro Plan sind höchstens ' + MAX_ITEMS + ' Einträge möglich.');
    }

    $('names-add').addEventListener('click', () => {
        const names = parseNames($('names-input').value);
        if (!names.length) { $('names-input').focus(); return; }
        addNames(names);
        $('names-input').value = '';
    });

    $('teacher-add').addEventListener('click', () => {
        const p = P();
        if (p.items.length >= MAX_ITEMS) return;
        snap(p);
        p.items.push({ id: uid(), name: 'Lehrertisch', teacher: true, r: null, c: null });
        renderAll();
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
        const p = P();
        snap(p);
        p.items.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        renderAll();
    });

    $('names-reset').addEventListener('click', () => {
        const p = P();
        if (!p.items.some(i => i.r != null)) return;
        snap(p);
        p.items.forEach(i => { i.r = null; i.c = null; });
        selectedId = null;
        renderAll();
    });

    $('plan-clear').addEventListener('click', async () => {
        const p = P();
        if (!p.items.length) return;
        if (!(await confirmDialog('Plan leeren?', 'Alle Namen und der Lehrertisch werden aus diesem Plan entfernt. „Rückgängig“ holt sie zurück.', 'Leeren'))) return;
        snap(p);
        p.items = [];
        selectedId = null;
        renderAll();
    });

    /* =========================================================
       Sichern und Laden
       ========================================================= */

    function saveBytes(text, name, type) {
        const url = URL.createObjectURL(new Blob([text], { type: type }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    $('save-json').addEventListener('click', () => {
        const data = {
            format: 'sitzplan', version: 2,
            plans: plans.map(p => ({
                name: p.name, raum: p.raum, klasse: p.klasse, cols: p.cols, rows: p.rows,
                items: p.items.map(i => ({ name: i.name, teacher: i.teacher, r: i.r, c: i.c }))
            }))
        };
        saveBytes(JSON.stringify(data, null, 2), 'Sitzplaene-' + new Date().toLocaleDateString('sv-SE') + '.json', 'application/json');
        dirty = false;
    });

    const cleanStr = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
    const isInt = v => typeof v === 'number' && isFinite(v) && Math.floor(v) === v;

    // Prüft eine geladene Datei und baut daraus saubere Pläne (auch das Format des alten Werkzeugs)
    function sanitizePlans(raw) {
        let list = null;
        if (Array.isArray(raw)) list = raw;
        else if (raw && Array.isArray(raw.plans)) list = raw.plans;
        if (!list || !list.length) return null;
        const out = [];
        list.slice(0, MAX_PLANS).forEach((src, idx) => {
            if (!src || typeof src !== 'object') return;
            const legacy = Array.isArray(src.gridItems) || Array.isArray(src.poolItems);
            const p = newPlan(cleanStr(src.name, MAX_NAME) || 'Plan ' + (idx + 1));
            p.raum = cleanStr(src.raum, 30);
            p.klasse = cleanStr(src.klasse, 30);
            if (legacy) { p.cols = 12; p.rows = 14; }
            else {
                p.cols = clamp(isInt(src.cols) ? src.cols : 12, COLS_MIN, COLS_MAX);
                p.rows = clamp(isInt(src.rows) ? src.rows : 8, ROWS_MIN, ROWS_MAX);
            }
            const items = [];
            if (legacy) {
                (Array.isArray(src.gridItems) ? src.gridItems : []).forEach(g => {
                    if (!g || !isInt(g.index) || g.index < 0) return;
                    items.push({ name: g.name, teacher: !!g.isTeacher, r: Math.floor(g.index / 12), c: g.index % 12 });
                });
                (Array.isArray(src.poolItems) ? src.poolItems : []).forEach(g => {
                    if (g) items.push({ name: g.name, teacher: !!g.isTeacher, r: null, c: null });
                });
            } else if (Array.isArray(src.items)) {
                src.items.forEach(g => {
                    if (g) items.push({ name: g.name, teacher: !!g.teacher, r: isInt(g.r) ? g.r : null, c: isInt(g.c) ? g.c : null });
                });
            }
            items.slice(0, MAX_ITEMS).forEach(g => {
                const name = cleanStr(g.name, MAX_NAME);
                if (!name) return;
                const item = { id: uid(), name: name, teacher: g.teacher, r: g.r, c: g.c };
                if (item.r == null || item.c == null) { item.r = null; item.c = null; }
                else if (!fits(p, item, item.r, item.c, [])) { item.r = null; item.c = null; }
                p.items.push(item);
            });
            out.push(p);
        });
        return out.length ? out : null;
    }

    $('load-json').addEventListener('click', () => $('load-json-input').click());
    $('load-json-input').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { infoDialog('Datei zu groß', 'Diese Datei ist keine gültige Plan-Datei.'); return; }
        let result = null;
        try { result = sanitizePlans(JSON.parse(await f.text())); } catch (err) { result = null; }
        if (!result) { infoDialog('Datei nicht lesbar', 'Das ist keine gültige Plan-Datei.'); return; }
        if (dirty && plans.some(p => p.items.length)) {
            if (!(await confirmDialog('Aktuelle Pläne ersetzen?', 'Die geladenen Pläne ersetzen alle Pläne, die gerade offen sind. Nicht gesicherte Änderungen gehen verloren.', 'Ersetzen'))) return;
        }
        plans = result;
        cur = 0;
        selectedId = null;
        dirty = false;
        renderAll();
        announce(result.length + ' Pläne geladen');
    });

    /* =========================================================
       Zoom
       ========================================================= */

    function setZoom(z) {
        zoom = clamp(Math.round(z * 100) / 100, 0.4, 1.6);
        renderGrid();
    }

    function fitZoom() {
        const p = P();
        const avail = $('gridscroll').clientWidth - 22;
        const base = p.cols * BASE_W + (p.cols - 1) * GAP;
        return avail / base;
    }

    $('zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
    $('zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
    $('zoom-fit').addEventListener('click', () => setZoom(fitZoom()));
    $('undo').addEventListener('click', undo);

    /* =========================================================
       Drucken
       ========================================================= */

    async function printPlan() {
        const p = P();
        const placed = p.items.filter(i => i.r != null);
        if (!placed.length) { await infoDialog('Nichts zu drucken', 'Es ist noch kein Name auf einem Platz.'); return; }

        let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
        placed.forEach(i => {
            minR = Math.min(minR, i.r); maxR = Math.max(maxR, i.r);
            minC = Math.min(minC, i.c); maxC = Math.max(maxC, i.c + (i.teacher ? 1 : 0));
        });
        const totalCols = maxC - minC + 1, totalRows = maxR - minR + 1;
        const bw = 110, bh = 65, bg = 6;
        const rawW = totalCols * (bw + bg) - bg, rawH = totalRows * (bh + bg) - bg;
        const scale = Math.min(1.4, 1000 / rawW, 560 / rawH);
        const cw = bw * scale, ch = bh * scale, gap = bg * scale;

        const title = ['Sitzplan', p.klasse ? 'Klasse ' + p.klasse : '', p.raum ? 'Raum ' + p.raum : ''].filter(Boolean).join(' · ');
        $('print-title').textContent = title + (!p.klasse && !p.raum ? ' · ' + p.name : '');
        $('print-date').textContent = 'Stand: ' + new Date().toLocaleDateString('de-DE');

        const area = $('print-area');
        area.textContent = '';
        area.style.width = (totalCols * (cw + gap) - gap) + 'px';
        area.style.height = (totalRows * (ch + gap) - gap) + 'px';
        placed.forEach(i => {
            const w = i.teacher ? cw * 2 + gap : cw;
            const box = el('div', { class: 'print-box' + (i.teacher ? ' teacher' : ''), text: i.name });
            box.style.left = ((i.c - minC) * (cw + gap)) + 'px';
            box.style.top = ((i.r - minR) * (ch + gap)) + 'px';
            box.style.width = w + 'px';
            box.style.height = ch + 'px';
            box.style.fontSize = fitFont(i.name, w, ch, 22 * scale) + 'px';
            area.append(box);
        });
        setTimeout(() => window.print(), 150);
    }

    $('print-top').addEventListener('click', printPlan);
    $('print-side').addEventListener('click', printPlan);

    /* =========================================================
       Schutz vor versehentlichem Verlassen, Start
       ========================================================= */

    window.addEventListener('beforeunload', e => {
        if (dirty && plans.some(p => p.items.length)) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    function init() {
        plans = [newPlan('Plan 1')];
        cur = 0;
        const wide = window.matchMedia('(min-width: 1000px)').matches;
        document.querySelectorAll('.side details').forEach(d => { d.open = wide; });
        $('det-names').open = true;
        renderAll();
        zoom = clamp(Math.round(fitZoom() * 100) / 100, 0.7, 1.15);
        renderGrid();
    }

    init();
})();
