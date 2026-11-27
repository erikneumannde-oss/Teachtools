/* Erzeugt den Antrag als Word-Datei (.docx) im Aufbau des Schulformulars. Wird erst beim Erzeugen geladen. */
(function () {
    'use strict';

    const enc = s => new TextEncoder().encode(s);
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const FIRST = 18, NEXT = 36;
    const GREY = '4D4D4D';
    const CW = [3260, 3440, 2760];      // Spaltenbreiten der Tabelle
    const FULL = 9466;

    const rpr = o => {
        o = o || {};
        const f = o.font || 'Arial';
        return '<w:rPr><w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '" w:eastAsia="' + f + '"/>' +
            (o.b ? '<w:b/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') +
            '<w:sz w:val="' + (o.sz || 22) + '"/><w:szCs w:val="' + (o.sz || 22) + '"/></w:rPr>';
    };
    const run = (t, o) => t === '' || t == null ? '' : '<w:r>' + rpr(o) + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
    const tab = o => '<w:r>' + rpr(o) + '<w:tab/></w:r>';
    const para = (inner, o) => {
        o = o || {};
        return '<w:p><w:pPr>' + (o.keep ? '<w:keepNext/>' : '') +
            (o.border ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>' : '') +
            (o.tabs ? '<w:tabs>' + o.tabs.map(t => '<w:tab w:val="' + (t.v || 'left') + '"' + (t.dot ? ' w:leader="dot"' : '') + ' w:pos="' + t.pos + '"/>').join('') + '</w:tabs>' : '') +
            '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after || 0) + '" w:line="' + (o.line || 240) + '" w:lineRule="auto"/>' +
            (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '') + '</w:pPr>' + inner + '</w:p>';
    };
    const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

    /* Zeile mit Beschriftung, Eingabe und Punktlinie bis zum jeweils nächsten Tabulator */
    function fieldRow(items, o) {
        const tabs = [];
        let inner = '';
        items.forEach(it => {
            if (it.t != null) inner += run(it.t, {});
            else { inner += run(it.v || '', { sz: 21 }) + tab({}); tabs.push({ pos: it.to, dot: true }); }
        });
        return para(inner, { tabs: tabs, before: o && o.before != null ? o.before : 150 });
    }

    const vs = (t, w) => { const n = (t || '').length, cap = w / 105; return n <= cap ? 21 : n <= cap * 1.15 ? 18 : n <= cap * 1.35 ? 16 : 14; };
    function cell(w, inner, o) {
        o = o || {};
        return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>' +
            para(inner, { jc: o.jc }) + '</w:tc>';
    }
    function table(rows, startNr, nRows) {
        const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => '<w:' + s + ' w:val="single" w:sz="6" w:space="0" w:color="000000"/>').join('');
        let x = '<w:tbl><w:tblPr><w:tblW w:w="' + FULL + '" w:type="dxa"/><w:tblBorders>' + bd + '</w:tblBorders><w:tblLayout w:type="fixed"/>' +
            '<w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' +
            CW.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>';
        x += '<w:tr><w:trPr><w:trHeight w:val="290" w:hRule="exact"/><w:cantSplit/></w:trPr>' +
            ['NAME', 'VORNAME', 'KLASSE/TUTOR'].map((h, i) => cell(CW[i], run(h, { font: 'Calibri', b: true }), { jc: 'center' })).join('') + '</w:tr>';
        for (let i = 0; i < nRows; i++) {
            const s = rows[i] || {};
            x += '<w:tr><w:trPr><w:trHeight w:val="350" w:hRule="exact"/><w:cantSplit/></w:trPr>' +
                cell(CW[0], run(String(startNr + i), { sz: 20 }) + tab({ sz: 20 }) + run(s.n || '', { sz: vs(s.n, CW[0] - 520) })).replace('<w:pPr>', '<w:pPr><w:tabs><w:tab w:val="left" w:pos="440"/></w:tabs>') +
                cell(CW[1], run(s.v || '', { sz: vs(s.v, CW[1]) })) +
                cell(CW[2], run(s.k || '', { sz: vs(s.k, CW[2]) })) + '</w:tr>';
        }
        return x + '</w:tbl>';
    }

    function drawing(rid) {
        const cx = Math.round(163 * 12700), cy = Math.round(63 * 12700);
        return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
            '<wp:docPr id="1" name="Schulgebäude" descr="Zeichnung des Schulgebäudes"/>' +
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="schule.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
            '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
            '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }

    async function build(f) {
        const fflate = window.fflate;
        const img = new Uint8Array(await (await fetch('schule.png')).arrayBuffer());
        const art = f.exkursion && !f.sport ? 'Exkursion' : f.sport && !f.exkursion ? 'Sportwettkampf' : f.exkursion && f.sport ? 'Exkursion und Sportwettkampf' : '';
        const students = f.ganz ? [] : f.students;
        const total = 1 + Math.ceil(Math.max(0, students.length - FIRST) / NEXT);
        const box = on => run(on ? '☒' : '☐', { font: 'MS Gothic', sz: 22 });

        let b = '';
        // Kopf: Bild links, Schulname rechts
        b += para(drawing('rId10') + tab({}) + run('Lily-Braun-Gymnasium', { font: 'Calibri', b: true, color: GREY }),
            { tabs: [{ pos: 6000 }], line: 240 });
        b += para(tab({}) + run('gegründet 1862 in Berlin-Spandau', { font: 'Calibri', sz: 20, color: GREY }),
            { tabs: [{ pos: 6000 }], border: true, after: 60 });
        b += para(run('Antrag auf', { font: 'Calibri', b: true, sz: 40 }), { jc: 'center', before: 60, after: 120 });
        b += para(tab({}) + box(f.exkursion) + run('  Durchführung einer Exkursion', {}), { tabs: [{ pos: 360 }], before: 60 });
        b += para(tab({}) + box(f.sport) + run('  Teilnahme an einem Sportwettkampf', {}), { tabs: [{ pos: 360 }], before: 160, after: 80 });

        b += fieldRow([{ t: 'ab der ' }, { v: f.std, to: 1900 }, { t: ' Std.' }]);
        b += fieldRow([{ t: 'am ' }, { v: f.datum, to: 4300 }, { t: '   von ' }, { v: f.von, to: 5900 }, { t: ' Uhr    bis ' }, { v: f.bis, to: 8300 }, { t: ' Uhr' }]);
        b += fieldRow([{ t: 'Klasse/Kurs: ' }, { v: f.klasse, to: 4800 }]);
        b += fieldRow([{ t: 'verantwortl. Lehrer*in ' }, { v: f.lehrer, to: 4900 }, { t: '   Begleitung ' }, { v: f.begleitung, to: FULL }]);
        b += fieldRow([{ t: 'Zielort/Thema ' }, { v: f.ziel, to: FULL }]);
        b += fieldRow([{ t: 'Treffpunkt: ' }, { v: f.treff, to: 7300 }, { t: '   um ' }, { v: f.treffzeit, to: 8700 }, { t: ' Uhr' }]);

        if (f.ganz) {
            b += para(run('Es nimmt die gesamte Klasse beziehungsweise der gesamte Kurs teil.', {}), { before: 200 });
        } else {
            b += para(run('Mit folgenden Schülerinnen und Schülern (entfällt bei gesamter Klasse)', {}), { before: 200, after: 40, keep: true });
            b += table(students.slice(0, FIRST), 1, FIRST);
        }
        const sigTabs = [{ pos: 3500, dot: true }, { pos: 5500 }, { pos: 8900, dot: true }];
        b += para(tab({}) + tab({}) + tab({}), { tabs: sigTabs, before: 700 });
        b += para(run('Datum, Unterschrift verantwortl. Lehrer*in', { font: 'Calibri', b: true, sz: 17 }) + tab({}) +
            run('Datum/Unterschrift Schulleitung', { font: 'Calibri', b: true, sz: 17 }), { tabs: [{ pos: 5500 }], before: 20 });

        for (let pi = 1; pi < total; pi++) {
            const from = FIRST + (pi - 1) * NEXT;
            const slice = students.slice(from, from + NEXT);
            b += pageBreak.replace('<w:p>', '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>');
            b += para(run('Antrag auf ' + (art || 'Exkursion oder Sportwettkampf') + ': Fortsetzung der Schülerliste', { font: 'Calibri', b: true, sz: 28 }), { after: 60 });
            const sub = [f.klasse, f.datum, f.ziel].filter(Boolean).join('  ·  ');
            b += para(run(sub, { sz: 21, color: GREY }), { border: true, after: 200 });
            b += table(slice, from + 1, slice.length);
        }

        const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
        const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        const sect = '<w:sectPr>' + (total > 1 ? '<w:footerReference w:type="default" r:id="rId11"/>' : '') +
            '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1200" w:bottom="1000" w:left="1240" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr>';
        const document = X + '<w:document ' + NS + '><w:body>' + b + sect + '</w:body></w:document>';
        const footer = X + '<w:ftr ' + NS + '>' + para('<w:r>' + rpr({ sz: 18, color: GREY }) + '<w:t xml:space="preserve">Seite </w:t></w:r>' +
            '<w:fldSimple w:instr=" PAGE ">' + run('1', { sz: 18, color: GREY }) + '</w:fldSimple>' + run(' von ', { sz: 18, color: GREY }) +
            '<w:fldSimple w:instr=" NUMPAGES ">' + run(String(total), { sz: 18, color: GREY }) + '</w:fldSimple>', { jc: 'center' }) + '</w:ftr>';
        const styles = X + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>' +
            '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault>' +
            '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
            '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/></w:tblPr></w:style></w:styles>';
        const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        const out = {
            '[Content_Types].xml': enc(X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
                '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
                '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
                '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
                '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'),
            '_rels/.rels': enc(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="word/document.xml"/>' +
                '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'),
            'word/_rels/document.xml.rels': enc(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="' + REL + '/styles" Target="styles.xml"/>' +
                '<Relationship Id="rId10" Type="' + REL + '/image" Target="media/schule.png"/>' +
                '<Relationship Id="rId11" Type="' + REL + '/footer" Target="footer1.xml"/></Relationships>'),
            'word/document.xml': enc(document),
            'word/styles.xml': enc(styles),
            'word/footer1.xml': enc(footer),
            'word/media/schule.png': img,
            'docProps/core.xml': enc(X + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' +
                esc('Antrag auf ' + (art || 'Exkursion oder Sportwettkampf')) + '</dc:title><dc:creator></dc:creator></cp:coreProperties>')
        };
        return fflate.zipSync(out);
    }

    window.AntragDocx = { build: build };
})();
