/* Erzeugt die Word-Datei aus der Briefvorlage der Schule. Wird erst beim Herunterladen geladen. */
(function () {
    'use strict';

    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dec = b => new TextDecoder('utf-8').decode(b);
    const enc = s => new TextEncoder().encode(s);

    // Abstand vor dem Betreff in Zwanzigstelpunkt: der Betreff beginnt 323 pt vom oberen Seitenrand
    const BETREFF_BEFORE = 4774;
    const FONT = '<w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cs="Arial"/>';
    let pid = 0x30000000;
    const nextId = () => (pid++).toString(16).toUpperCase().padStart(8, '0');

    function run(text, extra) {
        return '<w:r><w:rPr>' + FONT + (extra || '') + '</w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
    }
    function para(text, opts) {
        opts = opts || {};
        const ppr = '<w:pPr>' + (opts.keepNext ? '<w:keepNext/>' : '') + '<w:rPr>' + FONT + (opts.rpr || '') + '</w:rPr></w:pPr>';
        const body = text === '' ? '' : (opts.runs || run(text, opts.rpr));
        return '<w:p w14:paraId="' + nextId() + '" w14:textId="77777777">' + ppr + body + '</w:p>';
    }

    // Absatz mit der angegebenen paraId samt Inhalt ersetzen (er kommt in Choice und Fallback vor)
    function replacePara(xml, paraId, fn) {
        const re = new RegExp('<w:p w14:paraId="' + paraId + '"[^>]*>[\\s\\S]*?</w:p>', 'g');
        let n = 0;
        const out = xml.replace(re, m => { n++; return fn(m); });
        if (!n) throw new Error('Vorlage unerwartet: Absatz ' + paraId + ' fehlt');
        return out;
    }

    const FOOTER_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    function footerXml(variant) {
        const rp = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="4D4D4D"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>';
        const t = s => '<w:r>' + rp + '<w:t xml:space="preserve">' + s + '</w:t></w:r>';
        const ins = s => '<w:r>' + rp + '<w:instrText xml:space="preserve">' + s + '</w:instrText></w:r>';
        const fc = k => '<w:r>' + rp + '<w:fldChar w:fldCharType="' + k + '"/></w:r>';
        const field = (code, shown) => fc('begin') + ins(' ' + code + ' ') + fc('separate') + t(shown) + fc('end');
        // { IF { NUMPAGES } > 1 "Seite { PAGE } von { NUMPAGES }" "" } – die Seitenzahl erscheint nur bei mehr als einer Seite
        if (variant === 'plain') {
            return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + FOOTER_NS + '><w:p><w:pPr><w:pStyle w:val="Fuzeile"/><w:jc w:val="center"/><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>' +
                t('Seite ') + field('PAGE', '1') + t(' von ') + field('NUMPAGES', '1') + '</w:p></w:ftr>';
        }
        const content = fc('begin') + ins(' IF ') + field('NUMPAGES', '1') + ins(' > 1 "Seite ') + field('PAGE', '1') + ins(' von ') + field('NUMPAGES', '1') + ins('" "" ') + fc('separate') + fc('end');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + FOOTER_NS + '><w:p><w:pPr><w:pStyle w:val="Fuzeile"/><w:jc w:val="center"/><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>' + content + '</w:p></w:ftr>';
    }

    // Schätzt mit denselben Schriftmaßen wie die PDF-Datei, ob der Brief auf eine Seite passt
    async function estimate(letter) {
        const fk = window.fontkit;
        const get = async u => new Uint8Array(await (await fetch(u)).arrayBuffer());
        const [r, b] = await Promise.all([get('../lib/fonts/Carlito-Regular.ttf'), get('../lib/fonts/Carlito-Bold.ttf')]);
        const f = { reg: fk.create(r), bold: fk.create(b) };
        const feat = { liga: false, clig: false, calt: false, dlig: false };
        const measure = (key, text, size) => {
            const font = f[key];
            const run = font.layout(text, feat);
            return run.positions.reduce((sum, p) => sum + p.xAdvance, 0) / font.unitsPerEm * size;
        };
        const lay = window.BriefLayout.paginate(letter, measure);
        return { pages: lay.pages.length, bottomUsed: lay.bottomUsed, limit: window.BriefLayout.C.BOTTOM };
    }

    async function build(letter) {
        const fflate = window.fflate;
        const res = await fetch('vorlage.docx');
        if (!res.ok) throw new Error('Vorlage nicht ladbar');
        const files = fflate.unzipSync(new Uint8Array(await res.arrayBuffer()));
        let doc = dec(files['word/document.xml']);

        // 1. Adressfeld: statt „An “ stehen die Adresszeilen. Das Feld wird höher, damit auch längere Adressen passen.
        doc = replacePara(doc, '233CC48B', () => letter.address.map(l => para(l, { rpr: '<w:kern w:val="16"/><w:szCs w:val="28"/>' })).join(''));
        doc = doc.split('<wp:extent cx="2948940" cy="1188085"/>').join('<wp:extent cx="2948940" cy="1700000"/>')
            .split('<a:ext cx="2948940" cy="1188085"/>').join('<a:ext cx="2948940" cy="1700000"/>')
            .split('height:93.55pt').join('height:133.85pt');

        // 2. Ansprechpartner (Kürzel) und Datum in der zweiten Zeile des Feldes
        doc = replacePara(doc, '70006EAD', m => {
            const ppr = (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(m) || [''])[0];
            const rp = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';
            return '<w:p w14:paraId="' + nextId() + '" w14:textId="77777777">' + ppr +
                '<w:r>' + rp + '<w:t xml:space="preserve">' + esc(letter.kuerzel) + '</w:t></w:r>' +
                '<w:r>' + rp + '<w:tab/></w:r>' +
                '<w:r>' + rp + '<w:t>' + esc(letter.date) + '</w:t></w:r></w:p>';
        });

        // 3. Die Felder liegen fest auf der Seite und umfließen keinen Text, so hängt die Lage des Betreffs nicht von ihrer Größe ab.
        // Die leeren Absätze vor dem Betreff entfallen, ein fester Abstand ersetzt sie.
        doc = doc.split('<wp:wrapSquare wrapText="left"/>').join('<wp:wrapNone/>');
        const blank0 = doc.indexOf('<w:p w14:paraId="02EB378F"');
        const start = doc.indexOf('<w:p w14:paraId="5B103AF2"');
        const end = doc.indexOf('<w:sectPr');
        if (blank0 < 0 || start < 0 || end < 0) throw new Error('Vorlage unerwartet');
        doc = doc.slice(0, blank0) + doc.slice(start);
        const start2 = doc.indexOf('<w:p w14:paraId="5B103AF2"');
        const end2 = doc.indexOf('<w:sectPr');
        const big = '<w:sz w:val="30"/><w:szCs w:val="30"/>';
        let body = '<w:p w14:paraId="' + nextId() + '" w14:textId="77777777"><w:pPr><w:keepNext/><w:spacing w:before="' + BETREFF_BEFORE + '"/><w:rPr>' + FONT + '<w:b/><w:bCs/>' + big + '</w:rPr></w:pPr>' +
            run('Betreff', '<w:b/><w:bCs/>' + big) + run(': ', big) + run(letter.subject, '<w:b/><w:bCs/>' + big) + '</w:p>';
        body += para('', { keepNext: true });
        body += para(letter.salutation, { keepNext: true });
        body += para('', { keepNext: true });
        const lines = letter.lines;
        lines.forEach((l, i) => { body += para(l, { keepNext: i === lines.length - 1 }); });
        body += para('', { keepNext: true });
        body += para('Mit freundlichen Grüßen', { keepNext: true });
        for (let i = 0; i < 3; i++) body += para('', { keepNext: true });
        body += para(letter.names, { keepNext: !!letter.tail });
        if (letter.tail) {
            body += para('', { keepNext: true });
            body += para(letter.tail, { rpr: '<w:sz w:val="20"/><w:szCs w:val="20"/>' });
        }
        doc = doc.slice(0, start2) + body + doc.slice(end2);

        // 4. Fußzeile mit „Seite x von y“, nur bei mehr als einer Seite.
        // Mehrseitig: einfache Felder. Eine Seite: keine Fußzeile. Knapp an der Grenze: Feld mit Bedingung, das Word selbst auswertet.
        const est = await estimate(letter);
        let variant = null;
        if (est.pages > 1) variant = 'plain';
        else if (est.bottomUsed > est.limit - 3 * 14.65) variant = 'if';
        if (variant) doc = doc.replace('<w:headerReference w:type="first" r:id="rId8"/>', '<w:headerReference w:type="first" r:id="rId8"/><w:footerReference w:type="default" r:id="rId91"/><w:footerReference w:type="first" r:id="rId92"/>');
        files['word/document.xml'] = enc(doc);
        if (variant) {
            files['word/footer1.xml'] = enc(footerXml(variant));
            files['word/footer2.xml'] = enc(footerXml(variant));
        }
        let rels = dec(files['word/_rels/document.xml.rels']);
        if (variant) rels = rels.replace('</Relationships>',
            '<Relationship Id="rId91" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
            '<Relationship Id="rId92" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/></Relationships>');
        files['word/_rels/document.xml.rels'] = enc(rels);
        let ct = dec(files['[Content_Types].xml']);
        if (variant) ct = ct.replace('</Types>',
            '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
            '<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');
        files['[Content_Types].xml'] = enc(ct);

        // Reihenfolge: [Content_Types].xml zuerst, Bilder unkomprimiert
        const out = {};
        out['[Content_Types].xml'] = [files['[Content_Types].xml'], { level: 6 }];
        Object.keys(files).forEach(k => {
            if (k === '[Content_Types].xml') return;
            out[k] = [files[k], { level: /\.png$/.test(k) ? 0 : 6 }];
        });
        return fflate.zipSync(out);
    }

    window.BriefDocx = { build: build };
})();
