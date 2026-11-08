(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const L = window.Letter;

    // Nichts wird gespeichert: alle Eingaben leben nur im geöffneten Fenster.
    let kind = null;

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

    function infoDialog(title, text, list) {
        return new Promise(resolve => {
            const root = $('modal-root');
            const previous = document.activeElement;
            const ok = el('button', { type: 'button', class: 'btn primary', text: 'OK' });
            const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [el('h2', { text: title })]);
            if (text) box.append(el('p', { text: text }));
            if (list) box.append(el('ul', {}, list.map(t => el('li', { text: t }))));
            box.append(el('div', { class: 'modal-actions' }, [ok]));
            function close() {
                document.removeEventListener('keydown', onKey, true);
                root.textContent = '';
                root.hidden = true;
                if (previous && previous.focus) previous.focus();
                resolve();
            }
            function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
            ok.addEventListener('click', close);
            document.addEventListener('keydown', onKey, true);
            root.textContent = '';
            root.append(box);
            root.hidden = false;
            ok.focus();
        });
    }

    /* ---------- Personenfelder ---------- */

    function personBox(i, title) {
        const wrap = el('div', { 'data-person': String(i) });
        if (title) wrap.append(el('h3', { text: title }));
        const sex = el('select', { class: 'field', 'data-f': 'sex', 'aria-label': 'Anrede' }, [
            el('option', { value: 'f', text: 'Frau' }), el('option', { value: 'm', text: 'Herr' }), el('option', { value: 'n', text: 'ohne Anrede' })
        ]);
        const mk = (label, f, ph) => el('label', {}, [label, el('input', { class: 'field', type: 'text', 'data-f': f, maxlength: '60', autocomplete: 'off', placeholder: ph || '' })]);
        wrap.append(el('div', { class: 'grid4' }, [
            el('label', {}, ['Anrede', sex]),
            mk('Titel (optional)', 'title', 'Dr.'),
            mk('Vorname', 'first'),
            mk('Nachname', 'last')
        ]));
        return wrap;
    }

    function readPerson(i) {
        const w = document.querySelector('[data-person="' + i + '"]');
        if (!w) return { sex: 'f', title: '', first: '', last: '' };
        const g = f => w.querySelector('[data-f="' + f + '"]').value;
        return { sex: g('sex'), title: g('title'), first: g('first'), last: g('last') };
    }

    function renderPersons() {
        const typ = document.querySelector('input[name="typ"]:checked').value;
        const box = $('s-persons');
        const keep = [readPerson(0), readPerson(1)];
        box.textContent = '';
        const n = typ === 'einzel' ? 1 : (typ === 'zwei' ? 2 : 0);
        for (let i = 0; i < n; i++) box.append(personBox(i, n === 2 ? (i + 1) + '. Person' : ''));
        for (let i = 0; i < n; i++) {
            const w = box.querySelector('[data-person="' + i + '"]');
            ['sex', 'title', 'first', 'last'].forEach(f => { w.querySelector('[data-f="' + f + '"]').value = keep[i][f]; });
        }
        box.hidden = n === 0;
        $('s-familie').hidden = typ !== 'familie';
        $('s-institution').hidden = typ !== 'institution';
        refresh();
    }

    /* ---------- Formular lesen ---------- */

    function readForm() {
        const typ = document.querySelector('input[name="typ"]:checked').value;
        return {
            kind: kind,
            eltern: { art: $('e-art').value, wert: $('e-wert').value },
            sonstig: {
                typ: typ,
                persons: [readPerson(0), readPerson(1)],
                familie: $('s-familie-in').value,
                institution: $('s-institution-in').value,
                strasse: $('s-strasse').value, plz: $('s-plz').value, ort: $('s-ort').value,
                anrede: document.querySelector('input[name="anrede"]:checked').value
            },
            names: $('f-names').value, kuerzel: $('f-kuerzel').value,
            subject: $('f-subject').value, text: $('f-text').value
        };
    }

    function refresh() {
        if (!kind) return;
        $('e-label').textContent = $('e-art').value === 'jahrgang' ? 'Jahrgangsstufe' : 'Klasse';
        $('e-wert').placeholder = $('e-art').value === 'jahrgang' ? 'zum Beispiel 9' : 'zum Beispiel 7a';
        const f = readForm();
        const l = L.build(f);
        const box = $('check');
        box.textContent = '';
        const part = (label, text) => { box.append(el('b', { text: label + '\n' }), document.createTextNode(text + '\n\n')); };
        part('Adressfeld', l.address.join('\n'));
        part('Anrede', l.salutation);
        part('Ansprechpartner und Datum', (l.kuerzel || '…') + '   ' + l.date);
        part('Name unter dem Gruß', l.names || '…');
        box.lastChild.textContent = box.lastChild.textContent.replace(/\n+$/, '');
    }

    /* ---------- Auswahl der Briefart ---------- */

    document.querySelectorAll('.kind[data-kind]').forEach(b => b.addEventListener('click', () => {
        kind = b.dataset.kind;
        document.querySelectorAll('.kind[data-kind]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        $('form').hidden = false;
        $('box-eltern').hidden = kind !== 'eltern';
        $('box-sonstig').hidden = kind !== 'sonstig';
        if (kind === 'sonstig' && !$('s-persons').children.length) renderPersons();
        refresh();
        $('h-addr').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    document.querySelectorAll('input[name="typ"]').forEach(r => r.addEventListener('change', renderPersons));
    $('form').addEventListener('input', refresh);
    $('form').addEventListener('change', refresh);

    /* ---------- Dateien erzeugen ---------- */

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

    const stamp = () => new Date().toLocaleDateString('sv-SE');
    const baseName = () => (kind === 'eltern' ? 'Elternbrief-' : 'Brief-') + stamp();

    async function pdfBytes(letter) {
        await need('fflate', '../lib/fflate.js', () => !!window.fflate);
        await need('pdflib', '../lib/pdf-lib.min.js', () => !!window.PDFLib);
        await need('fontkit', '../lib/fontkit.umd.min.js', () => !!window.fontkit);
        await need('layout', 'layout.js', () => !!window.BriefLayout);
        await need('pdf', 'pdf.js', () => !!window.BriefPdf);
        return window.BriefPdf.build(letter);
    }

    async function checked() {
        const f = readForm();
        const miss = L.missing(f);
        if (miss.length) { await infoDialog('Es fehlen noch Angaben', 'Bitte ergänzen Sie:', miss); return null; }
        return L.build(f);
    }

    async function make(which, btn) {
        const letter = await checked();
        if (!letter) return;
        btn.disabled = true;
        try {
            if (which === 'docx') {
                await need('fflate', '../lib/fflate.js', () => !!window.fflate);
                await need('fontkit', '../lib/fontkit.umd.min.js', () => !!window.fontkit);
                await need('layout', 'layout.js', () => !!window.BriefLayout);
                await need('docx', 'docx.js', () => !!window.BriefDocx);
                const bytes = await window.BriefDocx.build(letter);
                saveBytes(bytes, baseName() + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            } else {
                saveBytes(await pdfBytes(letter), baseName() + '.pdf', 'application/pdf');
            }
        } catch (err) {
            await infoDialog('Datei nicht erstellt', 'Beim Erstellen ist ein Fehler aufgetreten. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.');
        }
        btn.disabled = false;
    }

    async function preview() {
        const letter = await checked();
        if (!letter) return;
        const btn = $('btn-preview');
        btn.disabled = true;
        try {
            const bytes = await pdfBytes(letter);
            await need('pdfjs', '../lib/pdf.min.js', () => !!window.pdfjsLib);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.min.js';
            const pdf = await window.pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
            const box = $('preview');
            box.textContent = '';
            const scale = 1.6 * Math.min(2, window.devicePixelRatio || 1);
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const vp = page.getViewport({ scale: scale });
                const cv = document.createElement('canvas');
                cv.width = Math.floor(vp.width);
                cv.height = Math.floor(vp.height);
                cv.setAttribute('role', 'img');
                cv.setAttribute('aria-label', 'Seite ' + i + ' von ' + pdf.numPages);
                box.append(cv);
                await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
            }
            $('preview-card').hidden = false;
            $('h-prev').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            await infoDialog('Vorschau nicht erstellt', 'Die Vorschau konnte nicht erzeugt werden. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.');
        }
        btn.disabled = false;
    }
    $('btn-preview').addEventListener('click', preview);
    $('btn-docx').addEventListener('click', () => make('docx', $('btn-docx')));
    $('btn-pdf').addEventListener('click', () => make('pdf', $('btn-pdf')));
})();
