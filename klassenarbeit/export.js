/* PDF-Übersicht der Klassenarbeits-Auswertung. Wird erst beim ersten Export geladen. */
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
        text('Klassenarbeits-Auswertung · ' + (a.tend ? 'mit Tendenz' : 'ohne Tendenz') + ' · Gesamtpunktzahl ' + fmtT(a.max), M, H - M - 30, 9, font, grey, 'left', W - 2 * M);
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

    window.KAExport = { build: build };
})();
