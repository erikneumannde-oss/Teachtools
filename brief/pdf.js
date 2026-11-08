/* Erzeugt die PDF-Datei im Layout der Briefvorlage der Schule. Wird erst beim Herunterladen geladen. */
(function () {
    'use strict';

    async function fetchBytes(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('Datei nicht ladbar: ' + url);
        return new Uint8Array(await r.arrayBuffer());
    }

    const { W, H, ML, TW, TOP_FIRST, TOP_NEXT, FOOT_H, CARLITO } = window.BriefLayout.C;
    const CAR_ASC = 1950 / 2048;
    const ARIAL = 1.149, ARIAL_ASC = 0.905;
    const GREY = [0x4d / 255, 0x4d / 255, 0x4d / 255];

    async function build(letter) {
        const PDFLib = window.PDFLib, rgb = PDFLib.rgb;
        const [regB, boldB, arialB, tpl] = await Promise.all([
            fetchBytes('../lib/fonts/Carlito-Regular.ttf'), fetchBytes('../lib/fonts/Carlito-Bold.ttf'),
            fetchBytes('../lib/fonts/LiberationSans-Regular.ttf'), fetchBytes('vorlage.docx')
        ]);
        const media = window.fflate.unzipSync(tpl, { filter: f => /^word\/media\//.test(f.name) });
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        // Carlito wird ohne Teilmenge und ohne Ligaturen eingebettet, sonst fehlen Buchstaben
        const noLig = { liga: false, clig: false, calt: false, dlig: false };
        const reg = await doc.embedFont(regB, { subset: false, features: noLig });
        const bold = await doc.embedFont(boldB, { subset: false, features: noLig });
        const arial = await doc.embedFont(arialB, { subset: true });
        const imgSchool = await doc.embedPng(media['word/media/image1.png']);
        const imgBerlin = await doc.embedPng(media['word/media/image2.png']);
        doc.setTitle(letter.subject);
        doc.setAuthor('');
        doc.setCreator('Lehrkräfte-Tools');
        doc.setProducer('Lehrkräfte-Tools');

        const Y = top => H - top;
        const col = c => rgb(c[0], c[1], c[2]);

        function text(page, s, x, lineTop, font, size, asc, color, spacing) {
            if (!s) return;
            page.drawText(s, { x: x, y: Y(lineTop + asc * size), font: font, size: size, color: col(color || [0, 0, 0]), characterSpacing: spacing || 0 });
        }

        const fonts = { reg: reg, bold: bold };
        const measure = (key, t, size) => fonts[key].widthOfTextAtSize(t, size);
        const layout = window.BriefLayout.paginate(letter, measure);
        const pages = layout.pages;
        const wrap = (words, width) => window.BriefLayout.wrap(words, width, measure);
        const toWords = window.BriefLayout.toWords;

        /* ---------- Zeichnen ---------- */

        const total = pages.length;
        pages.forEach((lines, pi) => {
            const page = doc.addPage([W, H]);
            if (pi === 0) {
                page.drawImage(imgBerlin, { x: 63.65, y: Y(31.5 + 80.0), width: 178.5, height: 80.0 });
                page.drawImage(imgSchool, { x: 370.9, y: Y(44.85 + 63.0), width: 162.5, height: 63.0 });
                text(page, 'Lily-Braun-Gymnasium', 374.4, 105.8, bold, 11, CAR_ASC, GREY, 0.45);
                text(page, 'gegründet 1862 in Berlin-Spandau', 374.4, 119.2, reg, 10, CAR_ASC, GREY, 0.45);
                text(page, 'Münsingerstr. 2', 374.6, 141.8, reg, 10, CAR_ASC, GREY);
                text(page, '13597 Berlin-Spandau', 374.6, 154.0, reg, 10, CAR_ASC, GREY);
                [['Tel:', '030 33 89 04 - 0', 178.4], ['Fax:', '030 33 89 04 - 144', 190.6], ['Mail:', 'Sekretariat@05y05.schule.berlin.de', 202.8]].forEach(r => {
                    text(page, r[0], 374.6, r[2], reg, 10, CAR_ASC, GREY);
                    text(page, r[1], 401.6, r[2], reg, 10, CAR_ASC, GREY);
                });
                // Rücksendezeile, unterstrichen
                const ret = 'Lily-Braun-Gymnasium, Münsingerstr. 2, 13597 Berlin';
                text(page, ret, 71.25, 142.25, reg, 8, CAR_ASC, GREY);
                const rw = reg.widthOfTextAtSize(ret, 8), ry = Y(142.25 + CAR_ASC * 8 + 1.1);
                page.drawLine({ start: { x: 71.25, y: ry }, end: { x: 71.25 + rw, y: ry }, thickness: 0.5, color: col(GREY) });
                // Adressfeld
                const addrWords = [];
                let top = 169.1;
                letter.address.forEach(l => {
                    wrap(toWords(l, 'reg', 12), 232.2).forEach(ln => {
                        let x = 71.25;
                        ln.forEach(w => { x += w.sp; text(page, w.t, x, top, reg, 12, CAR_ASC, [0, 0, 0]); x += reg.widthOfTextAtSize(w.t, 12); });
                        top += 12 * CARLITO;
                    });
                });
                // Ansprechpartner und Datum
                text(page, 'Ihr Ansprechpartner', 375.05, 222.35, arial, 10, ARIAL_ASC, GREY);
                text(page, 'Datum', 375.05 + 113.4, 222.35, arial, 10, ARIAL_ASC, GREY);
                const row2 = 222.35 + 10 * ARIAL + 3;
                text(page, letter.kuerzel, 375.05, row2, arial, 10, ARIAL_ASC, [0, 0, 0]);
                const kw = arial.widthOfTextAtSize(letter.kuerzel, 10);
                let dx = 113.4;
                if (kw >= dx - 1) dx = Math.ceil((kw + 1) / 35.4) * 35.4;
                text(page, letter.date, 375.05 + dx, row2, arial, 10, ARIAL_ASC, [0, 0, 0]);
            }
            let ly = pi === 0 ? TOP_FIRST : TOP_NEXT;
            lines.forEach(it => {
                let x = ML;
                it.words.forEach(w => {
                    x += w.sp || 0;
                    const wf = fonts[w.font];
                    text(page, w.t, x, ly, wf, w.size, CAR_ASC, [0, 0, 0]);
                    x += wf.widthOfTextAtSize(w.t, w.size);
                    if (w.after) { text(page, w.after, x, ly, reg, w.size, CAR_ASC, [0, 0, 0]); x += reg.widthOfTextAtSize(w.after, w.size); }
                });
                ly += it.h;
            });
            if (total > 1) {
                const s = 'Seite ' + (pi + 1) + ' von ' + total;
                const sw = arial.widthOfTextAtSize(s, 9);
                text(page, s, ML + TW / 2 - sw / 2, H - 35.45 - FOOT_H, arial, 9, ARIAL_ASC, GREY);
            }
        });
        return doc.save();
    }

    window.BriefPdf = { build: build };
})();
