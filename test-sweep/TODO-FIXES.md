# MausCrew — Çözülecek İşler (test turundan çıkan backlog)

Bu dosya **kendi kendine yeterlidir**: onu okuyan araç, önceki konuşmaya erişmeden işi yapabilir.
Bulguların nasıl elde edildiği ve kanıtları: [`TEST-SWEEP.md`](./TEST-SWEEP.md).

- **Depo:** `C:\Users\umuti\Projects\opendeepseekhearnesmanusbot\MausCrew` (kendi git deposu)
- **Çalışma ağacı:** commit edilmemiş değişiklikler var (test turunda 24 doğrulanmış düzeltme/iyileştirme var).
- **Güncel yeşil taban çizgisi (2 Eyl):**
  `npx vitest run` → **1055 passed / 16 skipped / 0 failed**,
  `npx tsc -b` ve `npx tsc -p tsconfig.server.json` temiz, `npx eslint .` → 0 hata / 100 uyarı.
- **Her görevden sonra:** ilgili testleri + tam paketi koş, typecheck ve lint'i tekrar geçir,
  `TEST-SWEEP.md` içindeki tabloyu ve bu dosyadaki kutuyu güncelle.

## Ev kuralları (bu depo için)

1. Yorumlar "ne" değil "neden" anlatır; mevcut dosyalardaki üslubu taklit et (uzun, gerekçeli blok yorumlar).
2. Güvenlik davranışını değiştiren hiçbir varsayılanı **kullanıcıya sormadan** değiştirme.
3. Test yazmadan davranış değiştirme. Test altyapısı: `vitest` (server/**, src/**/*.test.ts), sahte ACP CLI'ı `server/testing/fake-acp-cli.ts`.
4. Yıkıcı işlem yapma (Local VM silme/yeniden oluşturma, kullanıcının `~/.mauscrew` verisine dokunma).

## Test rig'i (canlı doğrulama gerektiğinde)

```bash
mkdir -p /c/Users/umuti/AppData/Local/Temp/mc-rig
cd "C:/Users/umuti/Projects/opendeepseekhearnesmanusbot/MausCrew"
MAUSCREW_DATA_DIR=/c/Users/umuti/AppData/Local/Temp/mc-rig MAUSCREW_PORT=8899 MAUSCREW_WEBHOOK_PORT=8901 \
  node --experimental-strip-types server/index.ts &          # harness
MAUSCREW_PORT=8899 npx vite --port 5299 --strictPort &        # arayüz
node test-sweep/scripts/probe1.mjs                            # örnek probe
```
Kapatma: `netstat -ano | grep -E "127.0.0.1:(8899|8901|5299).*LISTENING"` → `taskkill //PID <pid> //F`.
**Kullanıcının gerçek uygulaması 8799/8800'de olabilir; oraya dokunma.**

---

# A. Güvenlik açıkları (öncelikli)

## [x] A1 — Dosya yazma izin kapısı MausCrew politikasına bağlandı

**Sonuç.** Claude varsayılanı `manual` oldu. Bash/Write/Edit/MultiEdit/NotebookEdit için geçici
`PreToolUse` hook'u mevcut permission broker'a bağlandı ve ulaşılamazlık/zaman aşımında kapalı kalıyor.
Canlı rig'de dış workspace `Write` kartı reddedildi; hedef dosya oluşmadı ve audit `denied` kaydetti.
Argüman, varsayılan kip ve izolasyon regresyon testleri eklendi.

## [x] A2 — Host Claude ayarları ve kişisel bağlayıcılar izole edildi

**Sonuç.** Claude botu özel workspace cwd'sinde, yalnız `project,local` setting kaynakları ve
`--strict-mcp-config` ile çalışıyor; her tur taze sağlayıcı oturumu açıp MausCrew transkriptini
yeniden alıyor. Canlı rig yalnız MausCrew `computer/agents/routines/mauscrew` MCP'lerini gördü;
Gmail/Drive/Calendar ve üst dizin `CLAUDE.md` içeriği görünmedi.

## [x] A3 — Browser/network güvenli varsayılanı ASK oldu

**Sonuç.** `WebSearch` doğru sınıflandırıldı; varsayılan Browser ve Network kararı `ASK` yapıldı ve
önceki açık gömülü politika için migration eklendi. Policy engine/loader testleri ve canlı audit geçti.

---

# B. Kalan testler (bitmemiş doğrulama)

