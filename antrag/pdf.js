/* Erzeugt den Antrag im Layout des Formulars der Schule als saubere PDF-Datei (ohne Scanspuren).
   Wird erst beim Erzeugen geladen. */
(function () {
    'use strict';

    async function fetchBytes(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('Datei nicht ladbar: ' + url);
        return new Uint8Array(await r.arrayBuffer());
    }

    const W = 595.28, H = 841.89;
    const LEFT = 62, RIGHT = 535;
    const CAR_ASC = 1950 / 2048;
    const GREY = [0x4d / 255, 0x4d / 255, 0x4d / 255];
    const BLACK = [0, 0, 0];
    const SZ = 11;          // Schriftgröße der Beschriftungen
    const VSZ = 10.5;       // Schriftgröße der Eingaben
    const ROW_H = 17.5;     // Zeilenhöhe der Tabelle
    const HEAD_H = 14.5;
    const FIRST_ROWS = 18;
    const NEXT_ROWS = 36;

    async function build(f) {
        const PDFLib = window.PDFLib, rgb = PDFLib.rgb;
        const [carR, carB, libR, schule] = await Promise.all([
            fetchBytes('../lib/fonts/Carlito-Regular.ttf'), fetchBytes('../lib/fonts/Carlito-Bold.ttf'),
            fetchBytes('../lib/fonts/LiberationSans-Regular.ttf'), fetchBytes('schule.png')
        ]);
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        const noLig = { liga: false, clig: false, calt: false, dlig: false };
        const car = await doc.embedFont(carR, { subset: false, features: noLig });
        const carBold = await doc.embedFont(carB, { subset: false, features: noLig });
        const lib = await doc.embedFont(libR, { subset: true });
        const img = await doc.embedPng(schule);

        const art = f.exkursion && !f.sport ? 'Exkursion' : f.sport && !f.exkursion ? 'Sportwettkampf' : f.exkursion && f.sport ? 'Exkursion und Sportwettkampf' : '';
        doc.setTitle('Antrag auf ' + (art || 'Exkursion oder Sportwettkampf'));
        doc.setAuthor('');
        doc.setCreator('Lehrkräfte-Tools');
        doc.setProducer('Lehrkräfte-Tools');

        const warnings = [];
        const col = c => rgb(c[0], c[1], c[2]);
        const Y = top => H - top;

        function text(page, s, x, base, font, size, color) {
            if (!s) return;
            page.drawText(s, { x: x, y: Y(base), font: font, size: size, color: col(color || BLACK) });
        }
        function line(page, x1, y1, x2, y2, th, color) {
            page.drawLine({ start: { x: x1, y: Y(y1) }, end: { x: x2, y: Y(y2) }, thickness: th, color: col(color || BLACK) });
        }
        function dots(page, x1, x2, base) {
            if (x2 - x1 < 4) return;
            page.drawLine({
                start: { x: x1, y: Y(base + 1.7) }, end: { x: x2, y: Y(base + 1.7) },
                thickness: 0.85, color: col(BLACK), dashArray: [0.01, 2.6], lineCap: PDFLib.LineCapStyle.Round
            });
        }
        // Text in die Breite einpassen: erst verkleinern, dann kürzen
        function fit(s, font, maxW, size, what) {
            let sz = size;
            while (sz > 8.5 && font.widthOfTextAtSize(s, sz) > maxW) sz -= 0.25;
            if (font.widthOfTextAtSize(s, sz) > maxW) {
                let t = s;
                while (t.length > 1 && font.widthOfTextAtSize(t + '…', sz) > maxW) t = t.slice(0, -1);
                if (what) warnings.push(what + ' ist zu lang für das Feld und wurde gekürzt: „' + s + '“.');
                return { s: t + '…', size: sz };
            }
            return { s: s, size: sz };
        }
        function checkbox(page, x, base, on) {
            const s = 9, top = base - 8.2;
            page.drawRectangle({ x: x, y: Y(top + s), width: s, height: s, borderWidth: 1, borderColor: col(BLACK) });
            if (on) {
                line(page, x + 1.6, top + 1.6, x + s - 1.6, top + s - 1.6, 1.4);
                line(page, x + 1.6, top + s - 1.6, x + s - 1.6, top + 1.6, 1.4);
            }
        }

        /* Zeile aus Beschriftungen und Eingabefeldern */
        function row(page, base, parts) {
            let fixed = 0, fills = 0;
            parts.forEach(p => {
                if (p.t != null) p.w = lib.widthOfTextAtSize(p.t, SZ);
                if (p.g != null) p.w = p.g;
                if (p.fill) fills += p.fill; else fixed += p.w;
            });
            const unit = fills ? (RIGHT - LEFT - fixed) / fills : 0;
            let x = LEFT;
            parts.forEach(p => {
                const w = p.fill ? unit * p.fill : p.w;
                if (p.t != null) text(page, p.t, x, base, lib, SZ);
                else if (p.f) {
                    dots(page, x, x + w, base);
                    const v = p.v;
                    if (v) {
                        const r = fit(v, lib, w - 4, VSZ, p.what);
                        text(page, r.s, x + 2, base - 0.4, lib, r.size);
                    }
                }
                x += w;
            });
        }

        /* Tabelle: Kopf und Zeilen */
        const COLS = [LEFT, 225, 397, RIGHT];
        function table(page, top, rowsData, startNr, nRows) {
            const hb = top + HEAD_H, bottom = hb + ROW_H * nRows;
            line(page, LEFT, top, RIGHT, top, 0.8);
            line(page, LEFT, hb, RIGHT, hb, 0.8);
            ['NAME', 'VORNAME', 'KLASSE/TUTOR'].forEach((h, i) => {
                const w = carBold.widthOfTextAtSize(h, 11);
                text(page, h, (COLS[i] + COLS[i + 1]) / 2 - w / 2, top + 11, carBold, 11);
            });
            for (let i = 0; i < nRows; i++) {
                const rb = hb + ROW_H * (i + 1);
                line(page, LEFT, rb, RIGHT, rb, 0.7);
                text(page, String(startNr + i), LEFT + 3, rb - 3.8, lib, 10);
                const s = rowsData[i];
                if (s) {
                    const put = (v, x0, x1, what) => {
                        if (!v) return;
                        const r = fit(v, lib, x1 - x0 - 4, VSZ, what);
                        text(page, r.s, x0, rb - 3.8, lib, r.size);
                    };
                    put(s.n, LEFT + 24, COLS[1] - 2, 'Ein Name');
                    put(s.v, COLS[1] + 5, COLS[2] - 2, 'Ein Vorname');
                    put(s.k, COLS[2] + 5, RIGHT - 2, 'Eine Angabe zu Klasse/Tutor');
                }
            }
            line(page, COLS[1], top, COLS[1], bottom, 0.7);
            line(page, COLS[2], top, COLS[2], bottom, 0.7);
            return bottom;
        }

        const students = f.ganz ? [] : f.students;
        const extra = Math.max(0, students.length - FIRST_ROWS);
        const total = 1 + Math.ceil(extra / NEXT_ROWS);

        function pageNo(page, i) {
            if (total < 2) return;
            const s = 'Seite ' + (i + 1) + ' von ' + total;
            const w = lib.widthOfTextAtSize(s, 9);
            text(page, s, W / 2 - w / 2, 810, lib, 9, GREY);
        }

        /* ---------- Seite 1 ---------- */
        const p1 = doc.addPage([W, H]);
        p1.drawImage(img, { x: 58.7, y: Y(40 + 63), width: 163, height: 63 });
        text(p1, 'Lily-Braun-Gymnasium', 372, 85, carBold, 11, GREY);
        text(p1, 'gegründet 1862 in Berlin-Spandau', 372, 98, car, 10, GREY);
        line(p1, LEFT, 111, RIGHT, 111, 0.8);

        const title = 'Antrag auf';
        const tw = carBold.widthOfTextAtSize(title, 20);
        text(p1, title, W / 2 - tw / 2, 129, carBold, 20);

        checkbox(p1, 80, 162, f.exkursion);
        text(p1, 'Durchführung einer Exkursion', 98, 162, lib, SZ);
        checkbox(p1, 80, 187, f.sport);
        text(p1, 'Teilnahme an einem Sportwettkampf', 98, 187, lib, SZ);

        row(p1, 224, [{ t: 'ab der' }, { g: 4 }, { f: 1, v: f.std, w: 56, what: 'Die Stunde' }, { g: 4 }, { t: 'Std.' }]);
        row(p1, 249, [
            { t: 'am' }, { g: 4 }, { f: 1, v: f.datum, fill: 1, what: 'Das Datum' }, { g: 10 },
            { t: 'von' }, { g: 4 }, { f: 1, v: f.von, w: 78 }, { g: 4 }, { t: 'Uhr' }, { g: 16 },
            { t: 'bis' }, { g: 4 }, { f: 1, v: f.bis, w: 78 }, { g: 4 }, { t: 'Uhr' }
        ]);
        row(p1, 273.5, [{ t: 'Klasse/Kurs:' }, { g: 4 }, { f: 1, v: f.klasse, w: 160, what: 'Klasse/Kurs' }]);
        row(p1, 299, [
            { t: 'verantwortl. Lehrer*in' }, { g: 4 }, { f: 1, v: f.lehrer, fill: 1, what: 'Der Name der Lehrkraft' }, { g: 8 },
            { t: 'Begleitung' }, { g: 4 }, { f: 1, v: f.begleitung, fill: 1, what: 'Die Begleitung' }
        ]);
        row(p1, 324, [{ t: 'Zielort/Thema' }, { g: 4 }, { f: 1, v: f.ziel, fill: 1, what: 'Zielort/Thema' }]);
        row(p1, 349, [
            { t: 'Treffpunkt:' }, { g: 4 }, { f: 1, v: f.treff, fill: 1, what: 'Der Treffpunkt' }, { g: 10 },
            { t: 'um' }, { g: 4 }, { f: 1, v: f.treffzeit, w: 80 }, { g: 4 }, { t: 'Uhr' }
        ]);

        if (f.ganz) {
            text(p1, 'Es nimmt die gesamte Klasse beziehungsweise der gesamte Kurs teil.', LEFT, 373, lib, SZ);
        } else {
            text(p1, 'Mit folgenden Schülerinnen und Schülern (entfällt bei gesamter Klasse)', LEFT, 373, lib, SZ);
            table(p1, 382, students.slice(0, FIRST_ROWS), 1, FIRST_ROWS);
        }

        // Unterschriften
        dots(p1, LEFT, 232, 742);
        dots(p1, 345, 515, 742);
        text(p1, 'Datum, Unterschrift verantwortl. Lehrer*in', LEFT, 753, carBold, 8.5);
        text(p1, 'Datum/Unterschrift Schulleitung', 345, 753, carBold, 8.5);
        pageNo(p1, 0);

        /* ---------- Folgeseiten ---------- */
        for (let pi = 1; pi < total; pi++) {
            const pg = doc.addPage([W, H]);
            const from = FIRST_ROWS + (pi - 1) * NEXT_ROWS;
            const slice = students.slice(from, from + NEXT_ROWS);
            text(pg, 'Antrag auf ' + (art || 'Exkursion oder Sportwettkampf') + ': Fortsetzung der Schülerliste', LEFT, 58, carBold, 14);
            const sub = [f.klasse, f.datum, f.ziel].filter(Boolean).join('  ·  ');
            if (sub) { const r = fit(sub, lib, RIGHT - LEFT, 10.5); text(pg, r.s, LEFT, 74, lib, r.size, GREY); }
            line(pg, LEFT, 84, RIGHT, 84, 0.8);
            table(pg, 98, slice, from + 1, slice.length);
            pageNo(pg, pi);
        }

        if (!f.exkursion && !f.sport) warnings.push('Weder „Exkursion“ noch „Sportwettkampf“ ist angekreuzt. Beide Kästchen bleiben dann leer.');
        const bytes = await doc.save();
        return { bytes: bytes, warnings: warnings };
    }

    window.AntragPdf = { build: build };
})();
