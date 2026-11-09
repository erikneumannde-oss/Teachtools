/* Rechenlogik des Notenrechners (ohne Oberfläche, im Browser und in Node nutzbar) */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.NR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ---------- Noten und Punkte ---------- */

    // Umrechnung Note mit Tendenz -> Oberstufenpunkte (intern)
    const PTS = {
        '1+': 15, '1': 14, '1-': 13, '2+': 12, '2': 11, '2-': 10, '3+': 9, '3': 8, '3-': 7,
        '4+': 6, '4': 5, '4-': 4, '5+': 3, '5': 2, '5-': 1, '6': 0
    };
    const NOTE_OF_POINTS = ['6', '5-', '5', '5+', '4-', '4', '4+', '3-', '3', '3+', '2-', '2', '2+', '1-', '1', '1+'];
    const TEND = ['1+', '1', '1-', '2+', '2', '2-', '3+', '3', '3-', '4+', '4', '4-', '5+', '5', '5-', '6'];
    const PLAIN = ['1', '2', '3', '4', '5', '6'];

    function pointsToNote(p) { return NOTE_OF_POINTS[p]; }

    // Stufe der ganzen Note (1 bis 6) zu einer Punktzahl
    function noteLevel(p) { return p >= 13 ? 1 : p >= 10 ? 2 : p >= 7 ? 3 : p >= 4 ? 4 : p >= 1 ? 5 : 6; }

    // Durchschnitt in Punkten -> Dezimalnote
    function noteDecimalFromPoints(P) { return P >= 1 ? (17 - P) / 3 : 6 - (2 / 3) * P; }

    // Prüft und vereinheitlicht eine Eingabe. '' = leer, null = ungültig.
    function normalizeGrade(mode, input) {
        const s = String(input == null ? '' : input).trim().replace(/[−–—‐‑]/g, '-');
        if (s === '') return '';
        if (mode === 'tend') {
            const m = /^([1-6])\s*([+-])?$/.exec(s);
            if (!m) return null;
            return m[1] === '6' ? '6' : m[1] + (m[2] || '');
        }
        if (mode === 'plain') {
            const m = /^([1-6])\s*[+-]?$/.exec(s);
            return m ? m[1] : null;
        }
        if (mode === 'points') {
            if (!/^\d{1,2}$/.test(s)) return null;
            const n = parseInt(s, 10);
            return n >= 0 && n <= 15 ? String(n) : null;
        }
        return null;
    }

    /* ---------- Rundung ---------- */

    // Rechnerische Note: ab x,5 zählt die schlechtere Note. Beratung: Ziel ist ein Durchschnitt bis x,44.
    const ROUND_LIMIT = 0.5;
    const ADVICE_LIMIT = 0.45;

    // Ganze Note aus einem Durchschnitt: ab (n + grenze) zählt die schlechtere Note
    function gradeFromAvg(avg, grenze) {
        return Math.max(1, Math.min(6, Math.floor(avg + (1 - grenze) + 1e-9)));
    }

    /* ---------- Sek I ---------- */

    function sek1Mode(group) { return group.tendency ? 'tend' : 'plain'; }

    function gradeValue(group, str) {
        return group.tendency ? PTS[str] : parseInt(str, 10);
    }

    function scaleToNote(group, v) {
        return group.tendency ? Math.max(1, noteDecimalFromPoints(v)) : v;
    }

    // Mittelwert (in Punkten bzw. Noten) und Anzahl der Noten einer Spalte ohne Unterkategorien
    function leafStats(group, student, leaf, extra) {
        const raw = (student.grades && student.grades[leaf.id]) || [];
        const vals = [];
        raw.forEach(g => { if (g) vals.push(gradeValue(group, g)); });
        if (extra && extra.catId === leaf.id) vals.push(gradeValue(group, extra.grade));
        const n = vals.length;
        return { n: n, mean: n ? vals.reduce((a, b) => a + b, 0) / n : null };
    }

    // Gewichteter Mittelwert; ohne positive Gewichte wird gleichmäßig gemittelt
    function weightedMean(items) {
        let wsum = 0, acc = 0;
        items.forEach(c => { if (c.mean != null && c.weight > 0) { wsum += c.weight; acc += c.weight * c.mean; } });
        if (wsum > 0) return acc / wsum;
        const present = items.filter(c => c.mean != null);
        return present.length ? present.reduce((a, c) => a + c.mean, 0) / present.length : null;
    }

    function entry(group, c, stats, subs) {
        return {
            id: c.id, name: c.name, weight: c.weight, n: stats.n, mean: stats.mean,
            note: stats.mean == null ? null : scaleToNote(group, stats.mean), subs: subs || []
        };
    }

    // extra: { catId, grade } = zusätzliche (gedachte) Note in einer Spalte (Hauptkategorie ohne Unterkategorien oder Unterkategorie)
    function calcSek1(group, student, extra) {
        const byId = {};
        const cats = group.categories.map(cat => {
            if (cat.subs && cat.subs.length) {
                const subs = cat.subs.map(s => {
                    const e = entry(group, s, leafStats(group, student, s, extra));
                    byId[s.id] = e;
                    return e;
                });
                const e = entry(group, cat, { n: subs.reduce((a, s) => a + s.n, 0), mean: weightedMean(subs) }, subs);
                byId[cat.id] = e;
                return e;
            }
            const e = entry(group, cat, leafStats(group, student, cat, extra));
            byId[cat.id] = e;
            return e;
        });
        const m = weightedMean(cats);
        const total = m == null ? null : scaleToNote(group, m);
        const grade = total == null ? null : gradeFromAvg(total, ROUND_LIMIT);
        // Mit Tendenz: Punktedurchschnitt auf ganze Punkte runden; ab x,5 zählt die schlechtere Note
        let pts = null, tgrade = null;
        if (group.tendency && m != null) {
            pts = Math.max(0, Math.min(15, Math.ceil(m - 0.5 - 1e-9)));
            tgrade = NOTE_OF_POINTS[pts];
        }
        return { cats: cats, byId: byId, total: total, grade: grade, mean: m, pts: pts, tgrade: tgrade };
    }

    // Wählbare Endnoten: rechnerische Note und, falls aufgerundet wurde, die bessere
    function sek1Options(group, calc) {
        if (calc.grade == null) return [];
        if (group.tendency) {
            // Mit Tendenz: rechnerische Tendenz und, falls abgerundet wurde, die nächstbessere
            const opts = [calc.tgrade];
            if (calc.pts < 15 && calc.mean - calc.pts > 1e-9) opts.unshift(NOTE_OF_POINTS[calc.pts + 1]);
            return opts;
        }
        const opts = [calc.grade];
        if (calc.grade > 1 && Math.floor(calc.total + 1e-9) <= calc.grade - 1) opts.unshift(calc.grade - 1);
        return opts;
    }

    function allGrades(group) { return group.tendency ? TEND : PLAIN; }

    // Nach pädagogischem Ermessen überschriebene Note (nur Sek I), sonst null
    function sek1Over(group, student) {
        const v = student.over == null ? null : String(student.over);
        return v != null && allGrades(group).indexOf(v) !== -1 ? v : null;
    }

    function sek1Final(group, student, calc) {
        const over = sek1Over(group, student);
        if (over != null && calc.grade != null) return group.tendency ? over : parseInt(over, 10);
        const opts = sek1Options(group, calc);
        if (!opts.length) return null;
        const chosen = student.final != null ? (group.tendency ? String(student.final) : parseInt(student.final, 10)) : null;
        return chosen != null && opts.indexOf(chosen) !== -1 ? chosen : (group.tendency ? calc.tgrade : calc.grade);
    }

    // Beratung: Welche nächste Note in welcher Kategorie bringt die nächstbessere Note?
    function adviceSek1(group, student) {
        const calc = calcSek1(group, student);
        if (calc.grade == null) return { status: 'empty' };
        if (calc.grade === 1) return { status: 'best', calc: calc };
        const targetGrade = calc.grade - 1;
        const limit = targetGrade + ADVICE_LIMIT;          // Durchschnitt muss darunter liegen
        const maxAvg = Math.round((limit - 0.01) * 100) / 100;
        const cands = group.tendency
            ? TEND.slice().reverse().map(g => g)           // von schlecht (6) nach gut (1+)
            : PLAIN.slice().reverse();
        const leaves = [];
        group.categories.forEach(cat => {
            if (cat.weight <= 0) return;
            if (cat.subs && cat.subs.length) cat.subs.forEach(s => { if (s.weight > 0) leaves.push({ id: s.id, name: cat.name + ' › ' + s.name }); });
            else leaves.push({ id: cat.id, name: cat.name });
        });
        const rows = leaves.map(leaf => {
            for (let i = 0; i < cands.length; i++) {
                const t = calcSek1(group, student, { catId: leaf.id, grade: cands[i] });
                if (t.total != null && t.total < limit - 1e-9) {
                    return { catId: leaf.id, name: leaf.name, needed: cands[i], resultAvg: t.total };
                }
            }
            return { catId: leaf.id, name: leaf.name, needed: null };
        });
        return { status: 'ok', calc: calc, targetGrade: targetGrade, maxAvg: maxAvg, rows: rows };
    }

    /* ---------- Sek II ---------- */

    // Bruchrechnung mit ganzen Zahlen (vermeidet Rundungsfehler bei exakt x,5)
    function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = b; b = a % b; a = t; } return a || 1; }
    function frac(n, d) { const g = gcd(n, d); return { n: n / g, d: d / g }; }

    // Ergebnis der Rundung: { value, half, floor }
    function roundFrac(f, decision) {
        const fl = Math.floor(f.n / f.d);
        const rem = f.n - fl * f.d;
        const twice = 2 * rem;
        const out = { floor: fl, half: false, value: null, exact: f.n / f.d };
        if (twice < f.d) out.value = fl;
        else if (twice > f.d) out.value = fl + 1;
        else {
            out.half = true;
            out.value = decision === 'up' ? fl + 1 : decision === 'down' ? fl : null;
        }
        return out;
    }

    // Tabelle a (1:2): Klausur und allgemeiner Teil
    function tableA(kl, at) { return Math.floor((kl + 2 * at + 1) / 3); }

    // Tabelle b (1:1): Summe der beiden Klausuren und allgemeiner Teil
    const TABLE_B_ZERO = [5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0]; // für AT 15 bis 0, wenn die Klausursumme 0 ist
    function tableB(sum, at) {
        if (sum === 0) return { lo: TABLE_B_ZERO[15 - at], hi: TABLE_B_ZERO[15 - at], tie: false, special: true };
        const n = sum + 2 * at;
        const lo = Math.floor(n / 4), r = n % 4;
        if (r === 2) return { lo: lo, hi: lo + 1, tie: true };
        const v = r < 2 ? lo : lo + 1;
        return { lo: v, hi: v, tie: false };
    }

    // LK im 4. Kurshalbjahr (1:1): eine Klausur und allgemeiner Teil, bei x,5 entscheidet die Lehrkraft
    function table11(kl, at) {
        const n = kl + at, lo = Math.floor(n / 2);
        return n % 2 === 1 ? { lo: lo, hi: lo + 1, tie: true } : { lo: lo, hi: lo, tie: false };
    }

    function listValues(arr) {
        const out = [];
        (arr || []).forEach(g => { if (g !== '' && g != null) out.push(parseInt(g, 10)); });
        return out;
    }

    // Sek II: group.course = 'gk13' | 'gk4' | 'lk13' | 'lk4'; group.atWeights = { m, s }
    // gk13: AT 2/3, Klausur 1/3 · gk4: wie gk13, ohne Klausur zählt der AT zu 100 % · lk13: AT 1/2, zwei Klausuren 1/2 · lk4: AT 1/2, eine Klausur 1/2
    // extra: { cat: 'm'|'s'|'k', grade: n } (gedachte Zusatznote); ties: 'up' = bei x,5 aufrunden
    function calcSek2(group, student, extra, ties) {
        const g = student.grades || {};
        const mv = listValues(g.m), sv = listValues(g.s), kv = listValues(g.k);
        if (extra) ({ m: mv, s: sv, k: kv }[extra.cat]).push(extra.grade);
        const dec = student.dec || {};
        const useUp = ties === 'up';
        const res = { m: mv, s: sv, k: kv, at: null, kl: null, points: null, note: null, pending: [], tieFinal: null, info: '' };

        // Allgemeiner Teil
        const wm = Math.max(0, Math.round(group.atWeights.m)), ws = Math.max(0, Math.round(group.atWeights.s));
        const sumM = mv.reduce((a, b) => a + b, 0), sumS = sv.reduce((a, b) => a + b, 0);
        let atFrac = null;
        if (mv.length && sv.length) {
            if (wm + ws === 0) atFrac = frac(sumM * sv.length + sumS * mv.length, 2 * mv.length * sv.length);
            else atFrac = frac(wm * sumM * sv.length + ws * sumS * mv.length, (wm + ws) * mv.length * sv.length);
        } else if (mv.length) atFrac = frac(sumM, mv.length);
        else if (sv.length) atFrac = frac(sumS, sv.length);
        if (atFrac) {
            res.at = roundFrac(atFrac, useUp ? 'up' : dec.at);
            if (res.at.half && res.at.value == null) res.pending.push('at');
        }

        // Klausurteil
        if (group.course === 'lk13') {
            if (kv.length >= 2) res.kl = { value: kv[0] + kv[1], half: false, sum: true };
            // Mit nur einer Klausur zählt sie vorläufig doppelt
            else if (kv.length === 1) res.kl = { value: 2 * kv[0], half: false, sum: true, provisional: true, single: kv[0] };
        } else if (kv.length) {
            res.kl = roundFrac(frac(kv.reduce((a, b) => a + b, 0), kv.length), useUp ? 'up' : dec.kl);
            if (res.kl.half && res.kl.value == null) res.pending.push('kl');
        }

        // Zeugnispunkte
        if (!kv.length && res.at && res.at.value != null) {
            // Ohne Klausur bildet der allgemeine Teil allein die Note (im 4. Kurshalbjahr im Grundkurs endgültig, sonst vorläufig)
            res.points = res.at.value;
            res.info = group.course === 'gk4' ? 'Ohne Klausur zählt der allgemeine Teil zu 100 Prozent.' : 'Noch keine Klausur: vorläufig zählt der allgemeine Teil allein.';
        } else if (res.at && res.kl && res.at.value != null && res.kl.value != null) {
            if (group.course === 'lk13' || group.course === 'lk4') {
                const t = group.course === 'lk13' ? tableB(res.kl.value, res.at.value) : table11(res.kl.value, res.at.value);
                res.tieFinal = t.tie ? { lo: t.lo, hi: t.hi } : null;
                res.special = !!t.special;
                if (t.tie) {
                    const d = useUp ? 'up' : dec.final;
                    if (d === 'up') res.points = t.hi;
                    else if (d === 'down') res.points = t.lo;
                    else res.pending.push('final');
                } else res.points = t.lo;
            } else {
                res.points = tableA(res.kl.value, res.at.value);
            }
            if (res.points != null) res.note = pointsToNote(res.points);
        }
        return res;
    }

    function adviceSek2(group, student) {
        let base = calcSek2(group, student, null, null);
        let assumed = false;
        // Bei offener x,5-Entscheidung wird für die Beratung aufgerundet
        if (base.points == null && base.pending.length) {
            const up = calcSek2(group, student, null, 'up');
            if (up.points != null) { base = up; assumed = true; }
        }
        if (base.points == null) {
            // Es fehlt genau die letzte Klausur: zeigen, was sie ergäbe
            const need = group.course === 'lk13' ? 2 : 1;
            const have = listValues((student.grades || {}).k).length;
            if (base.at && have === need - 1 && !(group.course === 'gk4')) {
                const outs = [];
                for (let x = 0; x <= 15; x++) {
                    const t = calcSek2(group, student, { cat: 'k', grade: x }, 'up');
                    if (t.points != null && (!outs.length || outs[outs.length - 1].points !== t.points)) outs.push({ from: x, points: t.points });
                }
                if (outs.length) return { status: 'lastK', calc: base, outs: outs, last: need === 2 ? 'zweite Klausur' : 'Klausur' };
            }
            return { status: base.pending.length ? 'pending' : 'empty', calc: base };
        }
        const p0 = base.points;
        if (p0 >= 15) return { status: 'best', calc: base };
        let target = p0 + 1;
        if (group.adviceTarget === 'note') {
            const lvl = noteLevel(p0);
            target = p0 + 1;
            while (target < 15 && noteLevel(target) >= lvl) target++;
        }
        const labels = { m: 'Mündlich', s: 'Sonstige', k: 'Klausur' };
        const rows = ['m', 's', 'k'].map(cat => {
            const count = (student.grades && student.grades[cat] || []).filter(x => x !== '').length;
            if (cat === 'k' && group.course === 'lk13' && count >= 2) {
                return { cat: cat, name: labels[cat], needed: null, reason: 'Beide Klausuren sind geschrieben.' };
            }
            for (let x = 0; x <= 15; x++) {
                const t = calcSek2(group, student, { cat: cat, grade: x }, 'up');
                if (t.points != null && t.points >= target) return { cat: cat, name: labels[cat], needed: x, resultPoints: t.points };
            }
            return { cat: cat, name: labels[cat], needed: null };
        });
        return { status: 'ok', calc: base, current: p0, target: target, rows: rows, assumed: assumed };
    }

    return {
        PTS: PTS, TEND: TEND, PLAIN: PLAIN, NOTE_OF_POINTS: NOTE_OF_POINTS,
        pointsToNote: pointsToNote, noteLevel: noteLevel, noteDecimalFromPoints: noteDecimalFromPoints,
        normalizeGrade: normalizeGrade, gradeFromAvg: gradeFromAvg,
        calcSek1: calcSek1, sek1Options: sek1Options, sek1Final: sek1Final, sek1Over: sek1Over, allGrades: allGrades, adviceSek1: adviceSek1,
        frac: frac, roundFrac: roundFrac, tableA: tableA, tableB: tableB, table11: table11,
        calcSek2: calcSek2, adviceSek2: adviceSek2
    };
});
