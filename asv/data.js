/* Gemeinsame Angaben für Oberfläche, PDF und Word: die Bereiche des Bogens „Arbeits- und Sozialverhalten“ (Schul Z 600). */
(function () {
    'use strict';
    const CRIT = [
        { t: 'Lern- und Leistungsbereitschaft', l: ['verfolgt den Unterricht aufmerksam', 'arbeitet aktiv mit', 'fertigt Arbeiten sorgfältig an'] },
        { t: 'Zuverlässigkeit', l: ['zeigt eine kontinuierliche Arbeitsbereitschaft', 'hält das notwendige Arbeitsmaterial bereit'] },
        { t: 'Selbständigkeit', l: ['bearbeitet Arbeitsaufträge eigenständig', 'kann sich gezielt Hilfe holen', 'arbeitet zielstrebig ohne äußere Kontrolle'] },
        { t: 'Verantwortungsbereitschaft', l: ['geht sorgfältig mit Lern- und Arbeitsmitteln um', 'ist rücksichtsvoll und hilfsbereit', 'setzt sich für die Klassengemeinschaft ein'] },
        { t: 'Teamfähigkeit', l: ['hält sich an Regeln', 'arbeitet konstruktiv mit anderen zusammen', 'akzeptiert Lernpartner und kann Konflikte', 'gemeinschaftlich lösen'] },
        { t: 'Hausaufgaben', l: ['fertigt Hausaufgaben termingerecht', 'und sorgfältig an'] },
        { t: 'Respekt', l: ['zeigt gegenüber Lehrkräften und', 'Mitschüler*innen respektvolles Verhalten'] }
    ];
    const LEVELS = [['sehr', 'ausgeprägt'], ['', 'ausgeprägt'], ['teilweise', 'ausgeprägt'], ['gering', 'ausgeprägt']];
    const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    // „2026-07-08“ wird zu „08. Juli 2026“
    function longDate(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        if (!m) return '';
        return m[3] + '. ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
    }
    // Eingaben wie 5.3.2013, 05.03.13 oder 2013-03-05 werden zu 05.03.2013
    function normBirth(s) {
        s = String(s || '').trim();
        let d, mo, y;
        let m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(s);
        if (m) { d = +m[1]; mo = +m[2]; y = m[3].length === 2 ? (+m[3] > 30 ? 1900 : 2000) + +m[3] : +m[3]; }
        else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
        else return s;
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return s;
        return String(d).padStart(2, '0') + '.' + String(mo).padStart(2, '0') + '.' + y;
    }
    window.ASVData = { CRIT, LEVELS, MONTHS, longDate, normBirth };
})();
