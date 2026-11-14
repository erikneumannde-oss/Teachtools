/* Erzeugt die PDF mit einem Bogen je Kind im Layout des Vordrucks „Arbeits- und Sozialverhalten“. Wird erst beim Herunterladen geladen. */
(function () {
    'use strict';

    async function fetchBytes(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('Datei nicht ladbar: ' + url);
        return new Uint8Array(await r.arrayBuffer());
    }

    const W = 595.3, H = 841.9;
    const L = 70.9, R = 538.3;           // Textbreite
    const TX0 = 70.9, TX1 = 541.7;       // Tabelle
    const COLS = [326.2, 379.9, 433.7, 487.4, 541.7];
    const ROWS = [247.0, 303.0, 352.2, 409.3, 463.6, 528.9, 583.8, 637.5];

    async function build(students, info, filled) {
        const { CRIT, LEVELS, longDate } = window.ASVData;
        const PDFLib = window.PDFLib, rgb = PDFLib.rgb;
        const [regB, boldB, tpl] = await Promise.all([
            fetchBytes('../lib/fonts/Carlito-Regular.ttf'), fetchBytes('../lib/fonts/Carlito-Bold.ttf'), fetchBytes('vorlage.docx')
        ]);
        const media = window.fflate.unzipSync(tpl, { filter: f => /^word\/media\//.test(f.name) });
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        const noLig = { liga: false, clig: false, calt: false, dlig: false };
        const reg = await doc.embedFont(regB, { subset: false, features: noLig });
        const bold = await doc.embedFont(boldB, { subset: false, features: noLig });
        const wappen = await doc.embedPng(media['word/media/image1.png']);
        doc.setTitle('Arbeits- und Sozialverhalten');
        doc.setAuthor('');
        doc.setCreator('Lehrkräfte-Tools');
        doc.setProducer('Lehrkräfte-Tools');

        // Der Vordruck ist in einer breiteren Schrift gesetzt. Carlito wird so skaliert, dass die Titelzeile gleich breit wird.
        const K = 261 / reg.widthOfTextAtSize('Lily-Braun-Gymnasium', 24);
        const Y = t => H - t;
        const BLACK = rgb(0, 0, 0);
        // Zeilenoberkante wie im Vordruck (Zeilenhöhe 1,21 × Schriftgrad, Grundlinie 0,969 darunter)
        function text(page, s, x, top, size, font, o) {
            if (!s) return 0;
            const sz = size * K * ((o && o.k) || 1);
            let px = x;
            const w = font.widthOfTextAtSize(s, sz);
            if (o && o.center) px = x - w / 2;
            page.drawText(s, { x: px, y: Y(top + 0.969 * size), font: font, size: sz, color: BLACK });
            return w;
        }
        function line(page, x1, x2, y, th) {
            page.drawLine({ start: { x: x1, y: Y(y) }, end: { x: x2, y: Y(y) }, thickness: th || 0.75, color: BLACK });
        }
        function vline(page, x, y1, y2, th) {
            page.drawLine({ start: { x: x, y: Y(y1) }, end: { x: x, y: Y(y2) }, thickness: th || 0.75, color: BLACK });
        }
        function box(page, cx, cy, marked) {
            const s = 9;
            page.drawRectangle({ x: cx - s / 2, y: Y(cy + s / 2), width: s, height: s, borderColor: BLACK, borderWidth: 0.8 });
            if (marked) {
                const d = s / 2 - 1.3;
                page.drawLine({ start: { x: cx - d, y: Y(cy - d) }, end: { x: cx + d, y: Y(cy + d) }, thickness: 1.3, color: BLACK });
                page.drawLine({ start: { x: cx - d, y: Y(cy + d) }, end: { x: cx + d, y: Y(cy - d) }, thickness: 1.3, color: BLACK });
            }
        }
        const fitName = (s, font, size, maxW) => {
            let k = 1;
            const w = font.widthOfTextAtSize(s, size * K);
            if (w > maxW) k = maxW / w;
            return k;
        };

        const dateText = longDate(info.date);
        students.forEach(st => {
            const p = doc.addPage([W, H]);
            // Kopf
            p.drawImage(wappen, { x: L + 0.3, y: Y(16.35 + 56.9), width: 35.1, height: 56.9 });
            text(p, 'Lily-Braun-Gymnasium', 318.95, 21.3, 24, reg, { center: true });
            text(p, 'Berlin, Bezirk Spandau', 318.95, 50.4, 12, reg, { center: true });
            line(p, L, R, 79.5, 1);
            text(p, 'Informationen über das Arbeits- und Sozialverhalten', 304.6, 95.9, 16, bold, { center: true });
            // Name und Geburtstag
            const nm = st.name || '';
            text(p, nm, 304.7, 125.2, 12, reg, { center: true, k: fitName(nm, reg, 12, 440) });
            line(p, L, R, 140.7);
            text(p, 'Vorname Name', 304.7, 141.0, 7, reg, { center: true });
            text(p, 'geboren am', L, 159.0, 10, reg);
            text(p, st.birth || '', 134, 157.5, 10, reg);
            line(p, 130.7, 298.0, 170.6);
            // Halbjahr und Stufe
            // Wie im Vordruck: kurze Linie um die Ziffer, der Satz läuft direkt weiter
            const w1 = text(p, 'Diese Angaben beziehen sich auf das ', L, 185.4, 10, reg);
            const xa = L + w1, LW = 11;
            line(p, xa, xa + LW, 196.6);
            text(p, String(info.half || ''), xa + LW / 2, 184.0, 10, reg, { center: true });
            const x2 = xa + LW + 0.3;
            const w2 = text(p, '. Schulhalbjahr der Jahrgangsstufe ', x2, 185.4, 10, reg);
            const xb = x2 + w2, SW = 18;
            line(p, xb, xb + SW, 196.6);
            text(p, String(info.stufe || ''), xb + SW / 2, 184.0, 10, reg, { center: true });
            text(p, '.', xb + SW + 2.1, 185.4, 10, reg);
            // Tabelle
            const T0 = 211.6, TB = ROWS[ROWS.length - 1];
            ROWS.concat([T0]).forEach(y => line(p, TX0, TX1, y));
            [TX0].concat(COLS).forEach(x => vline(p, x, T0, TB));
            LEVELS.forEach((lv, i) => {
                const cx = (COLS[i] + COLS[i + 1]) / 2;
                if (lv[0]) { text(p, lv[0], cx, 217.8, 10, reg, { center: true, k: 0.92 }); text(p, lv[1], cx, 229.9, 10, reg, { center: true, k: 0.92 }); }
                else text(p, lv[1], cx, 229.9, 10, reg, { center: true, k: 0.92 });
            });
            CRIT.forEach((c, i) => {
                const top = ROWS[i], bot = ROWS[i + 1];
                text(p, c.t, L + 0.2, top + 0.4, 10, bold);
                c.l.forEach((l, j) => text(p, l, 92.3, top + 17.3 + j * 12.1, 10, reg));
                const mid = (top + bot) / 2 + 0.7;
                for (let k = 0; k < 4; k++) box(p, (COLS[k] + COLS[k + 1]) / 2, mid, !!filled && st.marks && st.marks[i] === k);
            });
            // Datum und Unterschriften
            text(p, 'Berlin, den', 212.8, 662.2, 10, reg);
            text(p, dateText, 338.4, 662.2 - 3, 10, reg, { center: true });
            line(p, 265.8, 411.0, 673.5);
            const head = info.head || '', klass = info.klass || '';
            line(p, L, 227.1, 705.0);
            line(p, 382.7, R, 705.0);
            const lab = (t, cx) => { const full = t; const k = fitName(full, reg, 7, 200); text(p, full, cx, 706.1, 7, reg, { center: true, k: k }); };
            lab('Schulleitung (' + (head || 'Name') + ')', 148.9);
            lab('Klassenleitung (' + (klass || 'Name') + ')', 460.5);
            text(p, 'Gelesen:', 192.6, 736.1, 10, reg);
            line(p, 237.6, 411.0, 747.7);
            text(p, 'Erziehungsberechtigte/r', 333.3, 750.6, 7, reg, { center: true });
            line(p, L, R, 766.2, 1);
            const w = text(p, 'Schul Z 600 –', L, 775.6, 7, bold);
            text(p, ' Arbeits- und Sozialverhalten – standardisierte Form – (09.05)', L + w, 775.6, 7, reg);
        });
        return doc.save();
    }

    window.ASVPdf = { build: build };
})();
