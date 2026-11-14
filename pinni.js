/* Pinni, die Reißzwecken-Assistentin: Frage, Führung mit Markierungen, Vorschaufenster.
   Läuft komplett im Browser. Gespeichert wird höchstens, ob Pinni auf dieser Seite schon gefragt hat. */
(function () {
    'use strict';
    if (window.__pinniGeladen) return;
    window.__pinniGeladen = true;

    const skript = document.currentScript;
    const basis = skript && skript.src ? skript.src.replace(/pinni\.js[^/]*$/, '') : '';
    const INHALT = window.PinniInhalt || {};

    function seitenSchluessel() {
        if (document.body && document.body.dataset.pinni) return document.body.dataset.pinni;
        const teile = location.pathname.split('/').filter(Boolean).filter(t => !/\.html?$/.test(t));
        const letzter = teile[teile.length - 1];
        return INHALT[letzter] ? letzter : 'start';
    }
    const KEY = seitenSchluessel();
    const TUT = INHALT[KEY];
    if (!TUT) return;

    function ls(op, k, v) {
        try { return op === 'get' ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return null; }
    }
    const FLAG = 'pinni-gefragt-' + KEY;
    const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    /* ---------- Figur ---------- */
    const SVG = '<svg viewBox="0 0 100 120" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="pinni-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f28080"/><stop offset="1" stop-color="#e03a52"/></linearGradient></defs>' +
        '<g class="pinni-body">' +
        '<polygon points="45,92 55,92 50,119" fill="#d5d8e0" stroke="#2a1f5c" stroke-width="3" stroke-linejoin="round"/>' +
        '<ellipse cx="50" cy="88" rx="33" ry="8" fill="#c92f48" stroke="#2a1f5c" stroke-width="3.5"/>' +
        '<path d="M17 72 C17 38 31 13 50 13 C69 13 83 38 83 72 C83 84 70 90 50 90 C30 90 17 84 17 72Z" fill="url(#pinni-grad)" stroke="#2a1f5c" stroke-width="3.5" stroke-linejoin="round"/>' +
        '<path d="M28 44 C30 31 38 24 46 22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>' +
        '<g class="pinni-eyes">' +
        '<ellipse cx="39" cy="56" rx="7.5" ry="9.5" fill="#fff" stroke="#2a1f5c" stroke-width="2"/>' +
        '<ellipse cx="61" cy="56" rx="7.5" ry="9.5" fill="#fff" stroke="#2a1f5c" stroke-width="2"/>' +
        '<circle cx="40.5" cy="58" r="5" fill="#2a1f5c"/><circle cx="62.5" cy="58" r="5" fill="#2a1f5c"/>' +
        '<circle cx="42" cy="55.5" r="1.7" fill="#fff"/><circle cx="64" cy="55.5" r="1.7" fill="#fff"/></g>' +
        '<ellipse cx="28" cy="71" rx="5.5" ry="3.6" fill="#f58aa0" opacity=".9"/><ellipse cx="72" cy="71" rx="5.5" ry="3.6" fill="#f58aa0" opacity=".9"/>' +
        '<path d="M42 72 Q50 81 58 72" fill="none" stroke="#2a1f5c" stroke-width="2.8" stroke-linecap="round"/>' +
        '<path d="M19 76 Q8 80 6 91" fill="none" stroke="#2a1f5c" stroke-width="4.2" stroke-linecap="round"/><circle cx="6" cy="92" r="3.6" fill="#2a1f5c"/>' +
        '<g class="pinni-arm-wave"><path d="M81 72 Q93 64 94 46" fill="none" stroke="#2a1f5c" stroke-width="4.2" stroke-linecap="round"/><circle cx="94" cy="44" r="3.6" fill="#2a1f5c"/></g>' +
        '<g class="pinni-arm-point"><path d="M81 72 L99 72" fill="none" stroke="#2a1f5c" stroke-width="4.2" stroke-linecap="round"/><circle cx="100" cy="72" r="3.6" fill="#2a1f5c"/></g>' +
        '</g></svg>';

    const wurzel = el('div', 'pinni-root');
    const fig = el('button', 'pinni-fig');
    fig.type = 'button';
    fig.setAttribute('aria-label', 'Pinni, die Assistentin: Hilfe und Führung');
    fig.title = 'Pinni fragen';
    fig.innerHTML = SVG;
    wurzel.appendChild(fig);
    const pointArm = () => fig.querySelector('.pinni-arm-point');

    let bubble = null;
    let aktiv = false; // Führung läuft
    let schritt = 0;
    let sperre = null, licht = null, zeitAus = null, reden = 0;

    function figGroesse() { return { w: fig.offsetWidth, h: fig.offsetHeight }; }
    function setFig(l, t) { fig.style.left = Math.round(l) + 'px'; fig.style.top = Math.round(t) + 'px'; }
    function heim() {
        const s = figGroesse();
        return { l: window.innerWidth - s.w - 14, t: window.innerHeight - s.h - 14 };
    }
    function zumHeim() {
        fig.classList.remove('gross', 'zeigt', 'pinni-flip');
        const h = heim();
        setFig(h.l, h.t);
    }
    const klemme = (v, a, b) => Math.max(a, Math.min(b, v));

    function schliesseBubble() {
        if (bubble) { bubble.remove(); bubble = null; }
        clearTimeout(zeitAus);
    }
    function neueBubble() {
        schliesseBubble();
        bubble = el('div', 'pinni-bubble');
        bubble.setAttribute('role', 'dialog');
        bubble.setAttribute('aria-live', 'polite');
        wurzel.appendChild(bubble);
        return bubble;
    }
    function knopf(text, cls, fn) {
        const b = el('button', 'pinni-btn' + (cls ? ' ' + cls : ''), text);
        b.type = 'button';
        b.addEventListener('click', fn);
        return b;
    }
    function bubbleAmHeim() {
        const s = figGroesse(), h = heim();
        const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        bubble.style.left = Math.round(klemme(window.innerWidth - bw - 10, 8, window.innerWidth)) + 'px';
        bubble.style.top = Math.round(klemme(h.t - bh - 8, 8, window.innerHeight)) + 'px';
        void s;
    }

    /* ---------- Frage und Menü ---------- */
    const SPRUECHE = [
        'Keine Sorge, ich pieks dich nicht. Ich bin nur zum Anheften da.',
        'Ich hänge hier einfach so rum. Beruflich.',
        'Ich bin die Einzige, die beim Anheften nie den Kopf verliert.',
        'Spitze, dass du da bist!',
        'Wenn es mal hakt, hänge ich mich gern rein.',
        'Ich hab einen Plan: erst anheften, dann abheften.',
        'Ich sehe zwar rund aus, aber meine Ideen haben Hand und Fuß. Na ja, Nadel.'
    ];
    const MUT = [
        'Du machst das gut. Schritt für Schritt kommt alles an seinen Platz.',
        'Das war schon eine ganze Menge Organisation. Das kann sich sehen lassen!',
        'Du hast viel um die Ohren und kriegst es trotzdem hin. Das verdient Respekt.',
        'Ein Fehler lässt sich hier fast immer rückgängig machen. Probier einfach aus.',
        'Du bist auf dem richtigen Weg. Und falls nicht: Ich hefte eine neue Karte an.',
        'Eine kleine Pause zwischendurch hat noch niemandem geschadet. Du hast sie dir verdient.',
        'Heute schon etwas geschafft? Dann ist das ein guter Tag.',
        'Gute Lehrkräfte sind selten fertig, aber du bist ziemlich weit. Weiter so!',
        'Du denkst an so viele Dinge gleichzeitig. Ich ziehe den Hut. Na ja, den Kopf.',
        'Kein Grund zur Eile. Gut gemacht ist besser als schnell gemacht.',
        'Deine Schülerinnen und Schüler haben Glück mit dir.',
        'Jede abgehakte Aufgabe ist ein kleiner Sieg. Dieser hier zählt auch.',
        'Atme kurz durch. Du hast mehr geschafft, als du denkst.',
        'Du darfst stolz auf dich sein. Ich bin es jedenfalls.',
        'Das sieht doch schon richtig gut aus!',
        'Wenn etwas nicht gleich klappt, ist das völlig normal. Beim nächsten Versuch sitzt es.',
        'Dein Einsatz ist Gold wert, und das ist noch untertrieben.',
        'Heute ist ein guter Tag, um etwas von der Liste zu streichen.',
        'Du bist nicht allein damit. Ich hänge hier und drücke die Daumen. Oder die Nadel.',
        'Ein Schritt nach dem anderen. Du bist schon mittendrin.',
        'Gut, dass es dich gibt. Wirklich.',
        'Danke für deine Arbeit. Das sieht man nicht immer, aber es zählt.'
    ];
    const zufall = l => l[Math.floor(Math.random() * l.length)];

    function frage(erstmals) {
        if (aktiv) return;
        zumHeim();
        const b = neueBubble();
        if (erstmals) {
            b.appendChild(el('h3', null, 'Hallo, ich bin Pinni!'));
            b.appendChild(el('p', null, 'Soll ich dir zeigen, wie das hier funktioniert?'));
        } else {
            b.appendChild(el('p', null, zufall(Math.random() < 0.5 ? MUT : SPRUECHE)));
            b.appendChild(el('p', null, 'Brauchst du eine Führung durch dieses Werkzeug?'));
        }
        const bt = el('div', 'pinni-btns');
        const ja = knopf('Ja, gern', 'primaer', () => { if (erstmals) ls('set', FLAG, '1'); startFuehrung(); });
        const nein = knopf('Nein, danke', '', () => {
            ls('set', FLAG, '1');
            const b2 = neueBubble();
            b2.appendChild(el('p', null, 'Alles klar, du schaffst das! Tipp mich einfach an, wenn du mich brauchst.'));
            bubbleAmHeim();
            zeitAus = setTimeout(schliesseBubble, 3200);
        });
        bt.append(ja, nein);
        b.appendChild(bt);
        bubbleAmHeim();
        ja.focus({ preventScroll: true });
        if (erstmals) zeitAus = setTimeout(schliesseBubble, 25000);
    }

    fig.addEventListener('click', () => {
        if (aktiv) return;
        if (bubble) { schliesseBubble(); return; }
        frage(false);
    });

    /* ---------- Führung ---------- */
    function sichtbar(e) {
        if (!e) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    }
    function zielFinden(s) {
        if (!s.sel) return null;
        const liste = Array.isArray(s.sel) ? s.sel : [s.sel];
        for (const q of liste) {
            const e = document.querySelector(q);
            if (sichtbar(e)) return e;
        }
        return null;
    }
    function vorbereiten(s) {
        if (s.tab) { const t = document.querySelector(s.tab); if (t) t.click(); }
        if (s.open) {
            const d = document.querySelector(s.open);
            if (d && d.tagName === 'DETAILS') d.open = true;
        }
    }

    function startFuehrung() {
        if (aktiv) return;
        aktiv = true;
        schritt = 0;
        schliesseBubble();
        sperre = el('div', 'pinni-block');
        licht = el('div', 'pinni-spot leer');
        wurzel.insertBefore(licht, fig);
        wurzel.insertBefore(sperre, licht);
        fig.classList.add('gross');
        fig.tabIndex = -1;
        zeige(0, true);
    }
    function beende(abschied) {
        if (!aktiv) return;
        aktiv = false;
        if (sperre) sperre.remove();
        if (licht) licht.remove();
        sperre = licht = null;
        fig.tabIndex = 0;
        schliesseBubble();
        zumHeim();
        if (abschied) {
            const b = neueBubble();
            b.appendChild(el('p', null, TUT.ende || 'Das war es schon. Tipp mich an, wenn du mich noch einmal brauchst.'));
            b.appendChild(el('p', null, zufall(MUT)));
            bubbleAmHeim();
            zeitAus = setTimeout(schliesseBubble, 7000);
        }
        fig.focus({ preventScroll: true });
    }

    function lightbox(src, titel) {
        const lb = el('div', 'pinni-lightbox');
        const img = el('img');
        img.src = src; img.alt = titel || 'Vorschau';
        const x = el('button', null, '×');
        x.type = 'button'; x.setAttribute('aria-label', 'Vorschau schließen');
        const zu = () => { lb.remove(); document.removeEventListener('keydown', esc, true); };
        const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); zu(); } };
        lb.addEventListener('click', zu);
        document.addEventListener('keydown', esc, true);
        lb.append(img, x);
        wurzel.appendChild(lb);
        x.focus({ preventScroll: true });
    }

    function fenster(p) {
        const w = el('div', 'pinni-win');
        const bar = el('div', 'pinni-win-bar');
        bar.append(el('i'), el('i'), el('span', null, p.title || 'Vorschau'));
        const gross = el('button', null, '⤢');
        gross.type = 'button'; gross.title = 'Vergrößern'; gross.setAttribute('aria-label', 'Vorschau vergrößern');
        bar.appendChild(gross);
        const img = el('img', 'pinni-win-img');
        img.alt = p.alt || p.title || 'Vorschau';
        img.src = basis + p.src;
        img.addEventListener('error', () => w.remove());
        const open = () => lightbox(basis + p.src, p.title);
        img.addEventListener('click', open);
        gross.addEventListener('click', open);
        w.append(bar, img);
        if (p.cap) w.appendChild(el('p', 'pinni-win-cap', p.cap));
        return w;
    }

    function zeige(i, erster) {
        const s = TUT.steps[i];
        if (!s) { beende(true); return; }
        schritt = i;
        const mein = ++reden;
        vorbereiten(s);
        const b = neueBubble();
        b.appendChild(el('p', 'pinni-schritt', 'Schritt ' + (i + 1) + ' von ' + TUT.steps.length));
        if (s.title) b.appendChild(el('h3', null, s.title));
        b.appendChild(el('p', null, s.text));
        if (s.preview) b.appendChild(fenster(s.preview));
        const bt = el('div', 'pinni-btns');
        const zurueck = knopf('Zurück', '', () => zeige(i - 1));
        zurueck.disabled = i === 0;
        const letzter = i === TUT.steps.length - 1;
        const weiter = knopf(letzter ? 'Fertig' : 'Weiter', 'primaer', () => letzter ? beende(true) : zeige(i + 1));
        const ende = knopf('Beenden', '', () => beende(false));
        bt.append(zurueck, weiter, el('span', 'pinni-spacer'), ende);
        b.appendChild(bt);
        // Layout nach kurzer Pause, damit Reiter und aufgeklappte Bereiche fertig gezeichnet sind
        setTimeout(() => {
            if (mein !== reden || !aktiv) return;
            const z = zielFinden(s);
            if (z) {
                const r0 = z.getBoundingClientRect();
                z.scrollIntoView({ block: r0.height > window.innerHeight * 0.5 ? 'start' : 'center', inline: 'nearest' });
            }
            requestAnimationFrame(() => { if (mein === reden && aktiv) platziere(z); });
            weiter.focus({ preventScroll: true });
        }, erster ? 30 : 110);
    }

    function platziere(z) {
        const vw = window.innerWidth, vh = window.innerHeight;
        fig.classList.add('gross');
        if (vw < 520) fig.classList.remove('gross');
        const { w: pw, h: ph } = figGroesse();
        const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        let R = null;
        if (z) {
            const r = z.getBoundingClientRect(), pad = 6;
            const l = Math.max(2, r.left - pad), t = Math.max(2, r.top - pad);
            const rr = Math.min(vw - 2, r.right + pad), bb = Math.min(vh - 2, r.bottom + pad);
            R = { left: l, top: t, right: rr, bottom: bb, w: rr - l, h: bb - t, cx: (l + rr) / 2, cy: (t + bb) / 2 };
            licht.classList.remove('leer');
            licht.style.left = l + 'px'; licht.style.top = t + 'px';
            licht.style.width = R.w + 'px'; licht.style.height = R.h + 'px';
        } else {
            licht.classList.add('leer');
            licht.style.left = vw / 2 + 'px'; licht.style.top = vh / 2 + 'px';
            licht.style.width = '0px'; licht.style.height = '0px';
        }
        let p = null;
        const g = 8;
        if (R) {
            const cand = {
                below() {
                    const pt = R.bottom + g, bt = pt + ph + 4;
                    if (bt + bh > vh - 8) return null;
                    const pl = klemme(R.cx - pw / 2, 8, vw - pw - 8);
                    return { pl, pt, bl: klemme(R.cx - bw / 2, 8, vw - bw - 8), bt };
                },
                above() {
                    const bt = R.top - g - ph - 4 - bh, pt = bt + bh + 4;
                    if (bt < 8) return null;
                    const pl = klemme(R.cx - pw / 2, 8, vw - pw - 8);
                    return { pl, pt, bl: klemme(R.cx - bw / 2, 8, vw - bw - 8), bt };
                },
                right() {
                    const pl = R.right + g, bl = pl + pw + 4;
                    if (bl + bw > vw - 8) return null;
                    const pt = klemme(R.cy - ph / 2, 8, vh - ph - 8);
                    return { pl, pt, bl, bt: klemme(pt, 8, vh - bh - 8) };
                },
                left() {
                    const pl = R.left - g - pw, bl = pl - 4 - bw;
                    if (bl < 8) return null;
                    const pt = klemme(R.cy - ph / 2, 8, vh - ph - 8);
                    return { pl, pt, bl, bt: klemme(pt, 8, vh - bh - 8) };
                }
            };
            const hoch = R.h > vh * 0.5 && R.w < vw * 0.6;
            const reihe = hoch ? ['right', 'left', 'below', 'above'] : ['below', 'above', 'right', 'left'];
            for (const n of reihe) { p = cand[n](); if (p) break; }
            if (!p) {
                // Kein freier Platz: Pinni und Sprechblase unten, die Markierung bleibt oben sichtbar
                p = { pl: 8, pt: vh - ph - 8, bl: klemme(8 + pw + 4, 8, vw - bw - 8), bt: vh - bh - 8 };
                if (vw < 520) { p.pt = vh - bh - ph - 12; p.bt = vh - bh - 8; p.bl = 8; }
            }
        } else {
            const bl = (vw - bw) / 2, bt = Math.max(8, (vh - bh) / 2 + ph / 2 - 10);
            p = { pl: klemme(bl + 6, 8, vw - pw - 8), pt: Math.max(8, bt - ph + 8), bl, bt };
        }
        bubble.style.left = Math.round(p.bl) + 'px';
        bubble.style.top = Math.round(p.bt) + 'px';
        setFig(p.pl, p.pt);
        // Pinni schaut und zeigt zum Ziel
        const tx = R ? R.cx : p.bl + bw / 2, ty = R ? R.cy : p.bt + bh / 2;
        const pcx = p.pl + pw / 2;
        const flip = tx < pcx - 4;
        fig.classList.toggle('pinni-flip', flip);
        fig.classList.toggle('zeigt', !!R);
        if (R) {
            const sx = p.pl + (flip ? 20 : 80) * (pw / 100), sy = p.pt + 72 * (ph / 120);
            const dx = (flip ? -1 : 1) * (tx - sx), dy = ty - sy;
            const winkel = klemme(Math.atan2(dy, Math.max(dx, 8)) * 180 / Math.PI, -85, 85);
            pointArm().setAttribute('transform', 'rotate(' + winkel.toFixed(1) + ' 81 72)');
        }
    }

    function neuLayout() {
        if (aktiv) {
            const s = TUT.steps[schritt];
            if (s && bubble) platziere(zielFinden(s));
        } else {
            const h = heim();
            setFig(h.l, h.t);
            if (bubble) bubbleAmHeim();
        }
    }
    let rafId = 0;
    function geplant() { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(neuLayout); }
    window.addEventListener('resize', geplant);
    window.addEventListener('scroll', geplant, { passive: true });

    document.addEventListener('keydown', e => {
        if (!aktiv || document.querySelector('.pinni-lightbox')) return;
        if (e.key === 'Escape') { e.preventDefault(); beende(false); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); if (schritt < TUT.steps.length - 1) zeige(schritt + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); if (schritt > 0) zeige(schritt - 1); }
    });

    function los() {
        document.body.appendChild(wurzel);
        zumHeim();
        if (!ls('get', FLAG)) setTimeout(() => { if (!aktiv && !bubble) frage(true); }, ruhig() ? 600 : 1400);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();

    window.Pinni = { start: startFuehrung, ende: () => beende(false) };
})();
