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

Una dashboard web locale e leggera per **OpenCode V2**, che permette di esplorare nel browser l'utilizzo dei token, i costi dei modelli, le prestazioni degli strumenti e il contesto delle sessioni per richiesta.

Esegui **`/usage-dashboard`** in OpenCode Mini o nella TUI completa per aprire la dashboard. Funziona all'interno del processo del plugin OpenCode, senza richiedere database aggiuntivi o demoni in background.

## Cosa puoi esplorare

- **Panoramica (`/stats`):** token totali, costi registrati in USD, sessioni, Step dei modelli, attività giornaliera, ripartizione dei token e tendenze giornaliere dei token su richiesta.
- **Modelli (`/models`):** grafici e tabelle di token e costi per provider, modello e variante, ordinabili per numero di token, costo, Step o nome del modello.
- **Strumenti (`/tools`):** volume delle chiamate, conteggi di successi, errori e richieste incomplete, oltre al tempo mediano di esecuzione (`P50`) per strumento.
- **Sessioni e contesto delle richieste (`/sessions`):** cerca le sessioni per titolo, naviga tra sessioni principali e secondarie, esamina le cronologie di token e costi per richiesta e visualizza la cronologia salvata fino a qualsiasi Step selezionato.

## Avvio rapido

Aggiungi il plugin a `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

Quindi esegui **`/usage-dashboard`** in OpenCode per aprire la dashboard nel browser predefinito, oppure visita direttamente <http://127.0.0.1:7331/stats> (funzionano anche `http://localhost:7331/stats` e `http://[::1]:7331/stats`).

### Personalizzare la porta

La porta predefinita è `7331`. Se esegui più progetti contemporaneamente o vuoi usare un'altra porta, imposta `options.port` (usa `0` per selezionare automaticamente una porta disponibile):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## Usare la dashboard

- **Filtri per data e progetto:** per impostazione predefinita vengono selezionati il mese corrente e il progetto corrente nel fuso orario del browser (includendo la data finale). Puoi passare in qualsiasi momento a **Tutti i progetti** o a un progetto specifico.
- **Interfaccia multilingue:** cambia lingua dal selettore in alto. La lingua selezionata (`?lang=...`), l'intervallo di date, il filtro del progetto e il collegamento alla richiesta attiva vengono mantenuti nell'URL, così puoi aggiungere facilmente ai preferiti o aggiornare qualsiasi vista.
- **Ripartizione giornaliera dei token:** nella pagina Panoramica, fai clic su **Carica i token giornalieri** per visualizzare i grafici giornalieri dei token di input, output, ragionamento e lettura/scrittura della cache per il periodo selezionato.
- **Esaminare il contesto delle richieste:**
  1. Apri **Sessioni / richieste** e seleziona una sessione (usa l'indicatore o la sezione **Sessioni secondarie** per passare tra sessioni di subagenti correlate).
  2. Fai clic su un punto del grafico delle richieste o su un orario nella tabella delle richieste.
  3. Esplora la **Cronologia salvata prima della richiesta** (inclusi prompt dell'utente, risposte precedenti, chiamate agli strumenti, skill e riepiloghi di compattazione) insieme alla **Risposta alla richiesta selezionata**.
  4. Usa **Carica altre 100 voci della cronologia** quando vuoi esaminare i messaggi precedenti di una sessione lunga.

### Note utili sulle metriche

- **Conteggio dei token:** viene visualizzato in unità compatte `K`, `M`, `B` e `T` (fino a due cifre decimali), mentre ordinamento e totali utilizzano i valori esatti. I token totali equivalgono a `input + output + reasoning + cache.read + cache.write`.
- **Stime dei costi:** i costi sono espressi in USD e si basano sull'utilizzo comunicato dal provider e sulle tariffe del catalogo dei modelli, come riferimento pratico.
- **Vista del contesto salvato:** l'ispettore delle richieste ricostruisce il contesto dalla cronologia salvata della sessione e dai confini delle compattazioni completate fino allo Step selezionato.

## Locale e privato per progettazione

- **Solo loopback:** si associa esclusivamente all'interfaccia loopback locale (`127.0.0.1` e `::1`) e convalida le intestazioni della stessa origine, affinché i dati di utilizzo siano accessibili solo dal tuo computer.
- **Nessun archivio aggiuntivo o telemetria:** legge su richiesta dal servizio condiviso OpenCode V2 locale in esecuzione. Tutte le risorse dell'interfaccia e le traduzioni sono incluse localmente, senza CDN esterne, strumenti di analisi o file di dati aggiuntivi. Per disinstallare il plugin, basta rimuovere la relativa voce da `opencode.json`.

## Eseguire dal codice sorgente

Realizzato per OpenCode **2.2.0** e Bun **1.4.2**. Dalla radice del repository:

```powershell
bun run setup
opencode mini
# All'interno di OpenCode: /usage-dashboard
```

Se lavori in un ambiente remoto, WSL o headless in cui il browser non può aprirsi automaticamente, controlla dal terminale l'URL attivo della dashboard e il suo stato:

```powershell
bun run status
```

### Controlli di sviluppo

```powershell
bun run build
bun run typecheck
bun run test
```

## Licenza

Distribuito con licenza MIT. Consulta [LICENSE](LICENSE) per i dettagli.
