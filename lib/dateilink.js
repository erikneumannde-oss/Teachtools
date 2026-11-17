/* Feste Sicherungsdatei (nur Chrome, Edge und Opera am Computer).
   Der Benutzer wählt einmal eine Datei aus. Danach wird immer genau diese Datei überschrieben.
   Der Verweis auf die Datei liegt in IndexedDB dieses Browsers, es wird nichts übertragen. */
(function () {
    'use strict';
    const supported = !!window.showSaveFilePicker && !!window.indexedDB;

    function el(tag, attrs, text) {
        const e = document.createElement(tag);
        Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
        if (text) e.textContent = text;
        return e;
    }

    function idb(name, mode, fn) {
        return new Promise(res => {
            try {
                const rq = indexedDB.open(name, 1);
                rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
                rq.onerror = () => res(null);
                rq.onsuccess = () => {
                    const db = rq.result;
                    const tx = db.transaction('kv', mode);
                    const r = fn(tx.objectStore('kv'));
                    tx.oncomplete = () => { db.close(); res(r && r.result !== undefined ? r.result : null); };
                    tx.onerror = tx.onabort = () => { db.close(); res(null); };
                };
            } catch (e) { res(null); }
        });
    }

    /* opt: { box, dbName, suggestedName, serialize(), onWritten(name), onError(text) } */
    function init(opt) {
        const box = opt.box;
        if (!supported || !box) return { write: async () => false };
        const st = { handle: null, ok: false, busy: false, again: false };

        const intro = 'Sie wählen einmal eine Datei aus. Danach wird immer genau diese Datei überschrieben, jedes Mal, wenn im Browser gespeichert wird. So sammeln sich keine Kopien im Download-Ordner. Die Datei enthält Namen und Noten. Der Browser merkt sich auf diesem Gerät, welche Datei gemeint ist.';
        box.textContent = '';
        box.append(el('h3', {}, 'Feste Sicherungsdatei (Computer)'));
        const text = el('p', { class: 'small-text' });
        const row = el('div', { class: 'btn-row' });
        const pick = el('button', { type: 'button', class: 'btn' }, 'Sicherungsdatei wählen …');
        const allow = el('button', { type: 'button', class: 'btn primary' }, 'Zugriff erlauben');
        const now = el('button', { type: 'button', class: 'btn' }, 'Jetzt in Datei sichern');
        const unlink = el('button', { type: 'button', class: 'btn danger' }, 'Verknüpfung lösen');
        row.append(pick, allow, now, unlink);
        box.append(text, row);
        box.hidden = false;

        async function perm(ask) {
            if (!st.handle) return false;
            try {
                const o = { mode: 'readwrite' };
                let p = await st.handle.queryPermission(o);
                if (p !== 'granted' && ask) p = await st.handle.requestPermission(o);
                return p === 'granted';
            } catch (e) { return false; }
        }

        function ui() {
            const linked = !!st.handle;
            pick.textContent = linked ? 'Andere Datei wählen …' : 'Sicherungsdatei wählen …';
            allow.hidden = !(linked && !st.ok);
            now.hidden = !(linked && st.ok);
            unlink.hidden = !linked;
            text.textContent = linked
                ? 'Verknüpfte Datei: ' + st.handle.name + (st.ok ? '. Sie wird bei jedem Speichern im Browser überschrieben.' : '. Nach dem Neuöffnen der Seite fragt der Browser einmal nach: bitte „Zugriff erlauben“ wählen.') + ' Die Datei enthält Namen und Noten.'
                : intro;
        }

        async function write(manual) {
            if (!st.handle || !st.ok) return false;
            if (st.busy) { st.again = true; return false; }
            st.busy = true;
            try {
                const w = await st.handle.createWritable();
                await w.write(opt.serialize());
                await w.close();
                if (opt.onWritten) opt.onWritten(st.handle.name, manual);
                return true;
            } catch (e) {
                st.ok = false;
                ui();
                if (manual && opt.onError) opt.onError('Die Datei konnte nicht beschrieben werden. Bitte „Zugriff erlauben“ wählen oder die Datei neu auswählen.');
                return false;
            } finally {
                st.busy = false;
                if (st.again) { st.again = false; write(false); }
            }
        }

        pick.addEventListener('click', async () => {
            let h;
            try {
                h = await window.showSaveFilePicker({
                    suggestedName: opt.suggestedName,
                    types: [{ description: 'Sicherungsdatei', accept: { 'application/json': ['.json'] } }]
                });
            } catch (e) { return; }
            st.handle = h;
            st.ok = await perm(true);
            await idb(opt.dbName, 'readwrite', s => s.put(h, 'handle'));
            ui();
            if (st.ok) await write(true);
        });
        allow.addEventListener('click', async () => { st.ok = await perm(true); ui(); if (st.ok) await write(true); });
        now.addEventListener('click', () => write(true));
        unlink.addEventListener('click', async () => {
            st.handle = null;
            st.ok = false;
            await idb(opt.dbName, 'readwrite', s => s.delete('handle'));
            ui();
        });

        ui();
        idb(opt.dbName, 'readonly', s => s.get('handle')).then(async h => {
            if (h && h.kind === 'file') { st.handle = h; st.ok = await perm(false); }
            ui();
        });

        return { write: write };
    }

    window.DateiLink = { init: init, supported: supported };
})();
