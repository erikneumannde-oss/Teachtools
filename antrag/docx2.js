/* Erzeugt den „Antrag auf Freistellung“ als Word-Datei (.docx). Wird erst beim Erzeugen geladen. */
(function () {
    'use strict';

    const enc = s => new TextEncoder().encode(s);
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const BW = 9060;                    // Breite der Kästen
    const SZ = 15;                      // 7,5 pt wie im Vordruck

    const rpr = o => {
        o = o || {};
        const f = o.font || 'Arial';
        return '<w:rPr><w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '" w:eastAsia="' + f + '"/>' +
            (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.u ? '<w:u w:val="single"/>' : '') +
            '<w:sz w:val="' + (o.sz || SZ) + '"/><w:szCs w:val="' + (o.sz || SZ) + '"/></w:rPr>';
    };
    const run = (t, o) => t === '' || t == null ? '' : '<w:r>' + rpr(o) + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
    const tab = o => '<w:r>' + rpr(o) + '<w:tab/></w:r>';
    const cb = (on, sz) => run(on ? '☒' : '☐', { font: 'MS Gothic', sz: sz || 14 });
    // tabs: Zahlen = linksbündig; { p, u: true } = mit Linie davor
    const para = (inner, o) => {
        o = o || {};
        const tabs = (o.tabs || []).map(t => typeof t === 'number' ? { p: t } : t);
        return '<w:p><w:pPr>' + (o.keep ? '<w:keepNext/>' : '') +
            (o.top ? '<w:pBdr><w:top w:val="single" w:sz="4" w:space="1" w:color="1A1A1A"/></w:pBdr>' : '') +
            (tabs.length ? '<w:tabs>' + tabs.map(t => '<w:tab w:val="left"' + (t.u ? ' w:leader="underscore"' : '') + ' w:pos="' + t.p + '"/>').join('') + '</w:tabs>' : '') +
            '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after || 0) + '" w:line="' + (o.line || 180) + '" w:lineRule="' + (o.rule || 'exact') + '"/>' +
            (o.ind ? '<w:ind w:left="' + o.ind + '" w:hanging="' + o.ind + '"/>' : '') +
            (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '') + '</w:pPr>' + inner + '</w:p>';
    };
    const bd = (c) => ['top', 'left', 'bottom', 'right'].map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="' + (c || '1A1A1A') + '"/>').join('');
    function box(inner, o) {
        o = o || {};
        return '<w:tbl><w:tblPr><w:tblW w:w="' + (o.w || BW) + '" w:type="dxa"/><w:tblBorders>' + bd() + '</w:tblBorders><w:tblLayout w:type="fixed"/>' +
            '<w:tblCellMar><w:top w:w="' + (o.pt == null ? 10 : o.pt) + '" w:type="dxa"/><w:left w:w="' + (o.pl == null ? 70 : o.pl) + '" w:type="dxa"/><w:bottom w:w="' + (o.pb == null ? 10 : o.pb) + '" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
            '<w:tblGrid><w:gridCol w:w="' + (o.w || BW) + '"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/>' +
            (o.h ? '<w:trHeight w:val="' + o.h + '" w:hRule="exact"/>' : '') + '</w:trPr><w:tc><w:tcPr><w:tcW w:w="' + (o.w || BW) + '" w:type="dxa"/></w:tcPr>' + inner + '</w:tc></w:tr></w:tbl>';
    }
    const gap = (h) => para('', { line: h || 100 });

    function wrap(text, maxChars, max) {
        const lines = [];
        String(text || '').split(/\n/).forEach(par => {
            let cur = '';
            par.split(/\s+/).filter(Boolean).forEach(w => {
                const t = cur ? cur + ' ' + w : w;
                if (t.length <= maxChars) cur = t; else { if (cur) lines.push(cur); cur = w; }
            });
            lines.push(cur);
        });
        return lines;
    }

    async function build(f) {
        const fflate = window.fflate;
        const ck = new Set(f.checks || []);
        if (f.grund) ck.add('gruende');
        if (f.usonst) ck.add('u-sonst');
        const has = k => ck.has(k);
        const a = 1400, RT = 6336;   // Beschreibung / rechte Spalte

        /* ---------- Seite 1 ---------- */
        let b = '';
        // Kasten 1 als Tabelle mit verbundenen Zellen
        const cell = (w, inner, extra) => '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (extra || '') + '</w:tcPr>' + inner + '</w:tc>';
        const lab = (t, v, ex) => para(run(t, {}) + (v ? run('   ' + v, { sz: 19 }) : ''), { line: 200, before: ex || 0 });
        b += '<w:tbl><w:tblPr><w:tblW w:w="' + BW + '" w:type="dxa"/><w:tblBorders>' + bd() + '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="1A1A1A"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="1A1A1A"/></w:tblBorders><w:tblLayout w:type="fixed"/>' +
            '<w:tblCellMar><w:top w:w="20" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="20" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
            '<w:tblGrid><w:gridCol w:w="5580"/><w:gridCol w:w="3480"/></w:tblGrid>' +
            '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="346" w:hRule="atLeast"/></w:trPr>' +
            cell(5580, para(run('Name, Vorname', {}), { line: 200 }) + para(run(f.nameErst || '', { sz: 24 }), { line: 300, before: 120 }), '<w:vMerge w:val="restart"/>') +
            cell(3480, lab('Telefon', f.telefon)) + '</w:tr>' +
            '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="332" w:hRule="atLeast"/></w:trPr>' +
            cell(5580, para('', { line: 200 }), '<w:vMerge/>') + cell(3480, lab('Personalnummer', f.personalnr)) + '</w:tr>' +
            '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="338" w:hRule="atLeast"/></w:trPr>' +
            cell(9060, lab('Privatanschrift', f.anschrift), '<w:gridSpan w:val="2"/>') + '</w:tr>' +
            '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="500" w:hRule="atLeast"/></w:trPr>' +
            cell(9060, para(run('An die Schulleitung des Lily-Braun-Gymnasiums 05Y05', { sz: 18 }), { line: 220, before: 20 }), '<w:gridSpan w:val="2"/>') + '</w:tr></w:tbl>';
        b += para(run('Antrag auf Freistellung', { b: true, sz: 23 }), { jc: 'center', before: 100, after: 120, line: 270 });

        // Kasten 2
        let z = '';
        const zt = [936, 1500, { p: 2820, u: true }, 2880, 3110, { p: 4460, u: true }, 4600, 5076, { p: 6580, u: true }];
        z += para(run('Zeitraum:', { b: true }) + tab() + cb(f.modus === 'bis') + run(' vom') + tab() + run(f.modus === 'bis' ? f.von : '', { sz: 19, u: true }) + tab() +
            tab() + run('bis') + tab() + run(f.modus === 'bis' ? f.bis : '', { sz: 19, u: true }) + tab() +
            tab() + cb(f.modus === 'am') + run(' am') + tab() + run(f.modus === 'am' ? f.von : '', { sz: 19, u: true }) + tab(),
            { tabs: zt, before: 100, line: 230 });
        z += para(cb(has('fort')) + run('  ') + run('für eine Fortbildungsveranstaltung der SenBJF', { b: true }), { before: 140 });
        z += para(run('(Original des Anmeldungsschreibens wurde bereits an die SenBJF abgesandt / Kopie liegt bei)', { i: true }), { ind: 0, before: 0, tabs: [] }).replace('<w:pPr>', '<w:pPr><w:ind w:left="190"/>').replace(/<w:ind w:left="190"\/>([\s\S]*?)<w:ind[^>]*\/>/, '<w:ind w:left="190"/>$1');
        z += para(cb(has('gruende')) + run('  ') + run('aus folgenden Gründen', { b: true }), {});
        z += para(run('(Begründung - stichpunktartige Beschreibung / ggf. weitergehende Begründung auf gesondertes Blatt)', { i: true }), {}).replace('<w:pPr>', '<w:pPr><w:ind w:left="190"/>');
        const gl = wrap(f.grund, 105).slice(0, 4);
        for (let i = 0; i < 3; i++) z += para(run(gl[i] || '', { sz: 18 }), { line: 220 }).replace('<w:pPr>', '<w:pPr><w:ind w:left="190"/>');
        const ut = [1700, 1920, 5270, 5440];
        z += para(run('Beigefügte Unterlagen:') + tab() + cb(has('u-programm')) + tab() + run('Programm') + tab() + cb(has('u-einladung')) + tab() + run('Einladung'), { tabs: ut, before: 120, line: 210 });
        z += para(tab() + cb(has('u-nachweis')) + tab() + run('Nachweis der Förderungswürdigkeit') + tab() + cb(has('u-mitglied')) + tab() + run('Erklärung über Mitgliedschaft'), { tabs: ut, line: 210 });
        z += para(tab() + run('(des Veranstalters bzw. der Veranstaltung)') + tab() + cb(has('u-sonst')) + tab() + run(f.usonst || '', { sz: 17, u: true }) + tab(),
            { tabs: [1920, 5270, 5440, { p: 8700, u: true }], line: 210 });
        z += para(tab() + cb(has('u-nachgereicht')) + tab() + run('Folgende Unterlagen werden nachgereicht') + tab() + tab(),
            { tabs: [1700, 1920, 5270, { p: 8700, u: true }], line: 210 });
        b += gap(60) + box(z, {});

        // Kästen A bis D
        const l1 = (k, par, desc, bold) => para(tab() + cb(has(k)) + tab() + run(par, { b: true }) + tab() + run(desc, bold ? { b: true } : {}), { tabs: [330, 490, a] });
        const l2 = (k, nr, desc, extra) => para(tab() + cb(has(k)) + tab() + run(nr) + tab() + run(desc) + (extra || ''), { tabs: [554, 756, a, 4980, 6500] });
        const info = () => run('Textanm. siehe ', { i: true }) + run('(i)', { i: true });
        let A = para(run('A', { b: true }) + tab() + run('Grundlage eines Urlaubs nach der SUrlVO *)', { b: true }), { tabs: [340] });
        A += l1('a2', '§ 2', 'Urlaub zur Wahrnehmung staatsbürgerlicher Pflichten und Rechte');
        A += l1('a3a', '§ 3 a', 'Urlaub für Zwecke der militärischen und zivilen Verteidigung');
        A += l1('a4', '§ 4', 'Absatz 1', true);
        [['Bildungsveranstaltungen, die staatspolitischen Zwecken dienen (Förderungswürdigkeit)'], ['Kirchliche Zwecke'],
         ['Veranstaltungen, die von Nutzen für die dienstliche Tätigkeit sind'], ['gewerkschaftliche Zwecke / Veranstaltungen von Berufsverbänden (Mitgliedschaft)'],
         ['Sportveranstaltungen (besonderes Interesse des Landes Berlin muss anerkannt sein)'],
         ['Olympisches Komitee, nationale / internationale Dachorganisationen von Sportverbänden'], ['Ablegen von Prüfungen im Rahmen einer Fortbildung']]
            .forEach((r, i) => { A += l2('a4n' + (i + 1), 'Nr. ' + (i + 1), r[0]); });
        A += l1('a5', '§ 5', 'Urlaub für ehrenamtliche Jugendarbeit');
        b += gap(100) + box(A);

        let B = para(run('B', { b: true }) + tab() + run('Grundlage eines Sonderurlaubs – Ausführungsvorschriften zu § 7 SUrlVO *)', { b: true }), { tabs: [340] });
        B += para(tab() + cb(has('b1')) + tab() + run('§ 1', { b: true }) + tab() + run('Absatz 1', { b: true }) + run(' – Persönliche Gründe'), { tabs: [330, 490, a] });
        B += l2('b1n1', 'Nr. 1', 'Niederkunft der Ehefrau oder der eingetragenen Lebenspartnerin', tab() + run('1 Tag'));
        B += l2('b1n2', 'Nr. 2', 'Tod der Ehefrau oder des Ehemannes, der eingetragenen Lebens-', tab() + run('2 Tage'));
        B += para(tab() + run('partnerin oder des eingetragenen Lebenspartners,'), { tabs: [a] });
        B += para(tab() + run('eines Kindes oder Elternteils'), { tabs: [a] });
        B += para(tab() + cb(has('b1n3')) + tab() + run('Nr. 3') + tab() + run('Umzug aus ') + run('dienstlichen', { b: true, u: true }) + run(' Gründen an einen anderen Ort') + tab() + tab() + run('1 Tag'), { tabs: [554, 756, a, 4980, 6500] });
        B += l2('b1n4', 'Nr. 4', 'Schwere Erkrankung', tab() + info());
        B += para(tab() + tab() + tab() + cb(has('b1n4a')) + run(' eines Angehörigen, soweit er in dem selben Haushalt lebt') + tab() + tab() + run('1 Tag im Kalenderjahr'), { tabs: [554, 756, 1300, 4980, 6500] }).replace('<w:tab w:val="left" w:pos="1300"/>', '<w:tab w:val="left" w:pos="1300"/>');
        B += para(tab() + cb(has('b2')) + tab() + run('§ 2', { b: true }) + tab() + run('Sonstige dringende Fälle') + tab() + info() + tab() + run('bis zu 3 Tage'), { tabs: [330, 490, a, 4980, 6500] });
        b += gap(100) + box(B);

        let C = para(run('C', { b: true }) + tab() + run('Grundlage eines Sonderurlaubs nach der SUrlVO *) zur weiteren Veranlassung an Personalstelle', { b: true }), { tabs: [340] });
        C += para(tab() + cb(has('c7')) + tab() + run('§ 7', { b: true }) + run(' Nr. 5') + tab() + run('Schwere Erkrankung'), { tabs: [330, 490, a] });
        C += para(tab() + cb(has('c7a')) + run(' eines Kindes, das das 12. Lebensjahr noch nicht vollendet hat'), { tabs: [1354] });
        C += para(tab() + cb(has('c7b')) + run(' einer Betreuungsperson (Kind unter 8 Jahren)') + tab() + info(), { tabs: [1354, 4980] });
        C += para(tab() + cb(has('c8')) + tab() + run('§ 8', { b: true }) + tab() + run('Urlaub zur Durchführung einer Heilkur') + tab() + info(), { tabs: [330, 490, a, 4980] });
        C += l1('c9', '§ 9', 'Urlaub zur Wahrnehmung besonderer Aufgaben und für eine fremdsprachliche Aus- oder Fortbildung');
        const vor = 'Die Voraussetzungen bitte den Ausführungen der SUrlVO entnehmen; Schulrecht 6.5.7 Seite 18a ff';
        C += para(tab() + run('(die Voraussetzungen bitte den Ausführungen der SUrlVO entnehmen; Schulrecht 6.5.7 Seite 18a ff)', { i: true }), { tabs: [1450] });
        C += l1('c10', '§ 10', 'Urlaub aus sonstigen Anlässen');
        C += para(tab() + run('(die Voraussetzungen bitte den Ausführungen der SUrlVO entnehmen; Schulrecht 6.5.7 Seite 18a ff)', { i: true }), { tabs: [1450] });
        b += gap(100) + box(C);

        let D = para(run('D', { b: true }) + tab() + cb(has('d')) + tab() + run('Bildungsurlaub', { b: true }), { tabs: [216, 344] });
        D += para(tab() + run('Berliner Bildungsurlaubsgesetz (BiUrlG) vom 24.10.1990 (GVBl. S. 2209)'), { tabs: [612] });
        b += gap(100) + box(D);

        let E = para(run('(Diese Erklärung entfällt bei Freistellung für SenBJF-Veranstaltungen!)', { b: true, i: true }));
        E += para(run('Im laufenden Jahr (200__) wurden mir bereits') + tab() + run(f.tage1 || '', { sz: 19, u: true }) + tab() + tab() + run('Tage Sonderurlaub gewährt.'), { tabs: [3340, { p: 3830, u: true }, 3880], before: 60 });
        E += para(run('Im vorhergehenden Jahr (200 ___) wurden mir') + tab() + run(f.tage2 || '', { sz: 19, u: true }) + tab() + tab() + run('Tage Sonderurlaub gewährt.'), { tabs: [3340, { p: 3830, u: true }, 3880] });
        b += gap(100) + box(E);

        let F = para(cb(has('e-merk')) + tab() + run('Von dem „Merkblatt zum Antrag auf Freistellung“ habe ich Kenntnis genommen.'), { tabs: [240], ind: 240 });
        F += para(cb(has('e-angest')) + tab() + run('Ich bin im Angestelltenverhältnis beschäftigt; mir ist bekannt, dass die genannten Vorschriften sinngemäß auch für Angestellte gelten. Ich bitte daher, nach den entsprechenden tarifrechtlichen Regelungen zu entscheiden (Richtlinien über den Urlaub der Arbeitnehmer aus besonderen Anlässen, § 52 BAT und § 45 SGB V).'), { tabs: [240], ind: 240 });
        F += para(run('Datum / Unterschrift Antragsteller/in'), { top: true, before: 420 });
        b += gap(100) + box(F);
        b += para(run('*) SUrlVO', { b: true }) + run(' (Verordnung über den Urlaub der Beamten und Richter aus besonderen Anlässen –Sonderurlaubsverordnung)'), { before: 60 });

        /* ---------- Seite 2 ---------- */
        const S2 = 23, P2 = (inner, o) => para(inner, Object.assign({ line: 280 }, o));
        b += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        b += para(run('Entscheidung über den Antrag durch Schulleitung', { b: true, sz: S2 }), { jc: 'center', before: 1100, line: 280 });
        b += para(run('(Hinweis für die Schulleitung: Bei Ablehnung ist ein gesonderter Bescheid erforderlich!)', { sz: 19 }), { jc: 'center', line: 240 });
        let P = '';
        P += para(tab() + run('Datum', { sz: 15 }) + tab() + tab(), { tabs: [4900, 5500, { p: 8300, u: true }], before: 420, line: 240 });
        P += para(tab() + run('Telefon', { sz: 15 }) + tab() + tab(), { tabs: [4900, 5500, { p: 8300, u: true }], before: 100, line: 240 });
        P += para(tab(), { tabs: [{ p: 4400, u: true }], before: 1000, line: 240 });
        P += para(run('Entscheidungsträger', { sz: 15 }), { line: 190 });
        P += para(run('Stempel / Stellenzeichen', { sz: 15 }), { line: 190 });
        P += P2(run('Herrn / Frau', { b: true, sz: S2 }) + tab() + run(f.nameZweit || '', { sz: S2 }) + tab(), { tabs: [1450, { p: 5400, u: true }], before: 1250 });
        P += P2(run('Ihr Antrag auf Freistellung', { b: true, sz: S2 }) + run(' für die Zeit vom', { sz: S2 }) + tab() + run(f.von2 || '', { sz: S2 }) + tab(), { tabs: [4700, { p: 8200, u: true }], before: 500 });
        P += P2(tab() + run('bis', { sz: S2 }) + tab() + run(f.bis2 || '', { sz: S2 }) + tab(), { tabs: [4200, 4700, { p: 8200, u: true }], before: 80 });
        P += P2(run('Sehr geehrter Herr / Sehr geehrte Frau', { sz: S2 }) + tab() + tab() + run('!', { sz: S2 }), { tabs: [4150, { p: 7800, u: true }, 8000], before: 640 });
        const c2 = (t, extra) => P2(cb(false, 20) + tab() + run(t, { sz: 21 }), Object.assign({ tabs: [360] }, extra));
        P += c2('Ihrem o.a. Antrag wird entsprochen.', { before: 420 });
        P += c2('Die nicht mehr benötigten Unterlagen erhalten Sie nach Einsicht anliegend', { before: 340 });
        P += P2(tab() + run('zurück.', { sz: 21 }), { tabs: [360] });
        P += c2('Von Ihrer Personalstelle erhalten Sie weitere Nachricht.', { before: 340 });
        P += para(tab() + run('(bei Freistellungsantrag nach Buchstabe C)', { i: true, sz: 14 }), { tabs: [360], line: 200 });
        P += P2(run('Mit freundlichen Grüßen', { sz: S2 }), { before: 480 });
        P += P2(run('Im Auftrag', { sz: S2 }));
        P += P2(run('Urschriftlich', { b: true, sz: S2 }), { before: 1000 });
        b += gap(480) + box(P, { pl: 260, h: 11000, pt: 40 });

        const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
        const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        const sect = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="520" w:right="1290" w:bottom="500" w:left="1296" w:header="400" w:footer="300" w:gutter="0"/></w:sectPr>';
        const styles = X + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>' +
            '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="15"/><w:szCs w:val="15"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault>' +
            '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
            '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/></w:tblPr></w:style></w:styles>';
        const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        return fflate.zipSync({
            '[Content_Types].xml': enc(X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
                '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
                '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
                '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'),
            '_rels/.rels': enc(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="word/document.xml"/>' +
                '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'),
            'word/_rels/document.xml.rels': enc(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/styles" Target="styles.xml"/></Relationships>'),
            'word/document.xml': enc(X + '<w:document ' + NS + '><w:body>' + b + sect + '</w:body></w:document>'),
            'word/styles.xml': enc(styles),
            'docProps/core.xml': enc(X + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Antrag auf Freistellung</dc:title><dc:creator></dc:creator></cp:coreProperties>')
        });
    }

    window.FreistellungDocx = { build: build };
})();
