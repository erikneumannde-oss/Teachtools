/* Zeilenumbruch und Seitenumbruch des Briefes im Layout der Vorlage (Maße in Punkt).
   Wird für die PDF-Datei und für die Entscheidung über die Seitenzahl in der Word-Datei genutzt. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.BriefLayout = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Seite und Ränder der Vorlage (A4; Ränder 2,5 cm links, 1,5 cm rechts, 2 cm oben, 1,5 cm unten)
    const C = {
        W: 595.28, H: 841.89, ML: 70.85, MR: 42.5,
        TOP_FIRST: 323.0, TOP_NEXT: 56.7,
        FOOT_H: 9 * 1.149
    };
    C.TW = C.W - C.ML - C.MR;
    C.BOTTOM = C.H - 35.45 - C.FOOT_H;
    C.CARLITO = 1.2207;
    const BIG = 15, BODY = 12;

    // measure(fontKey, text, size) -> Breite; fontKey: 'reg' | 'bold'
    function wrap(words, width, measure) {
        const lines = [];
        let cur = [], w = 0;
        const push = () => { lines.push(cur); cur = []; w = 0; };
        words.forEach(wd => {
            const ww = measure(wd.font, wd.t, wd.size);
            const gap = cur.length ? measure(wd.font, ' ', wd.size) : 0;
            if (cur.length && w + gap + ww > width) push();
            if (!cur.length && ww > width) {
                let part = '';
                for (const ch of wd.t) {
                    if (part && measure(wd.font, part + ch, wd.size) > width) { cur.push({ t: part, font: wd.font, size: wd.size, sp: 0 }); push(); part = ch; }
                    else part += ch;
                }
                cur.push({ t: part, font: wd.font, size: wd.size, sp: 0 });
                w = measure(wd.font, part, wd.size);
                return;
            }
            const g = cur.length ? measure(wd.font, ' ', wd.size) : 0;
            cur.push({ t: wd.t, font: wd.font, size: wd.size, sp: g, after: wd.after });
            w += g + ww;
        });
        if (cur.length) lines.push(cur);
        return lines.length ? lines : [[]];
    }
    const toWords = (s, font, size) => s.split(/ +/).filter(Boolean).map(t => ({ t: t, font: font, size: size }));

    function paginate(letter, measure) {
        const items = [];
        let paraNo = 0;
        function addPara(words, size, keepNext, extra) {
            const lines = words.length ? wrap(words, C.TW, measure) : [[]];
            const p = paraNo++;
            lines.forEach((ln, i) => items.push({ words: ln, size: size, keepNext: keepNext && i === lines.length - 1, para: p, idx: i, count: lines.length, h: size * C.CARLITO }));
        }
        // Betreff: „Betreff“ fett, Doppelpunkt normal, der Betreff fett
        addPara([{ t: 'Betreff', font: 'bold', size: BIG, after: ':' }].concat(toWords(letter.subject, 'bold', BIG)), BIG, true);
        addPara([], BODY, true);
        addPara(toWords(letter.salutation, 'reg', BODY), BODY, true);
        addPara([], BODY, true);
        letter.lines.forEach((l, i) => addPara(toWords(l, 'reg', BODY), BODY, i === letter.lines.length - 1));
        addPara([], BODY, true);
        addPara(toWords('Mit freundlichen Grüßen', 'reg', BODY), BODY, true);
        for (let i = 0; i < 3; i++) addPara([], BODY, true);
        addPara(toWords(letter.names, 'reg', BODY), BODY, false);

        const pages = [];
        let cur = [], y = C.TOP_FIRST;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (cur.length === 0 || y + it.h <= C.BOTTOM + 0.01) { cur.push(it); y += it.h; continue; }
            // Umbruch vor Zeile i. Regeln: keine einzelne Zeile eines Absatzes allein, Zeilen „mit nächstem Absatz“ zusammenhalten
            let b = cur.length;
            if (it.idx === 1 && it.count > 1) b = cur.length - 1;
            else if (it.idx === it.count - 1 && it.count > 2) b = cur.length - 1;
            while (b > 0 && cur[b - 1].keepNext) b--;
            if (b === 0) b = cur.length;
            const rest = cur.splice(b);
            pages.push(cur);
            cur = rest;
            y = C.TOP_NEXT + cur.reduce((s, r) => s + r.h, 0);
            i--;
        }
        pages.push(cur);
        const first = pages.length === 1;
        const used = (first ? C.TOP_FIRST : C.TOP_NEXT) + pages[pages.length - 1].reduce((s, r) => s + r.h, 0);
        return { pages: pages, bottomUsed: used };
    }

    return { C: C, wrap: wrap, toWords: toWords, paginate: paginate };
});
