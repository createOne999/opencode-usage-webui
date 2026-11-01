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

Et lett lokalt webdashboard for **OpenCode V2** som hjelper deg med å utforske tokenbruk, modellkostnader, verktøyytelse og kontekst per forespørsel for økter, direkte i nettleseren.

Kjør **`/usage-dashboard`** i OpenCode Mini eller hele TUI-et når du vil åpne dashbordet. Det kjører i OpenCode-pluginprosessen uten behov for en ekstra database eller bakgrunnsprosess.

## Dette kan du utforske

- **Oversikt (`/stats`):** Totalt antall tokener, registrert kostnad i USD, økter, modelltrinn, daglig aktivitet, tokendeling og daglige tokenutviklinger ved behov.
- **Modeller (`/models`):** Token- og kostnadsdiagrammer og -tabeller etter leverandør, modell og variant – sorterbare etter antall tokener, kostnad, trinn eller modellnavn.
- **Verktøy (`/tools`):** Antall kall, tellinger for vellykkede, mislykkede og ufullstendige kall samt median kjøretid (`P50`) per verktøy.
- **Økter og forespørselskontekst (`/sessions`):** Søk etter økter på tittel, naviger mellom overordnede økter og underøkter, undersøk tidslinjer for tokener og kostnader per forespørsel, og se den lagrede historikken fram til et valgt trinn.

## Hurtigstart

Legg til programtillegget i `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/oud#release"]
}
```

Kjør deretter **`/usage-dashboard`** i OpenCode for å åpne dashbordet i standardnettleseren, eller gå direkte til <http://127.0.0.1:7331/stats> (`http://localhost:7331/stats` og `http://[::1]:7331/stats` fungerer også).

### Tilpasse porten

Standardporten er `7331`. Hvis du kjører flere prosjekter samtidig eller vil bruke en annen port, angir du `options.port` (bruk `0` for å velge en ledig port automatisk):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/oud#release", "options": { "port": 7332 } }
  ]
}
```

## Bruke dashbordet

- **Dato- og prosjektfiltre:** Standardinnstillingen er gjeldende måned og prosjekt i nettleserens tidssone (sluttdatoen er inkludert). Du kan når som helst bytte til **Alle prosjekter** eller et bestemt prosjekt.
- **Flerspråklig grensesnitt:** Bytt språk i velgeren øverst. Valgt språk (`?lang=...`), datointervall, prosjektfilter og lenke til aktiv forespørsel beholdes i URL-en, slik at du enkelt kan bokmerke eller oppdatere en visning.
- **Daglig tokenoversikt:** På oversiktssiden kan du klikke **Last inn daglige tokener** for å se diagrammer over inndata, utdata, resonnering og tokener lest fra/skrevet til hurtigbufferen, dag for dag i den valgte perioden.
- **Undersøke forespørselskontekst:**
  1. Åpne **Økter / forespørsler** og velg en økt (bruk merket eller delen **Underøkter** for å gå mellom relaterte underagentøkter).
  2. Klikk på et punkt i forespørselsdiagrammet eller et tidsstempel i forespørselstabellen.
  3. Bla gjennom **Lagret historikk før forespørselen** (inkludert brukerforespørsler, tidligere svar, verktøykall, ferdigheter og sammendrag av komprimering) sammen med **Svar på valgt forespørsel**.
  4. Bruk **Last inn 100 flere historikkoppføringer** når du vil undersøke tidligere meldinger i en lang økt.

### Nyttige merknader om måleverdier

- **Tokentellinger:** Vises i kompakte enheter `K`, `M`, `B` og `T` (med opptil to desimaler), mens sortering og summer bruker nøyaktige tall. Totalt antall tokener er `input + output + reasoning + cache.read + cache.write`.
- **Kostnadsestimater:** Kostnadene vises i USD og bygger på rapportert bruk fra leverandøren og modellkatalogens satser, som en praktisk referanse.
- **Visning av lagret kontekst:** Forespørselsinspektøren rekonstruerer konteksten fra den lagrede økthistorikken og fullførte komprimeringsgrenser fram til det valgte trinnet.

## Lokal og privat som standard

- **Kun loopback:** Binder seg utelukkende til lokal loopback (`127.0.0.1` og `::1`) og validerer headere for samme opprinnelse, slik at bruksdataene bare er tilgjengelige på maskinen din.
- **Ingen ekstra lagring eller telemetri:** Leser ved behov fra den lokale delte OpenCode V2-tjenesten som kjører. Alle grensesnittelementer og oversettelser er inkludert lokalt, uten eksterne CDN-er, analyseverktøy eller ekstra datafiler. For å avinstallere fjerner du bare oppføringen for programtillegget fra `opencode.json`.

## Kjøre fra kildekoden

Bygget for OpenCode **2.2.0** og Bun **1.4.2**. Kjør fra roten av repositoriet:

```powershell
bun run setup
opencode mini
# I OpenCode: /usage-dashboard
```

Hvis du arbeider i et eksternt miljø, WSL eller et miljø uten grafisk grensesnitt der nettleseren ikke kan åpnes automatisk, kan du kontrollere den aktive dashbord-URL-en og om den er klar fra terminalen:

```powershell
bun run status
```

### Utviklingskontroller

```powershell
bun run build
bun run typecheck
bun run test
```

## Lisens

MIT-lisens. Se [LICENSE](LICENSE) for detaljer.
