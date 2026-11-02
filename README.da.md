# OpenCode Usage Dashboard

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

Et let, lokalt webdashboard til **OpenCode V2**, der hjælper dig med at undersøge dit tokenforbrug, modelomkostninger, værktøjers ydeevne og konteksten for hver sessionsanmodning direkte i browseren.

Kør **`/usage-dashboard`** i OpenCode Mini eller den fulde TUI, når du vil åbne dashboardet. Det kører i OpenCode-pluginprocessen og kræver hverken en ekstra database eller en baggrundsdaemon.

![OpenCode Usage Dashboard](screenshot.png)

## Dette kan du udforske

- **Oversigt (`/stats`):** Token i alt, registrerede omkostninger i USD, sessioner, modeltrin, daglig aktivitet, tokenfordeling og daglige tokentendenser efter behov.
- **Modeller (`/models`):** Diagrammer og tabeller over token og omkostninger fordelt på udbyder, model og variant — kan sorteres efter token, omkostninger, trin eller modelnavn.
- **Værktøjer (`/tools`):** Antal kald, antal vellykkede, mislykkede og ufuldstændige kald samt median-køretid (`P50`) pr. værktøj.
- **Sessioner og anmodningskontekst (`/sessions`):** Søg efter sessioner via overskrift, navigér mellem overordnede sessioner og undersessioner, undersøg tidslinjer for token og omkostninger pr. anmodning, og se den gemte historik frem til et valgt trin.

## Hurtig start

Føj plugin'et til din `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

Kør derefter **`/usage-dashboard`** i OpenCode for at åbne dashboardet i din standardbrowser, eller gå direkte til <http://127.0.0.1:7331/stats> (`http://localhost:7331/stats` og `http://[::1]:7331/stats` virker også).

### Tilpasning af porten

Standardporten er `7331`. Hvis du kører flere projekter samtidigt eller vil bruge en anden port, skal du angive `options.port` (brug `0` for automatisk at vælge en ledig port):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## Brug af dashboardet

- **Dato- og projektfiltre:** Vælger som standard den aktuelle måned og det aktuelle projekt i browserens tidszone (slutdatoen medregnes). Du kan når som helst vælge **Alle projekter** eller et bestemt projekt.
- **Flersproget brugerflade:** Skift sprog via vælgeren øverst. Dit valgte sprog (`?lang=...`), datointerval, projektfilter og link til den aktive anmodning gemmes i URL'en, så du nemt kan bogmærke eller genindlæse en visning.
- **Daglig tokenfordeling:** Klik på **Indlæs daglige token** på oversigtssiden for at se diagrammer over input-, output-, ræsonnements- og cachelæsnings-/cacheskrivningstoken dag for dag i den valgte periode.
- **Undersøg anmodningskontekst:**
  1. Åbn **Sessioner / anmodninger**, og vælg en session (brug mærket eller afsnittet **Undersessioner** til at gå til relaterede undersessioner fra agenter).
  2. Klik på et punkt i anmodningsdiagrammet eller et tidsstempel i anmodningstabellen.
  3. Gennemse **Gemt historik før anmodningen** (herunder brugerprompter, tidligere svar, værktøjskald, færdigheder og komprimeringsoversigter) sammen med **Svar på den valgte anmodning**.
  4. Brug **Indlæs 100 flere historikposter**, når du vil undersøge tidligere beskeder i en lang session.

### Nyttige oplysninger om målinger

- **Tokenantal:** Vises i kompakte enheder (`K`, `M`, `B` og `T`) med op til to decimaler, mens sortering og totaler bruger præcise tal. Det samlede tokenantal er `input + output + reasoning + cache.read + cache.write`.
- **Prisoverslag:** Omkostninger vises i USD og er baseret på udbyderrapporteret forbrug og modellernes katalogpriser som vejledende reference.
- **Visning af gemt kontekst:** Anmodningsinspektøren genskaber konteksten ud fra den gemte sessionshistorik og afsluttede komprimeringsgrænser frem til det valgte trin.

## Lokal og privat fra starten

- **Kun loopback:** Lytter udelukkende på lokal loopback (`127.0.0.1` og `::1`) og validerer same-origin-headere, så dine forbrugsdata kun er tilgængelige på din egen maskine.
- **Ingen ekstra lagring eller telemetri:** Henter data efter behov fra din lokale, kørende OpenCode V2-deltjeneste. Alle brugerfladefiler og oversættelser er samlet lokalt uden eksterne CDN'er, analyseværktøjer eller ekstra datafiler. Afinstallér ved blot at fjerne pluginposten fra `opencode.json`.

## Kør fra kildekoden

Bygget til OpenCode **2.2.0** og Bun **1.4.2**. Kør fra roden af repository'et:

```powershell
bun run setup
opencode mini
# Inde i OpenCode: /usage-dashboard
```

Hvis du arbejder i et eksternt, WSL- eller headless-miljø, hvor en browser ikke kan åbnes automatisk, kan du kontrollere dashboardets aktive URL og status fra terminalen:

```powershell
bun run status
```

### Udviklingskontrol

```powershell
bun run build
bun run typecheck
bun run test
```

## Licens

Licenseret under MIT. Se [LICENSE](LICENSE) for detaljer.
