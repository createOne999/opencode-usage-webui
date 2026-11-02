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

**OpenCode V2** için tarayıcınızda token kullanımınızı, model maliyetlerini, araç performansını ve istek başına oturum bağlamını keşfetmenize yardımcı olan hafif, yerel bir web panosu.

Panoyu açmak istediğinizde OpenCode Mini veya tam TUI içinde **`/usage-dashboard`** komutunu çalıştırın. Ek bir veritabanına veya arka plan servisine ihtiyaç duymadan OpenCode eklenti süreci içinde çalışır.

## Neleri keşfedebilirsiniz

- **Genel bakış (`/stats`):** Toplam token, kaydedilen USD maliyeti, oturumlar, model Steps, günlük etkinlik, token dökümü ve isteğe bağlı günlük token eğilimleri.
- **Modeller (`/models`):** Sağlayıcı, model ve Variant'a göre token ve maliyet grafikleri ile tabloları — token, maliyet, Steps veya model adına göre sıralanabilir.
- **Araçlar (`/tools`):** Çağrı hacmi, başarılı/başarısız/tamamlanmamış sayıları ve araç başına medyan (`P50`) yürütme süresi.
- **Oturumlar ve istek bağlamı (`/sessions`):** Oturumları başlığa göre arayın, üst ve alt oturumlar arasında geçiş yapın, istek başına token ve maliyet zaman çizelgelerini inceleyin ve seçilen adıma kadarki kaydedilmiş geçmişi görüntüleyin.

## Hızlı başlangıç

Eklentiyi `opencode.json` dosyanıza ekleyin:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

Ardından panoyu varsayılan tarayıcınızda açmak için OpenCode içinde **`/usage-dashboard`** komutunu çalıştırın veya doğrudan <http://127.0.0.1:7331/stats> adresini ziyaret edin (`http://localhost:7331/stats` ve `http://[::1]:7331/stats` de çalışır).

### Bağlantı noktasını özelleştirme

Varsayılan bağlantı noktası `7331`'dir. Aynı anda birden fazla proje çalıştırıyorsanız veya farklı bir bağlantı noktası kullanmak istiyorsanız `options.port` değerini ayarlayın (kullanılabilir herhangi bir bağlantı noktasını otomatik seçmek için `0` kullanın):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## Panoyu kullanma

- **Tarih ve proje filtreleri:** Varsayılan olarak tarayıcınızın saat diliminde geçerli ay ve geçerli proje seçilir (bitiş tarihi dahil). İstediğiniz zaman **Tüm projeler** seçeneğine veya belirli bir projeye geçebilirsiniz.
- **Çok dilli arayüz:** Dili üstteki seçiciden değiştirin. Seçtiğiniz dil (`?lang=...`), tarih aralığı, proje filtresi ve etkin istek bağlantısı URL'de kalır; böylece herhangi bir görünümü kolayca yer imlerine ekleyebilir veya yenileyebilirsiniz.
- **Günlük token dökümü:** Genel bakış sayfasında **Günlük tokenları yükle** düğmesine tıklayarak seçilen dönem için gün gün girdi, çıktı, akıl yürütme ve önbellek okuma/yazma token grafiklerini görüntüleyin.
- **İstek bağlamını inceleme:**
  1. **Oturumlar / istekler** bölümünü açın ve bir oturum seçin (ilgili alt ajan oturumları arasında geçiş yapmak için **Alt oturumlar** rozetini veya bölümünü kullanın).
  2. İstek grafiğinde bir noktaya veya istek tablosunda bir zaman damgasına tıklayın.
  3. **İstek öncesinde kaydedilmiş geçmiş** (kullanıcı istemleri, önceki yanıtlar, araç çağrıları, beceriler ve sıkıştırma özetleri dahil) ile **Seçilen isteğe yanıt** bölümlerine göz atın.
  4. Uzun bir oturumdaki daha eski mesajları incelemek istediğinizde **100 geçmiş kaydı daha yükle** seçeneğini kullanın.

### Metrikler hakkında faydalı notlar

- **Token sayıları:** `K`, `M`, `B` ve `T` gibi kısa birimlerle (en fazla iki ondalık basamak) gösterilir; sıralama ve toplamlar tam sayıları kullanır. Toplam token sayısı `input + output + reasoning + cache.read + cache.write` değerine eşittir.
- **Maliyet tahminleri:** Maliyetler, kolay başvuru için sağlayıcı tarafından bildirilen kullanıma ve model kataloğu ücretlerine göre USD olarak gösterilir.
- **Kaydedilmiş bağlam görünümü:** İstek inceleyicisi, bağlamı kaydedilmiş oturum geçmişinizden ve seçilen adıma kadarki tamamlanmış sıkıştırma sınırlarından yeniden oluşturur.

## Tasarım gereği yerel ve gizli

- **Yalnızca geri döngü:** Yalnızca yerel geri döngüye (`127.0.0.1` ve `::1`) bağlanır ve aynı kaynak başlıklarını doğrular; böylece kullanım verileriniz yalnızca kendi makinenizden erişilebilir kalır.
- **Ek depolama veya telemetri yok:** Çalışan yerel OpenCode V2 ortak hizmetinden istek üzerine okur. Tüm arayüz varlıkları ve çeviriler yerel olarak paketlenmiştir; harici CDN, analiz veya ek veri dosyası yoktur. Kaldırmak için `opencode.json` dosyasındaki eklenti girdisini silmeniz yeterlidir.

## Kaynak koddan çalıştırma

OpenCode **2.2.0** ve Bun **1.4.2** için geliştirilmiştir. Depo kökünden:

```powershell
bun run setup
opencode mini
# Inside OpenCode: /usage-dashboard
```

Tarayıcının otomatik açılamadığı uzak, WSL veya başsız bir ortamda çalışıyorsanız etkin pano URL'sini ve hazır durumunu terminalinizden kontrol edin:

```powershell
bun run status
```

### Geliştirme kontrolleri

```powershell
bun run build
bun run typecheck
bun run test
```

## Lisans

MIT lisanslıdır. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.
