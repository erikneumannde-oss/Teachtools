// Zeigt auf der Startseite einen Knopf zum Installieren, sobald der Browser die Installation anbietet
(function () {
    var deferred = null;
    var btn = document.getElementById('install-btn');
    if (!btn) return;
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferred = e;
        btn.hidden = false;
    });
    btn.addEventListener('click', function () {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.finally(function () { deferred = null; btn.hidden = true; });
    });
    window.addEventListener('appinstalled', function () { btn.hidden = true; });
})();
