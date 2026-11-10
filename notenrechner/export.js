/* PDF-Export des Notenrechners. Wird erst beim ersten Export geladen. */
(function () {
    'use strict';

    const NR = window.NR;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Skript nicht ladbar: ' + src));
            document.head.append(s);
        });
    }

    async function fetchBytes(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('Datei nicht ladbar: ' + url);
        return new Uint8Array(await r.arrayBuffer());
    }

    const fmt2 = x => x.toFixed(2).replace('.', ',');
    const fmtT = x => String(Math.round(x * 100) / 100).replace('.', ',');

    /* ---------- Spalten und Werte je Lerngruppe ---------- */

    function catList(g) {
        if (g.stufe === 'sek1') { const out = []; g.categories.forEach(c => { if (c.subs && c.subs.length) c.subs.forEach(s => out.push(s)); else out.push(c); }); return out; }
        return [
            { id: 'm', name: 'Mündlich', slots: g.slots.m },
            { id: 's', name: 'Sonstige', slots: g.slots.s },
            { id: 'k', name: 'Klausur', slots: g.slots.k }
        ];
    }

    function groupTitle(g) {
        if (g.stufe === 'sek2') {
            return 'Sek II · ' + ({ gk13: 'Grundkurs 1.–3. Kurshalbjahr', gk4: 'Grundkurs 4. Kurshalbjahr', lk13: 'Leistungskurs 1.–3. Kurshalbjahr', lk4: 'Leistungskurs 4. Kurshalbjahr' }[g.course] || 'Grundkurs');
        }
        return 'Sek I · ' + (g.tendency ? 'mit Tendenz' : 'ohne Tendenz');
    }

    function groupWeights(g) {
        if (g.stufe === 'sek2') return 'Allgemeiner Teil: mündlich ' + g.atWeights.m + ' %, sonstige ' + g.atWeights.s + ' %';
        const sum = g.categories.reduce((a, c) => a + (c.weight > 0 ? c.weight : 0), 0);
        return 'Wertung: ' + g.categories.map(c => c.name + ' ' + (sum > 0 && c.weight > 0 ? Math.round(c.weight / sum * 100) : 0) + ' %').join(' · ');
    }

    // Liefert { groups: [{label, span}], heads: [..], w: [Gewichte], bold: [Spalte fett?], rows: [[Texte]] }
    function layoutFor(g, only) {
        const cols = [];           // { head, weight, bold, get(st, ctx) }
        const heads = [];          // Gruppenköpfe über den Spalten
        const sek1 = g.stufe === 'sek1';
        const sum = sek1 ? g.categories.reduce((a, c) => a + (c.weight > 0 ? c.weight : 0), 0) : 0;
        const cl = catList(g);

        function addCat(c, label, withMean, meanGet) {
            const start = cols.length;
            for (let i = 0; i < c.slots; i++) {
                cols.push({ head: String(i + 1), weight: 1, get: st => ((st.grades && st.grades[c.id]) || [])[i] || '' });
            }
            if (withMean) cols.push({ head: 'Ø', weight: 1.5, get: meanGet });
            heads.push({ label: label, from: start, to: cols.length - 1 });
        }
        function addSingle(head, weight, bold, get) {
            const idx = cols.length;
            cols.push({ head: '', weight: weight, bold: bold, get: get });
            heads.push({ label: head, from: idx, to: idx });
        }

        if (sek1) {
            const pct = (list, c) => {
                const sm = list.reduce((a, x) => a + (x.weight > 0 ? x.weight : 0), 0);
                return sm > 0 && c.weight > 0 ? Math.round(c.weight / sm * 100) : 0;
            };
            const meanOf = id => (st, ctx) => {
                const x = ctx.calc.byId[id];
                return x && x.note != null ? fmt2(x.note) : '';
            };
            g.categories.forEach(c => {
                if (c.subs && c.subs.length) {
                    c.subs.forEach(s => addCat(s, c.name + ' › ' + s.name + ' · ' + pct(c.subs, s) + ' %', true, meanOf(s.id)));
                    addSingle('Ø ' + c.name, 2.6, false, meanOf(c.id));
                } else addCat(c, c.name + ' · ' + pct(g.categories, c) + ' %', true, meanOf(c.id));
            });
            addSingle('Ø', 1.7, false, (st, ctx) => ctx.calc.total == null ? '' : fmt2(ctx.calc.total));
            addSingle('Rechn.', 1.5, false, (st, ctx) => ctx.calc.grade == null ? '' : String(g.tendency ? ctx.calc.tgrade : ctx.calc.grade));
            addSingle('Note', 1.5, true, (st, ctx) => {
                const f = NR.sek1Final(g, st, ctx.calc);
                if (f == null) return '';
                return String(f) + (NR.sek1Over(g, st) != null && String(f) !== String(g.tendency ? ctx.calc.tgrade : ctx.calc.grade) && NR.sek1Options(g, ctx.calc).map(String).indexOf(String(f)) === -1 ? '*' : '');
            });
        } else {
            const avg = a => a.length ? fmtT(a.reduce((x, y) => x + y, 0) / a.length) : '';
            addCat(cl[0], 'Mündlich · ' + g.atWeights.m + ' %', true, (st, ctx) => avg(ctx.s2.m));
            addCat(cl[1], 'Sonstige · ' + g.atWeights.s + ' %', true, (st, ctx) => avg(ctx.s2.s));
            addSingle('AT', 1.5, false, (st, ctx) => {
                const a = ctx.s2.at;
                if (!a) return '';
                return a.value == null ? fmtT(a.exact) + ' ?' : String(a.value);
            });
            addCat(cl[2], 'Klausuren', false);
            addSingle(g.course === 'lk13' ? 'Σ Kl.' : 'Klausur', 1.6, false, (st, ctx) => {
                const k = ctx.s2.kl;
                if (!k) return '';
                return k.value == null ? fmtT(k.exact) + ' ?' : (k.provisional ? k.single + ' ×2' : String(k.value));
            });
            addSingle('Punkte', 1.5, true, (st, ctx) => ctx.s2.points != null ? String(ctx.s2.points) : (ctx.s2.tieFinal ? '?' : ''));
            addSingle('Note', 1.5, true, (st, ctx) => ctx.s2.note || '');
        }

        const rows = (only || g.students).map(st => {
            const ctx = sek1 ? { calc: NR.calcSek1(g, st) } : { s2: NR.calcSek2(g, st) };
            return { name: st.name, st: st, cells: cols.map(c => c.get(st, ctx)) };
        });
        return { cols: cols, heads: heads, rows: rows };
    }

    /* ---------- Zeichnen ---------- */

    async function build(groups) {
        if (!window.PDFLib) await loadScript('../lib/pdf-lib.min.js');
        if (!window.fontkit) await loadScript('../lib/fontkit.umd.min.js');
        const PDFLib = window.PDFLib;
        const rgb = PDFLib.rgb;
        const [regBytes, boldBytes] = await Promise.all([
            fetchBytes('../lib/fonts/DejaVuSans.ttf'),
            fetchBytes('../lib/fonts/DejaVuSans-Bold.ttf')
        ]);
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        const font = await doc.embedFont(regBytes, { subset: true });
        const bold = await doc.embedFont(boldBytes, { subset: true });
        const dateStr = new Date().toLocaleDateString('de-DE');

        const ink = rgb(0.13, 0.16, 0.2), grey = rgb(0.45, 0.48, 0.52), line = rgb(0.72, 0.76, 0.8);
        const headBg = rgb(0.9, 0.93, 0.96), zebra = rgb(0.965, 0.975, 0.985), accent = rgb(0.18, 0.5, 0.76);

        function fit(text, f, size, maxW) {
            if (f.widthOfTextAtSize(text, size) <= maxW) return text;
            let t = text;
            while (t.length > 1 && f.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1);
            return t + '…';
        }

        groups.forEach((g, gi) => {
            const L = layoutFor(g);
            const gradeCols = L.cols.length;
            const landscape = true; // immer A4 quer
            const W = landscape ? 841.89 : 595.28, H = landscape ? 595.28 : 841.89;
            const M = 30;
            const page = doc.addPage([W, H]);

            function text(t, x, y, size, f, color, align, maxW) {
                if (!t) return;
                let s = maxW ? fit(t, f, size, maxW) : t;
                const w = f.widthOfTextAtSize(s, size);
                const px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
                page.drawText(s, { x: px, y: y, size: size, font: f, color: color || ink });
            }

            // Kopf
            text(g.name, M, H - M - 14, 16, bold, ink, 'left', W - 2 * M);
            text(groupTitle(g), M, H - M - 30, 9, font, grey, 'left', W - 2 * M);
            text(groupWeights(g), M, H - M - 42, 8, font, grey, 'left', W - 2 * M);
            text('Stand: ' + dateStr, W - M, H - M - 14, 8, font, grey, 'right');
            const topY = H - M - 52;

            // Fuß
            text('Notenrechner · Seite ' + (gi + 1) + ' von ' + groups.length, M, M - 10, 7, font, grey, 'left');
            if (g.stufe === 'sek1') text('* Note nach pädagogischem Ermessen gesetzt.', W - M, M - 10, 7, font, grey, 'right');
            if (g.stufe === 'sek2') text('Ein „?“ bedeutet: Entscheidung bei x,5 steht noch aus.', W - M, M - 10, 7, font, grey, 'right');

            if (!L.rows.length) {
                text('Diese Lerngruppe enthält noch keine Namen.', M, topY - 20, 10, font, grey, 'left');
                return;
            }

            // Spaltenbreiten
            const nameW = Math.min(135, (W - 2 * M) * 0.24);
            const totalWeight = L.cols.reduce((a, c) => a + c.weight, 0);
            const unit = Math.min((W - 2 * M - nameW) / totalWeight, 46);
            const xs = [M + nameW];
            L.cols.forEach(c => xs.push(xs[xs.length - 1] + c.weight * unit));
            const right = xs[xs.length - 1];

            // Zeilenhöhe so wählen, dass alles auf die Seite passt
            const hh = 15;
            const bottomY = M + 6;
            const avail = topY - bottomY - 2 * hh;
            const rowH = Math.min(21, avail / L.rows.length);
            const fs = Math.max(4.5, Math.min(10, rowH * 0.56));
            const hfs = Math.min(8, hh * 0.55);

            // Kopfzeilen
            page.drawRectangle({ x: M, y: topY - 2 * hh, width: right - M, height: 2 * hh, color: headBg });
            page.drawRectangle({ x: M, y: topY - 2 * hh, width: right - M, height: 1.2, color: accent });
            text('Name', M + 4, topY - hh - 3.5, hfs, bold, ink, 'left');
            L.heads.forEach(h => {
                const x0 = xs[h.from], x1 = xs[h.to + 1];
                const single = h.from === h.to && !L.cols[h.from].head;
                if (single) {
                    text(h.label, (x0 + x1) / 2, topY - hh - 3.5, hfs, bold, ink, 'center', x1 - x0 - 2);
                } else {
                    text(h.label, (x0 + x1) / 2, topY - hh * 0.72, hfs, bold, ink, 'center', x1 - x0 - 2);
                    for (let i = h.from; i <= h.to; i++) {
                        text(L.cols[i].head, (xs[i] + xs[i + 1]) / 2, topY - hh * 1.72, hfs, font, grey, 'center');
                    }
                }
            });

            // Zeilen
            let y = topY - 2 * hh;
            L.rows.forEach((r, ri) => {
                const yb = y - rowH;
                if (ri % 2 === 1) page.drawRectangle({ x: M, y: yb, width: right - M, height: rowH, color: zebra });
                const ty = yb + (rowH - fs) / 2 + fs * 0.18;
                text(r.name, M + 4, ty, fs, font, ink, 'left', nameW - 8);
                r.cells.forEach((c, ci) => {
                    text(c, (xs[ci] + xs[ci + 1]) / 2, ty, fs, L.cols[ci].bold ? bold : font, ink, 'center', xs[ci + 1] - xs[ci] - 2);
                });
                y = yb;
            });

            // Linien
            const tableTop = topY, tableBottom = y;
            page.drawLine({ start: { x: M, y: tableBottom }, end: { x: right, y: tableBottom }, thickness: 0.8, color: line });
            const vlines = [M, xs[0]];
            L.heads.forEach(h => vlines.push(xs[h.to + 1]));
            vlines.forEach(x => page.drawLine({ start: { x: x, y: tableTop }, end: { x: x, y: tableBottom }, thickness: 0.5, color: line }));
            // feine Linien zwischen den Notenspalten (unterhalb der Kopfzeilen)
            for (let i = 1; i < xs.length - 1; i++) {
                page.drawLine({ start: { x: xs[i], y: tableTop - 2 * hh }, end: { x: xs[i], y: tableBottom }, thickness: 0.25, color: line });
            }
            page.drawLine({ start: { x: M, y: tableTop }, end: { x: right, y: tableTop }, thickness: 0.8, color: line });
        });

        return await doc.save();
    }

    /* ---------- Je Person: Noten und Bemerkungen in einer Tabelle ---------- */

    async function buildStudents(g, students) {
        if (!window.PDFLib) await loadScript('../lib/pdf-lib.min.js');
        if (!window.fontkit) await loadScript('../lib/fontkit.umd.min.js');
        const PDFLib = window.PDFLib, rgb = PDFLib.rgb;
        const [regBytes, boldBytes] = await Promise.all([fetchBytes('../lib/fonts/DejaVuSans.ttf'), fetchBytes('../lib/fonts/DejaVuSans-Bold.ttf')]);
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        const font = await doc.embedFont(regBytes, { subset: true });
        const bold = await doc.embedFont(boldBytes, { subset: true });
        const dateStr = new Date().toLocaleDateString('de-DE');
        const ink = rgb(0.13, 0.16, 0.2), grey = rgb(0.45, 0.48, 0.52), line = rgb(0.72, 0.76, 0.8);
        const headBg = rgb(0.9, 0.93, 0.96), zebra = rgb(0.965, 0.975, 0.985), accent = rgb(0.18, 0.5, 0.76);
        const W = 595.28, H = 841.89, M = 48;
        const FS = 9.5, LH = 13, PAD = 5;

        const L = layoutFor(g, students);
        const cl = catList(g);
        const nameOf = id => {
            if (g.stufe === 'sek1') {
                for (const c of g.categories) {
                    if (c.id === id) return c.name;
                    for (const s of (c.subs || [])) if (s.id === id) return c.name + ' › ' + s.name;
                }
            }
            const x = cl.find(k => k.id === id);
            return x ? x.name : '';
        };
        const wrapText = (t, f, size, maxW) => {
            const out = [];
            let cur = '';
            String(t).split(' ').forEach(w => {
                const test = cur ? cur + ' ' + w : w;
                if (cur && f.widthOfTextAtSize(test, size) > maxW) { out.push(cur); cur = w; } else cur = test;
            });
            if (cur) out.push(cur);
            return out.length ? out : [''];
        };
        const LABELS = { 'Ø': 'Durchschnitt', 'Rechn.': 'Rechnerische Note', 'Note': 'Note', 'AT': 'Allgemeiner Teil (AT)', 'Klausur': 'Klausur', 'Σ Kl.': 'Klausuren', 'Punkte': 'Notenpunkte' };

        const colX = [M, M + 125, M + 165, M + 215, M + 280];     // Bereich | Nr. | Note | Datum | Bemerkung
        const right = W - M;
        const remarkW = right - colX[4] - 2 * PAD;

        L.rows.forEach(r => {
            const st = r.st;
            // Zeilen der Tabelle
            const items = [];
            cl.forEach(c => {
                for (let i = 0; i < c.slots; i++) {
                    const gr = ((st.grades && st.grades[c.id]) || [])[i] || '';
                    const nobj = (st.notes && st.notes[c.id] && st.notes[c.id][i]) || null;
                    const nt = nobj ? nobj.t : '';
                    const dd = nobj && /^\d{4}-\d{2}-\d{2}$/.test(nobj.d || '') ? nobj.d.slice(8) + '.' + nobj.d.slice(5, 7) + '.' + nobj.d.slice(0, 4) : '';
                    if (gr || nt) items.push({ area: nameOf(c.id), nr: String(i + 1), grade: gr, note: nt, date: dd });
                }
            });
            // Ergebnisse
            const results = [];
            L.heads.forEach(h => {
                const single = h.from === h.to && !L.cols[h.from].head;
                if (single) {
                    const v = r.cells[h.from];
                    if (v === '' || v == null) return;
                    let label = LABELS[h.label] || h.label;
                    if (g.stufe === 'sek1' && /^Ø /.test(h.label)) label = h.label.replace(/^Ø /, 'Durchschnitt ');
                    results.push({ label: label, value: v, strong: !!L.cols[h.from].bold });
                } else {
                    for (let i = h.from; i <= h.to; i++) {
                        if (L.cols[i].head === 'Ø' && r.cells[i]) results.push({ label: 'Durchschnitt ' + h.label.replace(/ · \d+ %$/, ''), value: r.cells[i], strong: false });
                    }
                }
            });

            let page = null, y = 0, pageNo = 0;
            const text = (t, x, yy, size, f, color, align) => {
                if (t === '' || t == null) return;
                const w = f.widthOfTextAtSize(t, size);
                page.drawText(t, { x: align === 'center' ? x - w / 2 : x, y: yy, size: size, font: f, color: color || ink });
            };
            function newPage() {
                page = doc.addPage([W, H]);
                pageNo++;
                text(st.name, M, H - M - 12, 18, bold, ink);
                text(g.name + ' · ' + groupTitle(g), M, H - M - 30, 9, font, grey);
                text('Stand: ' + dateStr, right - font.widthOfTextAtSize('Stand: ' + dateStr, 8), H - M - 12, 8, font, grey);
                y = H - M - 52;
                if (items.length) tableHead();
            }
            function tableHead() {
                page.drawRectangle({ x: M, y: y - 20, width: right - M, height: 20, color: headBg });
                page.drawRectangle({ x: M, y: y - 20, width: right - M, height: 1.2, color: accent });
                text('Bereich', colX[0] + PAD, y - 14, 8.5, bold, ink);
                text('Nr.', colX[1] + (colX[2] - colX[1]) / 2, y - 14, 8.5, bold, ink, 'center');
                text(g.stufe === 'sek2' ? 'Punkte' : 'Note', colX[2] + (colX[3] - colX[2]) / 2, y - 14, 8.5, bold, ink, 'center');
                text('Datum', colX[3] + PAD, y - 14, 8.5, bold, ink);
                text('Bemerkung', colX[4] + PAD, y - 14, 8.5, bold, ink);
                y -= 20;
            }
            newPage();
            if (!items.length) { text('Noch keine Noten oder Bemerkungen eingetragen.', M, y - 6, 10, font, grey); y -= 24; }
            items.forEach((it, idx) => {
                const areaLines = wrapText(it.area, font, FS, colX[1] - colX[0] - 2 * PAD);
                const noteLines = it.note ? wrapText(it.note, font, FS, remarkW) : [''];
                const n = Math.max(areaLines.length, noteLines.length);
                const h = n * LH + 2 * PAD - 2;
                if (y - h < M + 20) { newPage(); }
                if (idx % 2 === 1) page.drawRectangle({ x: M, y: y - h, width: right - M, height: h, color: zebra });
                areaLines.forEach((t, k) => text(t, colX[0] + PAD, y - PAD - 8 - k * LH + 1, FS, font, ink));
                text(it.nr, colX[1] + (colX[2] - colX[1]) / 2, y - PAD - 7, FS, font, ink, 'center');
                text(it.grade, colX[2] + (colX[3] - colX[2]) / 2, y - PAD - 7, FS, bold, ink, 'center');
                if (it.note) text(it.date, colX[3] + PAD, y - PAD - 7, FS - 1, font, grey);
                noteLines.forEach((t, k) => text(t, colX[4] + PAD, y - PAD - 8 - k * LH + 1, FS, font, ink));
                y -= h;
                page.drawLine({ start: { x: M, y: y }, end: { x: right, y: y }, thickness: 0.4, color: line });
            });
            y -= 22;
            // Ergebnisse
            if (results.length) {
                if (y - (results.length * 16 + 20) < M + 20) newPage();
                text('Ergebnis', M, y, 11, bold, ink);
                y -= 16;
                results.forEach(res => {
                    text(res.label, M + PAD, y, 9.5, res.strong ? bold : font, ink);
                    text(res.value, colX[2] + 40, y, 9.5, res.strong ? bold : font, ink, 'center');
                    y -= 15;
                });
                if (g.stufe === 'sek1' && /\*$/.test(String((results.find(x => x.label === 'Note') || {}).value || ''))) text('* Note nach pädagogischem Ermessen gesetzt.', M, y - 4, 8, font, grey);
                if (g.stufe === 'sek2' && results.some(x => /\?$/.test(x.value))) text('Ein „?“ bedeutet: Entscheidung bei x,5 steht noch aus.', M, y - 4, 8, font, grey);
            }
        });
        return await doc.save();
    }

    window.NRExport = { build: build, buildStudents: buildStudents };
})();
