/* Rechenlogik der Arbeitenauswerter (ohne Oberfläche, im Browser und in Node nutzbar) */
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


    /* ---------- Oberstufe: Klausur mit Notenpunkten ---------- */

    // Notenpunkte 15 bis 1 aus dem Anteil der erreichten BE (laut VOGO, gültig ab 2019/2020); darunter 0
    const BE_PCT = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 33, 27, 20];

    // Ab x,5 wird aufgerundet
    const roundHalfUp = x => Math.floor(x + 0.5 + 1e-9);

    function beToNP(be, max) {
        if (be == null || !isFinite(be) || !(max > 0)) return null;
        const pct = be / max * 100;
        for (let i = 0; i < BE_PCT.length; i++) if (pct >= BE_PCT[i] - 1e-9) return 15 - i;
        return 0;
    }

    // Kleinste ganze BE-Zahl, die für die Fachpunkte reicht (es gibt keine halben BE)
    function beNeeded(np, max) {
        if (np <= 0) return 0;
        return Math.ceil(BE_PCT[15 - np] * max / 100 - 1e-9);
    }

    // Gewichte (Fach, Sprache) der Variante mit BE
    function weightsBE(a) { return { f: 100 - a.wSpr, s: a.wSpr }; }

    // Notenpunkte der Klausur einer Person
    function klausurRow(a, s) {
        let fach = null;
        let wF, wS;
        if (a.variant === 'ab') {
            const ok = s.afb.every(v => v != null);
            // Die Anteile der Bereiche beziehen sich auf den fachlichen Teil; der sprachliche Teil ist ein eigener Anteil an der Gesamtnote
            const wAfb = a.afbW.reduce((x, y) => x + y, 0);
            wF = 100 - a.wSpr;
            wS = a.wSpr;
            if (ok && wAfb > 0) fach = roundHalfUp(s.afb.reduce((x, v, i) => x + v * a.afbW[i], 0) / wAfb);
        } else {
            const w = weightsBE(a);
            wF = w.f; wS = w.s;
            fach = beToNP(s.be, a.beMax);
        }
        const spr = s.spr == null ? null : s.spr;
        let gesamt = null;
        if (fach != null && spr != null && wF + wS > 0) gesamt = roundHalfUp((wF * fach + wS * spr) / (wF + wS));
        return { fach: fach, spr: spr, gesamt: gesamt };
    }

    function evaluateKlausur(a) {
        const rows = a.students.map(s => Object.assign({ id: s.id }, klausurRow(a, s)));
        const graded = rows.filter(r => r.gesamt != null);
        const counts = {};
        for (let p = 0; p <= 15; p++) counts[p] = 0;
        graded.forEach(r => { counts[r.gesamt]++; });
        const avg = graded.length ? graded.reduce((x, r) => x + r.gesamt, 0) / graded.length : null;
        return { rows: rows, n: graded.length, counts: counts, avg: avg };
    }

    // Für eine sprachliche Leistung: Was ist im fachlichen Teil nötig, um die Gesamt-Notenpunkte zu erreichen?
    // Rückgabe je Ziel 15 bis 0: { fach, be } oder null, wenn es nicht erreichbar ist
    function needTable(a, spr) {
        const w = weightsBE(a);
        const out = {};
        for (let target = 15; target >= 0; target--) {
            let found = null;
            for (let f = 0; f <= 15; f++) {
                if (roundHalfUp((w.f * f + w.s * spr) / (w.f + w.s)) >= target) { found = f; break; }
            }
            out[target] = found == null ? null : { fach: found, be: beNeeded(found, a.beMax) };
        }
        return out;
    }

    // Notenpunkte als Note (15 = 1+, 0 = 6)
    function npLabel(p) { return TEND[15 - p]; }
    function npBase(p) { return p >= 13 ? 1 : p >= 10 ? 2 : p >= 7 ? 3 : p >= 4 ? 4 : p >= 1 ? 5 : 6; }
    // Eingabe von BE: ganze Zahl; '' = leer, null = ungültig
    function parseBE(input) {
        const s = String(input == null ? '' : input).trim();
        if (s === '') return '';
        return /^\d{1,4}$/.test(s) ? parseInt(s, 10) : null;
    }
    // Eingabe von Notenpunkten: ganze Zahl von 0 bis 15; '' = leer, null = ungültig
    function parseNP(input) {
        const s = String(input == null ? '' : input).trim();
        if (s === '') return '';
        if (!/^\d{1,2}$/.test(s)) return null;
        const v = parseInt(s, 10);
        return v <= 15 ? v : null;
    }

    /* ---------- Sek I: Arbeit mit Kriterien ---------- */

    // Eingabe einer Note: '' = leer, null = ungültig. Ohne Tendenz zählt nur die ganze Note.
    function parseGrade(tend, input) {
        const s = String(input == null ? '' : input).trim().replace(/[−–—‐‑]/g, '-');
        if (s === '') return '';
        const m = /^([1-6])\s*([+-])?$/.exec(s);
        if (!m) return null;
        if (!tend || m[1] === '6') return m[1];
        return m[1] + (m[2] || '');
    }

    // Höchstpunktzahl eines Kriteriums: Summe der Teilkriterien, sonst die eigene
    function critMax(c) {
        return c.subs && c.subs.length ? c.subs.reduce((x, s) => x + s.max, 0) : c.max;
    }

    // Note zu einem Prozentwert (der Schlüssel gilt für den Punkteanteil jedes Kriteriums)
    function gradeForPct(a, pct) {
        if (pct == null || !isFinite(pct)) return null;
        const lab = labels(a.tend);
        const th = a.tend ? a.thr.tend : a.thr.plain;
        for (let i = 0; i < th.length; i++) if (pct >= th[i] - 1e-9) return lab[i];
        return lab[lab.length - 1];
    }

    // Ergebnis einer Person: Teilnoten je Kriterium, Gesamtnote
    function kritRow(a, s) {
        const teil = {};
        a.crit.forEach(c => {
            const vals = (s.k && s.k[c.id]) || [];
            if (c.mode === 'grade') {
                teil[c.id] = { sum: null, grade: vals[0] || null };
                return;
            }
            const n = c.subs && c.subs.length ? c.subs.length : 1;
            let sum = 0, ok = true;
            for (let i = 0; i < n; i++) { if (vals[i] == null || !isFinite(vals[i])) ok = false; else sum += vals[i]; }
            const max = critMax(c);
            teil[c.id] = ok && max > 0 ? { sum: round2(sum), grade: gradeForPct(a, sum / max * 100) } : { sum: ok ? round2(sum) : null, grade: null };
        });
        const used = a.crit.filter(c => c.weight > 0);
        const wsum = used.reduce((x, c) => x + c.weight, 0);
        let grade = null, capped = false;
        if (used.length && wsum > 0 && used.every(c => teil[c.id].grade)) {
            if (a.tend) {
                const P = used.reduce((x, c) => x + c.weight * PTS[teil[c.id].grade], 0) / wsum;
                const pts = Math.max(0, Math.min(15, Math.ceil(P - 0.5 - 1e-9)));
                grade = TEND[15 - pts];
            } else {
                const m = used.reduce((x, c) => x + c.weight * baseNote(teil[c.id].grade), 0) / wsum;
                grade = String(Math.max(1, Math.min(6, Math.floor(m + 0.5 + 1e-9))));
            }
            // Leitkriterium: bei 5 oder 6 kann die Gesamtnote nicht besser sein als diese ganze Note
            const lead = a.crit.find(c => c.id === a.lead);
            if (lead && teil[lead.id].grade) {
                const lv = baseNote(teil[lead.id].grade);
                if (lv >= 5 && baseNote(grade) < lv) { grade = String(lv); capped = true; }
            }
        }
        return { teil: teil, grade: grade, capped: capped };
    }

    function evaluateKrit(a) {
        const rows = a.students.map(s => Object.assign({ id: s.id }, kritRow(a, s)));
        const graded = rows.filter(r => r.grade != null);
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        graded.forEach(r => { counts[baseNote(r.grade)]++; });
        let avg = null;
        if (graded.length) {
            avg = a.tend ? noteFromPoints(graded.reduce((x, r) => x + PTS[r.grade], 0) / graded.length)
                : graded.reduce((x, r) => x + baseNote(r.grade), 0) / graded.length;
        }
        return { rows: rows, n: graded.length, counts: counts, avg: avg, avgPts: null };
    }

    return {
        parseGrade: parseGrade, critMax: critMax, gradeForPct: gradeForPct, kritRow: kritRow, evaluateKrit: evaluateKrit,
        BE_PCT: BE_PCT, roundHalfUp: roundHalfUp, beToNP: beToNP, beNeeded: beNeeded, klausurRow: klausurRow,
        evaluateKlausur: evaluateKlausur, needTable: needTable, npLabel: npLabel, parseBE: parseBE, npBase: npBase, parseNP: parseNP,
        TEND: TEND, PLAIN: PLAIN, PTS: PTS, DEFAULT_PLAIN: DEFAULT_PLAIN,
        labels: labels, baseNote: baseNote, noteFromPoints: noteFromPoints, tendFromPlain: tendFromPlain,
        thresholdsInPoints: thresholdsInPoints, gradeFor: gradeFor, evaluate: evaluate,
        parsePoints: parsePoints, isDescending: isDescending, round2: round2
    };
});
