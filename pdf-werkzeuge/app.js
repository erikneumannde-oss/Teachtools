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

    var merge = { srcs: {}, items: [], nextId: 1, nextSrc: 1, busy: false };

    function drawRot(base, rot, canvas) {
        var w = base.width, h = base.height, r = rot % 360;
        var swap = r === 90 || r === 270;
        canvas.width = swap ? h : w;
        canvas.height = swap ? w : h;
        var c = canvas.getContext('2d');
        c.save();
        c.translate(canvas.width / 2, canvas.height / 2);
        c.rotate(r * Math.PI / 180);
        c.drawImage(base, -w / 2, -h / 2);
        c.restore();
    }

    async function mRenderThumb(it) {
        var token = ++it.token;
        if (it.kind === 'img') { drawRot(it.base, it.rot, it.canvas); return; }
        var src = merge.srcs[it.src];
        var page = await src.pdfjs.getPage(it.index + 1);
        var rotation = (page.rotate + it.rot) % 360;
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
        if (token !== it.token) return;
        it.canvas.width = tmp.width;
        it.canvas.height = tmp.height;
        it.canvas.getContext('2d').drawImage(tmp, 0, 0);
    }

    function renderMerge() {
        var grid = $('merge-grid');
        grid.textContent = '';
        merge.items.forEach(function (it, i) {
            var handle = el('button', { type: 'button', class: 'btn small handle', 'aria-label': 'Seite ' + (i + 1) + ' ziehen', title: 'Ziehen, um die Seite zu verschieben', text: '⠿' });
            handle.addEventListener('pointerdown', function (e) { startDrag(e, it, card); });
            var card = el('div', { class: 'card', 'data-id': String(it.id) }, [
                el('div', { class: 'thumb' }, [it.canvas]),
                el('div', { class: 'label', text: 'Seite ' + (i + 1) }),
                el('div', { class: 'src', text: it.kind === 'pdf' ? it.name + ' · S. ' + (it.index + 1) : it.name }),
                el('div', { class: 'ctrl' }, [
                    el('button', { type: 'button', class: 'btn small', 'aria-label': 'Nach vorn', text: '←', onclick: function () { moveMerge(i, -1); } }),
                    handle,
                    el('button', { type: 'button', class: 'btn small', 'aria-label': 'Nach hinten', text: '→', onclick: function () { moveMerge(i, 1); } }),
                    el('button', { type: 'button', class: 'btn small', 'aria-label': 'Drehen', text: '↻', onclick: function () { it.rot = (it.rot + 90) % 360; mRenderThumb(it).then(renderMerge); } }),
                    el('button', { type: 'button', class: 'btn small', 'aria-label': 'Entfernen', text: '✕', onclick: function () { merge.items.splice(i, 1); renderMerge(); } })
                ])
            ]);
            card.querySelectorAll('button')[0].disabled = (i === 0);
            card.querySelectorAll('button')[2].disabled = (i === merge.items.length - 1);
            var th = card.querySelector('.thumb');
            th.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button === 0) startDrag(e, it, card); });
            grid.append(card);
        });
        var files = {};
        merge.items.forEach(function (it) { files[it.kind === 'pdf' ? 's' + it.src : 'i' + it.id] = 1; });
        $('merge-info').textContent = merge.items.length ? merge.items.length + ' Seite(n) aus ' + Object.keys(files).length + ' Datei(en)' : '';
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
        var cards = $('merge-grid').children;
        var b = cards[j] && cards[j].querySelectorAll('button')[d < 0 ? 0 : 2];
        if (b && !b.disabled) b.focus();
    }

    // Verschieben per Ziehen (Maus, Finger, Stift)
    function startDrag(e, it, card) {
        if (merge.busy) return;
        e.preventDefault();
        var grid = $('merge-grid');
        var rect = card.getBoundingClientRect();
        var ghost = el('div', { class: 'ghost' });
        var gc = document.createElement('canvas');
        gc.width = it.canvas.width; gc.height = it.canvas.height;
        gc.getContext('2d').drawImage(it.canvas, 0, 0);
        gc.style.height = '110px';
        ghost.append(gc);
        document.body.append(ghost);
        card.classList.add('dragging');
        var offX = Math.min(rect.width, 40), offY = 40;
        var target = null, after = false;
        function place(x, y) { ghost.style.left = (x - offX) + 'px'; ghost.style.top = (y - offY) + 'px'; }
        function clearMarks() { grid.querySelectorAll('.drop-before, .drop-after').forEach(function (c) { c.classList.remove('drop-before', 'drop-after'); }); }
        place(e.clientX, e.clientY);
        function onMove(ev) {
            place(ev.clientX, ev.clientY);
            if (ev.clientY < 70) window.scrollBy(0, -14);
            else if (window.innerHeight - ev.clientY < 70) window.scrollBy(0, 14);
            clearMarks();
            target = null;
            var cards = Array.prototype.slice.call(grid.children);
            var best = null, bestD = Infinity;
            cards.forEach(function (c) {
                if (c === card) return;
                var r = c.getBoundingClientRect();
                var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                var inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
                var d = inside ? 0 : Math.hypot(ev.clientX - cx, ev.clientY - cy);
                if (d < bestD) { bestD = d; best = c; }
            });
            if (best) {
                var r2 = best.getBoundingClientRect();
                target = best;
                after = ev.clientX > r2.left + r2.width / 2;
                best.classList.add(after ? 'drop-after' : 'drop-before');
            }
        }
        function finish(ev, apply) {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onCancel);
            ghost.remove();
            clearMarks();
            card.classList.remove('dragging');
            if (apply && target) {
                var from = merge.items.indexOf(it);
                var tid = parseInt(target.getAttribute('data-id'), 10);
                var to = merge.items.findIndex(function (x) { return x.id === tid; });
                if (from >= 0 && to >= 0) {
                    merge.items.splice(from, 1);
                    to = merge.items.findIndex(function (x) { return x.id === tid; });
                    merge.items.splice(after ? to + 1 : to, 0, it);
                    renderMerge();
                }
            }
        }
        function onUp(ev) { finish(ev, true); }
        function onCancel(ev) { finish(ev, false); }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onCancel);
    }

    bindDrop('merge-drop', 'merge-input', async function (files) {
        merge.busy = true;
        renderMerge();
        var skipped = 0, errors = [];
        var added = [];
        for (var k = 0; k < files.length; k++) {
            var f = files[k];
            try {
                setStatus('merge-status', 'Lese „' + f.name + '“ …');
                await tick();
                if (isPdf(f)) {
                    var bytes = await readBytes(f);
                    await PDFDocument.load(bytes); // prüft, ob die Datei bearbeitbar ist
                    var pdfjs = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
                    var sid = merge.nextSrc++;
                    merge.srcs[sid] = { bytes: bytes, pdfjs: pdfjs, name: f.name };
                    for (var p = 0; p < pdfjs.numPages; p++) {
                        added.push({ id: merge.nextId++, kind: 'pdf', src: sid, index: p, name: f.name, rot: 0, token: 0, canvas: document.createElement('canvas') });
                    }
                } else if (isImage(f)) {
                    var loaded = await loadImage(f);
                    var sc = 220 / Math.max(loaded.img.naturalWidth, loaded.img.naturalHeight);
                    var base = document.createElement('canvas');
                    base.width = Math.max(1, Math.round(loaded.img.naturalWidth * Math.min(1, sc)));
                    base.height = Math.max(1, Math.round(loaded.img.naturalHeight * Math.min(1, sc)));
                    var bctx = base.getContext('2d');
                    bctx.fillStyle = '#ffffff';
                    bctx.fillRect(0, 0, base.width, base.height);
                    bctx.drawImage(loaded.img, 0, 0, base.width, base.height);
                    URL.revokeObjectURL(loaded.url);
                    added.push({ id: merge.nextId++, kind: 'img', file: f, name: f.name, rot: 0, token: 0, base: base, canvas: document.createElement('canvas') });
                } else skipped++;
            } catch (e) { errors.push(friendlyError(e, f.name)); }
        }
        added.forEach(function (it) { merge.items.push(it); if (it.kind === 'img') drawRot(it.base, 0, it.canvas); });
        merge.busy = false;
        var msg = [];
        if (skipped) msg.push(skipped + ' Datei(en) übersprungen (nur PDF und Bilder möglich, Word-Dateien bitte zuerst als PDF speichern).');
        if (errors.length) msg.push(errors.join(' '));
        setStatus('merge-status', msg.join(' '), errors.length > 0);
        renderMerge();
        for (var q = 0; q < added.length; q++) {
            if (added[q].kind === 'pdf') { try { await mRenderThumb(added[q]); } catch (e2) { /* Vorschau fehlt, Seite bleibt nutzbar */ } }
        }
    });

    $('merge-clear').addEventListener('click', function () {
        Object.keys(merge.srcs).forEach(function (k) { try { merge.srcs[k].pdfjs.destroy(); } catch (e) { /* egal */ } });
        merge.srcs = {};
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
            // Die benötigten Seiten jeder PDF werden auf einmal kopiert, so bleibt die Datei klein
            var copied = {};
            var bySrc = {};
            merge.items.forEach(function (it) { if (it.kind === 'pdf') (bySrc[it.src] = bySrc[it.src] || []).push(it.index); });
            var srcIds = Object.keys(bySrc);
            for (var s = 0; s < srcIds.length; s++) {
                var sid = srcIds[s];
                current = merge.srcs[sid].name;
                setStatus('merge-status', 'Lese „' + current + '“ …');
                await tick();
                var doc = await PDFDocument.load(merge.srcs[sid].bytes);
                var idx = bySrc[sid].slice().sort(function (a, b) { return a - b; });
                var pages = await out.copyPages(doc, idx);
                copied[sid] = {};
                idx.forEach(function (n, j) { copied[sid][n] = pages[j]; });
            }
            for (var i = 0; i < merge.items.length; i++) {
                var it = merge.items[i];
                current = it.name;
                setStatus('merge-status', 'Verarbeite Seite ' + (i + 1) + ' von ' + merge.items.length + ' …');
                await tick();
                var page;
                if (it.kind === 'pdf') {
                    page = copied[it.src][it.index];
                    if (it.rot) page.setRotation(degrees((page.getRotation().angle + it.rot) % 360));
                    out.addPage(page);
                } else {
                    var canvas = await imageToCanvas(it.file, maxSide);
                    var w = canvas.width, h = canvas.height;
                    var jpg = await canvasToJpeg(canvas, 0.9);
                    releaseCanvas(canvas);
                    var img = await out.embedJpg(jpg);
                    if (mode === 'a4') {
                        // Die Seite wird so gewählt, dass sie nach dem Drehen im passenden Format erscheint
                        var turned = it.rot === 90 || it.rot === 270;
                        var landDisp = turned ? h > w : w > h;
                        var pwD = landDisp ? 841.89 : 595.28, phD = landDisp ? 595.28 : 841.89;
                        var uw = turned ? phD : pwD, uh = turned ? pwD : phD;
                        var sc2 = Math.min(uw / w, uh / h);
                        page = out.addPage([uw, uh]);
                        page.drawImage(img, { x: (uw - w * sc2) / 2, y: (uh - h * sc2) / 2, width: w * sc2, height: h * sc2 });
                    } else {
                        page = out.addPage([w * 0.75, h * 0.75]);
                        page.drawImage(img, { x: 0, y: 0, width: w * 0.75, height: h * 0.75 });
                    }
                    if (it.rot) page.setRotation(degrees(it.rot));
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
