(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const MAX_ROWS = 400;

    // Nichts wird gespeichert: alle Eingaben leben nur im geöffneten Fenster.

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

    function announce(t) { const l = $('live'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); }

    /* ---------- Schülerliste ---------- */

    // Jede Zeile: { n: Name, v: Vorname, k: Klasse/Tutor }
    let rows = [];
    for (let i = 0; i < 5; i++) rows.push({ n: '', v: '', k: '' });

    const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 80);
    const isEmpty = r => !r.n && !r.v && !r.k;

    function renderRows(focusIdx) {
        const body = $('stu-body');
        body.textContent = '';
        rows.forEach((r, i) => {
            const mk = (f, label) => {
                const inp = el('input', { class: 'field', type: 'text', maxlength: '60', autocomplete: 'off', 'aria-label': label + ' (Zeile ' + (i + 1) + ')' });
                inp.value = r[f];
                inp.addEventListener('input', () => { r[f] = inp.value; count(); });
                inp.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const next = body.rows[i + 1];
                        if (next) next.querySelector('[data-f="' + f + '"]').focus();
                        else { addRow(); }
                    }
                });
                inp.setAttribute('data-f', f);
                return el('td', {}, [inp]);
            };
            const del = el('button', { type: 'button', class: 'btn small icon', 'aria-label': 'Zeile ' + (i + 1) + ' entfernen', text: '×' });
            del.addEventListener('click', () => { rows.splice(i, 1); if (!rows.length) rows.push({ n: '', v: '', k: '' }); renderRows(); });
            const tr = el('tr', i > 0 && i % 18 === 0 ? { class: 'stu-page' } : {}, [
                el('td', { class: 'nr', text: String(i + 1) }), mk('n', 'Name'), mk('v', 'Vorname'), mk('k', 'Klasse/Tutor'), el('td', { class: 'del' }, [del])
            ]);
            body.append(tr);
        });
        count();
        if (focusIdx != null && body.rows[focusIdx]) body.rows[focusIdx].querySelector('[data-f="n"]').focus();
    }

    function count() {
        const n = rows.filter(r => !isEmpty(r)).length;
        const pages = n > 18 ? 1 + Math.ceil((n - 18) / PER_FOLGESEITE) : 1;
        $('stu-count').textContent = n === 0 ? 'Noch keine Personen eingetragen.' : n + (n === 1 ? ' Person' : ' Personen') + (pages > 1 ? ', der Antrag hat ' + pages + ' Seiten.' : '.');
    }
    const PER_FOLGESEITE = 36;

    function addRow() {
        if (rows.length >= MAX_ROWS) { infoDialog('Höchstgrenze erreicht', 'Es sind höchstens ' + MAX_ROWS + ' Zeilen möglich.'); return; }
        rows.push({ n: '', v: '', k: '' });
        renderRows(rows.length - 1);
    }

    function appendPeople(list) {
        // Leere Startzeilen am Ende zuerst entfernen
        while (rows.length && isEmpty(rows[rows.length - 1])) rows.pop();
        let skipped = 0;
        list.forEach(p => {
            if (rows.length >= MAX_ROWS) { skipped++; return; }
            rows.push(p);
        });
        if (!rows.length) rows.push({ n: '', v: '', k: '' });
        renderRows();
        return skipped;
    }

    $('stu-add').addEventListener('click', addRow);
    $('stu-sort').addEventListener('click', () => {
        const filled = rows.filter(r => !isEmpty(r));
        filled.sort((a, b) => a.n.localeCompare(b.n, 'de') || a.v.localeCompare(b.v, 'de'));
        rows = filled.length ? filled : [{ n: '', v: '', k: '' }];
        renderRows();
    });
    $('stu-clear').addEventListener('click', () => {
        if (!rows.some(r => !isEmpty(r))) return;
        rows = [{ n: '', v: '', k: '' }, { n: '', v: '', k: '' }, { n: '', v: '', k: '' }];
        renderRows();
        announce('Liste geleert');
    });
    $('f-ganz').addEventListener('change', () => { $('stu-area').hidden = $('f-ganz').checked; });

    /* ---------- CSV und Text einlesen ---------- */

    function decode(buf) {
        let u = new Uint8Array(buf);
        if (u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF) u = u.subarray(3);
        try { return new TextDecoder('utf-8', { fatal: true }).decode(u); }
        catch (e) { return new TextDecoder('windows-1252').decode(u); }
    }

    function splitLine(line, d) {
        const out = [];
        let cur = '', q = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (q) {
                if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
                else cur += c;
            } else if (c === '"') q = true;
            else if (c === d) { out.push(cur); cur = ''; }
            else cur += c;
        }
        out.push(cur);
        return out.map(s => s.trim());
    }

    const HEAD = {
        n: /^(nachname|familienname|langname|name)$/i,
        v: /^(vorname|rufname)$/i,
        k: /^(klasse\/tutor|klasse|stammklasse|stammgruppe|kurs|tutor(in)?|klassenlehrer(in)?|klassenleitung)$/i
    };

    function parsePeople(text) {
        const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
        if (!lines.length) return [];
        // Trennzeichen: Semikolon, Tabulator oder Komma, je nachdem was in den ersten Zeilen am häufigsten vorkommt
        const sample = lines.slice(0, 8).join('\n');
        const cnt = ch => (sample.match(new RegExp(ch === '\t' ? '\\t' : '\\' + ch, 'g')) || []).length;
        let d = ';';
        const c = { ';': cnt(';'), '\t': cnt('\t'), ',': cnt(',') };
        if (c[';'] === 0) d = c['\t'] >= c[','] && c['\t'] > 0 ? '\t' : ',';
        const table = lines.map(l => splitLine(l, d));
        // Kopfzeile erkennen
        let idx = { n: 0, v: 1, k: 2, k2: -1 };
        let start = 0;
        const first = table[0];
        const hit = first.map(h => ({ n: HEAD.n.test(h), v: HEAD.v.test(h), k: HEAD.k.test(h) }));
        if (hit.some(h => h.n || h.v || h.k) && hit.filter(h => h.n || h.v || h.k).length >= 2) {
            start = 1;
            idx = { n: -1, v: -1, k: -1, k2: -1 };
            first.forEach((h, i) => {
                if (HEAD.v.test(h) && idx.v < 0) idx.v = i;
                else if (HEAD.n.test(h) && idx.n < 0) idx.n = i;
                else if (HEAD.k.test(h)) { if (idx.k < 0) idx.k = i; else if (idx.k2 < 0) idx.k2 = i; }
            });
            if (idx.n < 0 && idx.v >= 0) idx.n = idx.v === 0 ? 1 : 0;
            if (idx.n < 0) idx.n = 0;
        }
        const out = [];
        for (let i = start; i < table.length; i++) {
            const r = table[i];
            const get = j => (j >= 0 && j < r.length ? r[j] : '');
            let n = get(idx.n), v = get(idx.v), k = get(idx.k);
            if (idx.k2 >= 0 && get(idx.k2)) k = k ? k + '/' + get(idx.k2) : get(idx.k2);
            const p = { n: clean(n, 60), v: clean(v, 60), k: clean(k, 40) };
            if (!isEmpty(p)) out.push(p);
        }
        return out;
    }

    function takeText(text, sourceName) {
        const people = parsePeople(text);
        if (!people.length) { infoDialog('Keine Namen gefunden', 'In ' + (sourceName || 'dem Text') + ' wurden keine Namen erkannt. Erwartet wird: Name, Vorname, Klasse/Tutor, getrennt durch Semikolon, Komma oder Tabulator.'); return; }
        const skipped = appendPeople(people);
        announce(people.length + ' Personen übernommen');
        if (skipped) infoDialog('Nicht alles übernommen', skipped + ' Personen passten nicht mehr in die Liste (höchstens ' + MAX_ROWS + ').');
    }

    $('stu-file').addEventListener('click', () => $('stu-file-input').click());
    $('stu-file-input').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { infoDialog('Datei zu groß', 'Die Datei ist größer als 2 MB und sieht nicht nach einer Namensliste aus.'); return; }
        try { takeText(decode(await f.arrayBuffer()), 'der Datei'); }
        catch (err) { infoDialog('Datei nicht lesbar', 'Die Datei konnte nicht gelesen werden.'); }
    });
    $('stu-paste-btn').addEventListener('click', () => {
        const t = $('stu-paste').value;
        if (!t.trim()) return;
        takeText(t, 'dem eingefügten Text');
        $('stu-paste').value = '';
    });

    /* ---------- Formular lesen ---------- */

    const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    function fmtDate(iso, withYear) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        if (!m) return '';
        const d = new Date(+m[1], +m[2] - 1, +m[3]);
        return WT[d.getDay()] + ', ' + m[3] + '.' + m[2] + '.' + (withYear ? m[1] : '');
    }

    function readForm() {
        const v = (id, max) => clean($(id).value, max);
        let datum = '';
        const d1 = $('f-datum').value, d2 = $('f-datum2').value;
        if (d1 && d2 && d2 > d1) datum = fmtDate(d1, false) + ' – ' + fmtDate(d2, true);
        else if (d1) datum = fmtDate(d1, true);
        return {
            exkursion: $('t-exk').checked,
            sport: $('t-sport').checked,
            std: v('f-std', 12),
            datum: datum,
            von: $('f-von').value,
            bis: $('f-bis').value,
            klasse: v('f-klasse', 40),
            lehrer: v('f-lehrer', 60),
            begleitung: v('f-begl', 80),
            ziel: v('f-ziel', 140),
            treff: v('f-treff', 60),
            treffzeit: $('f-treffzeit').value,
            ganz: $('f-ganz').checked,
            students: rows.filter(r => !isEmpty(r)).map(r => ({ n: clean(r.n, 60), v: clean(r.v, 60), k: clean(r.k, 40) }))
        };
    }

    /* ---------- Datei erzeugen ---------- */

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

    /* Kreuze des Vordrucks (Seite 1): Schlüssel, Beschriftung, Einrückung */
    const CHECKS = [
        ['Anlass', [
            ['fort', 'für eine Fortbildungsveranstaltung der SenBJF', 0],
            ['gruende', 'aus folgenden Gründen', 0]]],
        ['Beigefügte Unterlagen', [
            ['u-programm', 'Programm', 0], ['u-einladung', 'Einladung', 0],
            ['u-nachweis', 'Nachweis der Förderungswürdigkeit (des Veranstalters bzw. der Veranstaltung)', 0],
            ['u-mitglied', 'Erklärung über Mitgliedschaft', 0],
            ['u-nachgereicht', 'Folgende Unterlagen werden nachgereicht', 0],
            ['u-sonst', 'Eigene Unterlage (leeres Kästchen)', 0]]],
        ['A  Grundlage eines Urlaubs nach der SUrlVO', [
            ['a2', '§ 2 Urlaub zur Wahrnehmung staatsbürgerlicher Pflichten und Rechte', 0],
            ['a3a', '§ 3 a Urlaub für Zwecke der militärischen und zivilen Verteidigung', 0],
            ['a4', '§ 4 Absatz 1', 0],
            ['a4n1', 'Nr. 1 Bildungsveranstaltungen, die staatspolitischen Zwecken dienen (Förderungswürdigkeit)', 1],
            ['a4n2', 'Nr. 2 Kirchliche Zwecke', 1],
            ['a4n3', 'Nr. 3 Veranstaltungen, die von Nutzen für die dienstliche Tätigkeit sind', 1],
            ['a4n4', 'Nr. 4 gewerkschaftliche Zwecke / Veranstaltungen von Berufsverbänden (Mitgliedschaft)', 1],
            ['a4n5', 'Nr. 5 Sportveranstaltungen (besonderes Interesse des Landes Berlin muss anerkannt sein)', 1],
            ['a4n6', 'Nr. 6 Olympisches Komitee, nationale / internationale Dachorganisationen von Sportverbänden', 1],
            ['a4n7', 'Nr. 7 Ablegen von Prüfungen im Rahmen einer Fortbildung', 1],
            ['a5', '§ 5 Urlaub für ehrenamtliche Jugendarbeit', 0]]],
        ['B  Grundlage eines Sonderurlaubs (Ausführungsvorschriften zu § 7 SUrlVO)', [
            ['b1', '§ 1 Absatz 1 – Persönliche Gründe', 0],
            ['b1n1', 'Nr. 1 Niederkunft der Ehefrau oder der eingetragenen Lebenspartnerin (1 Tag)', 1],
            ['b1n2', 'Nr. 2 Tod der Ehefrau, des Ehemannes, der eingetragenen Lebenspartnerin oder des Lebenspartners, eines Kindes oder Elternteils (2 Tage)', 1],
            ['b1n3', 'Nr. 3 Umzug aus dienstlichen Gründen an einen anderen Ort (1 Tag)', 1],
            ['b1n4', 'Nr. 4 Schwere Erkrankung', 1],
            ['b1n4a', 'eines Angehörigen, soweit er in dem selben Haushalt lebt (1 Tag im Kalenderjahr)', 2],
            ['b2', '§ 2 Sonstige dringende Fälle (bis zu 3 Tage)', 0]]],
        ['C  Grundlage eines Sonderurlaubs, zur weiteren Veranlassung an Personalstelle', [
            ['c7', '§ 7 Nr. 5 Schwere Erkrankung', 0],
            ['c7a', 'eines Kindes, das das 12. Lebensjahr noch nicht vollendet hat', 1],
            ['c7b', 'einer Betreuungsperson (Kind unter 8 Jahren)', 1],
            ['c8', '§ 8 Urlaub zur Durchführung einer Heilkur', 0],
            ['c9', '§ 9 Urlaub zur Wahrnehmung besonderer Aufgaben und für eine fremdsprachliche Aus- oder Fortbildung', 0],
            ['c10', '§ 10 Urlaub aus sonstigen Anlässen', 0]]],
        ['D  Bildungsurlaub', [['d', 'Bildungsurlaub (Berliner Bildungsurlaubsgesetz)', 0]]],
        ['Erklärungen', [
            ['e-merk', 'Von dem „Merkblatt zum Antrag auf Freistellung“ habe ich Kenntnis genommen.', 0],
            ['e-angest', 'Ich bin im Angestelltenverhältnis beschäftigt; mir ist bekannt, dass die genannten Vorschriften sinngemäß auch für Angestellte gelten. (…)', 0]]]
    ];
    function buildChecks() {
        const root = $('fr-checks');
        CHECKS.forEach(g => {
            const fs = document.createElement('fieldset');
            fs.className = 'chk-group';
            const lg = document.createElement('legend');
            lg.textContent = g[0];
            fs.append(lg);
            g[1].forEach(it => {
                const lb = document.createElement('label');
                lb.className = 'check chk-l' + it[2];
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.dataset.k = it[0];
                lb.append(cb, ' ' + it[1]);
                fs.append(lb);
            });
            root.append(fs);
        });
    }
    buildChecks();

    function isFrei() { return $('m-frei').checked; }
    function fmtShort(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
    }
    function readFrei() {
        const v = (id, max) => clean($(id).value, max);
        const nach = v('fr-name', 60), vor = v('fr-vorname', 60);
        const d1 = $('fr-von').value, d2 = $('fr-bis').value;
        const mehr = d1 && d2 && d2 > d1;
        return {
            nameErst: nach && vor ? nach + ', ' + vor : nach || vor,
            nameZweit: [vor, nach].filter(Boolean).join(' '),
            modus: d1 ? (mehr ? 'bis' : 'am') : '',
            von: fmtShort(d1), bis: mehr ? fmtShort(d2) : '',
            von2: fmtShort(d1), bis2: fmtShort(mehr ? d2 : d1),
            telefon: v('fr-tel', 30), personalnr: v('fr-pnr', 30), anschrift: v('fr-anschrift', 90),
            nach: nach,
            checks: Array.from(document.querySelectorAll('#fr-checks input[data-k]:checked')).map(c => c.dataset.k),
            grund: String($('fr-grund').value || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').slice(0, 500),
            usonst: v('fr-usonst', 60), tage1: v('fr-tage1', 6), tage2: v('fr-tage2', 6)
        };
    }

    async function build() {
        if (isFrei()) {
            await need('pdflib', '../lib/pdf-lib.min.js', () => !!window.PDFLib);
            await need('fontkit', '../lib/fontkit.umd.min.js', () => !!window.fontkit);
            await need('pdf2', 'pdf2.js', () => !!window.FreistellungPdf);
            return window.FreistellungPdf.build(readFrei());
        }
        await need('pdflib', '../lib/pdf-lib.min.js', () => !!window.PDFLib);
        await need('fontkit', '../lib/fontkit.umd.min.js', () => !!window.fontkit);
        await need('pdf', 'pdf.js', () => !!window.AntragPdf);
        return window.AntragPdf.build(readForm());
    }

    const safe = s => s.replace(/[^\w\-äöüÄÖÜß]+/g, '_').replace(/^_+|_+$/g, '');
    function baseName() {
        if (isFrei()) {
            const n = safe(readFrei().nach);
            return 'Freistellung' + (n ? '-' + n : '') + '-' + new Date().toLocaleDateString('sv-SE');
        }
        const f = readForm();
        const art = f.exkursion && !f.sport ? 'Exkursion' : f.sport && !f.exkursion ? 'Sportwettkampf' : 'Antrag';
        const kl = safe(f.klasse);
        return 'Antrag-' + art + (kl ? '-' + kl : '') + '-' + new Date().toLocaleDateString('sv-SE');
    }

    async function preview() {
        const btn = $('btn-preview');
        btn.disabled = true;
        try {
            const res = await build();
            await need('pdfjs', '../lib/pdf.min.js', () => !!window.pdfjsLib);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.min.js';
            const pdf = await window.pdfjsLib.getDocument({ data: res.bytes.slice(), isEvalSupported: false }).promise;
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
            const w = $('warn');
            w.textContent = '';
            if (res.warnings.length) {
                w.append(el('b', { text: 'Bitte beachten:' }), el('ul', { class: 'warn-list' }, res.warnings.map(t => el('li', { text: t }))));
                w.hidden = false;
            } else w.hidden = true;
            $('preview-card').hidden = false;
            $('h-prev').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            await infoDialog('Vorschau nicht erstellt', 'Die Vorschau konnte nicht erzeugt werden. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.');
        }
        btn.disabled = false;
    }

    async function makePdf() {
        const btn = $('btn-pdf');
        btn.disabled = true;
        try {
            const res = await build();
            saveBytes(res.bytes, baseName() + '.pdf', 'application/pdf');
            if (res.warnings.length) await infoDialog('Bitte beachten', '', res.warnings);
        } catch (err) {
            await infoDialog('Datei nicht erstellt', 'Beim Erstellen ist ein Fehler aufgetreten. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.');
        }
        btn.disabled = false;
    }

    $('btn-preview').addEventListener('click', preview);
    async function makeDocx() {
        const btn = $('btn-docx');
        btn.disabled = true;
        try {
            await need('fflate', '../lib/fflate.js', () => !!window.fflate);
            let bytes;
            if (isFrei()) {
                await need('docx2', 'docx2.js', () => !!window.FreistellungDocx);
                bytes = await window.FreistellungDocx.build(readFrei());
            } else {
                await need('docx', 'docx.js', () => !!window.AntragDocx);
                bytes = await window.AntragDocx.build(readForm());
            }
            saveBytes(bytes, baseName() + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        } catch (err) {
            await infoDialog('Datei nicht erstellt', 'Beim Erstellen ist ein Fehler aufgetreten. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.');
        }
        btn.disabled = false;
    }
    function applyMode() {
        const frei = isFrei();
        $('mode-antrag').hidden = frei;
        $('mode-frei').hidden = !frei;
        $('preview-card').hidden = true;
    }
    $('m-antrag').addEventListener('change', applyMode);
    $('m-frei').addEventListener('change', applyMode);
    $('btn-pdf').addEventListener('click', makePdf);
    $('btn-docx').addEventListener('click', makeDocx);

    renderRows();
})();
