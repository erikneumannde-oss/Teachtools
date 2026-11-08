/* Logik der Briefe: aus den Eingaben werden Adresszeilen, Anrede und Textzeilen (ohne Oberfläche, auch in Node nutzbar) */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Letter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/g, ' ').trim();

    // Aus einer Liste „A, B, C“ wird „A, B und C“
    function splitList(text) {
        return String(text || '').split(/[,;]+/).map(clean).filter(Boolean);
    }
    function joinUnd(list) {
        if (list.length <= 1) return list.join('');
        return list.slice(0, -1).join(', ') + ' und ' + list[list.length - 1];
    }

    const pad = n => String(n).padStart(2, '0');
    function dateText(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }

    // Eine Person: { sex: 'f' | 'm' | 'n', title, first, last }
    function personName(p) {
        const t = clean(p.title), f = clean(p.first), l = clean(p.last);
        const core = [t, f, l].filter(Boolean).join(' ');
        if (p.sex === 'f') return 'Frau ' + core;
        if (p.sex === 'm') return 'Herr ' + core;
        return core;
    }
    // Für die Anrede nur Titel und Nachname
    function personShort(p) {
        const core = [clean(p.title), clean(p.last)].filter(Boolean).join(' ');
        if (p.sex === 'f') return 'Frau ' + core;
        if (p.sex === 'm') return 'Herr ' + core;
        return [clean(p.title), clean(p.first), clean(p.last)].filter(Boolean).join(' ');
    }
    function personGreeting(p) {
        if (p.sex === 'f') return 'Sehr geehrte ' + personShort(p);
        if (p.sex === 'm') return 'Sehr geehrter ' + personShort(p);
        return 'Guten Tag ' + personShort(p);
    }
    const personOk = p => !!(clean(p.last) && (p.sex === 'n' ? clean(p.first) : true));

    /*
      form = {
        kind: 'eltern' | 'sonstig',
        eltern: { art: 'klasse' | 'jahrgang', wert },
        sonstig: { typ: 'einzel' | 'zwei' | 'familie' | 'institution', persons: [p1, p2], familie, institution,
                   strasse, plz, ort, anrede: 'neutral' | 'adresse' },
        names: 'A, B', kuerzel: 'X, Y', subject, text
      }
    */
    function missing(form) {
        const m = [];
        if (form.kind === 'eltern') {
            if (!clean(form.eltern.wert)) m.push(form.eltern.art === 'jahrgang' ? 'Jahrgangsstufe' : 'Klasse');
        } else {
            const s = form.sonstig;
            if (s.typ === 'einzel' && !personOk(s.persons[0])) m.push('Name der Person');
            if (s.typ === 'zwei' && !(personOk(s.persons[0]) && personOk(s.persons[1]))) m.push('Namen der beiden Personen');
            if (s.typ === 'familie' && !clean(s.familie)) m.push('Familienname');
            if (s.typ === 'institution' && !clean(s.institution)) m.push('Name der Institution');
        }
        if (!splitList(form.names).length) m.push('Ihr Name');
        if (!splitList(form.kuerzel).length) m.push('Kürzel');
        if (!clean(form.subject)) m.push('Betreff');
        if (!String(form.text || '').trim()) m.push('Text');
        return m;
    }

    function build(form, now) {
        let address = [], salutation = '';
        if (form.kind === 'eltern') {
            const w = clean(form.eltern.wert);
            if (form.eltern.art === 'jahrgang') {
                address = ['An die Eltern und Erziehungsberechtigten der Jahrgangsstufe ' + w];
                salutation = 'Sehr geehrte Eltern und Erziehungsberechtigte des Jahrgangs ' + w + ',';
            } else {
                address = ['An die Eltern und Erziehungsberechtigten der Klasse ' + w];
                salutation = 'Sehr geehrte Eltern und Erziehungsberechtigte der Klasse ' + w + ',';
            }
        } else {
            const s = form.sonstig;
            let greet = 'Sehr geehrte Damen und Herren,';
            if (s.typ === 'einzel') {
                const p = s.persons[0];
                address = [personName(p)];
                greet = personGreeting(p) + ',';
            } else if (s.typ === 'zwei') {
                const a = s.persons[0], b = s.persons[1];
                address = [personName(a), personName(b)];
                if (a.sex === 'n' || b.sex === 'n') greet = 'Guten Tag ' + personShort(a) + ' und ' + personShort(b) + ',';
                else greet = personGreeting(a) + ', ' + personGreeting(b).replace(/^Sehr/, 'sehr') + ',';
            } else if (s.typ === 'familie') {
                address = ['Familie ' + clean(s.familie)];
                greet = 'Sehr geehrte Familie ' + clean(s.familie) + ',';
            } else {
                address = [clean(s.institution)];
            }
            if (clean(s.strasse)) address.push(clean(s.strasse));
            const ortzeile = [clean(s.plz), clean(s.ort)].filter(Boolean).join(' ');
            if (ortzeile) address.push(ortzeile);
            salutation = s.anrede === 'adresse' ? greet : 'Sehr geehrte Damen und Herren,';
        }
        const text = String(form.text || '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+$/, '');
        return {
            address: address,
            salutation: salutation,
            subject: clean(form.subject),
            lines: text.split('\n').map(l => l.replace(/\s+$/, '')),
            names: joinUnd(splitList(form.names)),
            kuerzel: joinUnd(splitList(form.kuerzel)),
            date: dateText(now || new Date())
        };
    }

    return { splitList: splitList, joinUnd: joinUnd, dateText: dateText, build: build, missing: missing, clean: clean };
});
