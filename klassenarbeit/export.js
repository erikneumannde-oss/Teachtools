/* PDF-Übersicht der Arbeitenauswerter. Wird erst beim ersten Export geladen. */
(function () {
    'use strict';

    const KA = window.KA;

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

    const fmt = (x, d) => x.toFixed(d).replace('.', ',');
    const fmtT = x => String(Math.round(x * 100) / 100).replace('.', ',');

    async function build(a, ev) {
        if (!window.PDFLib) await loadScript('../lib/pdf-lib.min.js');
        if (!window.fontkit) await loadScript('../lib/fontkit.umd.min.js');
        const PDFLib = window.PDFLib, rgb = PDFLib.rgb;
        const [regBytes, boldBytes] = await Promise.all([fetchBytes('../lib/fonts/DejaVuSans.ttf'), fetchBytes('../lib/fonts/DejaVuSans-Bold.ttf')]);
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        const font = await doc.embedFont(regBytes, { subset: true });
        const bold = await doc.embedFont(boldBytes, { subset: true });

        const W = 595.28, H = 841.89, M = 36;
        const page = doc.addPage([W, H]);
        const ink = rgb(0.13, 0.16, 0.2), grey = rgb(0.45, 0.48, 0.52), line = rgb(0.72, 0.76, 0.8);
        const headBg = rgb(0.9, 0.93, 0.96), zebra = rgb(0.965, 0.975, 0.985), accent = rgb(0.18, 0.5, 0.76), navy = rgb(0.17, 0.24, 0.31);
        const noteRgb = { 1: rgb(0.153, 0.682, 0.376), 2: rgb(0.482, 0.714, 0.38), 3: rgb(0.831, 0.675, 0.05), 4: rgb(0.902, 0.569, 0.22), 5: rgb(0.827, 0.329, 0), 6: rgb(0.753, 0.224, 0.169) };

        function fit(t, f, size, maxW) {
            if (f.widthOfTextAtSize(t, size) <= maxW) return t;
            let s = t;
            while (s.length > 1 && f.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
            return s + '…';
        }
        function text(t, x, y, size, f, color, align, maxW) {
            if (t === '' || t == null) return;
            const s = maxW ? fit(String(t), f, size, maxW) : String(t);
            const w = f.widthOfTextAtSize(s, size);
            page.drawText(s, { x: align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y: y, size: size, font: f, color: color || ink });
        }

        // Kopf
        text(a.name, M, H - M - 14, 16, bold, ink, 'left', W - 2 * M - 90);
        text('Arbeitenauswerter · ' + (a.tend ? 'mit Tendenz' : 'ohne Tendenz') + ' · Gesamtpunktzahl ' + fmtT(a.max), M, H - M - 30, 9, font, grey, 'left', W - 2 * M);
        text('Stand: ' + new Date().toLocaleDateString('de-DE'), W - M, H - M - 14, 8, font, grey, 'right');
        const topY = H - M - 44;
        text('Notenrechner-Tools · Auswertung', M, M - 14, 7, font, grey, 'left');

        // Tabelle links
        const tableW = 330;
        const cols = a.useNumbers
            ? [{ h: 'Nr.', w: 40 }, { h: 'Punkte', w: 120 }, { h: '%', w: 90 }, { h: 'Note', w: 80 }]
            : [{ h: 'Nr.', w: 28 }, { h: 'Name', w: 128 }, { h: 'Punkte', w: 66 }, { h: '%', w: 58 }, { h: 'Note', w: 50 }];
        const xs = [M];
        cols.forEach(c => xs.push(xs[xs.length - 1] + c.w));
        const right = xs[xs.length - 1];
        const hh = 18;
        const avail = topY - (M + 8) - hh;
        const n = Math.max(a.students.length, 1);
        const rowH = Math.min(18, avail / n);
        const fs = Math.max(4.5, Math.min(9.5, rowH * 0.58));

        page.drawRectangle({ x: M, y: topY - hh, width: right - M, height: hh, color: headBg });
        page.drawRectangle({ x: M, y: topY - hh, width: right - M, height: 1.2, color: accent });
        cols.forEach((c, i) => text(c.h, i === 1 && !a.useNumbers ? xs[i] + 4 : (xs[i] + xs[i + 1]) / 2, topY - hh + 5.5, 8, bold, ink, i === 1 && !a.useNumbers ? 'left' : 'center'));

        let y = topY - hh;
        a.students.forEach((s, i) => {
            const yb = y - rowH;
            if (i % 2 === 1) page.drawRectangle({ x: M, y: yb, width: right - M, height: rowH, color: zebra });
            const ty = yb + (rowH - fs) / 2 + fs * 0.18;
            const r = ev.rows[i];
            let k = 0;
            text(String(i + 1), (xs[k] + xs[k + 1]) / 2, ty, fs, font, grey, 'center'); k++;
            if (!a.useNumbers) { text(s.name, xs[k] + 4, ty, fs, font, ink, 'left', cols[k].w - 8); k++; }
            text(s.pts == null ? '' : fmtT(s.pts), (xs[k] + xs[k + 1]) / 2, ty, fs, font, ink, 'center'); k++;
            text(s.pts == null ? '' : fmt(s.pts / a.max * 100, 1), (xs[k] + xs[k + 1]) / 2, ty, fs, font, grey, 'center'); k++;
            text(r.grade || '', (xs[k] + xs[k + 1]) / 2, ty, fs, bold, r.grade ? noteRgb[KA.baseNote(r.grade)] : ink, 'center');
            y = yb;
        });
        const bottom = y;
        page.drawLine({ start: { x: M, y: bottom }, end: { x: right, y: bottom }, thickness: 0.8, color: line });
        page.drawLine({ start: { x: M, y: topY }, end: { x: right, y: topY }, thickness: 0.8, color: line });
        xs.forEach(x => page.drawLine({ start: { x: x, y: topY }, end: { x: x, y: bottom }, thickness: 0.5, color: line }));

        // Rechte Spalte: Durchschnitt, Notenspiegel, Notenschlüssel
        const rx = right + 24, rw = W - M - rx;
        let ry = topY;
        page.drawRectangle({ x: rx, y: ry - 64, width: rw, height: 64, color: navy });
        text('Notendurchschnitt', rx + 10, ry - 18, 8, font, rgb(0.8, 0.85, 0.9), 'left');
        text(ev.avg == null ? '–' : fmt(ev.avg, 2), rx + 10, ry - 46, 24, bold, rgb(1, 1, 1), 'left');
        text(ev.n + ' von ' + a.students.length + ' bewertet', rx + rw - 8, ry - 22, 7.5, font, rgb(0.9, 0.93, 0.96), 'right');
        if (ev.avgPts != null) text('Ø ' + fmt(ev.avgPts, 1) + ' Punkte', rx + rw - 8, ry - 40, 7.5, font, rgb(0.9, 0.93, 0.96), 'right');
        ry -= 64 + 22;

        text('Notenspiegel', rx, ry, 9, bold, ink, 'left');
        ry -= 8;
        const mx = Math.max(1, ...Object.values(ev.counts));
        for (let k = 1; k <= 6; k++) {
            ry -= 20;
            page.drawRectangle({ x: rx, y: ry, width: 18, height: 16, color: noteRgb[k] });
            text(String(k), rx + 9, ry + 4.5, 9, bold, rgb(1, 1, 1), 'center');
            const bw = rw - 18 - 6 - 54;
            page.drawRectangle({ x: rx + 24, y: ry, width: bw, height: 16, color: rgb(0.894, 0.914, 0.933) });
            if (ev.counts[k] > 0) page.drawRectangle({ x: rx + 24, y: ry, width: Math.max(4, bw * ev.counts[k] / mx), height: 16, color: noteRgb[k] });
            text(ev.counts[k] + ' · ' + (ev.n ? Math.round(ev.counts[k] / ev.n * 100) : 0) + ' %', rx + rw, ry + 4.5, 8, font, ink, 'right');
        }
        if (a.tend) { ry -= 12; text('Tendenzen zählen zur ganzen Note.', rx, ry, 6.5, font, grey, 'left', rw); }
        ry -= 26;

        text('Notenschlüssel', rx, ry, 9, bold, ink, 'left');
        ry -= 6;
        const lab = KA.labels(a.tend);
        const th = KA.thresholdsInPoints(a);
        const krowH = Math.min(12, Math.max(8, (ry - (M + 8)) / (th.length + 1)));
        th.forEach((p, i) => {
            ry -= krowH;
            text(lab[i], rx + 2, ry + 2.5, 7.5, bold, ink, 'left');
            text('ab ' + fmtT(KA.round2(p)) + ' Punkten', rx + 34, ry + 2.5, 7.5, font, ink, 'left');
            text(fmt(p / a.max * 100, 1) + ' %', rx + rw, ry + 2.5, 7.5, font, grey, 'right');
        });
        ry -= krowH;
        text(lab[lab.length - 1], rx + 2, ry + 2.5, 7.5, bold, ink, 'left');
        text('darunter', rx + 34, ry + 2.5, 7.5, font, ink, 'left');

        return await doc.save();
    }


    /* ---------- Arbeit mit Kriterien (Sek I) ---------- */

    async function buildKrit(a, ev) {
        if (!window.PDFLib) await loadScript('../lib/pdf-lib.min.js');
        if (!window.fontkit) await loadScript('../lib/fontkit.umd.min.js');
        const PDFLib = window.PDFLib, rgb = PDFLib.rgb;
        const [regBytes, boldBytes] = await Promise.all([fetchBytes('../lib/fonts/DejaVuSans.ttf'), fetchBytes('../lib/fonts/DejaVuSans-Bold.ttf')]);
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        const font = await doc.embedFont(regBytes, { subset: true });
        const bold = await doc.embedFont(boldBytes, { subset: true });
        const W = 841.89, H = 595.28, M = 32;
        const page = doc.addPage([W, H]);
        const ink = rgb(0.13, 0.16, 0.2), grey = rgb(0.45, 0.48, 0.52), line = rgb(0.72, 0.76, 0.8);
        const headBg = rgb(0.9, 0.93, 0.96), zebra = rgb(0.965, 0.975, 0.985), accent = rgb(0.18, 0.5, 0.76), navy = rgb(0.17, 0.24, 0.31);
        const noteRgb = { 1: rgb(0.153, 0.682, 0.376), 2: rgb(0.482, 0.714, 0.38), 3: rgb(0.831, 0.675, 0.05), 4: rgb(0.902, 0.569, 0.22), 5: rgb(0.827, 0.329, 0), 6: rgb(0.753, 0.224, 0.169) };
        function fit(t, f, size, maxW) {
            if (f.widthOfTextAtSize(t, size) <= maxW) return t;
            let s = t;
            while (s.length > 1 && f.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
            return s + '…';
        }
        function text(t, x, y, size, f, color, align, maxW) {
            if (t === '' || t == null) return;
            const s = maxW ? fit(String(t), f, size, maxW) : String(t);
            const w = f.widthOfTextAtSize(s, size);
            page.drawText(s, { x: align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y: y, size: size, font: f, color: color || ink });
        }

        const wsum = a.crit.reduce((x, c) => x + (c.weight > 0 ? c.weight : 0), 0);
        const pctOf = c => (wsum > 0 && c.weight > 0 ? Math.round(c.weight / wsum * 100) : 0);
        text(a.name, M, H - M - 14, 16, bold, ink, 'left', W - 2 * M - 90);
        const lead = a.crit.find(c => c.id === a.lead);
        text('Arbeitenauswerter · ' + (a.tend ? 'mit Tendenz' : 'ohne Tendenz') + ' · ' + a.crit.map(c => c.name + ' ' + pctOf(c) + ' %').join(' · ')
            + (lead ? ' · Leitkriterium: ' + lead.name : ''), M, H - M - 30, 8.5, font, grey, 'left', W - 2 * M);
        text('Stand: ' + new Date().toLocaleDateString('de-DE'), W - M, H - M - 14, 8, font, grey, 'right');
        const topY = H - M - 42;
        text('Notenrechner-Tools · Auswertung' + (lead ? ' · * durch das Leitkriterium begrenzt' : ''), M, M - 14, 7, font, grey, 'left');

        // Spalten
        const cols = [{ h: 'Nr.', w: 22 }];
        if (!a.useNumbers) cols.push({ h: 'Name', w: 110, name: true });
        const groups = [];
        a.crit.forEach(c => {
            const pts = c.mode === 'points', subs = pts && c.subs.length;
            const start = cols.length;
            if (!pts) cols.push({ h: 'Note', w: 60, note: true });
            else {
                if (subs) c.subs.forEach(s => cols.push({ h: s.name + ' (' + fmtT(s.max) + ')', w: 34, small: true }));
                else cols.push({ h: 'von ' + fmtT(c.max), w: 38, small: true });
                if (subs) cols.push({ h: 'Σ ' + fmtT(KA.critMax(c)), w: 34 });
                cols.push({ h: 'Note', w: 32, note: true });
            }
            groups.push({ c: c, from: start, to: cols.length - 1 });
        });
        cols.push({ h: 'Gesamt', w: 44, total: true });
        const tableMax = W - 2 * M - 190;
        const sumW = cols.reduce((x, c) => x + c.w, 0);
        const scale = Math.min(1.25, tableMax / sumW);
        const xs = [M];
        cols.forEach(c => xs.push(xs[xs.length - 1] + c.w * scale));
        const right = xs[xs.length - 1];
        const hh = 15;
        const avail = topY - (M + 8) - 2 * hh;
        const n = Math.max(a.students.length, 1);
        const rowH = Math.min(17, avail / n);
        const fs = Math.max(4.5, Math.min(9, rowH * 0.58));

        page.drawRectangle({ x: M, y: topY - 2 * hh, width: right - M, height: 2 * hh, color: headBg });
        page.drawRectangle({ x: M, y: topY - 2 * hh, width: right - M, height: 1.2, color: accent });
        cols.forEach((c, i) => {
            const mid = (xs[i] + xs[i + 1]) / 2;
            if (c.name) text(c.h, xs[i] + 4, topY - hh - 3.5, 7.5, bold, ink, 'left');
            else if (i === 0 || c.total) text(c.h, mid, topY - hh - 3.5, 7.5, bold, ink, 'center', xs[i + 1] - xs[i] - 2);
            else text(c.h, mid, topY - 2 * hh + 5, 6.5, bold, ink, 'center', xs[i + 1] - xs[i] - 2);
        });
        groups.forEach(g => {
            const x0 = xs[g.from], x1 = xs[g.to + 1];
            text(g.c.name + ' · ' + pctOf(g.c) + ' %', (x0 + x1) / 2, topY - hh + 4.5, 7.5, bold, ink, 'center', x1 - x0 - 3);
        });

        let y = topY - 2 * hh;
        a.students.forEach((s, i) => {
            const yb = y - rowH;
            if (i % 2 === 1) page.drawRectangle({ x: M, y: yb, width: right - M, height: rowH, color: zebra });
            const ty = yb + (rowH - fs) / 2 + fs * 0.18;
            const r = ev.rows[i];
            let k = 0;
            const mid = () => (xs[k] + xs[k + 1]) / 2;
            text(String(i + 1), mid(), ty, fs, font, grey, 'center'); k++;
            if (!a.useNumbers) { text(s.name, xs[k] + 4, ty, fs, font, ink, 'left', cols[k].w * scale - 8); k++; }
            a.crit.forEach(c => {
                const pts = c.mode === 'points', subs = pts && c.subs.length;
                const vals = (s.k && s.k[c.id]) || [];
                const t = r.teil[c.id];
                if (!pts) { const g = vals[0]; text(g || '', mid(), ty, fs, bold, g ? noteRgb[KA.baseNote(g)] : ink, 'center'); k++; return; }
                const nIn = Math.max(1, c.subs.length);
                for (let q = 0; q < nIn; q++) { text(vals[q] == null ? '' : fmtT(vals[q]), mid(), ty, fs, font, ink, 'center'); k++; }
                if (subs) { text(t.sum == null ? '' : fmtT(t.sum), mid(), ty, fs, font, grey, 'center'); k++; }
                text(t.grade || '', mid(), ty, fs, bold, t.grade ? noteRgb[KA.baseNote(t.grade)] : ink, 'center'); k++;
            });
            text(r.grade ? r.grade + (r.capped ? '*' : '') : '', mid(), ty, fs, bold, r.grade ? noteRgb[KA.baseNote(r.grade)] : ink, 'center');
            y = yb;
        });
        const bottom = y;
        page.drawLine({ start: { x: M, y: bottom }, end: { x: right, y: bottom }, thickness: 0.8, color: line });
        page.drawLine({ start: { x: M, y: topY }, end: { x: right, y: topY }, thickness: 0.8, color: line });
        xs.forEach(x => page.drawLine({ start: { x: x, y: topY - hh }, end: { x: x, y: bottom }, thickness: 0.4, color: line }));
        [xs[0], xs[xs.length - 1]].concat(groups.map(g => xs[g.from]), [right]).forEach(x => page.drawLine({ start: { x: x, y: topY }, end: { x: x, y: bottom }, thickness: 0.7, color: line }));

        // Rechts: Durchschnitt und Notenspiegel
        const rx = right + 22, rw = W - M - rx;
        let ry = topY;
        page.drawRectangle({ x: rx, y: ry - 64, width: rw, height: 64, color: navy });
        text('Notendurchschnitt', rx + 10, ry - 18, 8, font, rgb(0.8, 0.85, 0.9), 'left');
        text(ev.avg == null ? '–' : fmt(ev.avg, 2), rx + 10, ry - 46, 24, bold, rgb(1, 1, 1), 'left');
        text(ev.n + ' von ' + a.students.length + ' bewertet', rx + rw - 8, ry - 22, 7.5, font, rgb(0.9, 0.93, 0.96), 'right');
        ry -= 64 + 22;
        text('Notenspiegel', rx, ry, 9, bold, ink, 'left');
        ry -= 8;
        const mx = Math.max(1, ...Object.values(ev.counts));
        for (let k = 1; k <= 6; k++) {
            ry -= 20;
            page.drawRectangle({ x: rx, y: ry, width: 18, height: 16, color: noteRgb[k] });
            text(String(k), rx + 9, ry + 4.5, 9, bold, rgb(1, 1, 1), 'center');
            const bw = rw - 18 - 6 - 54;
            page.drawRectangle({ x: rx + 24, y: ry, width: bw, height: 16, color: rgb(0.894, 0.914, 0.933) });
            if (ev.counts[k] > 0) page.drawRectangle({ x: rx + 24, y: ry, width: Math.max(4, bw * ev.counts[k] / mx), height: 16, color: noteRgb[k] });
            text(ev.counts[k] + ' · ' + (ev.n ? Math.round(ev.counts[k] / ev.n * 100) : 0) + ' %', rx + rw, ry + 4.5, 8, font, ink, 'right');
        }
        if (a.tend) { ry -= 12; text('Tendenzen zählen zur ganzen Note.', rx, ry, 6.5, font, grey, 'left', rw); }
        return await doc.save();
    }

    /* ---------- Oberstufe ---------- */

    async function init(W, H) {
        if (!window.PDFLib) await loadScript('../lib/pdf-lib.min.js');
        if (!window.fontkit) await loadScript('../lib/fontkit.umd.min.js');
        const PDFLib = window.PDFLib, rgb = PDFLib.rgb;
        const [regBytes, boldBytes] = await Promise.all([fetchBytes('../lib/fonts/DejaVuSans.ttf'), fetchBytes('../lib/fonts/DejaVuSans-Bold.ttf')]);
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        const font = await doc.embedFont(regBytes, { subset: true });
        const bold = await doc.embedFont(boldBytes, { subset: true });
        const page = doc.addPage([W, H]);
        const C = {
            ink: rgb(0.13, 0.16, 0.2), grey: rgb(0.45, 0.48, 0.52), line: rgb(0.78, 0.74, 0.68),
            headBg: rgb(0.93, 0.9, 0.84), zebra: rgb(0.975, 0.96, 0.93), accent: rgb(0.78, 0.04, 0.14), navy: rgb(0.16, 0.18, 0.21),
            white: rgb(1, 1, 1)
        };
        const noteRgb = { 1: rgb(0.153, 0.682, 0.376), 2: rgb(0.482, 0.714, 0.38), 3: rgb(0.831, 0.675, 0.05), 4: rgb(0.902, 0.569, 0.22), 5: rgb(0.827, 0.329, 0), 6: rgb(0.753, 0.224, 0.169) };
        function fit(t, f, size, maxW) {
            if (f.widthOfTextAtSize(t, size) <= maxW) return t;
            let s = t;
            while (s.length > 1 && f.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
            return s + '…';
        }
        function text(t, x, y, size, f, color, align, maxW) {
            if (t === '' || t == null) return;
            const s = maxW ? fit(String(t), f, size, maxW) : String(t);
            const w = f.widthOfTextAtSize(s, size);
            page.drawText(s, { x: align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y: y, size: size, font: f, color: color || C.ink });
        }
        return { doc, page, font, bold, rgb, C, noteRgb, text };
    }

    async function buildKlausur(a, ev) {
        const W = 595.28, H = 841.89, M = 36;
        const { doc, page, font, bold, rgb, C, noteRgb, text } = await init(W, H);
        const be = a.variant === 'be';
        const wTxt = be
            ? 'Fachlicher Teil: BE (gesamt ' + fmtT(a.beMax) + ') · Anteil fachlich ' + fmtT(100 - a.wSpr) + ' % · sprachlich ' + fmtT(a.wSpr) + ' %'
            : 'Fachlicher Teil: ' + a.afbNames.map((n, k) => n + ' ' + fmtT(a.afbW[k]) + ' %').join(' · ') + ' (am fachlichen Teil) · fachlich ' + fmtT(100 - a.wSpr) + ' % · sprachlich ' + fmtT(a.wSpr) + ' %';
        text(a.name, M, H - M - 14, 16, bold, C.ink, 'left', W - 2 * M - 90);
        text('Klausurauswertung · Notenpunkte · ' + wTxt, M, H - M - 30, 8.5, font, C.grey, 'left', W - 2 * M);
        text('Stand: ' + new Date().toLocaleDateString('de-DE'), W - M, H - M - 14, 8, font, C.grey, 'right');
        const topY = H - M - 44;
        text('Notenrechner-Tools · Auswertung', M, M - 14, 7, font, C.grey, 'left');

        const cols = [{ h: 'Nr.', w: 28 }];
        if (!a.useNumbers) cols.push({ h: 'Name', w: 140, name: true });
        if (be) cols.push({ h: 'BE', w: 56 });
        else a.afbNames.forEach(n => cols.push({ h: n, w: 56, small: true }));
        cols.push({ h: 'Fachlich', w: 54 }, { h: 'Sprachl.', w: 54 }, { h: 'Gesamt', w: 54, strong: true });
        const scale = (W - 2 * M) / cols.reduce((x, c) => x + c.w, 0);
        const xs = [M];
        cols.forEach(c => { c.w *= scale; xs.push(xs[xs.length - 1] + c.w); });
        const right = xs[xs.length - 1];
        const hh = 24;
        const BOTTOM = 236;
        const avail = topY - (M + BOTTOM + 16) - hh;
        const n = Math.max(a.students.length, 1);
        const rowH = Math.min(17, avail / n);
        const fs = Math.max(4.5, Math.min(9.5, rowH * 0.58));

        page.drawRectangle({ x: M, y: topY - hh, width: right - M, height: hh, color: C.headBg });
        page.drawRectangle({ x: M, y: topY - hh, width: right - M, height: 1.4, color: C.accent });
        cols.forEach((c, i) => {
            if (c.name) text(c.h, xs[i] + 4, topY - hh + 9, 8, bold, C.ink, 'left');
            else if (c.small) text(c.h.replace('Anforderungsbereich', 'AFB'), (xs[i] + xs[i + 1]) / 2, topY - hh + 9, 7.5, bold, C.ink, 'center', c.w - 4);
            else text(c.h, (xs[i] + xs[i + 1]) / 2, topY - hh + 9, 8, bold, C.ink, 'center');
        });

        let y = topY - hh;
        a.students.forEach((s, i) => {
            const yb = y - rowH;
            if (i % 2 === 1) page.drawRectangle({ x: M, y: yb, width: right - M, height: rowH, color: C.zebra });
            const ty = yb + (rowH - fs) / 2 + fs * 0.18;
            const r = ev.rows[i];
            let k = 0;
            const mid = () => (xs[k] + xs[k + 1]) / 2;
            text(String(i + 1), mid(), ty, fs, font, C.grey, 'center'); k++;
            if (!a.useNumbers) { text(s.name, xs[k] + 4, ty, fs, font, C.ink, 'left', cols[k].w - 8); k++; }
            if (be) { text(s.be == null ? '' : fmtT(s.be), mid(), ty, fs, font, C.ink, 'center'); k++; }
            else for (let q = 0; q < 3; q++) { text(s.afb[q] == null ? '' : String(s.afb[q]), mid(), ty, fs, font, C.ink, 'center'); k++; }
            text(r.fach == null ? '' : String(r.fach), mid(), ty, fs, font, C.grey, 'center'); k++;
            text(r.spr == null ? '' : String(r.spr), mid(), ty, fs, font, C.ink, 'center'); k++;
            text(r.gesamt == null ? '' : String(r.gesamt), mid(), ty, fs, bold, r.gesamt == null ? C.ink : noteRgb[KA.npBase(r.gesamt)], 'center');
            y = yb;
        });
        const bottom = y;
        page.drawLine({ start: { x: M, y: bottom }, end: { x: right, y: bottom }, thickness: 0.8, color: C.line });
        page.drawLine({ start: { x: M, y: topY }, end: { x: right, y: topY }, thickness: 0.8, color: C.line });
        xs.forEach(x => page.drawLine({ start: { x: x, y: topY }, end: { x: x, y: bottom }, thickness: 0.5, color: C.line }));

        // Unten: Notenpunkte mit Anzahl, daneben der Durchschnitt
        const by = M + BOTTOM;
        text('Notenpunkte', M, by - 4, 10, bold, C.ink, 'left');
        const mx = Math.max(1, ...Object.values(ev.counts));
        const rowS = (BOTTOM - 20) / 16;
        const spW = (W - 2 * M) * 0.64;
        let sy = by - 10;
        for (let p = 15; p >= 0; p--) {
            sy -= rowS;
            const bh = rowS - 2.5;
            page.drawRectangle({ x: M, y: sy, width: 24, height: bh, color: noteRgb[KA.npBase(p)] });
            text(String(p), M + 12, sy + bh / 2 - 3, 8, bold, C.white, 'center');
            const bw = spW - 24 - 8 - 26;
            page.drawRectangle({ x: M + 28, y: sy, width: bw, height: bh, color: rgb(0.91, 0.89, 0.84) });
            if (ev.counts[p] > 0) page.drawRectangle({ x: M + 28, y: sy, width: Math.max(3, bw * ev.counts[p] / mx), height: bh, color: noteRgb[KA.npBase(p)] });
            text(String(ev.counts[p]), M + spW, sy + bh / 2 - 3.5, 9, bold, C.ink, 'right');
        }
        const ax = M + spW + 24, aw = W - M - ax;
        page.drawRectangle({ x: ax, y: by - 84, width: aw, height: 84, color: C.navy });
        text('Notenpunkte-Durchschnitt', ax + aw / 2, by - 24, 8, font, rgb(0.85, 0.82, 0.75), 'center', aw - 8);
        text(ev.avg == null ? '–' : fmt(ev.avg, 2), ax + aw / 2, by - 58, 26, bold, C.white, 'center');
        text(ev.n + ' von ' + a.students.length + ' bewertet', ax + aw / 2, by - 76, 7.5, font, rgb(0.93, 0.9, 0.84), 'center', aw - 8);
        return await doc.save();
    }

    // BE-Übersicht: Welche BE werden bei welcher sprachlichen Leistung für welche Gesamt-Notenpunkte benötigt?
    async function buildBedarf(a) {
        const W = 841.89, H = 595.28, M = 36;
        const { doc, page, font, bold, rgb, C, noteRgb, text } = await init(W, H);
        text('BE-Übersicht · ' + a.name, M, H - M - 14, 16, bold, C.ink, 'left', W - 2 * M - 90);
        text('Gesamt-BE ' + fmtT(a.beMax) + ' · Anteil fachlich ' + fmtT(100 - a.wSpr) + ' % · sprachlich ' + fmtT(a.wSpr) + ' % · Ab ,5 wird aufgerundet', M, H - M - 30, 8.5, font, C.grey, 'left', W - 2 * M);
        text('Zeilen: Notenpunkte im sprachlichen Teil. Spalten: angestrebte Gesamt-Notenpunkte. Eintrag: mindestens benötigte BE im fachlichen Teil, „–“ bedeutet nicht erreichbar.', M, H - M - 44, 8, font, C.grey, 'left', W - 2 * M);
        text('Stand: ' + new Date().toLocaleDateString('de-DE'), W - M, H - M - 14, 8, font, C.grey, 'right');
        text('Notenrechner-Tools · Auswertung', M, M - 14, 7, font, C.grey, 'left');

        const topY = H - M - 58;
        const labW = 78, cw = (W - 2 * M - labW) / 15, rh = 20, hh = 26;
        const x0 = M;
        page.drawRectangle({ x: x0, y: topY - hh, width: W - 2 * M, height: hh, color: C.headBg });
        page.drawRectangle({ x: x0, y: topY - hh, width: W - 2 * M, height: 1.4, color: C.accent });
        text('Sprache ↓', x0 + 5, topY - hh + 9, 6.5, bold, C.ink, 'left', labW - 6);
        for (let t = 15; t >= 1; t--) text(String(t), x0 + labW + (15 - t) * cw + cw / 2, topY - hh + 9, 9, bold, C.ink, 'center');
        let y = topY - hh;
        for (let sp = 15; sp >= 0; sp--) {
            const tbl = KA.needTable(a, sp);
            const yb = y - rh;
            if (sp % 2 === 1) page.drawRectangle({ x: x0, y: yb, width: W - 2 * M, height: rh, color: C.zebra });
            page.drawRectangle({ x: x0, y: yb, width: labW, height: rh, color: C.headBg });
            text(String(sp), x0 + labW / 2, yb + 6, 9, bold, C.ink, 'center');
            for (let t = 15; t >= 1; t--) {
                const r = tbl[t];
                text(r ? fmtT(r.be) : '–', x0 + labW + (15 - t) * cw + cw / 2, yb + 6, 8, r ? font : font, r ? C.ink : C.grey, 'center');
            }
            y = yb;
        }
        const bottom = y;
        page.drawLine({ start: { x: x0, y: bottom }, end: { x: W - M, y: bottom }, thickness: 0.8, color: C.line });
        page.drawLine({ start: { x: x0, y: topY }, end: { x: W - M, y: topY }, thickness: 0.8, color: C.line });
        for (let i = 0; i <= 15; i++) { const x = x0 + labW + i * cw; page.drawLine({ start: { x: x, y: topY }, end: { x: x, y: bottom }, thickness: 0.4, color: C.line }); }
        page.drawLine({ start: { x: x0, y: topY }, end: { x: x0, y: bottom }, thickness: 0.5, color: C.line });
        page.drawLine({ start: { x: W - M, y: topY }, end: { x: W - M, y: bottom }, thickness: 0.5, color: C.line });
        page.drawLine({ start: { x: x0 + labW, y: topY }, end: { x: x0 + labW, y: bottom }, thickness: 1, color: C.line });

        // Schlüssel: Fachliche Notenpunkte aus BE
        const ky = bottom - 22;
        text('Fachliche Notenpunkte aus BE (VOGO, ab 2019/2020)', M, ky + 8, 8, bold, C.ink, 'left');
        const kw = (W - 2 * M - labW) / 16;
        text('Notenpunkte', x0 + 2, ky - 8, 7, bold, C.ink, 'left');
        text('ab BE', x0 + 2, ky - 20, 7, bold, C.ink, 'left');
        for (let p = 15; p >= 0; p--) {
            const cx = x0 + labW + (15 - p) * kw + kw / 2;
            text(String(p), cx, ky - 8, 7.5, bold, C.ink, 'center');
            text(p === 0 ? '0' : fmtT(KA.beNeeded(p, a.beMax)), cx, ky - 20, 7.5, font, C.ink, 'center');
        }
        return await doc.save();
    }

    window.KAExport = { build: build, buildKrit: buildKrit, buildKlausur: buildKlausur, buildBedarf: buildBedarf };
})();
