/* Rechtschreibprüfung im Hintergrund (Web Worker). Läuft komplett im Browser, nichts wird gesendet. */
'use strict';
let sp = null;
const FUGEN = ['', 's', 'es', 'n', 'en', 'e', 'er', 'ens'];
const gross = w => w.charAt(0).toUpperCase() + w.slice(1);
const klein = w => w.charAt(0).toLowerCase() + w.slice(1);

function ok(w) { return sp.correct(w); }

/* Erster Wortteil eines Kompositums: Grundform, Verbstamm (Schreib-tisch), weggefallenes -e (Schul-buch) */
function vorderteil(k) {
    return ok(k) || ok(klein(k)) || ok(k + 'e') || ok(klein(k) + 'en') || ok(gross(k));
}
/* Zusammengesetzte Wörter (Hunspell-Regeln dafür kennt die Bibliothek nicht):
   Teile mit mindestens 3 Buchstaben, dazwischen die üblichen Fugenlaute. */
function zusammen(w, tiefe) {
    if (tiefe > 3) return false;
    for (let i = 3; i <= w.length - 3; i++) {
        const links = w.slice(0, i), rechts = w.slice(i);
        for (const f of FUGEN) {
            if (f && !links.endsWith(f)) continue;
            const kern = f ? links.slice(0, links.length - f.length) : links;
            if (kern.length < 3 || !vorderteil(kern)) continue;
            const r = gross(rechts);
            if (ok(r) || zusammen(r, tiefe + 1)) return true;
        }
    }
    return false;
}
function richtig(w) {
    if (ok(w)) return true;
    if (w.indexOf('-') > 0) return w.split('-').every(t => !t || richtig(t));
    return zusammen(w, 0);
}
function abstand(a, b) {
    const m = a.length, n = b.length; let v = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        let diag = v[0]; v[0] = i;
        for (let j = 1; j <= n; j++) { const t = v[j]; v[j] = Math.min(v[j] + 1, v[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1)); diag = t; }
    }
    return v[n];
}
function vorschlaege(w) {
    const kand = sp.suggest(w).slice(0, 6).map(k => [k, 0]);
    /* Tippfehler im hinteren Teil eines langen Wortes: vorderen gültigen Teil behalten */
    let n = 0;
    for (let i = 4; i <= w.length - 3 && n < 10; i++) {
        const links = w.slice(0, i), rechts = w.slice(i);
        if (!(vorderteil(links) || zusammen(links, 1))) continue;
        sp.suggest(gross(rechts)).slice(0, 4).forEach(v => { kand.push([links + klein(v), 1]); n++; });
    }
    const gesehen = new Set(), aus = [];
    kand.forEach(([k, q]) => {
        if (k === w || gesehen.has(k) || /[a-zäöüß][A-ZÄÖÜ]/.test(k) || !richtig(k)) return;
        let d = abstand(w, k);
        if (d > 1) for (let i = 0; i < w.length - 1; i++) if (w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2) === k) d = 1;
        gesehen.add(k); aus.push({ k, q, d });
    });
    aus.sort((x, y) => x.d - y.d || x.q - y.q || (x.q ? y.k.length - x.k.length : 0));
    return aus.slice(0, 5).map(x => x.k);
}
self.onmessage = async e => {
    const m = e.data;
    try {
        if (m.laden) {
            if (!sp) {
                importScripts(m.nspell);
                const [aff, dic] = await Promise.all([fetch(m.aff).then(r => r.text()), fetch(m.dic).then(r => r.text())]);
                sp = self.nspell(aff, dic);
            }
            self.postMessage({ id: m.id, bereit: true });
        } else if (m.pruefe) {
            self.postMessage({ id: m.id, falsch: m.pruefe.filter(w => !richtig(w)) });
        } else if (m.vorschlag) {
            self.postMessage({ id: m.id, liste: vorschlaege(m.vorschlag) });
        }
    } catch (err) {
        self.postMessage({ id: m.id, fehler: String(err && err.message || err) });
    }
};
