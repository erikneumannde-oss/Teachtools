/*
  Lilibär, das Startmaskottchen von Teachtools (Skin für die Kolbi-Engine: skin-lilibaer.js)
  Idee: Dr. Benjamin Janzen · Umsetzung: Erik Neumann mit Hilfe von Claude

  Lilibär lebt nur auf der Startseite. Sie ist keine Assistentin (das ist Pinni in den Werkzeugen),
  sondern begrüßt die Kolleginnen und Kollegen, muntert auf, erzählt Witze, informiert über die Werkzeuge
  und über unsere Schule. Beim ersten Besuch stellt sie sich vor und ruft Pinni kurz herein.

  Datenschutz: Alles läuft nur im Browser. Gespeichert wird nur ein Merker, ob die Vorstellung schon lief
  (localStorage 'lilibaer-vorstellung'), und für die Begrüßung, ob sie in dieser Sitzung schon kam (sessionStorage).
  Es wird nichts gesendet und nichts von externen Adressen geladen.
*/
(function () {
  'use strict';
  if (window.Lilibaer) return;
  var L = window.Lilibaer = {};
  var KEY = 'lilibaer-vorstellung', GRUSS = 'lilibaer-gruss';
  var bags = {};

  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function bag(name, src) {                      // jede Aussage einmal, bevor sich etwas wiederholt
    var b = bags[name] || (bags[name] = []);
    if (!b.length) { b.push.apply(b, src); for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = b[i]; b[i] = b[j]; b[j] = t; } }
    return b.pop();
  }
  function store(kind, op, k, v) { try { var s = kind === 's' ? sessionStorage : localStorage; return op === 'get' ? s.getItem(k) : s.setItem(k, v); } catch (e) { return null; } }
  function X() { return '<button class="kb-x" aria-label="Schließen" data-k="close">×</button>'; }
  function opt(k, label, dot) { return '<button class="kb-opt" data-nb="' + k + '"><span class="kb-dot"' + (dot ? ' style="background:' + dot + '"' : '') + '></span>' + esc(label) + '</button>'; }
  function say(html, m, ms) { Kolbi.open(html, ms || 0, m || 'happy'); }
  function busy() { return Kolbi.bubbleRect && Kolbi.bubbleRect(); }
  function back(extra) { return '<div style="margin-top:8px">' + (extra || '') + opt('menu', 'Zurück zum Menü', '#9ca3af') + '</div>'; }
  function p(t, b) { return '<p class="kb-text"' + (b ? ' style="margin-bottom:6px"' : '') + '>' + t + '</p>'; }

  // ------------------------------------------------------------------ Inhalte (Entwurf, zur Durchsicht)
  var WITZE = [
    ['Was sagt die Null zur Acht?', 'Schicker Gürtel!'],
    ['Was ist ein Bär ohne Zähne?', 'Ein Gummibär.'],
    ['Wie nennt man ein Lehrerzimmer ohne Kaffee?', 'Einen Notfall.'],
    ['Warum ist der Radiergummi der beste Kollege?', 'Er nimmt Fehler nicht persönlich.'],
    ['Was sagt eine PDF zur anderen?', '„Wir passen perfekt zusammen.“'],
    ['Wie viele Lehrkräfte braucht man, um eine Glühbirne zu wechseln?', 'Drei: eine zum Wechseln und zwei fürs Protokoll.'],
    ['Warum sind Geister so schlechte Lügner?', 'Man schaut direkt durch sie hindurch.'],
    ['Was macht ein Pirat am Computer?', 'Er drückt die Enter-Taste.'],
    ['Warum ging das Handy zur Schule?', 'Es wollte schlauer werden.'],
    ['Was ist braun, flauschig und hat Pausenaufsicht?', 'Ich. Zumindest in meinen Träumen.'],
    ['Warum nehmen Bären keine Handschuhe zur Konferenz mit?', 'Sie haben ihre Pfoten schon dabei.'],
    ['Was ist ein Keks unter einem Baum?', 'Ein schattiges Plätzchen.'],
    ['Kennst du den Witz über Zeitmanagement?', 'Ich erzähle ihn später.']
  ];
  var MUT = [
    'Du hältst gerade sehr viele Dinge gleichzeitig am Laufen. Dass das meistens klappt, ist keine Selbstverständlichkeit.',
    'Nicht alles muss heute fertig werden. Such dir das eine aus, das wirklich zählt, und fang damit an.',
    'Deine Arbeit kommt an, auch wenn niemand es jedes Mal sagt. Danke, dass du das machst.',
    'Ein Tag, der holprig war, sagt nichts über dich als Lehrkraft. Du hast schon viele gute Stunden gehalten.',
    'Atme einmal tief durch. Schultern runter, Kiefer locker. Besser?',
    'Du darfst um Hilfe bitten. Im Kollegium sitzen mehr Menschen, die dich unterstützen wollen, als du denkst.',
    'Was du heute schaffst, reicht. Und was liegen bleibt, ist auch morgen noch da.',
    'Du bringst Erfahrung, Geduld und Ideen mit. Das ist eine ziemlich gute Mischung.',
    'Kleine Erfolge zählen. Eine Stunde, in der alle mitgemacht haben, ist ein echter Erfolg.',
    'Du musst nicht perfekt sein, damit deine Schülerinnen und Schüler bei dir etwas lernen.'
  ];
  var SCHULE = [
    'Unsere Schule liegt am Rande der Spandauer Altstadt, ganz in der Nähe des Rathauses, mit U-Bahn und Bussen in der Nähe. Ein Park gehört auch zur Umgebung.',
    'In jedem Unterrichtsraum hängt ein Smartboard. Außerdem gibt es Glasfaser, WLAN und neu ausgestattete Computerräume.',
    'Unsere Schule wurde als „Exzellente digitale Schule“ ausgezeichnet.',
    'Englisch ist die erste Fremdsprache. Ab Klasse 7 kommt Französisch oder Spanisch dazu, ab Klasse 8 Latein oder Chinesisch.',
    'Ab Klasse 7 gibt es Schwerpunktklassen: eine Sprachenklasse, eine Kunstklasse (in Kooperation mit der Kunstbastion) und eine Tabletklasse mit MINT-Orientierung.',
    'In der Oberstufe gibt es Leistungskurse in zwölf Fächern, darunter Musik, Kunst und Politikwissenschaft.',
    'Wer Latein erfolgreich abschließt, bekommt am Ende der Jahrgangsstufe 12 das Latinum.',
    'Wir haben Austausche mit einer Schule bei Bordeaux in Frankreich und mit einer Schule in Albacete in Spanien. Dazu kommt ein Austausch im Rahmen der Städtepartnerschaft Spandau–Siegen.',
    'Seit 1995 gibt es eine Partnerschaft mit der 19. Mittel- und Oberschule in Peking. Sie ruht gerade, aber sie gehört zu unserer Geschichte.',
    'Die Roboter-AG hat 2026 am Regionalwettbewerb der World Robot Olympiad teilgenommen.',
    'Im Erasmus-Projekt 2025 ging es um „Starke Töne – Musik, Respekt und Begegnung“.',
    'Wir engagieren uns zum Beispiel im Schulsozialprojekt Honduras und als „Schule ohne Rassismus“.',
    'Es gibt Arbeitsgemeinschaften unter anderem in Sport, Musik, Kunst, Theater und Naturwissenschaften.',
    'Unsere Cafeteria hat Brötchen, Snacks und Getränke. Für den Notfall im Lehrerzimmer gilt das nur eingeschränkt.'
  ];
  var KURZ = [                                   // kurze Zwischenrufe, wenn Lilibär von selbst etwas sagt
    'Schön, dass du da bist. Schau dich in Ruhe um.',
    'Du machst das gut. Wirklich.',
    'Trink bei Gelegenheit einen Schluck Wasser. 💧',
    'Wusstest du, dass in jedem Raum unserer Schule ein Smartboard hängt?',
    'Mit der Feder halte ich gute Ideen fest. Hast du heute schon eine gehabt?',
    'Wenn du mich antippst, erzähle ich dir etwas oder suche ein Werkzeug mit dir aus.',
    'Kleine Pause? Ich passe solange auf die Zettel auf.',
    'Wir haben Austausche mit Frankreich und Spanien. Das fände ich als Bär ziemlich aufregend.'
  ];

  // ------------------------------------------------------------------ Menü
  function menu() {
    say(X() + p('<b>' + rnd(['Schön, dass du da bist!', 'Womit kann ich dir eine Freude machen?', 'Na, was darf es sein?']) + '</b>') +
      opt('werkzeuge', 'Was gibt es hier?') + opt('mut', 'Etwas Aufmunterndes') + opt('witz', 'Einen Witz bitte') +
      opt('schule', 'Etwas über unsere Schule') + opt('checkin', 'Wie geht es dir?  Und mir?') + opt('vorstellung', 'Lilibär und Pinni vorstellen'), 'happy');
  }
  function werkzeuge() {
    var n = [].slice.call(document.querySelectorAll('.notes .note')), h = '', i;
    var intern = n.filter(function (a) { return a.getAttribute('data-tag') !== 'Extern'; }), extern = n.filter(function (a) { return a.getAttribute('data-tag') === 'Extern'; });
    for (i = 0; i < intern.length; i++) { var b = intern[i].querySelector('b'), s = intern[i].querySelector('small'); h += '<li><b>' + esc(b ? b.textContent : '') + '</b>' + (s ? ': ' + esc(s.textContent) : '') + '</li>'; }
    say(X() + p('<b>Das findest du auf dieser Pinnwand:</b>') +
      '<ul class="kb-text" style="margin:0 0 6px;padding-left:18px">' + h + '</ul>' +
      (extern.length ? p('Dazu kommen ' + extern.length + ' Zettel, die externe Seiten in einem neuen Fenster öffnen: ' + extern.map(function (a) { var b = a.querySelector('b'); return esc(b ? b.textContent : ''); }).join(', ') + '.') : '') +
      p('Alles läuft in deinem Browser. Nichts wird übertragen. In jedem Werkzeug hilft dir Pinni, die Reißzwecke, wenn du sie antippst.') + back(), 'interested');
  }
  function mut() {
    say(X() + p('<b>' + esc(bag('mut', MUT)) + '</b>') + back(opt('mut', 'Noch eins')), rnd(['happy', 'love', 'excited']));
  }
  function witz() {
    var w = bag('witz', WITZE);
    say(X() + p('<b>' + esc(w[0]) + '</b>') + '<div id="lb-pointe">' + opt('pointe', 'Auflösen', '#f59e0b') + '</div>', 'wink');
    pointe = w[1];
  }
  var pointe = '';
  function aufloesen() {
    say(X() + p(esc(pointe)) + back(opt('witz', 'Noch einen')), 'giggle');
  }
  function schule() {
    say(X() + p('<b>Unsere Schule</b>') + p(esc(bag('schule', SCHULE))) +
      back(opt('schule', 'Noch ein Fakt') + '<a class="kb-link" href="https://lily-braun-gymnasium.de/" target="_blank" rel="noopener noreferrer" style="display:block;margin:6px 0 2px">Zur Website der Schule (neues Fenster)</a>'), 'interested');
  }
  function checkin() {
    say(X() + p('<b>' + rnd(['Und bei dir? Wie geht es dir gerade wirklich?', 'Kurz Luft holen: Wie fühlst du dich heute?']) + '</b>') +
      opt('ci-gut', 'Gut, danke', '#22c55e') + opt('ci-voll', 'Viel los', '#f59e0b') + opt('ci-muede', 'Müde', '#60a5fa') + opt('ci-schwer', 'Heute ist es schwer', '#a78bfa') + opt('menu', 'Lieber nicht', '#9ca3af'), 'caring');
  }
  function checkinReply(k) {
    var R = {
      gut: ['Das freut mich sehr!', 'love', 'Dann nutz den Schwung für das, was dir wichtig ist. Und wenn du magst, erzähle ich dir einen Witz.'],
      voll: ['Das klingt nach einem vollen Kopf.', 'interested', 'Nimm dir einen Moment: Was ist das Eine, das heute wirklich erledigt werden muss? Den Rest darfst du sortieren, später oder gar nicht. Die Werkzeuge hier sparen dir ein bisschen Zeit.'],
      muede: ['Ach, das kenne ich.', 'yawn', 'Wenn es geht, gönn dir fünf Minuten: Fenster auf, Schultern lockern, einen Schluck trinken. Ich passe solange auf.'],
      schwer: ['Das tut mir leid.', 'sad', 'Du musst heute nichts beweisen. Mach das Nötigste und sei freundlich zu dir. Wenn es dich länger belastet, sprich mit jemandem, dem du vertraust, im Kollegium oder außerhalb der Schule. Ich bin hier, falls du eine Aufmunterung oder einen Witz brauchst.']
    }[k];
    if (!R) return;
    say(X() + p('<b>' + R[0] + '</b>') + p(R[2]) + back(k === 'gut' ? opt('witz', 'Einen Witz bitte') : opt('mut', 'Etwas Aufmunterndes')), R[1]);
  }

  // ------------------------------------------------------------------ Pinni: Gastauftritt
  var PINNI_SVG = '<svg viewBox="0 0 100 120" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="lb-pinni-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f28080"/><stop offset="1" stop-color="#e03a52"/></linearGradient></defs>' +
        '<g class="pinni-body">' +
        '<polygon points="45,92 55,92 50,119" fill="#d5d8e0" stroke="#2a1f5c" stroke-width="3" stroke-linejoin="round"/>' +
        '<ellipse cx="50" cy="88" rx="33" ry="8" fill="#c92f48" stroke="#2a1f5c" stroke-width="3.5"/>' +
        '<path d="M17 72 C17 38 31 13 50 13 C69 13 83 38 83 72 C83 84 70 90 50 90 C30 90 17 84 17 72Z" fill="url(#lb-pinni-grad)" stroke="#2a1f5c" stroke-width="3.5" stroke-linejoin="round"/>' +
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
  var gast = null;
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }
  function pinniAuftritt(done) {
    if (gast) return;
    var root = document.createElement('div'); root.className = 'pinni-root lb-gast';
    var fig = document.createElement('div'); fig.className = 'pinni-fig lb-flug'; fig.setAttribute('role', 'img'); fig.setAttribute('aria-label', 'Pinni, die Reißzwecken-Assistentin'); fig.innerHTML = PINNI_SVG;
    root.appendChild(fig); document.body.appendChild(root);
    var W = vw() < 520 ? 46 : 64, H = Math.round(W * 76 / 64);
    var sp = (Kolbi.spot && Kolbi.spot()) || { x: vw() - 70, y: vh() - 120, top: vh() - 150 };
    var tx = sp.x - 96 > 8 ? sp.x - 96 - W / 2 : Math.min(vw() - W - 8, sp.x + 60), ty = Math.max(90, Math.min(vh() - H - 14, sp.top - 6));
    fig.style.width = W + 'px'; fig.style.height = H + 'px';
    fig.style.left = (vw() + 90) + 'px'; fig.style.top = (ty - 140) + 'px';
    gast = { root: root, fig: fig, bubble: null, ty: ty, tx: tx, W: W, H: H, done: done };
    var wait = reduced() ? 20 : 60;
    setTimeout(function () { fig.style.left = tx + 'px'; fig.style.top = ty + 'px'; }, wait);
    setTimeout(function () { fig.classList.remove('lb-flug'); pinniSpricht(); }, reduced() ? 80 : 1000);
  }
  function pinniSpricht() {
    if (!gast) return;
    var b = document.createElement('div'); b.className = 'lb-bubble'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Pinni stellt sich vor');
    b.innerHTML = '<p><b>Hallo, ich bin Pinni!</b> 📌</p>' +
      '<p>Ich bin die Reißzwecke und wohne in den Werkzeugen. Dort tippst du mich an, und ich erkläre dir Schritt für Schritt, wie das Werkzeug funktioniert. Dabei markiere ich auf der Seite, was gemeint ist, und beantworte deine Fragen. Du kannst mich auch verschieben, wenn ich im Weg bin.</p>' +
      '<p>Hier auf der Startseite überlasse ich Lilibär das Feld. Bis gleich in den Werkzeugen!</p>' +
      '<button type="button">Danke, Pinni!</button>';
    gast.root.appendChild(b); gast.bubble = b;
    var bw = b.offsetWidth, bh = b.offsetHeight, left = Math.max(12, Math.min(vw() - bw - 12, gast.tx + gast.W / 2 - bw / 2)), top = gast.ty - bh - 12;
    if (top < 8) top = Math.min(vh() - bh - 8, gast.ty + gast.H + 12);
    b.style.left = left + 'px'; b.style.top = Math.max(8, top) + 'px';
    var btn = b.querySelector('button'); btn.addEventListener('click', pinniGeht); try { btn.focus({ preventScroll: true }); } catch (e) {}
    gast.fig.classList.add('lieb'); setTimeout(function () { if (gast) gast.fig.classList.remove('lieb'); }, 2200);
  }
  function pinniGeht() {
    if (!gast) return; var g = gast;
    if (g.bubble && g.bubble.parentNode) g.bubble.parentNode.removeChild(g.bubble);
    g.fig.classList.add('lb-flug'); g.fig.style.left = (vw() + 90) + 'px'; g.fig.style.top = (g.ty - 120) + 'px';
    setTimeout(function () { if (g.root.parentNode) g.root.parentNode.removeChild(g.root); if (gast === g) gast = null; if (g.done) g.done(); }, reduced() ? 40 : 1000);
  }

  // ------------------------------------------------------------------ Vorstellung
  function fertig() { store('l', 'set', KEY, '1'); }
  var VOR = [
    { m: 'excited', h: '<b>Hallo und herzlich willkommen!</b> Ich bin Lilibär, das Maskottchen unseres Lily-Braun-Gymnasiums. Schön, dass du hier bist.' },
    { m: 'love', h: 'Ich bin hier auf der Startseite zu Hause. Ich muntere dich auf, erzähle dir einen Witz, wenn du magst, erkläre dir die Werkzeuge und weiß einiges über unsere Schule. Tippe mich einfach an.' },
    { m: 'happy', h: 'Und jetzt möchte ich dir jemanden vorstellen, der dir in den Werkzeugen zur Seite steht.', btn: 'Pinni hereinrufen', pinni: true },
    { m: 'excited', h: 'Das war Pinni! Sie hilft dir in jedem Werkzeug. Ich bleibe hier und passe auf die Zettel auf. Möchtest du mich später etwas fragen, tippe mich einfach an.', btn: 'Los geht’s!' }
  ];
  L.vorstellung = function (i) {
    i = i || 0; var s = VOR[i], last = i === VOR.length - 1;
    Kolbi.guide({ endLabel: 'Vorstellung beenden', html: s.h, btn: s.btn || 'Weiter', mood: s.m,
      onGo: function () {
        if (s.pinni) { Kolbi.guideEnd(); pinniAuftritt(function () { L.vorstellung(i + 1); }); }
        else if (last) { Kolbi.guideEnd(); Kolbi.mood('excited', 2200); fertig(); }
        else L.vorstellung(i + 1);
      },
      onEnd: function () { Kolbi.guideEnd(); fertig(); } });
  };
  L.pinniTreffen = function () { Kolbi.hush(); pinniAuftritt(function () { say(X() + p('Pinni ist wieder unterwegs. In jedem Werkzeug findest du sie.') + back(), 'happy', 5000); }); };

  // ------------------------------------------------------------------ Start
  function gruss() {
    var d = new Date(), h = d.getHours(), wt = d.getDay(), t;
    var tag = h < 5 ? 'Noch so spät wach?' : h < 11 ? 'Guten Morgen!' : h < 17 ? 'Guten Tag!' : 'Guten Abend!';
    if (wt === 0 || wt === 6) t = 'Schön, dass du auch am Wochenende hereinschaust. Gönn dir bitte trotzdem Pausen.';
    else if (wt === 1) t = 'Ein neuer Wochenanfang. Du musst nicht alles heute schaffen.';
    else if (wt === 5) t = 'Fast geschafft: Das Wochenende ist in Sicht.';
    else t = rnd(['Schön, dass du da bist.', 'Ich freue mich, dich zu sehen.', 'Schau dich in Ruhe um.']);
    say(X() + p('<b>' + tag + '</b> ' + t) + opt('menu', 'Menü öffnen', '#2a9d8f'), h < 5 ? 'yawn' : 'happy', 9000);
  }
  L.init = function (o) {
    o = o || {};
    Kolbi.init({
      id: 'lilibaer', skin: window.KolbiSkins.lilibaer, color: '#2a9d8f', offsetBottom: o.offsetBottom == null ? 56 : o.offsetBottom,
      intro: false, canTalk: function () { return true; }, tapHelp: function () { return null; }, comments: KURZ
    });
    Kolbi.help = menu;
    var root = document.getElementById('kolbi-bubble');
    if (root) root.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-nb]'); if (!t) return; var k = t.getAttribute('data-nb');
      if (k === 'menu') menu(); else if (k === 'werkzeuge') werkzeuge(); else if (k === 'mut') mut(); else if (k === 'witz') witz(); else if (k === 'pointe') aufloesen();
      else if (k === 'schule') schule(); else if (k === 'checkin') checkin(); else if (k === 'vorstellung') L.vorstellung(0);
      else if (k.indexOf('ci-') === 0) checkinReply(k.slice(3));
      else if (k === 'close') Kolbi.hush();
    });
    var seen = store('l', 'get', KEY);
    if (!seen) setTimeout(function () { L.vorstellung(0); }, 1600);
    else if (!store('s', 'get', GRUSS)) { store('s', 'set', GRUSS, '1'); setTimeout(function () { if (!busy()) gruss(); }, 1600); }
  };
  L._pinni = pinniAuftritt;      // nur zum Testen
  if (document.body && document.body.getAttribute('data-fach') === 'start') L.init();
})();
