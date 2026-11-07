(function () {
    'use strict';

    var PDFDocument = PDFLib.PDFDocument;
    var degrees = PDFLib.degrees;
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.min.js';

    /* ---------- Hilfsfunktionen ---------- */

    function $(id) { return document.getElementById(id); }

    function el(tag, props, children) {
        var e = document.createElement(tag);
        props = props || {};
        Object.keys(props).forEach(function (k) {
            if (k === 'class') e.className = props[k];
            else if (k === 'text') e.textContent = props[k];
            else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), props[k]);
            else e.setAttribute(k, props[k]);
        });
        (children || []).forEach(function (c) { e.append(c); });
        return e;
    }

    function fmtSize(n) {
        if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
        return Math.max(1, Math.round(n / 1024)) + ' KB';
    }

    function baseName(n) { return n.replace(/\.[^.]+$/, ''); }

    function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

    function readBytes(blob) {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onload = function () { resolve(new Uint8Array(fr.result)); };
            fr.onerror = function () { reject(new Error('Datei konnte nicht gelesen werden.')); };
            fr.readAsArrayBuffer(blob);
        });
    }

    function saveBytes(bytes, name, type) {
        var url = URL.createObjectURL(new Blob([bytes], { type: type }));
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }

    function setStatus(id, msg, isError) {
        var s = $(id);
        s.textContent = msg || '';
        s.className = 'status' + (isError ? ' error' : '');
    }

    function isPdf(f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); }
    function isImage(f) { return /^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(f.name); }

    function friendlyError(e, name) {
        var m = (e && e.message) || '';
        if (/encrypt|password/i.test(m) || (e && e.name === 'PasswordException')) {
            return '„' + name + '“ ist passwortgeschützt oder verschlüsselt und kann nicht bearbeitet werden.';
        }
        return 'Fehler bei „' + name + '“: ' + (m || 'Datei konnte nicht verarbeitet werden.');
    }

    function bindDrop(labelId, inputId, handler) {
        var label = $(labelId), input = $(inputId);
        input.addEventListener('change', function () {
            var files = Array.prototype.slice.call(input.files);
            input.value = '';
            if (files.length) handler(files);
        });
        ['dragenter', 'dragover'].forEach(function (ev) {
            label.addEventListener(ev, function (e) { e.preventDefault(); label.classList.add('over'); });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            label.addEventListener(ev, function (e) { e.preventDefault(); label.classList.remove('over'); });
        });
        label.addEventListener('drop', function (e) {
            var files = Array.prototype.slice.call(e.dataTransfer.files);
            if (files.length) handler(files);
        });
    }

    /* ---------- Bilder ---------- */

    function loadImage(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () { resolve({ img: img, url: url }); };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('Das Bild „' + file.name + '“ konnte nicht gelesen werden.'));
            };
            img.src = url;
        });
    }

    // Zeichnet das Bild (mit korrekter Ausrichtung) verkleinert auf ein Canvas.
    async function imageToCanvas(file, maxSide) {
        var loaded = await loadImage(file);
        var w = loaded.img.naturalWidth, h = loaded.img.naturalHeight;
        var s = Math.min(1, maxSide / Math.max(w, h));
        w = Math.max(1, Math.round(w * s));
        h = Math.max(1, Math.round(h * s));
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(loaded.img, 0, 0, w, h);
        URL.revokeObjectURL(loaded.url);
        return c;
    }

    function canvasToJpeg(canvas, quality) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (!blob) { reject(new Error('Bild konnte nicht umgewandelt werden.')); return; }
                readBytes(blob).then(resolve, reject);
            }, 'image/jpeg', quality);
        });
    }

    function releaseCanvas(c) { c.width = 0; c.height = 0; }

    /* ---------- Tabs ---------- */

    document.querySelectorAll('.tabs button').forEach(function (b) {
        b.addEventListener('click', function () {
            document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
            document.querySelectorAll('.panel').forEach(function (p) {
                p.classList.toggle('active', p.id === 'tab-' + b.getAttribute('data-tab'));
            });
        });
    });

    /* =========================================================
       1. Zusammenfügen
       ========================================================= */

    var merge = { items: [], nextId: 1, busy: false };

    function renderMerge() {
        var ul = $('merge-list');
        ul.textContent = '';
        merge.items.forEach(function (it, i) {
            ul.append(el('li', {}, [
                el('span', { class: 'name', text: (i + 1) + '. ' + it.file.name }),
                el('span', { class: 'size', text: (it.kind === 'pdf' ? 'PDF · ' : 'Bild · ') + fmtSize(it.file.size) }),
                el('button', { type: 'button', class: 'btn small', 'aria-label': 'Nach oben', text: '↑', onclick: function () { moveMerge(i, -1); } }),
                el('button', { type: 'button', class: 'btn small', 'aria-label': 'Nach unten', text: '↓', onclick: function () { moveMerge(i, 1); } }),
                el('button', { type: 'button', class: 'btn small', 'aria-label': 'Entfernen', text: '✕', onclick: function () { merge.items.splice(i, 1); renderMerge(); } })
            ]));
            ul.lastChild.querySelectorAll('button')[0].disabled = (i === 0);
            ul.lastChild.querySelectorAll('button')[1].disabled = (i === merge.items.length - 1);
        });
        $('merge-go').disabled = merge.busy || merge.items.length === 0;
        $('merge-clear').disabled = merge.busy || merge.items.length === 0;
    }

    function moveMerge(i, d) {
        var j = i + d;
        if (j < 0 || j >= merge.items.length) return;
        var t = merge.items[i];
        merge.items[i] = merge.items[j];
        merge.items[j] = t;
        renderMerge();
    }

    bindDrop('merge-drop', 'merge-input', function (files) {
        var skipped = 0;
        files.forEach(function (f) {
            if (isPdf(f)) merge.items.push({ id: merge.nextId++, file: f, kind: 'pdf' });
            else if (isImage(f)) merge.items.push({ id: merge.nextId++, file: f, kind: 'img' });
            else skipped++;
        });
        setStatus('merge-status', skipped ? skipped + ' Datei(en) übersprungen (nur PDF und Bilder möglich).' : '');
        renderMerge();
    });

    $('merge-clear').addEventListener('click', function () {
        merge.items = [];
        setStatus('merge-status', '');
        renderMerge();
    });

    $('merge-go').addEventListener('click', async function () {
        merge.busy = true;
        renderMerge();
        var current = '';
        try {
            var mode = $('merge-pagemode').value;
            var maxSide = parseInt($('merge-maxside').value, 10);
            var out = await PDFDocument.create();
            for (var i = 0; i < merge.items.length; i++) {
                var it = merge.items[i];
                current = it.file.name;
                setStatus('merge-status', 'Verarbeite ' + (i + 1) + ' von ' + merge.items.length + ' …');
                await tick();
                if (it.kind === 'pdf') {
                    var src = await PDFDocument.load(await readBytes(it.file));
                    var pages = await out.copyPages(src, src.getPageIndices());
                    pages.forEach(function (p) { out.addPage(p); });
                } else {
                    var canvas = await imageToCanvas(it.file, maxSide);
                    var w = canvas.width, h = canvas.height;
                    var jpg = await canvasToJpeg(canvas, 0.9);
                    releaseCanvas(canvas);
                    var img = await out.embedJpg(jpg);
                    var page;
                    if (mode === 'a4') {
                        var land = w > h;
                        var pw = land ? 841.89 : 595.28, ph = land ? 595.28 : 841.89;
                        var sc = Math.min(pw / w, ph / h);
                        page = out.addPage([pw, ph]);
                        page.drawImage(img, { x: (pw - w * sc) / 2, y: (ph - h * sc) / 2, width: w * sc, height: h * sc });
                    } else {
                        page = out.addPage([w * 0.75, h * 0.75]);
                        page.drawImage(img, { x: 0, y: 0, width: w * 0.75, height: h * 0.75 });
                    }
                }
            }
            var bytes = await out.save();
            saveBytes(bytes, 'zusammengefuegt.pdf', 'application/pdf');
            setStatus('merge-status', 'Fertig: zusammengefuegt.pdf (' + out.getPageCount() + ' Seiten, ' + fmtSize(bytes.length) + ').');
        } catch (e) {
            setStatus('merge-status', friendlyError(e, current), true);
        }
        merge.busy = false;
        renderMerge();
    });

    /* =========================================================
       2. Seiten bearbeiten
       ========================================================= */

    var pg = { name: '', bytes: null, pdf: null, pages: [], busy: false };

    function pgButtons() {
        var has = pg.pages.length > 0 && !pg.busy;
        $('pages-save').disabled = !has;
        $('pages-save-sel').disabled = !has;
        $('pages-zip').disabled = !has;
        $('pages-reset').disabled = !pg.pdf || pg.busy;
    }

    async function renderThumb(p) {
        var token = ++p.token;
        var page = await pg.pdf.getPage(p.index + 1);
        var rotation = (page.rotate + p.rot) % 360;
        var base = page.getViewport({ scale: 1, rotation: rotation });
        var scale = 220 / Math.max(base.width, base.height);
        var vp = page.getViewport({ scale: scale, rotation: rotation });
        var tmp = document.createElement('canvas');
        tmp.width = Math.floor(vp.width);
        tmp.height = Math.floor(vp.height);
        var ctx = tmp.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (token !== p.token) return;
        p.canvas.width = tmp.width;
        p.canvas.height = tmp.height;
        p.canvas.getContext('2d').drawImage(tmp, 0, 0);
    }

    function renderGrid() {
        var grid = $('pages-grid');
        grid.textContent = '';
        pg.pages.forEach(function (p, i) {
            var cb = el('input', { type: 'checkbox', 'aria-label': 'Seite ' + (i + 1) + ' wählen' });
            cb.checked = p.sel;
            var card = el('div', { class: 'card' + (p.sel ? ' sel' : '') }, [
                el('div', { class: 'thumb' }, [p.canvas]),
                el('div', { class: 'label', text: 'Seite ' + (i + 1) + (p.index !== i ? ' (vorher ' + (p.index + 1) + ')' : '') }),
                el('div', { class: 'ctrl' }, [
                    el('button', { type: 'button', class: 'btn small', 'aria-label': 'Nach vorn', text: '←', onclick: function () { movePage(i, -1); } }),
                    el('button', { type: 'button', class: 'btn small', 'aria-label': 'Nach hinten', text: '→', onclick: function () { movePage(i, 1); } }),
                    el('button', { type: 'button', class: 'btn small', 'aria-label': 'Drehen', text: '↻', onclick: function () { p.rot = (p.rot + 90) % 360; renderThumb(p); } }),
                    el('button', { type: 'button', class: 'btn small', 'aria-label': 'Löschen', text: '✕', onclick: function () { pg.pages.splice(i, 1); renderGrid(); } })
                ]),
                el('label', { class: 'pick' }, [cb, el('span', { text: 'wählen' })])
            ]);
            card.querySelectorAll('button')[0].disabled = (i === 0);
            card.querySelectorAll('button')[1].disabled = (i === pg.pages.length - 1);
            cb.addEventListener('change', function () { p.sel = cb.checked; card.classList.toggle('sel', p.sel); });
            grid.append(card);
        });
        $('pages-info').textContent = pg.pdf ? '„' + pg.name + '“ – ' + pg.pages.length + ' Seite(n) im Ergebnis' : '';
        pgButtons();
    }

    function movePage(i, d) {
        var j = i + d;
        if (j < 0 || j >= pg.pages.length) return;
        var t = pg.pages[i];
        pg.pages[i] = pg.pages[j];
        pg.pages[j] = t;
        renderGrid();
    }

    async function setupPages() {
        pg.pages = [];
        for (var i = 0; i < pg.pdf.numPages; i++) {
            pg.pages.push({ index: i, rot: 0, sel: false, token: 0, canvas: document.createElement('canvas') });
        }
        renderGrid();
        var all = pg.pages.slice();
        for (var k = 0; k < all.length; k++) {
            try { await renderThumb(all[k]); } catch (e) { /* Vorschau fehlt, Seite bleibt nutzbar */ }
        }
    }

    bindDrop('pages-drop', 'pages-input', async function (files) {
        var f = files[0];
        if (!isPdf(f)) { setStatus('pages-status', 'Bitte eine PDF-Datei auswählen.', true); return; }
        pg.busy = true;
        pgButtons();
        setStatus('pages-status', 'Lade „' + f.name + '“ …');
        try {
            var bytes = await readBytes(f);
            await PDFDocument.load(bytes); // prüft, ob die Datei bearbeitbar ist
            if (pg.pdf) { try { pg.pdf.destroy(); } catch (e) { /* egal */ } }
            pg.pdf = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
            pg.bytes = bytes;
            pg.name = baseName(f.name);
            await setupPages();
            setStatus('pages-status', '');
        } catch (e) {
            pg.pdf = null; pg.pages = []; pg.bytes = null;
            renderGrid();
            setStatus('pages-status', friendlyError(e, f.name), true);
        }
        pg.busy = false;
        pgButtons();
    });

    async function exportPages(list) {
        var src = await PDFDocument.load(pg.bytes);
        var out = await PDFDocument.create();
        for (var i = 0; i < list.length; i++) {
            var cp = (await out.copyPages(src, [list[i].index]))[0];
            if (list[i].rot) cp.setRotation(degrees((cp.getRotation().angle + list[i].rot) % 360));
            out.addPage(cp);
        }
        return out.save();
    }

    $('pages-save').addEventListener('click', async function () {
        pg.busy = true; pgButtons();
        try {
            setStatus('pages-status', 'Speichere …');
            await tick();
            var bytes = await exportPages(pg.pages);
            saveBytes(bytes, pg.name + '-bearbeitet.pdf', 'application/pdf');
            setStatus('pages-status', 'Gespeichert: ' + pg.name + '-bearbeitet.pdf (' + fmtSize(bytes.length) + ').');
        } catch (e) { setStatus('pages-status', friendlyError(e, pg.name), true); }
        pg.busy = false; pgButtons();
    });

    $('pages-save-sel').addEventListener('click', async function () {
        var sel = pg.pages.filter(function (p) { return p.sel; });
        if (!sel.length) { setStatus('pages-status', 'Bitte zuerst Seiten mit dem Häkchen „wählen“ markieren.', true); return; }
        pg.busy = true; pgButtons();
        try {
            var bytes = await exportPages(sel);
            saveBytes(bytes, pg.name + '-auswahl.pdf', 'application/pdf');
            setStatus('pages-status', 'Gespeichert: ' + pg.name + '-auswahl.pdf (' + sel.length + ' Seite(n)).');
        } catch (e) { setStatus('pages-status', friendlyError(e, pg.name), true); }
        pg.busy = false; pgButtons();
    });

    $('pages-zip').addEventListener('click', async function () {
        pg.busy = true; pgButtons();
        try {
            var files = {};
            var digits = String(pg.pages.length).length;
            for (var i = 0; i < pg.pages.length; i++) {
                setStatus('pages-status', 'Seite ' + (i + 1) + ' von ' + pg.pages.length + ' …');
                await tick();
                var n = String(i + 1);
                while (n.length < digits) n = '0' + n;
                files[pg.name + '-Seite-' + n + '.pdf'] = await exportPages([pg.pages[i]]);
            }
            saveBytes(fflate.zipSync(files, { level: 0 }), pg.name + '-Seiten.zip', 'application/zip');
            setStatus('pages-status', 'Gespeichert: ' + pg.name + '-Seiten.zip');
        } catch (e) { setStatus('pages-status', friendlyError(e, pg.name), true); }
        pg.busy = false; pgButtons();
    });

    $('pages-reset').addEventListener('click', async function () {
        pg.busy = true; pgButtons();
        await setupPages();
        pg.busy = false; pgButtons();
    });

    /* =========================================================
       3. Bilder verkleinern
       ========================================================= */

    var im = { files: [], results: [], busy: false };

    function renderImgs() {
        var ul = $('imgs-list');
        ul.textContent = '';
        if (im.results.length) {
            im.results.forEach(function (r) {
                ul.append(el('li', {}, [
                    el('span', { class: 'name', text: r.name }),
                    el('span', { class: 'size', text: fmtSize(r.before) + ' → ' + fmtSize(r.bytes.length) }),
                    el('button', { type: 'button', class: 'btn small', text: 'Speichern', onclick: function () { saveBytes(r.bytes, r.name, 'image/jpeg'); } })
                ]));
            });
        } else {
            im.files.forEach(function (f) {
                ul.append(el('li', {}, [
                    el('span', { class: 'name', text: f.name }),
                    el('span', { class: 'size', text: fmtSize(f.size) })
                ]));
            });
        }
        $('imgs-go').disabled = im.busy || im.files.length === 0;
        $('imgs-zip').disabled = im.busy || im.results.length === 0;
    }

    bindDrop('imgs-drop', 'imgs-input', function (files) {
        var imgs = files.filter(isImage);
        im.files = imgs;
        im.results = [];
        setStatus('imgs-status', imgs.length < files.length ? (files.length - imgs.length) + ' Datei(en) übersprungen (kein Bild).' : '');
        renderImgs();
    });

    $('imgs-go').addEventListener('click', async function () {
        im.busy = true; im.results = []; renderImgs();
        var maxSide = parseInt($('imgs-maxside').value, 10);
        var quality = parseFloat($('imgs-quality').value);
        var used = {};
        var current = '';
        try {
            for (var i = 0; i < im.files.length; i++) {
                var f = im.files[i];
                current = f.name;
                setStatus('imgs-status', 'Bild ' + (i + 1) + ' von ' + im.files.length + ' …');
                await tick();
                var c = await imageToCanvas(f, maxSide);
                var bytes = await canvasToJpeg(c, quality);
                releaseCanvas(c);
                var name = baseName(f.name) + '-klein.jpg';
                var n = 2;
                while (used[name]) { name = baseName(f.name) + '-klein-' + n + '.jpg'; n++; }
                used[name] = true;
                im.results.push({ name: name, bytes: bytes, before: f.size });
            }
            var sumBefore = 0, sumAfter = 0;
            im.results.forEach(function (r) { sumBefore += r.before; sumAfter += r.bytes.length; });
            setStatus('imgs-status', 'Fertig: ' + fmtSize(sumBefore) + ' → ' + fmtSize(sumAfter) + '.');
        } catch (e) { setStatus('imgs-status', friendlyError(e, current), true); }
        im.busy = false;
        renderImgs();
    });

    $('imgs-zip').addEventListener('click', function () {
        var files = {};
        im.results.forEach(function (r) { files[r.name] = r.bytes; });
        saveBytes(fflate.zipSync(files, { level: 0 }), 'bilder-klein.zip', 'application/zip');
    });

    /* =========================================================
       4. PDF verkleinern
       ========================================================= */

    var sh = { file: null, busy: false };

    bindDrop('shrink-drop', 'shrink-input', function (files) {
        var f = files[0];
        if (!isPdf(f)) { setStatus('shrink-status', 'Bitte eine PDF-Datei auswählen.', true); return; }
        sh.file = f;
        $('shrink-info').textContent = '„' + f.name + '“ (' + fmtSize(f.size) + ')';
        $('shrink-go').disabled = false;
        setStatus('shrink-status', '');
    });

    $('shrink-go').addEventListener('click', async function () {
        sh.busy = true;
        $('shrink-go').disabled = true;
        var scale = parseFloat($('shrink-scale').value);
        var quality = parseFloat($('shrink-quality').value);
        var pdf = null;
        try {
            var bytes = await readBytes(sh.file);
            pdf = await pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
            var out = await PDFDocument.create();
            for (var i = 1; i <= pdf.numPages; i++) {
                setStatus('shrink-status', 'Seite ' + i + ' von ' + pdf.numPages + ' …');
                await tick();
                var page = await pdf.getPage(i);
                var vp = page.getViewport({ scale: scale });
                var c = document.createElement('canvas');
                c.width = Math.floor(vp.width);
                c.height = Math.floor(vp.height);
                var ctx = c.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, c.width, c.height);
                await page.render({ canvasContext: ctx, viewport: vp }).promise;
                var jpg = await canvasToJpeg(c, quality);
                releaseCanvas(c);
                var img = await out.embedJpg(jpg);
                var v1 = page.getViewport({ scale: 1 });
                var np = out.addPage([v1.width, v1.height]);
                np.drawImage(img, { x: 0, y: 0, width: v1.width, height: v1.height });
            }
            var result = await out.save();
            if (result.length >= sh.file.size) {
                setStatus('shrink-status', 'Das Ergebnis (' + fmtSize(result.length) + ') ist nicht kleiner als das Original (' + fmtSize(sh.file.size) + '). Es wurde nichts gespeichert. Mit niedrigerer Auflösung oder Qualität erneut versuchen.', true);
            } else {
                saveBytes(result, baseName(sh.file.name) + '-klein.pdf', 'application/pdf');
                setStatus('shrink-status', 'Fertig: ' + fmtSize(sh.file.size) + ' → ' + fmtSize(result.length) + '.');
            }
        } catch (e) {
            setStatus('shrink-status', friendlyError(e, sh.file.name), true);
        }
        if (pdf) { try { pdf.destroy(); } catch (e2) { /* egal */ } }
        sh.busy = false;
        $('shrink-go').disabled = false;
    });

    renderMerge();
    renderImgs();
})();
