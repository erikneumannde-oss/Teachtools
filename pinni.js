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
        '<g class="pinni-eyes pinni-augen">' +
        '<ellipse cx="39" cy="56" rx="7.5" ry="9.5" fill="#fff" stroke="#2a1f5c" stroke-width="2"/>' +
        '<ellipse cx="61" cy="56" rx="7.5" ry="9.5" fill="#fff" stroke="#2a1f5c" stroke-width="2"/>' +
        '<circle cx="40.5" cy="58" r="5" fill="#2a1f5c"/><circle cx="62.5" cy="58" r="5" fill="#2a1f5c"/>' +
        '<circle cx="42" cy="55.5" r="1.7" fill="#fff"/><circle cx="64" cy="55.5" r="1.7" fill="#fff"/></g>' +
        '<ellipse cx="28" cy="71" rx="5.5" ry="3.6" fill="#f58aa0" opacity=".9"/><ellipse cx="72" cy="71" rx="5.5" ry="3.6" fill="#f58aa0" opacity=".9"/>' +
        '<path class="pinni-mund" d="M42 72 Q50 81 58 72" fill="none" stroke="#2a1f5c" stroke-width="2.8" stroke-linecap="round"/>' +
        '<g class="pinni-x-traurig"><path d="M43 79 Q50 71 57 79" fill="none" stroke="#2a1f5c" stroke-width="2.8" stroke-linecap="round"/>' +
        '<path d="M31 46 L45 42 M69 46 L55 42" fill="none" stroke="#2a1f5c" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path class="pinni-traene" d="M34 63 C31 68 30 71 34 72 C38 71 37 68 34 63Z" fill="#7cc4ff" stroke="#2a1f5c" stroke-width="1.2"/></g>' +
        '<g class="pinni-x-lieb"><path d="M32 59 Q39 50 46 59 M54 59 Q61 50 68 59" fill="none" stroke="#2a1f5c" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M40 71 Q50 85 60 71Z" fill="#fff" stroke="#2a1f5c" stroke-width="2.6" stroke-linejoin="round"/>' +
        '<ellipse cx="27" cy="70" rx="6.5" ry="4.2" fill="#ff6f91" opacity=".85"/><ellipse cx="73" cy="70" rx="6.5" ry="4.2" fill="#ff6f91" opacity=".85"/></g>' +
        '<path d="M19 76 Q8 80 6 91" fill="none" stroke="#2a1f5c" stroke-width="4.2" stroke-linecap="round"/><circle cx="6" cy="92" r="3.6" fill="#2a1f5c"/>' +
        '<g class="pinni-arm-wave"><path d="M81 72 Q93 64 94 46" fill="none" stroke="#2a1f5c" stroke-width="4.2" stroke-linecap="round"/><circle cx="94" cy="44" r="3.6" fill="#2a1f5c"/></g>' +
        '<g class="pinni-arm-point"><path d="M81 72 L99 72" fill="none" stroke="#2a1f5c" stroke-width="4.2" stroke-linecap="round"/><circle cx="100" cy="72" r="3.6" fill="#2a1f5c"/></g>' +
        '</g></svg>';

    const wurzel = el('div', 'pinni-root');
    const fig = el('button', 'pinni-fig');
    fig.type = 'button';
    fig.setAttribute('aria-label', 'Pinni, die Assistentin: Hilfe und Führung');
    fig.title = 'Pinni fragen. Du kannst mich auch verschieben.';
    fig.innerHTML = SVG;
    wurzel.appendChild(fig);
    const pointArm = () => fig.querySelector('.pinni-arm-point');

    let bubble = null;
    let aktiv = false; // Führung läuft
    let schritt = 0;
    let sperre = null, licht = null, zeitAus = null, reden = 0, csvOffen = false, liste = [], waechter = 0;

    function figGroesse() { return { w: fig.offsetWidth, h: fig.offsetHeight }; }
    function setFig(l, t) { fig.style.left = Math.round(l) + 'px'; fig.style.top = Math.round(t) + 'px'; }
    /* Platz, den die Nutzerin oder der Nutzer Pinni gegeben hat (Anteil an der freien Fläche). Bleibt nur auf diesem Gerät. */
    const POS = 'pinni-platz';
    let eigen = null;
    try {
        const g = JSON.parse(ls('get', POS) || 'null');
        if (g && typeof g.x === 'number' && typeof g.y === 'number') eigen = { x: Math.max(0, Math.min(1, g.x)), y: Math.max(0, Math.min(1, g.y)) };
    } catch (e) { eigen = null; }
    function heim() {
        const s = figGroesse(), vw = window.innerWidth, vh = window.innerHeight;
        const maxL = Math.max(4, vw - s.w - 4), maxT = Math.max(4, vh - s.h - 4);
        if (eigen) return { l: Math.max(4, Math.min(maxL, eigen.x * maxL)), t: Math.max(4, Math.min(maxT, eigen.y * maxT)) };
        return { l: vw - s.w - 14, t: vh - s.h - 14 };
    }
    function platzMerken() {
        const s = figGroesse(), vw = window.innerWidth, vh = window.innerHeight;
        const maxL = Math.max(1, vw - s.w - 8), maxT = Math.max(1, vh - s.h - 8);
        eigen = { x: Math.max(0, Math.min(1, (parseFloat(fig.style.left) - 4) / maxL)), y: Math.max(0, Math.min(1, (parseFloat(fig.style.top) - 4) / maxT)) };
        ls('set', POS, JSON.stringify(eigen));
    }
    function zumHeim() {
        fig.classList.remove('gross', 'zeigt', 'pinni-flip');
        const h = heim();
        setFig(h.l, h.t);
    }
    const klemme = (v, a, b) => Math.max(a, Math.min(b, v));

    let stimmungZeit = 0;
    function stimmung(art, ms) {
        clearTimeout(stimmungZeit);
        fig.classList.remove('traurig', 'lieb');
        if (art) {
            fig.classList.add(art);
            if (ms) stimmungZeit = setTimeout(() => fig.classList.remove(art), ms);
        }
    }
    function schliesseBubble() {
        if (bubble) { bubble.remove(); bubble = null; }
        clearTimeout(zeitAus);
    }
    function neueBubble() {
        schliesseBubble();
        bubble = el('div', 'pinni-bubble');
        bubble.setAttribute('role', 'dialog');
        bubble.setAttribute('aria-live', 'polite');
        const innen = el('div', 'pinni-inner');
        bubble.appendChild(innen);
        wurzel.appendChild(bubble);
        return innen;
    }
    function wer(b) { b.appendChild(el('p', 'pinni-wer', 'Pinni')); }
    function xKnopf(onClose) {
        const x = el('button', 'pinni-x', '×');
        x.type = 'button'; x.setAttribute('aria-label', 'Schließen');
        x.addEventListener('click', () => { schliesseBubble(); if (onClose) onClose(); });
        bubble.appendChild(x);
    }
    function opt(text, fn) {
        const b = el('button', 'pinni-opt');
        b.type = 'button';
        b.append(el('span', 'pinni-dot'), document.createTextNode(text));
        b.addEventListener('click', fn);
        return b;
    }
    function link(text, fn) {
        const b = el('button', 'pinni-link', text);
        b.type = 'button';
        b.addEventListener('click', fn);
        return b;
    }
    /* Kurze Sprechblase am Heimplatz (Bemerkung, Abschied) */
    function kurz(texte, ms, mitLinks) {
        zumHeim();
        const b = neueBubble();
        wer(b);
        texte.forEach(t => b.appendChild(el('p', 'pinni-text', t)));
        if (mitLinks) b.appendChild(el('div', 'pinni-links', null)).appendChild(leiseLink());
        xKnopf();
        bubbleAmHeim();
        zeitAus = setTimeout(schliesseBubble, ms);
    }
    function knopf(text, cls, fn) {
        const b = el('button', 'pinni-btn' + (cls ? ' ' + cls : ''), text);
        b.type = 'button';
        b.addEventListener('click', fn);
        return b;
    }
    function bubbleAmHeim() {
        const s = figGroesse(), h = heim(), vw = window.innerWidth, vh = window.innerHeight;
        const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        let t = h.t - bh - 8;
        if (t < 8) t = h.t + s.h + 8;
        const l = Math.round(klemme(h.l + s.w - bw, 8, Math.max(8, vw - bw - 8)));
        bubble.style.left = l + 'px';
        bubble.style.top = Math.round(klemme(t, 8, Math.max(8, vh - bh - 8))) + 'px';
        bubble.classList.add('heim');
        bubble.classList.toggle('darunter', t > h.t);
        bubble.style.setProperty('--tx', Math.round(klemme(h.l + s.w / 2 - l, 18, Math.max(18, bw - 18))) + 'px');
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
    const FRAGEN = [
        'Wie geht es dir gerade? Alles gut bei dir?',
        'Kurz nachgefragt: Hattest du heute schon einen schönen Moment?',
        'Na, wie läuft dein Tag? Geht es dir gut?',
        'Ich wollte nur wissen, ob es dir gut geht.',
        'Hast du heute schon etwas getrunken? Und: Geht es dir gut?',
        'Hand aufs Herz, oder auf die Nadel: Wie geht es dir?',
        'Geht es dir gut? Ich frage nicht nur aus Höflichkeit.',
        'Wie war deine Woche bisher? Alles im grünen Bereich?'
    ];
    const JA = [
        'Das freut mich wirklich! Dann machen wir einfach so weiter.',
        'Wie schön! Das hebt auch meine Laune. Und ich hab nur eine Nadel.',
        'Prima! Genieß das Gefühl, das hast du dir verdient.',
        'Das höre ich gern. Gute Laune ist die halbe Arbeit.',
        'Super! Dann kann ja nichts mehr schiefgehen.',
        'Das macht mich froh. Danke, dass du es mir erzählt hast.',
        'Freut mich! Sag Bescheid, wenn ich dir etwas abnehmen kann.'
    ];
    const NEIN_ZUERST = ['Oh …', 'Ach, das tut mir leid …', 'Oje …', 'Hm … das mag ich gar nicht hören …'];
    const TROST = [
        'Das ist okay. Nicht jeder Tag ist ein guter, und du musst heute nicht alles schaffen.',
        'Ich bin hier und hefte die Dinge für dich an. Eins nach dem anderen, in deinem Tempo.',
        'Manchmal hilft schon ein Glas Wasser und ein tiefer Atemzug. Probier es kurz aus.',
        'Du gibst jeden Tag viel für andere. Heute darfst du ruhig etwas milder mit dir sein.',
        'Schlechte Tage gehen vorbei, versprochen. Und morgen sieht vieles schon anders aus.',
        'Wenn du magst, mach eine kleine Pause. Die Zettel laufen dir nicht weg.',
        'Du bist mehr als deine Liste. Danke, dass du trotzdem hier bist.',
        'Ich drück dir die Daumen. Oder zumindest die Nadel.',
        'Das wird wieder. Und bis dahin bin ich an deiner Seite, so gut eine Pinnnadel das kann.',
        'Vielleicht hilft es, mit jemandem zu reden, der dich mag. Du bist es wert.'
    ];
    const zufall = l => l[Math.floor(Math.random() * l.length)];

    /* ---------- Einstellungen: ausgeblendet, leiser ---------- */
    const AUS = 'pinni-aus', LEISE = 'pinni-leise';
    let ausgeblendet = ls('get', AUS) === '1', leise = ls('get', LEISE) === '1';
    const zurueckBtn = el('button', 'pinni-back');
    zurueckBtn.type = 'button';
    zurueckBtn.setAttribute('aria-label', 'Pinni wieder holen');
    zurueckBtn.title = 'Pinni wieder holen';
    zurueckBtn.append(document.createTextNode('📌'), el('span', 'pinni-hol', 'Pinni holen'));
    wurzel.appendChild(zurueckBtn);
    function wendeAusAn() { wurzel.classList.toggle('aus', ausgeblendet); }
    function ausblenden() {
        ausgeblendet = true; ls('set', AUS, '1');
        schliesseBubble();
        wendeAusAn();
    }
    function holen() {
        ausgeblendet = false; ls('set', AUS, '0');
        wendeAusAn();
        zumHeim();
        menue(false);
    }
    zurueckBtn.addEventListener('click', holen);
    function leiseLink() {
        return link(leise ? 'Pinni darf wieder öfter erzählen' : 'Weniger reden', () => {
            leise = !leise; ls('set', LEISE, leise ? '1' : '0');
            kurz([leise ? 'Alles klar, ich rede weniger. Du kannst mich jederzeit antippen.' : 'Schön, ich erzähle wieder öfter.'], 3500);
        });
    }
    const merken = () => ls('set', FLAG, '1');

    /* ---------- Menü: etwas Nettes, dann Auswahl ---------- */
    /* Frage "Geht es dir gut?" mit zwei kleinen Antworten; Reaktion mit Gesichtsausdruck */
    function wohlbefinden(b, nachher) {
        const reihe = el('div', 'pinni-antw');
        const ja = el('button', 'pinni-pille', 'Ja, danke');
        const nein = el('button', 'pinni-pille', 'Nicht so gut');
        ja.type = nein.type = 'button';
        ja.addEventListener('click', () => {
            merken();
            stimmung('lieb', 9000);
            antwort(zufall(JA), nachher);
        });
        nein.addEventListener('click', () => {
            merken();
            stimmung('traurig', 2600);
            antwort(zufall(NEIN_ZUERST), null, 2400, () => {
                stimmung('lieb', 11000);
                antwort(zufall(TROST), nachher);
            });
        });
        reihe.append(ja, nein);
        b.appendChild(reihe);
    }
    function antwort(text, nachher, ms, weiter) {
        zumHeim();
        const b = neueBubble();
        wer(b);
        b.appendChild(el('p', 'pinni-text', text));
        if (nachher) nachher(b);
        xKnopf(() => stimmung(null));
        bubbleAmHeim();
        zeitAus = setTimeout(weiter || schliesseBubble, ms || (nachher ? 40000 : 9000 + text.length * 40));
    }
    function menuePunkte(b) {
        const liste = el('div', 'pinni-opts');
        liste.appendChild(opt('Tutorial starten', () => { merken(); startFuehrung(); }));
        if (TUT.csv) liste.appendChild(opt('CSV-Datei aus WebUntis holen', () => { merken(); csvFuehrung(null); }));
        liste.appendChild(opt('Pinni ausblenden', () => { merken(); ausblenden(); }));
        b.appendChild(liste);
        b.appendChild(el('div', 'pinni-links', null)).appendChild(leiseLink());
    }
    function menue(erstmals) {
        if (aktiv || csvOffen) return;
        zumHeim();
        const b = neueBubble();
        wer(b);
        const wurf = Math.random();
        const frage = !erstmals && wurf < 0.4;
        if (erstmals) b.appendChild(el('p', 'pinni-text', 'Hallo, ich bin Pinni! Soll ich dir zeigen, wie das hier funktioniert?'));
        else if (frage) b.appendChild(el('p', 'pinni-text', zufall(FRAGEN)));
        else b.appendChild(el('p', 'pinni-text', zufall(wurf < 0.7 ? MUT : SPRUECHE)));
        if (frage) wohlbefinden(b, menuePunkte);
        menuePunkte(b);
        xKnopf(merken);
        bubbleAmHeim();
        zeitAus = setTimeout(schliesseBubble, 40000);
    }

    /* ---------- Gelegentliche Bemerkungen ---------- */
    let letzteAktion = Date.now(), naechsteBem = Date.now() + 40000, letzteBem = '';
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { letzteAktion = Date.now(); }, { passive: true, capture: true }));
    function bemerkung() {
        const pool = MUT.concat(SPRUECHE);
        (TUT.tipps || []).forEach(t => { pool.push('Tipp: ' + t); pool.push('Tipp: ' + t); });
        let t = zufall(pool), n = 0;
        while (t === letzteBem && n++ < 5) t = zufall(pool);
        letzteBem = t;
        if (Math.random() < 0.25) {
            zumHeim();
            const b = neueBubble();
            wer(b);
            b.appendChild(el('p', 'pinni-text', zufall(FRAGEN)));
            wohlbefinden(b, null);
            xKnopf();
            bubbleAmHeim();
            zeitAus = setTimeout(schliesseBubble, 25000);
            return;
        }
        kurz([t], 6500 + t.length * 45, true);
    }
    setInterval(() => {
        if (aktiv || csvOffen || bubble || ausgeblendet || leise || griff || document.hidden) return;
        const a = document.activeElement;
        if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
        if (document.querySelector('.modal, .pinni-lightbox')) return;
        const jetzt = Date.now();
        if (jetzt < naechsteBem || jetzt - letzteAktion < 15000) return;
        naechsteBem = jetzt + (60 + Math.random() * 50) * 1000;
        bemerkung();
    }, 4000);

    let gezogen = false, griff = null;
    fig.addEventListener('pointerdown', e => {
        if (aktiv || csvOffen || (e.pointerType === 'mouse' && e.button !== 0)) return;
        griff = { x: e.clientX, y: e.clientY, l: parseFloat(fig.style.left) || 0, t: parseFloat(fig.style.top) || 0, bewegt: false, id: e.pointerId };
        try { fig.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    });
    fig.addEventListener('pointermove', e => {
        if (!griff || e.pointerId !== griff.id) return;
        const dx = e.clientX - griff.x, dy = e.clientY - griff.y;
        if (!griff.bewegt && Math.hypot(dx, dy) > 6) { griff.bewegt = true; fig.classList.add('zieht'); schliesseBubble(); }
        if (griff.bewegt) {
            const s = figGroesse();
            setFig(klemme(griff.l + dx, 4, window.innerWidth - s.w - 4), klemme(griff.t + dy, 4, window.innerHeight - s.h - 4));
        }
    });
    function griffEnde(e) {
        if (!griff || e.pointerId !== griff.id) return;
        if (griff.bewegt) {
            platzMerken();
            gezogen = true;
            setTimeout(() => { gezogen = false; }, 80);
        }
        fig.classList.remove('zieht');
        griff = null;
    }
    fig.addEventListener('pointerup', griffEnde);
    fig.addEventListener('pointercancel', griffEnde);
    fig.addEventListener('keydown', e => {
        if (aktiv || csvOffen) return;
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d) return;
        e.preventDefault();
        const s = figGroesse();
        setFig(klemme((parseFloat(fig.style.left) || 0) + d[0] * 24, 4, window.innerWidth - s.w - 4), klemme((parseFloat(fig.style.top) || 0) + d[1] * 24, 4, window.innerHeight - s.h - 4));
        platzMerken();
        if (bubble) bubbleAmHeim();
    });
    fig.addEventListener('click', () => {
        if (aktiv || csvOffen) return;
        if (gezogen) { gezogen = false; return; }
        if (bubble) { schliesseBubble(); return; }
        menue(false);
    });

    /* ---------- Führung ---------- */
    function sichtbar(e) {
        if (!e) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    }
    function bed(c) {
        if (!c) return true;
        if (c.sichtbar) return sichtbar(document.querySelector(c.sichtbar));
        if (c.versteckt) return !sichtbar(document.querySelector(c.versteckt));
        return true;
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
        if (s.vor && window.PinniHooks && window.PinniHooks[s.vor[0]]) window.PinniHooks[s.vor[0]](s.vor[1]);
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
        liste = TUT.steps.filter(s => bed(s.wenn));
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
        clearInterval(waechter);
        schliesseCsv();
        if (sperre) sperre.remove();
        if (licht) licht.remove();
        sperre = licht = null;
        fig.tabIndex = 0;
        schliesseBubble();
        zumHeim();
        if (abschied) kurz([TUT.ende || 'Das war es schon. Tipp mich an, wenn du mich noch einmal brauchst.', zufall(MUT)], 8000);
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
        const s = liste[i];
        if (!s) { beende(true); return; }
        clearInterval(waechter);
        schritt = i;
        const mein = ++reden;
        vorbereiten(s);
        const b = neueBubble();
        b.appendChild(el('p', 'pinni-schritt', 'Schritt ' + (i + 1) + ' von ' + liste.length));
        if (s.title) b.appendChild(el('h3', null, s.title));
        b.appendChild(el('p', null, s.text));
        if (s.preview) {
            if (window.innerHeight < 440) {
                // Niedriges Fenster (Handy quer): kein Vorschaufenster in der Sprechblase, das Bild lässt sich groß öffnen
                const vk = knopf('Vorschau ansehen', '', () => lightbox(basis + s.preview.src, s.preview.title));
                vk.classList.add('pinni-vorschau');
                b.appendChild(vk);
            } else b.appendChild(fenster(s.preview));
        }
        const tat = !!s.fertig;
        if (tat) b.appendChild(el('p', 'pinni-hinweis', s.hinweis || 'Es geht weiter, sobald du es gemacht hast.'));
        if (s.csv) b.appendChild(el('p', null, 'Soll ich dir erklären, wie du für Klassen der Sekundarstufe I ganz leicht eine CSV-Datei bekommst? Für die Oberstufe funktioniert das leider nicht so einfach.'));
        const bt = el('div', 'pinni-btns');
        const zurueck = knopf('Zurück', '', () => zeige(i - 1));
        zurueck.disabled = i === 0;
        const letzter = i === liste.length - 1;
        const weiter = knopf(letzter ? 'Fertig' : 'Weiter', 'primaer', () => letzter ? beende(true) : zeige(i + 1));
        const ende = knopf('Beenden', '', () => beende(false));
        bt.appendChild(zurueck);
        if (s.csv) {
            const ja = knopf('Ja, bitte', 'primaer', () => csvFuehrung(() => { if (aktiv) zeige(i + 1); }));
            const nein = knopf('Nein, weiter', '', () => (letzter ? beende(true) : zeige(i + 1)));
            bt.append(ja, nein);
        } else if (!tat) bt.appendChild(weiter);
        bt.append(el('span', 'pinni-spacer'), ende);
        b.appendChild(bt);
        if (tat) {
            waechter = setInterval(() => {
                if (!aktiv || mein !== reden) { clearInterval(waechter); return; }
                if (bed(s.fertig)) { clearInterval(waechter); zeige(i + 1); }
                else if (s.abbruch && bed(s.abbruch)) { clearInterval(waechter); zeige(i - 1); }
            }, 200);
        }
        // Layout nach kurzer Pause, damit Reiter und aufgeklappte Bereiche fertig gezeichnet sind
        setTimeout(() => {
            if (mein !== reden || !aktiv) return;
            const z = zielFinden(s);
            if (z) {
                const r0 = z.getBoundingClientRect();
                z.scrollIntoView({ block: r0.height > window.innerHeight * 0.5 ? 'start' : 'center', inline: 'nearest' });
            }
            requestAnimationFrame(() => { if (mein === reden && aktiv) platziere(z); });
            if (!tat) (s.csv ? bt.querySelector('.primaer') : weiter).focus({ preventScroll: true });
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
            const stp = liste[schritt];
            if (sperre) sperre.style.clipPath = stp && stp.frei ? 'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ' + l + 'px ' + t + 'px, ' + l + 'px ' + bb + 'px, ' + rr + 'px ' + bb + 'px, ' + rr + 'px ' + t + 'px, ' + l + 'px ' + t + 'px)' : '';
            licht.classList.remove('leer');
            licht.style.left = l + 'px'; licht.style.top = t + 'px';
            licht.style.width = R.w + 'px'; licht.style.height = R.h + 'px';
        } else {
            if (sperre) sperre.style.clipPath = '';
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
                // Kein freier Platz neben oder über dem Ziel: die vier Ecken probieren, die am wenigsten verdeckt
                let best = null;
                [[false, false], [true, false], [false, true], [true, true]].forEach(([rechts, unten]) => {
                    const bl = rechts ? Math.max(8, vw - bw - 8) : klemme(8 + pw + 4, 8, Math.max(8, vw - bw - 8));
                    const bt = unten ? Math.max(8, vh - bh - 8) : 8;
                    const ix = Math.max(0, Math.min(bl + bw, R.right) - Math.max(bl, R.left)), iy = Math.max(0, Math.min(bt + bh, R.bottom) - Math.max(bt, R.top));
                    const verdeckt = ix * iy;
                    if (!best || verdeckt < best.v) best = { v: verdeckt, bl, bt, rechts, unten };
                });
                let pl = best.bl - pw - 4;
                if (pl < 8) pl = klemme(best.bl + bw + 4, 8, Math.max(8, vw - pw - 8));
                p = { pl, pt: best.unten ? Math.max(8, vh - ph - 8) : 8, bl: best.bl, bt: best.bt };
                if (vw < 520) { p.pl = 8; p.pt = best.unten ? Math.max(8, vh - bh - ph - 12) : bh + 12; p.bl = 8; }
            }
        } else {
            const bl = (vw - bw) / 2, bt = Math.max(8, (vh - bh) / 2 + ph / 2 - 10);
            p = { pl: klemme(bl + 6, 8, vw - pw - 8), pt: Math.max(8, bt - ph + 8), bl, bt };
        }
        bubble.classList.remove('heim', 'darunter');
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

    /* ---------- CSV aus WebUntis: großes Vorschaufenster ---------- */
    const CSV = [
        { bild: 'webuntis-1.png', alt: 'WebUntis nach dem Einloggen, Menüpunkt Stammdaten markiert',
          text: 'Dafür loggst du dich bei WebUntis ein. Danach wählst du links im Menü „Stammdaten“. Oben wählst du dann deine Klasse aus. Das geht nur für Klassen der Sekundarstufe I so einfach, für die Oberstufe leider nicht.' },
        { bild: 'webuntis-2.png', alt: 'Liste der Schülerinnen und Schüler einer Klasse mit dem Knopf Berichte',
          text: 'Jetzt siehst du die Liste der Klasse. Ganz unten findest du den Knopf „Berichte“. Den klickst du an.' },
        { bild: 'webuntis-3.png', alt: 'Berichte-Menü mit dem grünen CSV-Symbol in der Zeile Schüler',
          text: 'Es öffnet sich eine kleine Auswahl. In der Zeile „Schüler“ klickst du auf das grüne Symbol mit der Aufschrift CSV. Die Datei wird heruntergeladen.' },
        { bild: null,
          text: 'Die Datei solltest du noch kurz bearbeiten. Das geht mit jedem Tabellenprogramm, zum Beispiel Excel, Numbers oder LibreOffice Calc. Es stehen nämlich viel mehr Daten darin, als hier gebraucht werden. Lass nur die Spalten stehen, die du brauchst, und speichere die Datei wieder als CSV.' }
    ];
    let csvRoot = null, csvWeiter = null, csvZurueck = null, csvEnde = () => {}, csvDanach = null;
    function schliesseCsv() {
        if (csvRoot) { csvRoot.remove(); csvRoot = null; }
        csvOffen = false; csvWeiter = csvZurueck = null;
        fig.classList.remove('weg');
    }
    function csvFuehrung(danach) {
        schliesseBubble();
        csvOffen = true;
        csvDanach = danach;
        fig.classList.add('weg');
        const bg = el('div', 'pinni-bigbg');
        const panel = el('div', 'pinni-big');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'CSV-Datei aus WebUntis holen');
        const bar = el('div', 'pinni-win-bar');
        bar.append(el('i'), el('i'), el('span', null, 'CSV-Datei aus WebUntis holen'));
        const x = el('button', null, '×');
        x.type = 'button'; x.setAttribute('aria-label', 'Schließen');
        bar.appendChild(x);
        const img = el('img', 'pinni-big-img');
        const koerper = el('div', 'pinni-big-body');
        const mini = el('div', 'pinni-big-pinni');
        mini.innerHTML = SVG.replace(/pinni-grad/g, 'pinni-grad-mini').replace('<svg ', '<svg class="pinni-mini" ');
        const txt = el('div', 'pinni-big-text');
        const nr = el('p', 'pinni-schritt');
        const t = el('p', 'pinni-big-satz');
        const bt = el('div', 'pinni-btns');
        txt.append(nr, t, bt);
        koerper.append(mini, txt);
        const haupt = el('div', 'pinni-big-main');
        haupt.append(img, koerper);
        panel.append(bar, haupt);
        bg.appendChild(panel);
        wurzel.appendChild(bg);
        csvRoot = bg;
        let k = 0;
        csvEnde = () => { const d = csvDanach; schliesseCsv(); if (d) d(); else { zumHeim(); const b2 = neueBubble(); b2.appendChild(el('p', null, 'Viel Erfolg! Tipp mich an, wenn ich es dir noch einmal zeigen soll.')); bubbleAmHeim(); zeitAus = setTimeout(schliesseBubble, 4500); } };
        function zeigeCsv(n) {
            k = n;
            const s = CSV[n];
            nr.textContent = 'Schritt ' + (n + 1) + ' von ' + CSV.length;
            t.textContent = s.text;
            if (s.bild) {
                img.hidden = false;
                img.src = basis + 'pinni/vorschau/' + s.bild;
                img.alt = s.alt || '';
            } else { img.hidden = true; img.removeAttribute('src'); }
            bt.textContent = '';
            const zu = knopf('Zurück', '', () => zeigeCsv(k - 1));
            zu.disabled = n === 0;
            const letzt = n === CSV.length - 1;
            const w = knopf(letzt ? 'Fertig' : 'Weiter', 'primaer', () => letzt ? csvEnde() : zeigeCsv(k + 1));
            const bd = knopf('Beenden', '', () => csvEnde());
            bt.append(zu, w, el('span', 'pinni-spacer'), bd);
            csvZurueck = n > 0 ? () => zeigeCsv(k - 1) : null;
            csvWeiter = letzt ? null : () => zeigeCsv(k + 1);
            w.focus({ preventScroll: true });
        }
        img.addEventListener('click', () => { if (img.src) lightbox(img.src, img.alt); });
        x.addEventListener('click', () => csvEnde());
        zeigeCsv(0);
    }

    function neuLayout() {
        if (aktiv) {
            const s = liste[schritt];
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
        if (document.querySelector('.pinni-lightbox')) return;
        if (csvOffen) {
            if (e.key === 'Escape') { e.preventDefault(); csvEnde(); }
            else if (e.key === 'ArrowRight' && csvWeiter) { e.preventDefault(); csvWeiter(); }
            else if (e.key === 'ArrowLeft' && csvZurueck) { e.preventDefault(); csvZurueck(); }
            return;
        }
        if (!aktiv) return;
        const s = liste[schritt];
        if (s && (s.frei || s.fertig)) return; // hier arbeitet die Seite selbst, Tasten gehören ihr
        const feld = e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
        if (e.key === 'Escape') { e.preventDefault(); beende(false); }
        else if (feld) return;
        else if (e.key === 'ArrowRight') { e.preventDefault(); if (schritt < liste.length - 1 && !(s && s.csv)) zeige(schritt + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); if (schritt > 0) zeige(schritt - 1); }
    });

    function los() {
        document.body.appendChild(wurzel);
        wendeAusAn();
        zumHeim();
        if (!ls('get', FLAG) && !ausgeblendet) setTimeout(() => { if (!aktiv && !bubble && !ausgeblendet) menue(true); }, ruhig() ? 600 : 1400);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();

    window.Pinni = { start: startFuehrung, ende: () => beende(false), csv: () => csvFuehrung(null) };
})();
