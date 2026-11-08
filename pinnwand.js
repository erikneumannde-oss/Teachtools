/* Ordnet die Zettel je nach Anzahl in einem Raster an, damit alle auf der Pinnwand Platz haben. */
(function () {
    'use strict';
    const box = document.querySelector('.notes');
    if (!box) return;
    function layout() {
        const n = Array.from(box.children).filter(c => c.classList.contains('note') && !c.hidden).length;
        if (n <= 6) { box.classList.remove('raster'); return; }
        const cols = n <= 9 ? 3 : (n <= 16 ? 4 : 5);
        const rows = Math.ceil(n / cols);
        // Schrift schrumpft mit der Zahl der Reihen, damit der Text in die Zettel passt
        const scale = rows <= 2 ? 1 : (rows === 3 ? 0.84 : (rows === 4 ? 0.68 : 0.56));
        box.style.setProperty('--cols', String(cols));
        box.style.setProperty('--rows', String(rows));
        box.style.setProperty('--fs', String(scale));
        box.classList.add('raster');
    }
    layout();
})();
