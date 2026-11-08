(function () {
    'use strict';

    const MAX_NAME = 60, MAX_PEOPLE = 200;
    const $ = id => document.getElementById(id);

    // Nichts wird gespeichert: alles liegt nur in diesen Variablen.
    let people = [];          // { id, name, away }
    let nextId = 1;
    let drawnIds = new Set(); // bereits gezogen (nur bei „Niemanden doppelt ziehen“)
    let history = [];         // Liste der Ziehungen, je Ziehung ein Feld mit Namen
    let spinTimer = null;
    let hasGroups = false;

    function el(tag, props, kids) {
        const n = document.createElement(tag);
        Object.keys(props || {}).forEach(k => {
            if (k === 'text') n.textContent = props[k];
            else if (k === 'class') n.className = props[k];
            else n.setAttribute(k, props[k]);
        });
        (kids || []).forEach(c => n.append(c));
        return n;
    }

    function announce(msg) {
        const live = $('live');
        live.textContent = '';
        setTimeout(() => { live.textContent = msg; }, 30);
    }

    /* ---------- Dialog ---------- */

    function infoDialog(title, text) {
        return new Promise(resolve => {
            const root = $('modal-root');
            const previous = document.activeElement;
            const ok = el('button', { type: 'button', class: 'btn primary', text: 'OK' });
            const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
                el('h2', { text: title }), el('p', { text: text }), el('div', { class: 'modal-actions' }, [ok])
            ]);
            function close() {
                document.removeEventListener('keydown', onKey, true);
                root.textContent = '';
                root.hidden = true;
                if (previous && previous.focus) previous.focus();
                resolve();
            }
            function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); } }
            ok.addEventListener('click', close);
            document.addEventListener('keydown', onKey, true);
            root.textContent = '';
            root.append(box);
            root.hidden = false;
            ok.focus();
        });
    }

    /* ---------- Zufall ---------- */

    // Gleichverteilte Zufallszahl 0 … n-1 ohne Verzerrung
    function randInt(n) {
        if (n <= 1) return 0;
        const lim = Math.floor(0x100000000 / n) * n;
        const buf = new Uint32Array(1);
        do { crypto.getRandomValues(buf); } while (buf[0] >= lim);
        return buf[0] % n;
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = randInt(i + 1);
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    const present = () => people.filter(p => !p.away);

    /* ---------- Namen ---------- */

    function parseNames(text) {
        const clean = text.replace(/^﻿/, '');
        let lines = clean.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
        if (lines.length === 1) lines = lines[0].split(/[;,\t]+/);
        return lines
            .map(l => l.replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME))
            .filter(l => l.length);
    }

    function addNames(names) {
        let added = 0;
        names.forEach(n => {
            if (people.length < MAX_PEOPLE) { people.push({ id: nextId++, name: n, away: false }); added++; }
        });
        renderPeople();
        announce(added + ' Namen hinzugefügt');
        if (added < names.length) infoDialog('Höchstgrenze erreicht', 'Es sind höchstens ' + MAX_PEOPLE + ' Namen möglich.');
    }

    function renderPeople() {
        const box = $('chips');
        box.textContent = '';
        people.forEach(p => {
            const nm = el('button', { type: 'button', class: 'nm', 'aria-pressed': String(!p.away), title: p.away ? 'Wieder anwesend' : 'Als fehlend markieren', text: p.name });
            const x = el('button', { type: 'button', class: 'x', 'aria-label': p.name + ' entfernen', title: 'Entfernen', text: '×' });
            const chip = el('span', { class: 'chip' + (p.away ? ' away' : '') }, [nm, x]);
            nm.addEventListener('click', () => { p.away = !p.away; renderPeople(); });
            x.addEventListener('click', () => {
                people = people.filter(q => q !== p);
                drawnIds.delete(p.id);
                renderPeople();
            });
            box.append(chip);
        });
        const n = present().length;
        $('count').textContent = people.length
            ? n + ' von ' + people.length + ' anwesend' + (n < people.length ? '. Durchgestrichene fehlen.' : '. Antippen markiert jemanden als fehlend.')
            : 'Noch keine Namen.';
        $('names-clear').disabled = !people.length;
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

    $('names-clear').addEventListener('click', () => {
        people = [];
        drawnIds = new Set();
        history = [];
        renderPeople();
        resetDraw();
        $('groups').textContent = '';
        hasGroups = false;
        $('g-again').disabled = true;
        $('g-print').disabled = true;
    });

    /* ---------- Reiter ---------- */

    function showTab(which) {
        ['gruppen', 'zufall'].forEach(t => {
            const on = t === which;
            $('tab-' + t).setAttribute('aria-selected', String(on));
            $('panel-' + t).hidden = !on;
        });
    }
    $('tab-gruppen').addEventListener('click', () => showTab('gruppen'));
    $('tab-zufall').addEventListener('click', () => showTab('zufall'));

    /* ---------- Gruppen ---------- */

    $('g-mode').addEventListener('change', () => {
        $('g-num-label').textContent = $('g-mode').value === 'count' ? 'Gruppen' : 'Personen';
        $('g-num').value = $('g-mode').value === 'count' ? 4 : 4;
    });

    function intField(id, lo, hi) {
        const v = parseInt($(id).value, 10);
        return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null;
    }

    function makeGroups() {
        const list = present();
        if (!list.length) { infoDialog('Keine Namen', 'Tragen Sie zuerst Namen ein. Fehlende Personen werden nicht eingeteilt.'); return; }
        const num = intField('g-num', 1, 50);
        if (num == null) { $('g-num').focus(); return; }
        const k = $('g-mode').value === 'count' ? Math.min(num, list.length) : Math.ceil(list.length / num);
        const groups = Array.from({ length: k }, () => []);
        shuffle(list).forEach((p, i) => groups[i % k].push(p.name));
        const box = $('groups');
        box.textContent = '';
        groups.forEach((g, i) => {
            const ul = el('ul', {}, g.map(n => el('li', { text: n })));
            box.append(el('div', { class: 'gcard' }, [el('h3', { text: 'Gruppe ' + (i + 1) + ' (' + g.length + ')' }), ul]));
        });
        hasGroups = true;
        $('g-again').disabled = false;
        $('g-print').disabled = false;
        announce(k + ' Gruppen gebildet');
    }
    $('g-run').addEventListener('click', makeGroups);
    $('g-again').addEventListener('click', makeGroups);
    $('g-print').addEventListener('click', () => { if (hasGroups) window.print(); });

    /* ---------- Zufallsauswahl ---------- */

    function resetDraw() {
        clearInterval(spinTimer);
        drawnIds = new Set();
        history = [];
        $('drawn').textContent = '';
        $('drawn').append(el('span', { class: 'placeholder', text: 'Noch niemand gezogen.' }));
        $('z-history').textContent = '';
        $('z-run').disabled = false;
    }
    $('z-reset').addEventListener('click', resetDraw);

    function draw() {
        const list = present();
        if (!list.length) { infoDialog('Keine Namen', 'Tragen Sie zuerst Namen ein. Fehlende Personen werden nicht gezogen.'); return; }
        const norepeat = $('z-norepeat').checked;
        let pool = norepeat ? list.filter(p => !drawnIds.has(p.id)) : list;
        if (!pool.length) {
            $('drawn').textContent = '';
            $('drawn').append(el('span', { class: 'placeholder', text: 'Alle wurden schon gezogen. „Zurücksetzen“ beginnt von vorn.' }));
            return;
        }
        const num = intField('z-num', 1, 50) || 1;
        const chosen = shuffle(pool).slice(0, Math.min(num, pool.length));
        const box = $('drawn');
        const btn = $('z-run');
        const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function reveal() {
            box.textContent = '';
            chosen.forEach(p => box.append(el('span', { class: 'big', text: p.name })));
            if (norepeat) chosen.forEach(p => drawnIds.add(p.id));
            history.push(chosen.map(p => p.name).join(', '));
            $('z-history').textContent = '';
            $('z-history').append(el('strong', { text: 'Bisher gezogen: ' }), document.createTextNode(history.join(' · ')));
            btn.disabled = false;
            announce(chosen.map(p => p.name).join(', ') + ' gezogen');
        }

        if (still) { reveal(); return; }
        btn.disabled = true;
        clearInterval(spinTimer);
        const t0 = Date.now();
        const slots = Math.min(chosen.length, 6);
        spinTimer = setInterval(() => {
            if (Date.now() - t0 > 1100) { clearInterval(spinTimer); reveal(); return; }
            box.textContent = '';
            for (let i = 0; i < slots; i++) box.append(el('span', { class: 'big spin', text: list[randInt(list.length)].name }));
        }, 70);
    }
    $('z-run').addEventListener('click', draw);

    renderPeople();
})();