| # | Test | Nasıl | Ön koşul |
|---|---|---|---|
| [x] B1 | Kart gösteren bir araçla tam onay akışı | Bash allow/deny/always-allow + sonraki auto-allow ve dış workspace Write deny canlı geçti; 15 dk timeout fail-closed yapılandırıldı, canlı 15 dk bekletilmedi | tamamlandı |
| [x] B2 | Oda (group) turu: `@mention` ile çok botlu konuşma, sıralı konuşma, hop limiti | `live6`: iki bot sırayla yanıtladı, tek zincir hop'u çalıştı, üçüncü yanıt oluşmadı | tamamlandı |
| [x] B3 | Proje odası izolasyonu | `live6`: proje işareti prompt'a girdi; özel bot transkripti ayrı kaldı; workspace korundu | tamamlandı |
| [x] B4 | Diğer motorlarda smoke tur | 2 Eyl: 11 sağlayıcı tarandı. **Çalışan:** Claude, Codex, Grok, DeepSeek Harness (env anahtarı), DeepSeek gateway (anthropic ucu), OpenRouter gateway (`anthropic/*` modelleriyle). **Giriş gerekiyor (doğru raporlanıyor):** Kimi, Droid, OpenCode Go. **Sürüm eski:** Antigravity (agy 1.0.0). Üç ürün hatası bulundu ve düzeltildi → bölüm D | tamamlandı |
| [x] B5 | Motor failover zinciri | `live8` düzeltme sonrası ilk koşuda kontrollü 429 sonrası Claude → Codex devrini, geçmiş bildirimini ve token cevabını geçti; tekrar koşusunda Codex kullanım limiti ayrıca görüldü | tamamlandı (ilk başarılı koşu) |
| [x] B6 | Mesaj dallanma (branching) ve düzenleme | `live5`: 14/14; kardeş dallar ve iki yönlü `activeLeafId` geçişi doğrulandı | tamamlandı |
| [x] B7 | Hafıza / digest | `live9` 8/8 journal/enjeksiyon; otomatik uzun-konuşma digest planlama ve task kalıcılığı testli | tamamlandı |
| [x] B8 | PC kontrolü (Local VM) | 2 Eyl: imaj zaten indirilmişti, konteyner çalışıyordu — yeniden oluşturmaya gerek kalmadı. Gerçek uygulamanın (8799) VM'i `ready`, `desktopReady`. Botun kullandığı `container-mcp` doğrudan sürüldü: 57 araç, `get_desktop_state` PNG/JPEG kare, `launch_app` terminal açtı, `click` + `type_text` + `press_key` (foreground delivery) ile `/tmp/probe.txt` yazılıp `cat` ile geri okundu — ekran görüntüsünde çıktı görünüyor. Sınıflandırılmamış araç adı fail-closed reddediliyor | tamamlandı |
| [x] B9 | Composio/Plugins bağlantı akışı | 2 Eyl: kullanıcının anahtarıyla geçti — katalog canlı API'den **500 toolkit**, logo proxy'si SVG'yi aynı origin'den veriyor (bilinmeyen slug 404), 24 curated servisin bağlantı durumu okunuyor, `POST /authorize` geçerli `connect.composio.dev` onay URL'i üretiyor (açılmadı), `DELETE` temiz dönüyor. Not: anahtar uygulama config'inde boştu; MausCrew `COMPOSIO_API_KEY` ortam değişkenini de okuyor (`config.ts:195`) — kalıcı olması için Ayarlar → Connections'a girilmeli | tamamlandı |
| [x] B10 | Sesli yanıt (TTS) | 2 Eyl: kullanıcının ElevenLabs anahtarı `~/.mauscrew/config.json` içinde mevcuttu. 21 ses listelendi, `prepare` ready döndü, `speak` 200 + `audio/mpeg` + 10.910 bayt geçerli MP3 (ID3) üretti; 500 karakter faturalama sınırı 413, boş metin 400 | tamamlandı |
| [~] B11 | Mobil uzak erişim | 2 Eyl: Tailscale 1.102.2 kurulu ve çalışıyor; serve zaten `https://umut.tail1ea60f.ts.net → localhost:8799` (gerçek uygulama). Canlı zincir doğrulandı: tailnet HTTPS üzerinden `/api/health` → **401 `pairing required`** (ingress + uzak istek koruması çalışıyor). Eşleme kodunun telefonda kullanılması test edilmedi | **Kalan:** telefon adımı; ayrıca rig üzerinden test `tailscale serve` eşlemesini gerçek uygulamadan çalar — kullanıcı onayı ister |
| [x] B12 | Electron paketleme, updater ve kurulu-app smoke | `pnpm package:win` geçti; v0.1.45 EXE/ZIP/blockmap/latest.yml oluştu; updater 23/23, Electron parse 23/23, `/S` exit 0 ve kurulu health başarılı | paket + sessiz kurulum tamamlandı; yayın yapılmadı |

B12 EXE SHA-256: `B3C85F676F0EAD7D8E89AA08FB920FBBF9FDC2FCEA015ED5A50FD7332AB43102`.

---

# C. Küçük işler (isteğe bağlı)

- [x] C1 — `POST /api/bots` artık ad kabul ediyor, 1–64 karakter doğruluyor ve aynı adı
  büyük/küçük harf duyarsız 409 ile reddediyor; API testi var. **2 Eyl ek:** tekillik artık
  route'ta değil `store.createBot`'ta — takım içe aktarımı ve Chief'in bot önerisi de kapsanıyor
  (çakışan ad numaralanır: `Panko 2`).
