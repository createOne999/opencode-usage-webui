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

Lagana lokalna web-kontrolna tabla za **OpenCode V2** koja vam omogućava da u pregledniku pratite upotrebu tokena, troškove modela, performanse alata i kontekst sesije za svaki zahtjev.

Pokrenite **`/usage-dashboard`** u OpenCode Mini ili punom TUI-ju kad god želite otvoriti kontrolnu tablu. Radi unutar procesa dodatka OpenCode, bez potrebe za dodatnom bazom podataka ili pozadinskim servisom.

## Šta možete pregledati

- **Pregled (`/stats`):** Ukupan broj tokena, zabilježeni trošak u USD, sesije, koraci modela, dnevna aktivnost, sastav tokena i trendovi dnevne upotrebe tokena na zahtjev.
- **Modeli (`/models`):** Grafikoni i tabele tokena i troškova po pružaocu usluge, modelu i varijanti — mogu se sortirati po broju tokena, trošku, koracima ili nazivu modela.
- **Alati (`/tools`):** Broj poziva, broj uspješnih/neuspješnih/nedovršenih poziva i medijan (`P50`) vremena izvršavanja za svaki alat.
- **Sesije i kontekst zahtjeva (`/sessions`):** Pretražujte sesije po naslovu, krećite se između nadređenih i podređenih sesija, pregledajte vremenske linije tokena i troškova po zahtjevu te sačuvanu historiju do odabranog koraka.

## Brzi početak

Dodajte dodatak u `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/oud#release"]
}
```

Zatim pokrenite **`/usage-dashboard`** unutar OpenCodea da biste otvorili kontrolnu tablu u zadanom pregledniku ili direktno posjetite <http://127.0.0.1:7331/stats> (`http://localhost:7331/stats` i `http://[::1]:7331/stats` također rade).

### Prilagođavanje porta

Zadani port je `7331`. Ako istovremeno pokrećete više projekata ili želite drugi port, postavite `options.port` (upotrijebite `0` za automatski odabir bilo kojeg dostupnog porta):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/oud#release", "options": { "port": 7332 } }
  ]
}
```

## Korištenje kontrolne table

- **Filteri datuma i projekta:** Početne vrijednosti su trenutni mjesec i trenutni projekat u vremenskoj zoni preglednika (uključujući završni datum). U bilo kojem trenutku možete odabrati **Sve projekte** ili određeni projekat.
- **Višejezičko sučelje:** Jezik promijenite pomoću izbornika pri vrhu. Odabrani jezik (`?lang=...`), raspon datuma, filter projekta i veza do aktivnog zahtjeva ostaju u URL-u, pa svaki prikaz možete jednostavno označiti ili osvježiti.
- **Dnevni pregled tokena:** Na stranici Pregled kliknite **Učitaj dnevne tokene** da biste vidjeli grafikone ulaznih, izlaznih i tokena zaključivanja te čitanja/pisanja predmemorije po danima za odabrani period.
- **Pregled konteksta zahtjeva:**
  1. Otvorite **Sesije / zahtjevi** i odaberite sesiju (koristite oznaku ili odjeljak **Podređene sesije** za prelazak između povezanih sesija podagenata).
  2. Kliknite tačku na grafikonu zahtjeva ili vremensku oznaku u tabeli zahtjeva.
  3. Pregledajte **Sačuvanu historiju prije zahtjeva** (uključujući korisničke upite, ranije odgovore, pozive alata, vještine i sažetke sažimanja) uz **Odgovor na odabrani zahtjev**.
  4. Upotrijebite **Učitaj još 100 zapisa historije** kad god želite pregledati ranije poruke u dugoj sesiji.

### Korisne napomene o metrikama

- **Broj tokena:** Prikazuje se u skraćenim jedinicama `K`, `M`, `B` i `T` (do dvije decimale), dok se sortiranje i ukupni iznosi računaju iz tačnih vrijednosti. Ukupan broj tokena je `input + output + reasoning + cache.read + cache.write`.
- **Procjene troškova:** Troškovi su prikazani u USD, na osnovu upotrebe koju prijavi pružalac usluge i cijena iz kataloga modela, kao orijentaciona vrijednost.
- **Prikaz sačuvanog konteksta:** Preglednik zahtjeva rekonstruiše kontekst iz sačuvane historije sesije i dovršenih granica sažimanja do odabranog koraka.

## Lokalno i privatno po dizajnu

- **Samo loopback:** Strogo se veže za lokalni loopback (`127.0.0.1` i `::1`) i provjerava zaglavlja istog izvora, tako da su podaci o upotrebi dostupni samo na vašem računaru.
- **Bez dodatne pohrane ili telemetrije:** Po potrebi čita iz aktivne lokalne zajedničke usluge OpenCode V2. Sva sredstva sučelja i prijevodi uključeni su lokalno, bez vanjskih CDN-ova, analitike ili dodatnih datoteka podataka. Za deinstalaciju jednostavno uklonite unos dodatka iz `opencode.json`.

## Pokretanje iz izvornog koda

Namijenjeno za OpenCode **2.2.0** i Bun **1.4.2**. Iz korijena repozitorija:

```powershell
bun run setup
opencode mini
# Inside OpenCode: /usage-dashboard
```

Ako radite u udaljenom okruženju, WSL-u ili okruženju bez grafičkog sučelja gdje se preglednik ne može automatski otvoriti, provjerite aktivni URL kontrolne table i spremnost iz terminala:

```powershell
bun run status
```

### Provjere tokom razvoja

```powershell
bun run build
bun run typecheck
bun run test
```

## Licenca

Licenca MIT. Detalje pogledajte u datoteci [LICENSE](LICENSE).
