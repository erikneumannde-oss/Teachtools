/* Rechenlogik der Klassenarbeits-Auswertung (ohne Oberfläche, im Browser und in Node nutzbar) */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.KA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Notenstufen von der besten zur schlechtesten. Es gibt nur eine 6, also keine 6+ oder 6-.
    const TEND = ['1+', '1', '1-', '2+', '2', '2-', '3+', '3', '3-', '4+', '4', '4-', '5+', '5', '5-', '6'];
    const PLAIN = ['1', '2', '3', '4', '5', '6'];

    // Umrechnung in Oberstufenpunkte (nur intern für den Durchschnitt)
    const PTS = {
        '1+': 15, '1': 14, '1-': 13, '2+': 12, '2': 11, '2-': 10, '3+': 9, '3': 8, '3-': 7,
        '4+': 6, '4': 5, '4-': 4, '5+': 3, '5': 2, '5-': 1, '6': 0
    };

    const labels = tend => tend ? TEND : PLAIN;
    const baseNote = label => parseInt(label, 10);

    // Durchschnitt in Punkten -> Dezimalnote (15 Punkte und 14 Punkte ergeben 1,0)
    function noteFromPoints(P) {
        const n = P >= 1 ? (17 - P) / 3 : 6 - (2 / 3) * P;
        return Math.max(1, Math.min(6, n));
    }

    // Voreinstellung: IHK-Schlüssel in Prozent (ab 92 = 1, ab 81 = 2, ab 67 = 3, ab 50 = 4, ab 30 = 5)
    const DEFAULT_PLAIN = [92, 81, 67, 50, 30];

    // Jede ganze Note in drei gleich große Stufen teilen: aus dem Schlüssel ohne Tendenz wird der mit Tendenz
    function tendFromPlain(plain, top) {
        const out = [];
        for (let i = 0; i < 5; i++) {
            const lo = plain[i];
            const hi = i === 0 ? (top == null ? 100 : top) : plain[i - 1];
            const step = (hi - lo) / 3;
            out.push(round2(lo + 2 * step), round2(lo + step), round2(lo));
        }
        return out;
    }

    function round2(x) { return Math.round(x * 100) / 100; }

    // Alle Schwellen eines Schlüssels in Punkten, von der besten zur schlechtesten Stufe
    function thresholdsInPoints(a) {
        const vals = a.tend ? a.thr.tend : a.thr.plain;
        return vals.map(v => a.unit === 'points' ? v : v * a.max / 100);
    }

    // Note zu einer Punktzahl; null bei leerer Eingabe
    function gradeFor(a, pts) {
        if (pts == null || !isFinite(pts)) return null;
        const lab = labels(a.tend);
        const th = thresholdsInPoints(a);
        for (let i = 0; i < th.length; i++) if (pts >= th[i] - 1e-9) return lab[i];
        return lab[lab.length - 1];
    }

    // Ergebnisse der ganzen Arbeit
    function evaluate(a) {
        const rows = a.students.map(s => ({ id: s.id, pts: s.pts, grade: gradeFor(a, s.pts) }));
        const graded = rows.filter(r => r.grade != null);
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        graded.forEach(r => { counts[baseNote(r.grade)]++; });
        let avg = null, avgPts = null;
        if (graded.length) {
            if (a.tend) {
                const p = graded.reduce((s, r) => s + PTS[r.grade], 0) / graded.length;
                avg = noteFromPoints(p);
            } else {
                avg = graded.reduce((s, r) => s + baseNote(r.grade), 0) / graded.length;
            }
            avgPts = graded.reduce((s, r) => s + r.pts, 0) / graded.length;
        }
        return { rows: rows, n: graded.length, counts: counts, avg: avg, avgPts: avgPts };
    }

    // Eingabe einer Punktzahl: Komma oder Punkt, höchstens zwei Nachkommastellen. '' = leer, null = ungültig.
    function parsePoints(input) {
        const s = String(input == null ? '' : input).trim().replace(',', '.');
        if (s === '') return '';
        if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
        return parseFloat(s);
    }

    // Prüft, ob die Schwellen von der besten zur schlechtesten Stufe absteigen
    function isDescending(vals) {
        for (let i = 1; i < vals.length; i++) if (!(vals[i] < vals[i - 1])) return false;
        return true;
    }

    return {
        TEND: TEND, PLAIN: PLAIN, PTS: PTS, DEFAULT_PLAIN: DEFAULT_PLAIN,
        labels: labels, baseNote: baseNote, noteFromPoints: noteFromPoints, tendFromPlain: tendFromPlain,
        thresholdsInPoints: thresholdsInPoints, gradeFor: gradeFor, evaluate: evaluate,
        parsePoints: parsePoints, isDescending: isDescending, round2: round2
    };
});