- [x] C2 — `GET /api/remote/devices/:id` eklendi.
- [x] C3 — ikincil sayfa/modal bileşenleri lazy-load edildi ve manual chunk bölme eklendi;
  ana başlangıç chunk'ı 1,3 MB'tan 380,12 kB'a indi. 500 kB üstündeki kalanlar isteğe bağlı Shiki gramerleri.
- [~] C4 — `npx eslint .` → **0 hata / 100 uyarı**. Dağılım: 76 `no-explicit-any` (tamamı
  JSON-RPC/wire sınırlarında, tipsiz protokol mesajı ayrıştıran yerlerde — kasıtlı),
  12 `react-hooks/set-state-in-effect`, 8 kadar React-compiler kuralı (store'daki `stateRef`
  aynası ve `useMemo` içindeki timer gibi bilinçli desenler), 1 `prefer-const` (ileri referans
  için `let` şart). Bunları değiştirmek düzeltme değil refactor olur; davranışı riske atmamak
  için bilerek bırakıldı.
- [x] C5 — `test-sweep/` klasörü bu talebin kanıt ve devir kaydı olduğu için korundu; kullanıcı
  özellikle bu iki belge üzerinden devam edilmesini istediğinden silinmedi.

---

# D. Bu turda zaten yapılanlar (tekrar yapma)

| Konu | Dosya | Durum |
|---|---|---|
| Delege edilen bot adımını raporlayamıyordu (thread şartı) | `server/index.ts`, `server/workflows.ts` (`canUpdateStep`) | ✅ test edildi |
| Derinlik kapağında agents MCP hiç yüklenmiyordu | `server/drivers/agents-proxy.ts` (`visibleTools`), `server/index.ts` | ✅ canlı doğrulandı |
| Takılan `sending` review kayıtları | `server/review-queue.ts` (`recoverStuckDeliveries`) | ✅ |
| "sent" gerçekten gönderildi demek değildi | `server/review-queue.ts` (`deliveryOutcome`) + prompt | ✅ |
| Başarısız gönderimi tekrar deneme | `server/index.ts`, `src/components/ReviewQueuePage.tsx` | ✅ |
| Org chart döngüde bot gizliyordu + atama sıralaması | `src/lib/org-chart.ts` | ✅ |
| Review silme / workflow iptal route + UI | `server/index.ts`, `ReviewQueuePage`, `WorkflowsPage` | ✅ |
| SSE/POST yarışı (UI "SENDING"de takılıyordu) | `src/state/store.tsx` | ✅ |
| `POST /api/bots` SSE yayını yapmıyordu | `server/index.ts` | ✅ |
| Routine doğrulama hataları 500 dönüyordu | `server/routines.ts` (`invalid()`) | ✅ |
| `modelSelection` tip doğrulaması | `server/index.ts` | ✅ |
| Sahte ACP CLI `session/load`'da mcpServers'ı yok sayıyordu | `server/testing/fake-acp-cli.ts` | ✅ |
| ACP motorlarında kimlik hatası sıradan hata sayılıyordu (setup bayrağı ve giriş komutu yok) | `server/drivers/acp/core.ts` (`isAuthFailureMessage`) | ✅ regresyon + canlı Kimi |
| Süresi dolmuş token'la motor "giriş yapılmış" görünüyordu | `server/harness/registry.ts` (`noteAuthFailure`), `server/index.ts` | ✅ regresyon + canlı |
| Antigravity: agy 1.0.0 "hazır" görünüp her turda yardım metni döküyordu | `server/drivers/antigravity.ts` (`meetsMinimumAgyVersion`) | ✅ regresyon + canlı |
| Gateway "deferred custom tools" 400'ü ham API hatası olarak düşüyordu | `server/drivers/claude.ts` (`deferralRefusal`) | ✅ regresyon + canlı |
| Adı açıkça verilen botlarda tekillik yoktu: aynı takım dosyasını iki kez almak iki "Panko" üretiyor, `@Panko` birine ulaşamıyordu | `server/names.ts` (`uniqueBotName`), `server/store.ts` | ✅ regresyon + canlı (Panko / Panko 2 / Panko 3) |
| Room/Project Room turları seçili model/effort'u sağlayıcıya göndermiyordu | `server/index.ts`, `server/comms.test.ts` | ✅ regresyon + canlı 11/11 |
| Claude provider result 429/billing hataları failover'a ulaşmıyordu | `server/drivers/claude.ts`, `server/drivers/claude.test.ts` | ✅ regresyon + canlı devir |
| fallbackChain API'den sonra kayboluyordu | `server/config.ts`, `server/index.test.ts` | ✅ kalıcılık regresyonu + canlı devir |
