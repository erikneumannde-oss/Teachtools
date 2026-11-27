/* Erzeugt den „Antrag auf Freistellung“ (Fortbildung u. a.) im Aufbau des Vordrucks, ohne die durchgestrichenen Passagen.
   Wird erst beim Erzeugen geladen. */
(function () {
    'use strict';

    async function fetchBytes(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('Datei nicht ladbar: ' + url);
        return new Uint8Array(await r.arrayBuffer());
    }

    const W = 595.28, H = 841.89;
    const L = 64.8, R = 517.8;           // Seite 1: Kästen von links nach rechts
    const S = 7.6;                       // Schriftgröße des Vordrucks (Seite 1)
    const LINE = 0.55;
    const INK = [0.1, 0.1, 0.1];

    async function build(f) {
        const PDFLib = window.PDFLib, rgb = PDFLib.rgb;
        const [rB, bB, iB, biB] = await Promise.all(['Regular', 'Bold', 'Italic', 'BoldItalic'].map(n => fetchBytes('../lib/fonts/LiberationSans-' + n + '.ttf')));
        const doc = await PDFLib.PDFDocument.create();
        doc.registerFontkit(window.fontkit);
        const F = {
            r: await doc.embedFont(rB, { subset: true }), b: await doc.embedFont(bB, { subset: true }),
            i: await doc.embedFont(iB, { subset: true }), bi: await doc.embedFont(biB, { subset: true })
        };
        doc.setTitle('Antrag auf Freistellung');
        doc.setAuthor('');
        doc.setCreator('Lehrkräfte-Tools');
        doc.setProducer('Lehrkräfte-Tools');

        const warnings = [];
        const ck = new Set(f.checks || []);
        if (f.grund) ck.add('gruende');
        if (f.usonst) ck.add('u-sonst');
        const has = k => ck.has(k);
        const col = c => rgb(c[0], c[1], c[2]);
        const Yp = top => H - top;

        function text(page, s, x, base, font, size) {
            if (!s) return 0;
            page.drawText(s, { x: x, y: Yp(base), font: F[font || 'r'], size: size || S, color: col(INK) });
            return F[font || 'r'].widthOfTextAtSize(s, size || S);
        }
        function width(s, font, size) { return F[font || 'r'].widthOfTextAtSize(s, size || S); }
        function line(page, x1, y1, x2, y2, th) {
            page.drawLine({ start: { x: x1, y: Yp(y1) }, end: { x: x2, y: Yp(y2) }, thickness: th || LINE, color: col(INK) });
        }
        function rect(page, x1, y1, x2, y2) {
            line(page, x1, y1, x2, y1); line(page, x1, y2, x2, y2); line(page, x1, y1, x1, y2); line(page, x2, y1, x2, y2);
        }
        function box(page, x, cy, on, s) {
            s = s || 4.2;
            const top = cy - s / 2 + 0.4;
            page.drawRectangle({ x: x, y: Yp(top + s), width: s, height: s, borderWidth: 0.6, borderColor: col(INK) });
            if (on) {
                line(page, x + 0.7, top + 0.7, x + s - 0.7, top + s - 0.7, 0.9);
                line(page, x + 0.7, top + s - 0.7, x + s - 0.7, top + 0.7, 0.9);
            }
        }
        function info(page, x, base) {     // Symbol „Textanmerkung“: Kreis mit i
            const r = 2.6, cx = x + r, cy = base - 2.6;
            page.drawCircle({ x: cx, y: Yp(cy), size: r, borderWidth: 0.5, borderColor: col(INK) });
            text(page, 'i', cx - 0.6, cy + 1.8, 'b', 4.6);
        }
        function fit(s, font, maxW, size, what) {
            let sz = size;
            while (sz > 7 && width(s, font, sz) > maxW) sz -= 0.25;
            if (width(s, font, sz) > maxW) {
                let t = s;
                while (t.length > 1 && width(t + '…', font, sz) > maxW) t = t.slice(0, -1);
                warnings.push(what + ' ist zu lang für das Feld und wurde gekürzt: „' + s + '“.');
                return { s: t + '…', size: sz };
            }
            return { s: s, size: sz };
        }
        function value(page, s, x, base, maxW, size, what) {
            if (!s) return;
            const r = fit(s, 'r', maxW, size, what);
            text(page, r.s, x, base, 'r', r.size);
        }

        /* =========================== Seite 1 =========================== */
        const p1 = doc.addPage([W, H]);
        // Umrechnung aus den Ausschnitten (200 dpi): Ausschnittpunkt -> Punkt auf der Seite
        const mk = (ox, oy) => ({ x: px => (px + ox) * 0.36, y: px => (px + oy) * 0.36, b: px => (px + oy + 7) * 0.36 });
        const c0 = mk(120, 120), c1 = mk(120, 880), c2 = mk(120, 1600);

        // Kasten 1: Name, Telefon, Personalnummer, Privatanschrift, Schule
        rect(p1, L, 52.9, R, 129.6);
        line(p1, 343.8, 52.9, 343.8, 86.8);
        line(p1, 343.8, 70.2, R, 70.2);
        line(p1, L, 86.8, R, 86.8);
        line(p1, L, 103.7, R, 103.7);
        text(p1, 'Name, Vorname', c0.x(70), c0.b(40), 'r');
        text(p1, 'Telefon', c0.x(845), c0.b(40), 'r');
        text(p1, 'Personalnummer', c0.x(845), c0.b(87), 'r');
        text(p1, 'Privatanschrift', c0.x(70), c0.b(132), 'r');
        text(p1, 'An die Schulleitung des Lily-Braun-Gymnasiums 05Y05', c0.x(70), c0.b(181) + 0.5, 'r', 9);
        // Eingaben
        if (f.nameErst) { const r = fit(f.nameErst, 'r', 343.8 - L - 10, 12, 'Der Name'); text(p1, r.s, c0.x(70), 79, 'r', r.size); }
        value(p1, f.telefon, 385, c0.b(40), R - 385 - 4, 9, 'Die Telefonnummer');
        value(p1, f.personalnr, 407, c0.b(87), R - 407 - 4, 9, 'Die Personalnummer');
        value(p1, f.anschrift, 124, c0.b(132) + 1, R - 124 - 4, 9, 'Die Anschrift');

        // Titel
        const title = 'Antrag auf Freistellung';
        text(p1, title, 292 - width(title, 'b', 11.4) / 2, 139.5, 'b', 11.4);

        // Kasten 2: Zeitraum, Gründe, Unterlagen
        rect(p1, L, 162, R, 316.8);
        const zy = c0.b(381);
        text(p1, 'Zeitraum:', c0.x(70), zy, 'b');
        box(p1, c0.x(190), c0.y(381) + 0.5, f.modus === 'bis'); text(p1, 'vom', c0.x(218), zy);
        line(p1, c0.x(268), zy + 1.8, c0.x(452), zy + 1.8);
        text(p1, 'bis', c0.x(460), zy);
        line(p1, c0.x(492), zy + 1.8, c0.x(680), zy + 1.8);
        box(p1, c0.x(700), c0.y(381) + 0.5, f.modus === 'am'); text(p1, 'am', c0.x(728), zy);
        line(p1, c0.x(765), zy + 1.8, c0.x(975), zy + 1.8);
        if (f.modus === 'bis') {
            value(p1, f.von, c0.x(268) + 3, zy - 0.4, c0.x(452) - c0.x(268) - 4, 10, 'Das Datum');
            value(p1, f.bis, c0.x(492) + 3, zy - 0.4, c0.x(680) - c0.x(492) - 4, 10, 'Das Datum');
        } else if (f.modus === 'am') {
            value(p1, f.von, c0.x(765) + 3, zy - 0.4, c0.x(975) - c0.x(765) - 4, 10, 'Das Datum');
        }
        box(p1, c0.x(72), c0.y(425), has('fort')); text(p1, 'für eine Fortbildungsveranstaltung der SenBJF', c0.x(100), c0.b(425), 'b');
        text(p1, '(Original des Anmeldungsschreibens wurde bereits an die SenBJF abgesandt / Kopie liegt bei)', c0.x(105), c0.b(452), 'i');
        box(p1, c0.x(72), c0.y(474), has('gruende')); text(p1, 'aus folgenden Gründen', c0.x(100), c0.b(474), 'b');
        text(p1, '(Begründung - stichpunktartige Beschreibung / ggf. weitergehende Begründung auf gesondertes Blatt)', c0.x(105), c0.b(499), 'i');
        if (f.grund) {
            const maxW = R - c0.x(105) - 8, lines = [];
            f.grund.split(/\n/).forEach(par => {
                let cur = '';
                par.split(/\s+/).filter(Boolean).forEach(w => {
                    const t = cur ? cur + ' ' + w : w;
                    if (width(t, 'r', 9) <= maxW) cur = t; else { if (cur) lines.push(cur); cur = w; }
                });
                lines.push(cur);
            });
            if (lines.length > 4) warnings.push('Die Begründung ist zu lang für das Feld und wurde nach vier Zeilen abgeschnitten. Bitte auf gesondertem Blatt fortsetzen (laut Vordruck vorgesehen).');
            lines.slice(0, 4).forEach((t, i) => text(p1, t, c0.x(105), c0.b(528) + i * 11, 'r', 9));
        }
        text(p1, 'Beigefügte Unterlagen:', c0.x(70), c0.b(640));
        box(p1, c0.x(297), c0.y(640), has('u-programm')); text(p1, 'Programm', c0.x(327), c0.b(640));
        box(p1, c0.x(792), c0.y(640), has('u-einladung')); text(p1, 'Einladung', c0.x(815), c0.b(640));
        box(p1, c0.x(297), c0.y(669), has('u-nachweis')); text(p1, 'Nachweis der Förderungswürdigkeit', c0.x(327), c0.b(669));
        box(p1, c0.x(792), c0.y(669), has('u-mitglied')); text(p1, 'Erklärung über Mitgliedschaft', c0.x(815), c0.b(669));
        text(p1, '(des Veranstalters bzw. der Veranstaltung)', c0.x(333), c0.b(696));
        box(p1, c0.x(792), c0.y(699), has('u-sonst')); line(p1, c0.x(815), c0.y(708), c0.x(1093), c0.y(708));
        value(p1, f.usonst, c0.x(817), c0.y(708) - 1.5, c0.x(1093) - c0.x(817) - 2, 9, 'Die eigene Unterlage');
        box(p1, c0.x(297), c0.y(723), has('u-nachgereicht')); text(p1, 'Folgende Unterlagen werden nachgereicht', c0.x(327), c0.b(723));
        line(p1, c0.x(790), c0.y(735), c0.x(1105), c0.y(735));

        // Kasten A
        rect(p1, L, 324.7, R, 439);
        text(p1, 'A', c1.x(68), c1.b(36), 'b'); text(p1, 'Grundlage eines Urlaubs nach der SUrlVO *)', c1.x(108), c1.b(36), 'b');
        const lvl1 = (c, y, par, desc, bold, dx, k) => {
            box(p1, c.x(106), c.y(y), has(k)); text(p1, par, c.x(128), c.b(y), 'b');
            if (desc) text(p1, desc, c.x(dx), c.b(y), bold ? 'b' : 'r');
        };
        const lvl2 = (c, y, nr, desc, dx, k) => {
            box(p1, c.x(137), c.y(y), has(k)); text(p1, nr, c.x(165), c.b(y)); text(p1, desc, c.x(dx), c.b(y));
        };
        lvl1(c1, 62, '§ 2', 'Urlaub zur Wahrnehmung staatsbürgerlicher Pflichten und Rechte', false, 257, 'a2');
        lvl1(c1, 89, '§ 3 a', 'Urlaub für Zwecke der militärischen und zivilen Verteidigung', false, 257, 'a3a');
        lvl1(c1, 113, '§ 4', 'Absatz 1', true, 257, 'a4');
        [[141, 'Nr. 1', 'Bildungsveranstaltungen, die staatspolitischen Zwecken dienen (Förderungswürdigkeit)'],
         [167, 'Nr. 2', 'Kirchliche Zwecke'],
         [193, 'Nr. 3', 'Veranstaltungen, die von Nutzen für die dienstliche Tätigkeit sind'],
         [220, 'Nr. 4', 'gewerkschaftliche Zwecke / Veranstaltungen von Berufsverbänden (Mitgliedschaft)'],
         [247, 'Nr. 5', 'Sportveranstaltungen (besonderes Interesse des Landes Berlin muss anerkannt sein)'],
         [275, 'Nr. 6', 'Olympisches Komitee, nationale / internationale Dachorganisationen von Sportverbänden'],
         [300, 'Nr. 7', 'Ablegen von Prüfungen im Rahmen einer Fortbildung']].forEach((r, i) => lvl2(c1, r[0], r[1], r[2], 257, 'a4n' + (i + 1)));
        lvl1(c1, 326, '§ 5', 'Urlaub für ehrenamtliche Jugendarbeit', false, 257, 'a5');

        // Kasten B
        rect(p1, L, 448, R, 537.5);
        text(p1, 'B', c1.x(68), c1.b(376), 'b'); text(p1, 'Grundlage eines Sonderurlaubs – Ausführungsvorschriften zu § 7 SUrlVO *)', c1.x(107), c1.b(376), 'b');
        box(p1, c1.x(106), c1.y(398), has('b1')); text(p1, '§ 1', c1.x(128), c1.b(398), 'b');
        const aw = text(p1, 'Absatz 1', c1.x(242), c1.b(398), 'b'); text(p1, ' – Persönliche Gründe', c1.x(242) + aw, c1.b(398));
        const RX = c1.x(940);
        lvl2(c1, 426, 'Nr. 1', 'Niederkunft der Ehefrau oder der eingetragenen Lebenspartnerin', 247, 'b1n1'); text(p1, '1 Tag', RX, c1.b(426));
        lvl2(c1, 452, 'Nr. 2', 'Tod der Ehefrau oder des Ehemannes, der eingetragenen Lebens-', 247, 'b1n2'); text(p1, '2 Tage', RX, c1.b(452));
        text(p1, 'partnerin oder des eingetragenen Lebenspartners,', c1.x(247), c1.b(475));
        text(p1, 'eines Kindes oder Elternteils', c1.x(247), c1.b(498));
        box(p1, c1.x(137), c1.y(524), has('b1n3')); text(p1, 'Nr. 3', c1.x(165), c1.b(524));
        let x3 = c1.x(247); x3 += text(p1, 'Umzug aus ', x3, c1.b(524));
        const dw = text(p1, 'dienstlichen', x3, c1.b(524), 'b'); line(p1, x3, c1.b(524) + 1, x3 + dw, c1.b(524) + 1, 0.7);
        text(p1, ' Gründen an einen anderen Ort', x3 + dw, c1.b(524)); text(p1, '1 Tag', RX, c1.b(524));
        lvl2(c1, 551, 'Nr. 4', 'Schwere Erkrankung', 247, 'b1n4');
        const ta = text(p1, 'Textanm. siehe ', c1.x(752), c1.b(551), 'i'); info(p1, c1.x(752) + ta, c1.b(551));
        box(p1, c1.x(255), c1.y(576), has('b1n4a')); text(p1, 'eines Angehörigen, soweit er in dem selben Haushalt lebt', c1.x(278), c1.b(576)); text(p1, '1 Tag im Kalenderjahr', RX, c1.b(576));
        box(p1, c1.x(106), c1.y(601), has('b2')); text(p1, '§ 2', c1.x(128), c1.b(601), 'b'); text(p1, 'Sonstige dringende Fälle', c1.x(242), c1.b(601));
        const tb = text(p1, 'Textanm. siehe ', c1.x(752), c1.b(601), 'i'); info(p1, c1.x(752) + tb, c1.b(601));
        text(p1, 'bis zu 3 Tage', c1.x(950), c1.b(601));

        // Kasten C
        rect(p1, L, 547.2, R, 630);
        text(p1, 'C', c1.x(68), c1.b(651), 'b'); text(p1, 'Grundlage eines Sonderurlaubs nach der SUrlVO *) zur weiteren Veranlassung an Personalstelle', c1.x(106), c1.b(651), 'b');
        box(p1, c1.x(106), c1.y(674), has('c7')); const sw = text(p1, '§ 7', c1.x(128), c1.b(674), 'b'); text(p1, ' Nr. 5', c1.x(128) + sw, c1.b(674)); text(p1, 'Schwere Erkrankung', c1.x(245), c1.b(674));
        box(p1, c1.x(248), c1.y(697), has('c7a')); text(p1, 'eines Kindes, das das 12. Lebensjahr noch nicht vollendet hat', c1.x(272), c1.b(697));
        box(p1, c1.x(248), c1.y(721), has('c7b')); const tc = text(p1, 'einer Betreuungsperson (Kind unter 8 Jahren)', c1.x(272), c1.b(721));
        const td = text(p1, 'Textanm. siehe ', c1.x(752), c1.b(721), 'i'); info(p1, c1.x(752) + td, c1.b(721));
        lvl1(c2, 27, '§ 8', 'Urlaub zur Durchführung einer Heilkur', false, 242, 'c8');
        const te = text(p1, 'Textanm. siehe ', c2.x(752), c2.b(27), 'i'); info(p1, c2.x(752) + te, c2.b(27));
        lvl1(c2, 52, '§ 9', 'Urlaub zur Wahrnehmung besonderer Aufgaben und für eine fremdsprachliche Aus- oder Fortbildung', false, 242, 'c9');
        text(p1, '(die Voraussetzungen bitte den Ausführungen der SUrlVO entnehmen; Schulrecht 6.5.7 Seite 18a ff)', c2.x(252), c2.b(79), 'i');
        lvl1(c2, 102, '§ 10', 'Urlaub aus sonstigen Anlässen', false, 242, 'c10');
        text(p1, '(die Voraussetzungen bitte den Ausführungen der SUrlVO entnehmen; Schulrecht 6.5.7 Seite 18a ff)', c2.x(252), c2.b(125), 'i');

        // Kasten D
        rect(p1, L, 639, R, 655.6);
        text(p1, 'D', c2.x(62), c2.b(184), 'b'); box(p1, c2.x(90), c2.y(184), has('d')); text(p1, 'Bildungsurlaub', c2.x(108), c2.b(184), 'b');
        text(p1, 'Berliner Bildungsurlaubsgesetz (BiUrlG) vom 24.10.1990 (GVBl. S. 2209)', c2.x(145), c2.b(207));

        // Kasten E
        rect(p1, L, 664.2, R, 696.6);
        text(p1, '(Diese Erklärung entfällt bei Freistellung für SenBJF-Veranstaltungen!)', c2.x(65), c2.b(257), 'bi');
        text(p1, 'Im laufenden Jahr (200__) wurden mir bereits', c2.x(62), c2.b(290));
        line(p1, c2.x(524), c2.b(290) + 1.5, c2.x(592), c2.b(290) + 1.5); text(p1, 'Tage Sonderurlaub gewährt.', c2.x(598), c2.b(290));
        value(p1, f.tage1, c2.x(524) + 8, c2.b(290) - 0.5, 60, 10, 'Die Tageszahl');
        text(p1, 'Im vorhergehenden Jahr (200 ___) wurden mir', c2.x(62), c2.b(313));
        line(p1, c2.x(525), c2.b(313) + 1.5, c2.x(592), c2.b(313) + 1.5); text(p1, 'Tage Sonderurlaub gewährt.', c2.x(600), c2.b(313));
        value(p1, f.tage2, c2.x(525) + 8, c2.b(313) - 0.5, 60, 10, 'Die Tageszahl');

        // Kasten F
        rect(p1, L, 710, R, 773.3);
        box(p1, c2.x(62), c2.y(382), has('e-merk')); text(p1, 'Von dem „Merkblatt zum Antrag auf Freistellung“ habe ich Kenntnis genommen.', c2.x(93), c2.b(382));
        box(p1, c2.x(62), c2.y(405), has('e-angest')); text(p1, 'Ich bin im Angestelltenverhältnis beschäftigt; mir ist bekannt, dass die genannten Vorschriften sinngemäß auch für', c2.x(93), c2.b(405));
        text(p1, 'Angestellte gelten. Ich bitte daher, nach den entsprechenden tarifrechtlichen Regelungen zu entscheiden (Richtlinien über', c2.x(97), c2.b(432));
        text(p1, 'den Urlaub der Arbeitnehmer aus besonderen Anlässen, § 52 BAT und § 45 SGB V).', c2.x(97), c2.b(460));
        line(p1, L, 748.8, R, 748.8);
        text(p1, 'Datum / Unterschrift Antragsteller/in', c2.x(62), c2.b(530));
        const fw = text(p1, '*) SUrlVO', c2.x(50), c2.b(589), 'b');
        text(p1, ' (Verordnung über den Urlaub der Beamten und Richter aus besonderen Anlässen –Sonderurlaubsverordnung)', c2.x(50) + fw, c2.b(589));

        /* =========================== Seite 2 =========================== */
        const p2 = doc.addPage([W, H]);
        const T2 = 'Entscheidung über den Antrag durch Schulleitung';
        text(p2, T2, 296 - width(T2, 'b', 11.4) / 2, 97.5, 'b', 11.4);
        const H2 = '(Hinweis für die Schulleitung: Bei Ablehnung ist ein gesonderter Bescheid erforderlich!)';
        text(p2, H2, 296 - width(H2, 'r', 9.4) / 2, 110.5, 'r', 9.4);
        rect(p2, 68.4, 162.7, 523.5, 718.2);
        text(p2, 'Datum', 335.5, 197, 'r', S); line(p2, 365, 197.8, 474, 197.8);
        text(p2, 'Telefon', 335.5, 215.4, 'r', S); line(p2, 365, 216.2, 474, 216.2);
        line(p2, 81.7, 266, 277, 266);
        text(p2, 'Entscheidungsträger', 81.7, 274, 'r', S);
        text(p2, 'Stempel / Stellenzeichen', 81.7, 284, 'r', S);
        const BS = 11.6, X0 = 81.4;
        text(p2, 'Herrn / Frau', X0, 349.5, 'b', BS); line(p2, 156, 351.7, 337, 351.7);
        const aw2 = text(p2, 'Ihr Antrag auf Freistellung', X0, 395, 'b', BS); text(p2, ' für die Zeit vom', X0 + aw2, 395, 'r', BS);
        line(p2, 311, 396.8, 469, 396.8);
        text(p2, 'bis', 291.6, 414.3, 'r', BS); line(p2, 311, 415.8, 469, 415.8);
        const von2 = f.von2, bis2 = f.bis2;
        value(p2, von2, 318, 394.6, 148, 11.6, 'Das Datum'); value(p2, bis2, 318, 414, 148, 11.6, 'Das Datum');
        text(p2, 'Sehr geehrter Herr / Sehr geehrte Frau', X0, 459, 'r', BS); line(p2, 285, 460.4, 462, 460.4); text(p2, '!', 465, 459, 'r', BS);
        if (f.nameZweit) { const r = fit(f.nameZweit, 'r', 462 - 288 - 4, 11.6, 'Der Name'); text(p2, r.s, 288, 458.8, 'r', r.size); }
        const CB = 10.7;
        box(p2, 82, 481.5, false, 5.6); text(p2, 'Ihrem o.a. Antrag wird entsprochen.', 103, 485, 'r', CB);
        box(p2, 82, 509, false, 5.6); text(p2, 'Die nicht mehr benötigten Unterlagen erhalten Sie nach Einsicht anliegend', 103, 512.5, 'r', CB);
        text(p2, 'zurück.', 103, 526, 'r', CB);
        box(p2, 82, 550, false, 5.6); text(p2, 'Von Ihrer Personalstelle erhalten Sie weitere Nachricht.', 103, 553.5, 'r', CB);
        text(p2, '(bei Freistellungsantrag nach Buchstabe C)', 103, 565, 'i', 7);
        text(p2, 'Mit freundlichen Grüßen', X0, 600.5, 'r', BS);
        text(p2, 'Im Auftrag', X0, 613, 'r', BS);
        text(p2, 'Urschriftlich', X0, 676, 'b', BS);

        if (!f.nameErst) warnings.push('Es wurde kein Name eingetragen. Die Namensfelder bleiben leer.');
        const bytes = await doc.save();
        return { bytes: bytes, warnings: warnings };
    }

    window.FreistellungPdf = { build: build };
})();
