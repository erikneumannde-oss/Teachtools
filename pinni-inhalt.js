/* Inhalte der Pinni-Führungen. Jeder Schritt: sel (Markierung, leer = Mitte), text, optional tab/open (vorher anklicken/aufklappen), preview. */
window.PinniInhalt = {
    start: {
        ende: 'Das war die Pinnwand. Die Zettel kennst du jetzt, den Rest zeige ich dir in jedem Werkzeug gern noch einmal.',
        steps: [
            { text: 'Ich bin Pinni und halte hier alles zusammen. Nur meine Witze halten manchmal nicht, die sind ziemlich spitz. Ich zeige dir kurz, was es hier gibt.' },
            { sel: '.paper', title: 'Die Pinnwand', text: 'Hier liegen kleine Werkzeuge für den Schulalltag. Es gibt keine Anmeldung, und alle Eingaben bleiben im Browser. Es wird nichts übertragen.' },
            { sel: '.note[href*="notenrechner"]', title: 'Zettel öffnen', text: 'Jeder Zettel ist ein Werkzeug. Antippen öffnet es. Beim Notenrechner geht es um Noten für Sek I und Sek II, mit Beratung und PDF.',
              preview: { src: 'pinni/vorschau/notenrechner-pdf.png', title: 'Notenrechner: PDF je Person', cap: 'Beispiel mit erfundenen Daten.' } },
            { sel: '.note[href*="klassenarbeit"]', title: 'Arbeitenauswerter', text: 'Hier werden Klassenarbeiten und Klausuren ausgewertet: Punkte, Noten und Notenspiegel.',
              preview: { src: 'pinni/vorschau/klassenarbeit-uebersicht.png', title: 'Arbeitenauswerter: Übersicht als PDF', cap: 'Beispiel mit erfundenen Daten.' } },
            { sel: '.note[href*="brief"]', title: 'Briefgenerator', text: 'Briefe im Briefkopf der Schule, als Word-Datei oder als PDF.',
              preview: { src: 'pinni/vorschau/brief-elternbrief.png', title: 'Briefgenerator: Elternbrief', cap: 'Beispiel mit erfundenen Daten.' } },
            { sel: '.note[href*="sitzplan"]', title: 'Weitere Werkzeuge', text: 'Dazu kommen der Sitzplanersteller, die PDF- und Bildwerkzeuge, Gruppen und Zufall sowie Timer, Stoppuhr und Geräuschampel. In jedem davon kann ich dich wieder durchführen.' },
            { sel: '.note[data-tag="Extern"]', title: 'Rosa Zettel', text: 'Rosa Zettel sind Links zu anderen Seiten. Sie öffnen sich in einem neuen Fenster und stehen immer ganz hinten.' },
            { sel: '.impressum-link', text: 'Impressum und Datenschutz stehen hier. Dort ist auch erklärt, dass nichts übertragen wird.' }
        ]
    },

    sitzplan: {
        ende: 'Das war der Sitzplanersteller. Jetzt sitzt hoffentlich jede und jeder am richtigen Platz.',
        steps: [
            { text: 'Willkommen beim Sitzplanersteller! Ich zeige dir, wie Namen auf ihre Plätze kommen. Beim Platzieren bin ich ganz in meinem Element: Ich hefte gern an.' },
            { sel: '.plans-bar', title: 'Pläne', text: 'Jeder Plan hat einen eigenen Reiter, zum Beispiel für jede Klasse. Mit dem Plus legst du einen neuen Plan an.' },
            { sel: '#det-names > summary', open: '#det-names', title: 'Namen eintragen', text: 'Hier kommen die Namen hinein, ein Name pro Zeile. Du kannst auch eine Liste aus einer CSV- oder TXT-Datei importieren.' },
            { sel: '#pool-wrap', title: 'Noch nicht platziert', text: 'Alle Namen, die noch keinen Platz haben, warten hier.' },
            { sel: '#gridscroll', title: 'Der Raum', text: 'Namen antippen und dann einen freien Platz antippen. Ein besetzter Platz tauscht die Namen. Am Rechner kannst du auch ziehen, auf dem Handy oder Tablet nach kurzem Halten.' },
            { sel: '#zoom-fit', title: 'Größe und Rückgängig', text: 'Mit Plus, Minus und „Anpassen“ stellst du die Ansicht ein. Ein Fehler lässt sich mit „Rückgängig“ zurücknehmen.' },
            { sel: '#det-plan > summary', open: '#det-plan', title: 'Raum einrichten', text: 'Klasse, Raum und die Zahl der Spalten und Reihen stellst du hier ein.' },
            { sel: '#print-top', title: 'Drucken', text: 'Mit Drucken entsteht der Plan zum Aushängen. Die Vorschau zeigt einen Raum mit erfundenen Namen.',
              preview: { src: 'pinni/vorschau/sitzplan-druck.png', title: 'Sitzplan mit Namen', cap: 'Beispiel mit erfundenen Namen.' } },
            { sel: '#det-save > summary', open: '#det-save', title: 'Sichern', text: 'Mit „Alle Pläne sichern“ speicherst du eine Datei auf deinem Gerät. Über „Laden“ holst du sie später zurück.' }
        ]
    },

    gruppen: {
        ende: 'Das war es. Auf gute Zusammenarbeit, ich hefte mich an niemanden.',
        steps: [
            { text: 'Hier teilst du Gruppen ein oder ziehst Namen. Ich bin für Gruppenarbeit gut geeignet: Ich halte nämlich zusammen.' },
            { sel: '#det-names > summary', open: '#det-names', title: 'Zuerst die Namen', text: 'Trage die Namen ein, ein Name pro Zeile, oder importiere eine CSV- oder TXT-Datei. Fehlende Personen tippst du in der Liste an, dann werden sie nicht eingeteilt.' },
            { sel: '#tab-gruppen', tab: '#tab-gruppen', title: 'Gruppen einteilen', text: 'Wähle, ob du eine Zahl an Gruppen oder eine Gruppengröße möchtest, und tippe auf „Einteilen“. „Neu mischen“ würfelt neu.' },
            { sel: '#g-print', title: 'Drucken', text: 'Das Ergebnis lässt sich ausdrucken.' },
            { sel: '#tab-zufall', tab: '#tab-zufall', title: 'Zufallsauswahl', text: 'Hier werden Namen gezogen. Mit dem Häkchen wird niemand doppelt gezogen, und „Zurücksetzen“ füllt die Lostrommel wieder.' },
            { sel: '#det-names', text: 'Nichts davon wird gespeichert. Wenn du die Seite schließt, sind die Namen weg.' }
        ]
    },

    timer: {
        ende: 'Das war es. Die Zeit läuft, ich nicht. Ich bleibe hier stehen.',
        steps: [
            { text: 'Hier gibt es Timer, Stoppuhr und Geräuschampel. Ich passe auf die Zeit auf, auch wenn ich selbst nie rechtzeitig zum Abheften komme.' },
            { sel: '.tabs', title: 'Drei Reiter', text: 'Mit den Reitern wechselst du zwischen Timer, Stoppuhr und Geräuschampel.' },
            { sel: '#t-presets', tab: '#tab-timer', title: 'Timer', text: 'Wähle eine Schnellwahl oder stelle Minuten und Sekunden selbst ein. Dann auf „Start“.' },
            { sel: '#t-ampel-on', title: 'Zeitampel', text: 'Auf Wunsch zeigt eine Ampel die Zeit an: grün, gelb in den letzten Minuten und rot bei Ablauf. Das ist gut sichtbar für Gruppenarbeit.' },
            { sel: '#s-display', tab: '#tab-stopp', title: 'Stoppuhr', text: 'Die Stoppuhr zählt hoch. Mit „Runde“ merkst du dir Zwischenzeiten.' },
            { sel: '.lamp.red', tab: '#tab-ampel', title: 'Geräuschampel', text: 'Ein Tipp auf eine Lampe schaltet die Ampel von Hand.' },
            { sel: '#a-mode-mic', title: 'Mit Mikrofon', text: 'Auf Wunsch misst das Mikrofon die Lautstärke und die Ampel schaltet selbst. Es wird nichts aufgenommen, gespeichert oder übertragen. Dein Browser fragt vorher um Erlaubnis.' }
        ]
    },

    notenrechner: {
        ende: 'Das war der Notenrechner. Noten sind übrigens das Einzige, was ich lieber an der Wand als im Kopf habe.',
        steps: [
            { text: 'Willkommen beim Notenrechner! Ich zeige dir, wie du Noten einträgst und Berichte als PDF bekommst. Rechnen ist nicht meine Stärke, aber ich zeige dir gern, wer es kann.' },
            { sel: ['.plans-bar'], title: 'Lerngruppen', text: 'Jede Lerngruppe hat einen eigenen Reiter. Mit dem Plus legst du eine neue an, für Sek I oder Sek II.' },
            { sel: ['#det-names > summary'], open: '#det-names', title: 'Namen', text: 'Hier trägst du die Namen ein oder importierst eine CSV- oder TXT-Datei.' },
            { sel: ['#tablewrap', '#empty'], title: 'Die Notentabelle', text: 'Noten tippst du direkt in die Tabelle. Die Gesamtnote entsteht nach den Wertungen, die du festlegst. Sobald eine Lerngruppe angelegt ist, siehst du die Tabelle hier.' },
            { sel: ['#edit-rating', '#empty'], title: 'Kategorien und Wertung', text: 'Hier legst du fest, welche Kategorien es gibt und wie stark sie zählen.' },
            { sel: ['#toggle-notes', '#empty'], title: 'Bemerkungen', text: 'Zu jeder Note kannst du eine Bemerkung einblenden und schreiben. Das Datum wird automatisch gespeichert.' },
            { sel: ['#advice-card', '#empty'], title: 'Beratung', text: 'Die Beratung zeigt, welche Note bei einer Person möglich ist. Sie ist nur eine Hilfe, die Entscheidung bleibt bei dir.' },
            { sel: ['#pdf-students', '#empty'], title: 'PDF je Person', text: 'Für jede Person entsteht ein eigenes PDF mit allen Noten und Bemerkungen in einer Tabelle.',
              preview: { src: 'pinni/vorschau/notenrechner-pdf.png', title: 'PDF je Person', cap: 'Beispiel mit erfundenen Daten.' } },
            { sel: '#det-save > summary', open: '#det-save', title: 'Speichern', text: 'Wenn du möchtest, speicherst du im Browser oder als Datei. Beides bleibt auf deinem Gerät. Nichts wird übertragen.' }
        ]
    },

    klassenarbeit: {
        ende: 'Das war der Arbeitenauswerter. Alle Punkte sind jetzt gut angeheftet.',
        steps: [
            { text: 'Hier wertest du Klassenarbeiten und Klausuren aus. Ich pikse niemanden, aber ich zeige dir, wo die Punkte hingehören.' },
            { sel: '.plans-bar', title: 'Arbeiten', text: 'Jede Arbeit hat einen eigenen Reiter. Mit dem Plus legst du eine neue an. Zur Wahl stehen Klassenarbeit, Klausur und die Auswertung nach Kriterien.' },
            { sel: '#det-arbeit > summary', open: '#det-arbeit', title: 'Arbeit einrichten', text: 'Hier stellst du Typ, Aufgaben und Punkte ein.' },
            { sel: '#det-key > summary', open: '#det-key', title: 'Schlüssel', text: 'Der Schlüssel legt fest, ab welchem Anteil welche Note vergeben wird. Du kannst ihn anpassen.' },
            { sel: '#det-names > summary', open: '#det-names', title: 'Namen', text: 'Trage die Namen ein oder importiere eine CSV- oder TXT-Datei.' },
            { sel: ['#tablewrap', '#empty'], title: 'Punkte eintragen', text: 'Die Punkte kommen direkt in die Tabelle, die Noten werden berechnet. Sobald eine Arbeit angelegt ist, siehst du die Tabelle hier.' },
            { sel: ['#result', '#empty'], title: 'Ergebnis', text: 'Oben siehst du Durchschnitt, Notenspiegel und weitere Kennzahlen auf einen Blick.' },
            { sel: ['#pdf', '#empty'], title: 'PDF und Bild', text: 'Die Übersicht gibt es als PDF, den Notenspiegel als JPEG.',
              preview: { src: 'pinni/vorschau/klassenarbeit-uebersicht.png', title: 'Übersicht als PDF', cap: 'Beispiel mit erfundenen Daten.' } },
            { sel: ['#grades-file', '#empty'], title: 'Noten für den Notenrechner', text: 'Die Noten lassen sich als Datei für den Notenrechner ablegen und dort wieder einlesen.' },
            { sel: '#det-save > summary', open: '#det-save', title: 'Speichern', text: 'Wenn du möchtest, speicherst du im Browser oder als Datei. Beides bleibt auf deinem Gerät.' }
        ]
    },

    brief: {
        ende: 'Das war der Briefgenerator. Und denk dran: Ein Brief ohne Anrede ist wie ich ohne Nadel.',
        steps: [
            { text: 'Willkommen beim Briefgenerator! Ich zeige dir, wie aus ein paar Angaben ein fertiger Brief wird. Mit mir bleibt alles auf dem Punkt.' },
            { sel: '#kinds', title: 'Brief wählen', text: 'Zuerst wählst du die Art des Briefs: Elternbrief, sonstiger Brief, Information über einen mündlichen Tadel oder über eine ungenügende Leistung.' },
            { sel: '#h-addr', tab: '#kinds .kind[data-kind="eltern"]', title: 'Adressfeld', text: 'Hier steht, an wen der Brief geht. Beim Elternbrief reicht eine Klasse oder ein Jahrgang.' },
            { sel: '#card-tadel', tab: '#kinds .kind[data-kind="tadel"]', title: 'Tadel', text: 'Beim Tadel trägst du Name, Datum und den Grund ein. Der Betreff und der Hinweis auf die Kopie in den Akten sind fest vorgegeben.' },
            { sel: '#card-ungen', tab: '#kinds .kind[data-kind="ungenuegend"]', title: 'Ungenügende Leistung', text: 'Hier kommen Art der Leistungsüberprüfung, Fach, Name, Datum und eine mögliche Bemerkung hinein.' },
            { sel: '#h-abs', title: 'Absender', text: 'Hier stehen deine Namen und dein Kürzel für die Briefzeile.' },
            { sel: '#card-txt', tab: '#kinds .kind[data-kind="eltern"]', title: 'Betreff und Text', text: 'Hier schreibst du den Text. Eine leere Zeile erzeugt einen Absatz.' },
            { sel: '#check', title: 'Kontrolle', text: 'Die Kontrolle weist dich auf fehlende Angaben hin, bevor du den Brief erstellst.' },
            { sel: '#btn-pdf', title: 'Word oder PDF', text: 'Den fertigen Brief gibt es als Word-Datei oder als PDF, im Briefkopf der Schule.',
              preview: { src: 'pinni/vorschau/brief-elternbrief.png', title: 'Elternbrief als PDF', cap: 'Beispiel mit erfundenen Daten.' } }
        ]
    },

    'pdf-werkzeuge': {
        ende: 'Das war es. Seiten zusammenzuheften ist ja quasi mein Beruf.',
        steps: [
            { text: 'Hier fügst du PDFs und Bilder zusammen, ordnest Seiten und verkleinerst Dateien. Zusammenhalten kann ich gut.' },
            { sel: '.tabs', title: 'Drei Reiter', text: 'Seiten ordnen und zusammenfügen, Bilder verkleinern oder eine PDF verkleinern.' },
            { sel: '#merge-drop', tab: '.tabs [data-tab="merge"]', title: 'Dateien hinzufügen', text: 'Wähle PDFs, Fotos oder Scans aus. Jede Seite und jedes Bild erscheint als eigene Karte. Word-Dateien bitte vorher als PDF speichern.' },
            { sel: '#merge-grid', title: 'Karten ordnen', text: 'Die Karten lassen sich am Griff ziehen, mit den Pfeilen verschieben, drehen und entfernen. Die Reihenfolge hier ist die Reihenfolge in der neuen PDF.',
              preview: { src: 'pinni/vorschau/pdf-karten.png', title: 'Seitenkarten', cap: 'Beispiel mit erfundenem Inhalt.' } },
            { sel: '#merge-go', title: 'Speichern', text: 'Alle Seiten als PDF speichern, nur die gewählten oder jede Seite einzeln als ZIP.' },
            { sel: '#imgs-drop', tab: '.tabs [data-tab="imgs"]', title: 'Bilder verkleinern', text: 'Große Fotos werden kleiner, zum Beispiel für den Versand. Du stellst Größe und Qualität selbst ein.' },
            { sel: '#shrink-drop', tab: '.tabs [data-tab="shrink"]', title: 'PDF verkleinern', text: 'Auch große PDFs werden kleiner. Alles passiert auf deinem Gerät, die Dateien werden nirgends hochgeladen.' }
        ]
    }
};
