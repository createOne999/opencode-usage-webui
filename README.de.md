# OpenCode-Nutzungsdashboard

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

Ein leichtgewichtiges lokales Web-Dashboard für **OpenCode V2**, mit dem du Tokenverbrauch, Modellkosten, Werkzeugleistung und den Sitzungskontext einzelner Anfragen direkt im Browser erkunden kannst.

Führe **`/usage-dashboard`** in OpenCode Mini oder der vollständigen TUI aus, wann immer du das Dashboard öffnen möchtest. Es läuft im OpenCode-Plugin-Prozess und benötigt weder eine zusätzliche Datenbank noch einen Hintergrunddienst.

![OpenCode Usage Dashboard](screenshot.png)

## Was du entdecken kannst

- **Übersicht (`/stats`):** Token gesamt, erfasste Kosten in USD, Sitzungen, Modell-Steps, tägliche Aktivität, Token-Aufschlüsselung und tägliche Token-Trends auf Abruf.
- **Modelle (`/models`):** Token- und Kostendiagramme sowie Tabellen nach Anbieter, Modell und Variant – sortierbar nach Token, Kosten, Steps oder Modellname.
- **Werkzeuge (`/tools`):** Aufrufzahlen, Anzahl erfolgreicher, fehlgeschlagener und unvollständiger Aufrufe sowie die mediane (`P50`) Ausführungszeit pro Werkzeug.
- **Sitzungen und Anfragekontext (`/sessions`):** Sitzungen nach Titel durchsuchen, zwischen übergeordneten und untergeordneten Sitzungen wechseln, Token- und Kostenverläufe pro Anfrage prüfen und den gespeicherten Verlauf bis zu einem ausgewählten Step ansehen.

## Schnellstart

Füge das Plugin zu deiner `opencode.json` hinzu:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

Führe anschließend **`/usage-dashboard`** in OpenCode aus, um das Dashboard im Standardbrowser zu öffnen, oder rufe direkt <http://127.0.0.1:7331/stats> auf (`http://localhost:7331/stats` und `http://[::1]:7331/stats` funktionieren ebenfalls).

### Port anpassen

Der Standardport ist `7331`. Wenn du mehrere Projekte gleichzeitig ausführst oder einen anderen Port verwenden möchtest, setze `options.port` (mit `0` wird automatisch ein verfügbarer Port ausgewählt):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## Dashboard verwenden

- **Datums- und Projektfilter:** Standardmäßig werden der aktuelle Monat und das aktuelle Projekt in der Zeitzone deines Browsers verwendet (einschließlich des Enddatums). Du kannst jederzeit zu **Alle Projekte** oder einem bestimmten Projekt wechseln.
- **Mehrsprachige Oberfläche:** Wechsle die Sprache über die Auswahl oben. Die gewählte Sprache (`?lang=...`), der Zeitraum, der Projektfilter und der aktive Anfrage-Link bleiben in der URL erhalten, sodass du jede Ansicht einfach als Lesezeichen speichern oder aktualisieren kannst.
- **Tägliche Token-Aufschlüsselung:** Klicke auf der Übersichtsseite auf **Tägliche Token laden**, um für den gewählten Zeitraum Tagesdiagramme für Eingabe, Ausgabe, Reasoning sowie Cache-Lese- und Cache-Schreibzugriffe anzuzeigen.
- **Anfragekontext prüfen:**
  1. Öffne **Sitzungen / Anfragen** und wähle eine Sitzung aus (über das Abzeichen oder den Abschnitt **Untergeordnete Sitzungen** kannst du zu verwandten Subagent-Sitzungen wechseln).
  2. Klicke auf einen Punkt im Anfragediagramm oder auf einen Zeitstempel in der Anfragetabelle.
  3. Sieh dir **Gespeicherten Verlauf vor der Anfrage** (einschließlich Nutzer-Prompts, früherer Antworten, Werkzeugaufrufe, Skills und Zusammenfassungen der Kontextkomprimierung) zusammen mit der **Antwort auf die ausgewählte Anfrage** an.
  4. Nutze **100 weitere Verlaufseinträge laden**, um bei langen Sitzungen frühere Nachrichten zu prüfen.

### Hinweise zu Kennzahlen

- **Tokenzahlen:** Werden in kompakten Einheiten `K`, `M`, `B` und `T` (mit bis zu zwei Dezimalstellen) angezeigt; Sortierung und Summen verwenden exakte Zahlen. Die Gesamtzahl der Token entspricht `input + output + reasoning + cache.read + cache.write`.
- **Kostenschätzungen:** Kosten werden zur Orientierung in USD angezeigt und basieren auf der vom Anbieter gemeldeten Nutzung sowie den Preisen des Modellkatalogs.
- **Ansicht des gespeicherten Kontexts:** Die Anfrageansicht rekonstruiert den Kontext anhand des gespeicherten Sitzungsverlaufs und abgeschlossener Grenzen der Kontextkomprimierung bis zum ausgewählten Step.

## Von Grund auf lokal und privat

- **Nur Loopback:** Das Dashboard bindet ausschließlich an lokale Loopback-Adressen (`127.0.0.1` und `::1`) und prüft Same-Origin-Header, damit deine Nutzungsdaten nur auf deinem Rechner zugänglich sind.
- **Kein zusätzlicher Speicher und keine Telemetrie:** Daten werden bei Bedarf vom laufenden lokalen OpenCode V2-Dienst gelesen. Alle UI-Dateien und Übersetzungen sind lokal gebündelt; externe CDNs, Analysewerkzeuge oder zusätzliche Datendateien werden nicht benötigt. Zum Deinstallieren entfernst du einfach den Plugin-Eintrag aus `opencode.json`.

## Aus dem Quellcode ausführen

Entwickelt für OpenCode **2.2.0** und Bun **1.4.2**. Führe im Stammverzeichnis des Repositorys Folgendes aus:

```powershell
bun run setup
opencode mini
# Inside OpenCode: /usage-dashboard
```

Wenn du in einer Remote-, WSL- oder Headless-Umgebung arbeitest, in der sich kein Browser automatisch öffnen kann, kannst du die aktive Dashboard-URL und den Bereitschaftsstatus im Terminal prüfen:

```powershell
bun run status
```

### Entwicklungsprüfungen

```powershell
bun run build
bun run typecheck
bun run test
```

## Lizenz

MIT-lizenziert. Einzelheiten findest du unter [LICENSE](LICENSE).
