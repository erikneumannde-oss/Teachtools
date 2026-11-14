/* Erzeugt die Word-Datei aus dem Originalvordruck: je Kind ein Bogen, mit Namen, Angaben und (auf Wunsch) angekreuzten Feldern. */
(function () {
    'use strict';

    const enc = s => new TextEncoder().encode(s);
    const dec = b => new TextDecoder('utf-8').decode(b);
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sp = t => '<w:t xml:space="preserve">' + esc(t) + '</w:t>';

    function once(s, from, to) {
        const i = s.indexOf(from);
        if (i < 0) throw new Error('Vorlage unerwartet');
        return s.slice(0, i) + to + s.slice(i + from.length);
    }

    async function build(students, info, filled) {
        const fflate = window.fflate;
        const { longDate } = window.ASVData;
        const res = await fetch('vorlage.docx');
        if (!res.ok) throw new Error('Vorlage nicht ladbar');
        const files = fflate.unzipSync(new Uint8Array(await res.arrayBuffer()));
        const doc = dec(files['word/document.xml']);
        const bStart = doc.indexOf('<w:body>') + 8;
        const sectAt = doc.lastIndexOf('<w:sectPr');
        const head = doc.slice(0, bStart), sect = doc.slice(sectAt);
        const els = doc.slice(bStart, sectAt).match(/<w:(p|tbl)[ >][\s\S]*?<\/w:\1>/g);
        if (!els || els.length !== 18) throw new Error('Vorlage unerwartet');
        const dateText = longDate(info.date);

        const parts = students.map((st, n) => {
            const e = els.slice();
            // Seitenwechsel vor jedem Bogen außer dem ersten, eindeutige Bildnummer, kein Lesezeichen
            e[0] = once(e[0], '<w:pPr>', n ? '<w:pPr><w:pageBreakBefore/>' : '<w:pPr>').replace('<wp:docPr id="1"', '<wp:docPr id="' + (100 + n) + '"');
            e[14] = e[14].replace(/<w:bookmarkStart[^>]*\/><w:bookmarkEnd[^>]*\/>/, '');
            // Name auf der Linie: die beiden Tabulatoren der Linie nehmen den Namen in die Mitte
            e[5] = once(e[5], '<w:tab/><w:tab/>', '<w:tab/>' + sp(st.name) + '<w:tab/>');
            e[5] = e[5].replace('<w:rPr><w:rFonts w:ascii="SenBJS" w:hAnsi="SenBJS"/><w:u w:val="single"/></w:rPr><w:tab/>', '<w:rPr><w:rFonts w:ascii="SenBJS" w:hAnsi="SenBJS"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:u w:val="single"/></w:rPr><w:tab/>');
            e[7] = once(e[7], '<w:t xml:space="preserve"> </w:t>', sp(' ' + (st.birth || '')));
            // Halbjahr mittig auf der Linie: der linke Tabulator wird durch einen zentrierten ersetzt
            e[8] = once(e[8], '<w:tab w:val="left" w:pos="3600"/>', '<w:tab w:val="center" w:pos="4494"/>');
            e[8] = once(e[8], '<w:t xml:space="preserve"> 2</w:t>', '<w:tab/>' + sp(info.half || ''));
            e[8] = once(e[8], '<w:t xml:space="preserve">       </w:t>', sp('  ' + (info.stufe || '') + '  '));
            e[10] = once(e[10], '<w:t xml:space="preserve">      08. Juli 2026</w:t>', sp('      ' + dateText));
            // Die Namen stehen statt „Name“ in den Klammern unter den Linien, die Linien bleiben für die Unterschrift frei
            e[12] = once(e[12], '<w:t xml:space="preserve">Schulleitung  (Name)</w:t>', sp('Schulleitung (' + (info.head || 'Name') + ')'));
            e[12] = once(e[12], '<w:t xml:space="preserve">Klassenleitung (Name)</w:t>', sp('Klassenleitung (' + (info.klass || 'Name') + ')'));
            // Kästchen: 7 Bereiche mit je 4 Feldern, der Reihe nach
            let idx = 0;
            e[9] = e[9].replace(/<w:sdt>[\s\S]*?<\/w:sdt>/g, s => {
                const i = idx++, row = Math.floor(i / 4), col = i % 4;
                const on = !!filled && st.marks && st.marks[row] === col;
                return on ? s.replace('<w14:checked w14:val="0"/>', '<w14:checked w14:val="1"/>').replace('☐', '☒') : s;
            });
            return e.join('');
        });
        files['word/document.xml'] = enc(head + parts.join('') + sect);
        files['docProps/core.xml'] = enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
            '<dc:title>Arbeits- und Sozialverhalten</dc:title></cp:coreProperties>');

        const out = {};
        out['[Content_Types].xml'] = [files['[Content_Types].xml'], { level: 6 }];
        Object.keys(files).forEach(k => {
            if (k === '[Content_Types].xml') return;
            out[k] = [files[k], { level: /\.png$/.test(k) ? 0 : 6 }];
        });
        return fflate.zipSync(out);
    }

    window.ASVDocx = { build: build };
})();
