/* Lilibär – das Bären-Maskottchen des Lily-Braun-Gymnasiums (Skin für die Kolbi-Engine, wie Hugo)
   Idee: Dr. Benjamin Janzen. Umsetzung: Erik Neumann mit Hilfe von Claude. */
(function () {
  'use strict';
  var FUR = '#a16028', FUR_D = '#8a4f20', LIGHT = '#efceab', INK = '#2c0b04', DARK = '#4e281d', MOUTH = '#6b1d2a', TEAL = '#5cb7b2', TEAL_D = '#3f9f9a';
  // Die Figur ist in Bildkoordinaten (Vorlage) gezeichnet und wird auf die 106er-Breite der Engine skaliert.
  var T = 'scale(0.2944) translate(-312 -62)';

  // ------------------------------------------------------------------ Gesicht
  function dot(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + INK + '" stroke="none"/><circle cx="' + (cx + r * .32).toFixed(1) + '" cy="' + (cy - r * .34).toFixed(1) + '" r="' + (r * .34).toFixed(1) + '" fill="#fff" stroke="none"/>';
  }
  function lids(a, b) { return '<g class="k-lid">' + a + b + '</g>'; }
  var HEART = 'M41 80 c-8 -5 -8 -12 -2.5 -12 c2.3 0 2.5 2 2.5 3 c0 -1 .2 -3 2.5 -3 c5.5 0 5.5 7 -2.5 12z';
  function heart(x) { return '<path transform="translate(' + x + ' 214) scale(3.2) translate(-41 -80)" d="' + HEART + '" fill="#ff4d6d" stroke="none"/>'; }
  var ARC_UP_R = '<path d="M554 205 q19 -26 38 0"/>';

  var EYES = {
    o:      lids(dot(451, 197, 17.5), dot(573, 197, 17.5)),
    big:    lids(dot(451, 197, 19.5), dot(573, 197, 19.5)),
    wide:   lids(dot(451, 197, 21), dot(573, 197, 21)),
    small:  '<g class="k-lid"><circle cx="451" cy="199" r="13" fill="' + INK + '" stroke="none"/><circle cx="573" cy="199" r="13" fill="' + INK + '" stroke="none"/></g>',
    side:   lids(dot(459, 191, 16.5), dot(581, 191, 16.5)),
    inter:  lids(dot(454, 195, 18.5), dot(576, 195, 18.5)),
    half:   '<path d="M432 202 a19 19 0 0 0 38 0 z" fill="' + INK + '" stroke="none"/><path d="M554 202 a19 19 0 0 0 38 0 z" fill="' + INK + '" stroke="none"/><path d="M429 202 h44"/><path d="M551 202 h44"/>',
    closed: '<path d="M432 197 q19 14 38 0"/><path d="M554 197 q19 14 38 0"/>',
    happy:  '<path d="M432 205 q19 -26 38 0"/>' + ARC_UP_R,
    wink:   lids(dot(451, 197, 17.5), '') + ARC_UP_R,
    x:      '<path d="M436 181 l30 30 M466 181 l-30 30"/><path d="M558 181 l30 30 M588 181 l-30 30"/>',
    heart:  heart(451) + heart(573)
  };

  var SMILE = 'M487 229 Q490 246 512 237 Q534 246 537 229';
  var OPEN = '<path d="M489 231 Q512 270 535 231 Z" fill="' + MOUTH + '"/><path d="M501 253 Q512 263 523 253 Q512 246 501 253 Z" fill="#ff7a8a" stroke="none"/>';
  var ARM_L = 'M424 336 Q372 352 352 284';
  var ARM_R_FORM = 'M590 286 C628 286 654 312 658 352 C662 390 650 421 628 421 C608 421 599 407 599 388 C599 360 598 328 590 304 Z';
  var ARM_R_SHADE = 'M594 308 C600 330 600 360 600 388 C600 402 607 414 617 418 C611 396 614 352 603 318 Z';
  var SCARF_BAND = '<path d="M421 274 Q467 292 512 291 Q560 291 603 275 L606 293 Q565 322 515 326 Q462 322 422 294 Z" fill="' + TEAL + '"/>' +
      '<path d="M423 280 Q445 292 470 302 L466 297 Q444 288 423 276 Z" fill="' + TEAL_D + '"/><path d="M588 282 Q598 287 606 288 L604 279 Z" fill="' + TEAL_D + '"/>';
  var SCARF_END = '<g id="lb-scarf"><path d="M542 296 L592 296 L593 385 Q593 389 589 389 L548 389 Q545 389 545 385 Z" fill="' + TEAL + '"/>' +
      '<path d="M543 316 L592 313 L592 328 L544 332 Z" fill="' + TEAL_D + '"/></g>';
  function armR(r) {
    if (r) return '<g class="lb-armr"><g id="lb-armr" data-up="1"><path d="' + r + '" fill="none" stroke="' + FUR + '" stroke-width="50" stroke-linecap="round"/></g></g>';
    return '<g class="lb-armr"><g id="lb-armr" data-up="0"><circle cx="598" cy="306" r="22" fill="' + FUR + '" stroke="none"/>' +
      '<path d="' + ARM_R_FORM + '" fill="' + FUR + '" stroke="none"/><path d="' + ARM_R_SHADE + '" fill="' + FUR_D + '" stroke="none"/></g></g>';
  }


  var M = {
    happy:      { e: 'o', m: SMILE },
    excited:    { e: 'big', m: OPEN, l: 'M424 336 Q366 326 352 262', r: 'M608 334 Q662 326 674 262',
                  ex: '<text x="654" y="190" font-size="44" font-weight="800" fill="#ffd35a" stroke="none">!</text>' },
    interested: { e: 'inter', m: '<ellipse cx="512" cy="244" rx="8" ry="9" fill="' + DARK + '"/>', br: '<path d="M428 160 q22 -16 44 -4"/><path d="M552 156 q22 -12 44 4"/>' },
    thinking:   { e: 'side', m: 'M497 244 Q512 236 530 244',
                  ex: '<text x="654" y="190" font-size="50" font-weight="800" fill="#ffd35a" stroke="none">?</text>' },
    bored:      { e: 'half', m: 'M494 243 q6 -6 12 0 t12 0 t12 0' },
    yawn:       { e: 'closed', m: '<ellipse cx="512" cy="250" rx="14" ry="17" fill="' + MOUTH + '"/>' },
    sleep:      { e: 'closed', m: 'M498 238 Q512 248 526 238',
                  ex: '<g class="k-zzz" font-weight="800" fill="#cbd5f5" stroke="none"><text x="652" y="225" font-size="36">z</text><text x="668" y="190" font-size="48">Z</text></g>' },
    wink:       { e: 'wink', m: SMILE, r: 'M608 334 Q656 350 674 284' },
    giggle:     { e: 'happy', m: OPEN, r: 'M608 334 Q656 350 674 284' },
    dizzy:      { e: 'x', m: 'M492 243 q7 -8 14 0 q7 8 14 0',
                  ex: '<g class="k-zzz" fill="#ffd35a" stroke="none"><circle cx="420" cy="52" r="7"/><circle cx="512" cy="36" r="7"/><circle cx="600" cy="52" r="7"/></g>' },
    surprised:  { e: 'wide', m: '<ellipse cx="512" cy="247" rx="9" ry="12" fill="' + MOUTH + '"/>', br: '<path d="M428 156 q22 -20 44 -4"/><path d="M552 152 q22 -16 44 4"/>' },
    love:       { e: 'heart', m: SMILE,
                  ex: '<g class="k-zzz" fill="#ff8fa8" stroke="none" font-weight="800"><text x="654" y="200" font-size="40">♥</text><text x="318" y="170" font-size="30">♥</text></g>' },
    hum:        { e: 'o', m: 'M494 236 Q512 254 530 236',
                  ex: '<g class="k-zzz" fill="#cbd5f5" stroke="none" font-weight="800"><text x="654" y="205" font-size="44">♪</text></g>' },
    caring:     { e: 'big', m: SMILE, br: '<path d="M428 168 q22 -2 44 -16"/><path d="M552 152 q22 14 44 16"/>',
                  ex: '<g class="k-zzz" fill="#ff8fa8" stroke="none" font-weight="800"><text x="654" y="200" font-size="34">♥</text></g>' },
    sad:        { e: 'o', m: 'M492 249 Q512 236 532 249', br: '<path d="M428 168 q22 -2 44 -16"/><path d="M552 152 q22 14 44 16"/>' },
    oops:       { e: 'small', m: 'M492 245 q7 -9 14 0 q7 9 14 0', br: '<path d="M430 162 l38 10"/><path d="M594 162 l-38 10"/>',
                  ex: '<path d="M655 180 q13 22 0 30 q-13 -8 0 -30z" fill="#7fd0ff" stroke="none"/>' }
  };

  function arm(cls, d) { return '<path class="k-arm ' + cls + '" d="' + d + '"/>'; }
  function endOf(d) { var m = /([\d.]+) ([\d.]+)$/.exec(d); return [+m[1], +m[2]]; }
  function quill(dl) {
    var e = endOf(dl), dx = e[0] - 352, dy = e[1] - 284;
    return '<g transform="translate(' + dx + ' ' + dy + ')"><g id="lb-quill" data-x="352" data-y="284">' +
      '<g transform="translate(322 324) rotate(36)">' +
      '<path d="M0 -45 C -20 -62 -22 -112 2 -154 C 24 -112 24 -66 0 -45 Z" fill="#f7ecd0" stroke="#e2cfa6" stroke-width="2.5"/>' +
      '<line x1="0" y1="0" x2="1" y2="-150" stroke="#d6c196" stroke-width="4" stroke-linecap="round"/></g>' +
      '<circle cx="344" cy="289" r="15" fill="' + FUR + '" stroke="none"/></g></g>';
  }
  function face(m) {
    var d = M[m] || M.happy, dl = d.l || ARM_L;
    var inner =
      '<g fill="none" stroke="' + FUR + '" stroke-width="50" stroke-linecap="round">' + arm('k-arml', dl) + '</g>' + armR(d.r) + SCARF_END + SCARF_BAND +
      quill(dl) +
      '<g fill="none" stroke="' + DARK + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' + (d.br || '') + '</g>' +
      '<g class="k-mouth" fill="none" stroke="' + DARK + '" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">' + (d.m.charAt(0) === 'M' ? '<path d="' + d.m + '"/>' : d.m) + '</g>' +
      '<ellipse cx="433" cy="227" rx="18" ry="10.5" fill="#dd8267" opacity=".95"/><ellipse cx="591" cy="227" rx="18" ry="10.5" fill="#dd8267" opacity=".95"/>' + (d.ex || '');
    return '<g transform="' + T + '">' + inner + '</g>' +
      '<g id="kolbi-eyes" fill="none" stroke="' + INK + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><g transform="' + T + '">' + EYES[d.e] + '</g></g>';
  }

  // ------------------------------------------------------------------ Figur
  function lily() {
    var p = '', ang = [-64, -110, 176, 128, 58], i;
    for (i = 0; i < ang.length; i++) p += '<path transform="rotate(' + ang[i] + ')" d="M0 0 C -10 -14 -11 -34 0 -46 C 11 -34 10 -14 0 0 Z"/>';
    var pts = [[-14, -17], [-6, -21], [2, -23], [9, -18], [12, -10]], st = '', dots = '';
    pts.forEach(function (q) { st += 'M0 -2 L' + q[0] + ' ' + q[1] + ' '; dots += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3.2"/>'; });
    return '<g id="lb-lily"><g transform="translate(588 112) scale(.98)"><g fill="#f8f3df" stroke="#e0d8b8" stroke-width="1.8" stroke-linejoin="round">' + p + '</g>' +
      '<path d="' + st + '" fill="none" stroke="#b8b36a" stroke-width="1.6"/><g fill="#e6b23c">' + dots + '</g></g></g>';
  }
  function art() {
    return '' +
      // Körper mit Beinen
      '<path d="M428 290 C408 340 406 400 414 455 L420 495 Q422 514 446 514 L486 514 Q498 514 498 500 L498 478 Q512 483 527 478 L527 500 Q527 514 540 514 L584 514 Q601 514 601 498 L606 455 C614 400 616 340 598 290 Z" fill="' + FUR + '"/>' +
      '<path d="M468 446 Q485 452 498 470 L498 479 Q478 470 466 452 Z" fill="' + FUR_D + '"/><path d="M556 446 Q540 452 527 470 L527 479 Q546 470 558 452 Z" fill="' + FUR_D + '"/>' +
      '<ellipse cx="511" cy="383" rx="69" ry="64" fill="' + LIGHT + '"/>' +
      '<ellipse cx="455" cy="507" rx="21" ry="8.5" fill="' + LIGHT + '"/><ellipse cx="571" cy="507" rx="21" ry="8.5" fill="' + LIGHT + '"/>' +
      // Ohren
      '<circle cx="406" cy="110" r="39" fill="' + FUR + '"/><circle cx="410" cy="112" r="23" fill="#f1cfa9"/>' +
      '<circle cx="621" cy="110" r="39" fill="' + FUR + '"/><circle cx="625" cy="112" r="23" fill="#f1cfa9"/>' +
      // Kopf, Schnauze, Nase
      '<path d="M388 200 C388 120 440 82 512 82 C584 82 640 120 640 200 C640 255 590 296 512 296 C436 296 388 255 388 200 Z" fill="' + FUR + '"/>' +
      '<ellipse cx="512" cy="234" rx="45" ry="41.5" fill="' + LIGHT + '"/>' +
      '<path d="M495 211 q0 -6 8 -6 h18 q8 0 8 6 q0 10 -17 14 q-17 -4 -17 -14z" fill="' + DARK + '"/>' +
      // Schal
      SCARF_BAND +
      lily();
  }
  function svg() {
    return '<svg viewBox="0 0 106 135" role="img" aria-label="Lilibär, das Bären-Maskottchen des Lily-Braun-Gymnasiums">' +
      '<g transform="' + T + '">' + art() + '</g><g id="kk-face">' + face('happy') + '</g></svg>';
  }
  var S = { root: null, last: null, l: 0, s: 0, q: 0, wl: 99, ws: 99, wq: 99, eL: null, eS: null, eQ: null, eA: null, a: null, wa: 99 };
  function setRot(e, a, cx, cy) { e.setAttribute('transform', 'rotate(' + a.toFixed(1) + ' ' + cx + ' ' + cy + ')'); }
  function phys(el, ph, tn, amp) {
    if (S.root !== el.root) { S.root = el.root; S.last = null; S.l = S.s = S.q = 0; S.wl = S.ws = S.wq = 99; S.eL = S.eS = S.eQ = S.eA = null; S.a = null; }
    if (!S.eL || !S.eL.isConnected) S.eL = el.root.querySelector('#lb-lily');
    if (!S.eS || !S.eS.isConnected) S.eS = el.root.querySelector('#lb-scarf');
    if (!S.eQ || !S.eQ.isConnected) { S.eQ = el.root.querySelector('#lb-quill'); S.wq = 99; }
    if (!S.eA || !S.eA.isConnected) { S.eA = el.root.querySelector('#lb-armr'); S.wa = 99; S.a = null; }
    var dt = S.last === null ? 0.016 : Math.min(0.05, Math.max(0.001, ph.t - S.last)); S.last = ph.t;
    var k = Math.min(1, dt * 6);   // weiches Nachziehen statt Ruckeln
    S.l += (tn * 22 + Math.sin(ph.t * 1.6) * 4 - S.l) * k;
    S.s += (-tn * 14 + Math.sin(ph.t * 2.2) * 3 - S.s) * k;
    S.q += (tn * 12 + Math.sin(ph.t * 3) * 5 - S.q) * k;
    if (S.eA) {
      var up = S.eA.getAttribute('data-up') === '1', talk = el.char && el.char.classList.contains('talk');
      var ta = up ? (talk ? Math.sin(ph.t * 8) * 10 : Math.sin(ph.t * 2) * 3) : (talk ? -4 - Math.sin(ph.t * 8) * 4 : 0);
      if (S.a === null) S.a = ta;
      S.a += (ta - S.a) * Math.min(1, dt * 10);
      if (Math.abs(S.a - S.wa) > 0.3) { S.wa = S.a; setRot(S.eA, S.a, up ? 608 : 598, up ? 334 : 304); }
    }
    if (S.eL && Math.abs(S.l - S.wl) > 0.25) { S.wl = S.l; setRot(S.eL, S.l, 588, 112); }
    if (S.eS && Math.abs(S.s - S.ws) > 0.25) { S.ws = S.s; setRot(S.eS, S.s, 566, 300); }
    if (S.eQ && Math.abs(S.q - S.wq) > 0.25) { S.wq = S.q; setRot(S.eQ, S.q, 352, 284); }
  }

  window.KolbiSkins = window.KolbiSkins || {};
  window.KolbiSkins.lilibaer = {
    name: 'Lilibär', emoji: '🐻', key: 'lilibaer', size: { w: 74, h: 94, wm: 59, hm: 75 },
    svg: svg, face: face, phys: phys,
    t: {
      jokeLead: 'Unlustiger Bären-Witz: ',
      intro: ['Hallo! Ich bin Lilibär 🐻', 'Ich bin das Maskottchen des Lily-Braun-Gymnasiums. Ich erzähle ab und zu etwas, gebe Denkanstöße und helfe, wenn du magst.'],
      NICE: [
        'Du machst das richtig gut. Weiter so!',
        'Schön, dass du dir Zeit nimmst. So lernt man am meisten.',
        'Du denkst richtig mit. Das gefällt mir!',
        'Ich bin stolz auf dich. Und ich bin nur ein Bär!',
        'Falls du es noch nicht gehört hast: Du kannst mehr, als du denkst.'
      ],
      MOTIVATION: [
        'Fehler gehören zum Lernen dazu. Selbst ein Bär fällt mal vom Baum.',
        'Schritt für Schritt kommst du ans Ziel, auch über den größten Berg.',
        'Wer nachfragt, lernt mehr. Fragen sind keine Schwäche.',
        'Ein bisschen Geduld, dann ergibt sich vieles von selbst.',
        'Auch große Gedanken haben mal ganz klein angefangen.'
      ],
      JOKES: [
        ['Was ist ein Bär ohne Zähne?', 'Ein Gummibär.'],
        ['Was ist die Lieblingsstadt von Bären?', 'Berlin. Da sind sie sogar im Wappen.'],
        ['Wie nennt man einen Bären, der nie die Hausaufgaben vergisst?', 'Merk-Bär.'],
        ['Warum ist Lilibär immer gut vorbereitet?', 'Er hat die Feder schon in der Pfote.'],
        ['Was ist braun, flauschig und argumentiert richtig gut?', 'Ein Debattier-Bär.']
      ],
      FACTS: [
        'Wusstest du? Der Bär ist das Wappentier von Berlin. Ich bin also quasi ein Einheimischer.',
        'Wusstest du? Lily Braun lebte von 1865 bis 1916. Sie war Schriftstellerin und Frauenrechtlerin, und nach ihr heißt unsere Schule.',
        'Wusstest du? Lily Braun schrieb die „Memoiren einer Sozialistin“, ein Buch über ihr eigenes Leben.',
        'Wusstest du? Die Feder in meiner Pfote erinnert an Lily Braun: Sie hat sehr viel geschrieben.',
        'Wusstest du? Die Lilie an meinem Ohr ist ein kleines Wortspiel mit ihrem Vornamen.'
      ],
      GENERIC: [
        'Magst du mich mit dem Finger ein Stück schieben? Ich lasse mich gern tragen.',
        'Neugier ist die halbe Miete.',
        'Tipp: Lies Aufgaben lieber einmal mehr als einmal zu wenig.',
        'Probier ruhig aus. Hier geht nichts kaputt!'
      ],
      TICKLE: ['Hihi, das kitzelt im Fell! 😄', 'Hihihi! Stopp, ich muss lachen!', 'Kitzeln verboten! … na gut, ein bisschen ist okay.'],
      DIZZY: ['Uff, mir wird ganz schwindelig!', 'Huch, ich bin doch kein Tanzbär!', 'Langsam bitte, mir steht das Fell zu Berge!'],
      BREAK: ['Du arbeitest schon eine Weile. Trink einen Schluck Wasser und streck dich kurz! 💧', 'Kleine Pause gefällig? Danach geht es mit frischem Kopf weiter.'],
      BORED: ['Ähm … hallo? Ist da jemand?', 'Ich zähle mal meine Pfoten. Eins, zwei, drei, vier. Stimmt!', 'Ist gerade Pause? Dann schreibe ich schnell etwas mit meiner Feder auf.', '*gähn* Ich hätte jetzt Lust auf ein bisschen Lernen.'],
      CHECKIN: ['Kurze Zwischenfrage von deinem Bären: Wie geht es dir gerade?', 'Na, wie fühlst du dich beim Lernen?', 'Hand aufs Fell: Wie läuft es bei dir?'],
      CHECK_EMP: ['Oh …', 'Ach, das tut mir leid …', 'Oje, da brummt mir der Bauch mit …'],
      CHECK_REPLY: {
        good: ['Das freut mich! Ich mache innerlich einen Purzelbaum. 🎉', 'Super! Dann machen wir weiter.'],
        ok: ['Das kenne ich. Manchmal braucht man einen Anlauf. Schritt für Schritt klappt es.', 'Okay. Mach in Ruhe weiter. Wenn du hängst, tippe mich an.'],
        tired: ['Dann gönn dir eine kurze Pause: Schultern lockern, einen Schluck trinken, kurz aus dem Fenster schauen. Danach geht es oft besser.', 'Verständlich. Sogar Bären machen manchmal Pause.'],
        hard: ['Das ist völlig okay. Schwierige Aufgaben gehören dazu, und du musst nicht alles sofort können.']
      },
      WAKE: ['Oh! Ich bin kurz eingenickt. Schön, dass du wieder da bist!', 'Huch, da bist du ja wieder! Ich habe nur ein kleines Nickerchen gehalten.']
    }
  };
})();
