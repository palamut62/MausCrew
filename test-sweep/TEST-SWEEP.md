# MausCrew — Tam Kapsam Test Süreci (canlı kayıt)

Bu dosya, "tüm özellikleri en üst seviyede test et" isteğiyle başlayan test turunun
kalıcı kaydıdır. Başka bir araç/oturum buradan devam edebilir: rig nasıl kurulur,
ne test edildi, ne bulundu, ne değişti, ne kaldı — hepsi aşağıda.

Son güncelleme: 2026-08-31, oturum içi.
Test edilen sürüm: `package.json` 0.1.45, çalışma ağacı (commit edilmemiş değişikliklerle).

---

## 1. Test ortamı (rig) — nasıl kurulur

Kullanıcının gerçek verisine **dokunulmaz**; izole bir veri dizini kullanılır.

```bash
# 1) izole veri dizini + harness (8899) + webhook alıcı (8901)
mkdir -p /c/Users/umuti/AppData/Local/Temp/mc-rig
cd "C:/Users/umuti/Projects/opendeepseekhearnesmanusbot/MausCrew"
MAUSCREW_DATA_DIR=/c/Users/umuti/AppData/Local/Temp/mc-rig \
MAUSCREW_PORT=8899 MAUSCREW_WEBHOOK_PORT=8901 \
node --experimental-strip-types server/index.ts > /c/Users/umuti/AppData/Local/Temp/mc-rig/server.log 2>&1 &

# 2) arayüz (API proxy'si 8899'a gider)
MAUSCREW_PORT=8899 npx vite --port 5299 --strictPort
```

Notlar:
- Kullanıcının gerçek MausCrew uygulaması 8799/8800'de çalışıyor olabilir — çakışmasın diye 8899/8901.
- Rig'i kapatma: `netstat -ano | grep -E "127.0.0.1:(8899|8901|5299).*LISTENING"` → `taskkill //PID <pid> //F`.
- Temizlik: `rm -rf /c/Users/umuti/AppData/Local/Temp/mc-rig`.
- Kurulu motorlar (bu makinede): claude 2.1.251, codex 0.151.0, droid, grok, kimi, opencode; docker 29.7.2. gemini/antigravity CLI yok.

### Probe betikleri
`test-sweep/scripts/` altında (bu depoya kopyalandı, atılabilir):

| Betik | Kapsam |
|---|---|
| `probe1.mjs` | health, instances, config, bots CRUD, tasks, rooms, projects, shared workspace |
| `probe2.mjs` | routines (cron), manuel run, webhooks, MCP kaydı, skills, security policy, local/host computer, remote, connectors, TTS |
| `probe3.mjs` | webhook teslimatı (bearer + capability URL + red senaryoları), MCP şeması, skills CRUD |
| `probe4.mjs` | güvenlik sınırları: Host/Origin, internal token, gövde limiti, path traversal, SSE, policy round-trip |
| `probe5.mjs` | team export/import, mesaj reaksiyonları, task yaşam döngüsü, takeover, steer/interrupt, config |
| `live1.mjs` | **gerçek motorla**: tur, ask_bot delegasyonu, create_workflow, queue_review, izin kartı |
| `live2.mjs` | **gerçek motorla**: delege edilen botun kendi adımını raporlaması + queue_review (depth-1) |
| `live3.mjs` | **gerçek motorla**: botun kendini zamanlaması + zamanlanmış (cron) çalışma |
| `live4.mjs` | **gerçek motorla**: shell izin kartı, deny ve stale-answer denemesi (R3 nedeniyle kart oluşmuyor) |
| `live5.mjs` | **gerçek motorla**: mesaj düzenleme, iki dal ve `activeLeafId` geçişi |
| `live6.mjs` | **gerçek motorla**: iki botlu oda, sıralama, tek-hop sınırı ve Project Room izolasyonu |
| `live7.mjs` | **gerçek motorla**: Codex/Grok/Kimi/Droid/OpenCode Go/DeepSeek smoke turları |
| `live8.mjs` | **gerçek motorla**: kontrollü 429 sonrası Claude → Codex failover ve transkript bildirimi |
| `live9.mjs` | **gerçek motorla**: otomatik journal harvest + sonraki tur bellek enjeksiyonu |

Çalıştırma: `node test-sweep/scripts/probe1.mjs` (rig ayakta olmalı).

---

## 2. Yapılan testler ve sonuçları

### 2.1 Statik kapılar
| Kontrol | Sonuç |
|---|---|
| `npx vitest run` (tüm paket) | ✅ 1040 geçti / 16 skip / 0 hata (115 dosya geçti, 3 dosya skip) |
| `npx tsc -b` (client) | ✅ temiz |
| `npx tsc -p tsconfig.server.json` | ✅ temiz |
| `npx eslint .` | ✅ 0 hata, 149 uyarı (uyarı backlog'u; test-sweep Node global kapsamı düzeltildi) |
| `node --test electron/*.node-test.mjs` | ✅ 23 geçti (updater/tray) |
| `npx vite build` | ✅ ana başlangıç chunk'ı 1,3 MB → 380 kB; yalnız isteğe bağlı Shiki dil gramerleri 500 kB üzerinde |

### 2.2 API yüzeyi (izole rig)
| Alan | Sonuç | Not |
|---|---|---|
| health / instances / config | ✅ | 9 motor, 8'i available; config sır sızdırmıyor |
| bots CRUD + tasks + threads | ✅ | chiefOfStaff tekilliği, 404'ler, sayfalama doğru |
| rooms (groups) | ✅ | üye, bülten, defaultResponder |
| projects | ✅ | oda otomatik açılıyor, güncelleme/silme |
| team export/import | ✅ | manifest sırsız; bozuk manifest 5 farklı yoldan reddediliyor |
| routines (cron) | ✅ | daily/interval/once, enable/disable, calendar penceresi, manuel run |
| routine runs | ✅ | quiet watch, restart kurtarma ("MausCrew restarted while this routine was running") |
| webhooks | ✅ | bearer + capability URL kabul; yanlış/eksik secret 401; GET 405; silinen hook 404; attempt kaydı |
| MCP registry | ✅ | şema doğrulama, 30 sunucu limiti, newline injection reddi, env değerleri asla echo edilmiyor |
| skills | ✅ | create/list/update/delete, duplicate 409, path traversal reddi, rename reddi |
| security policy + audit | ✅ | round-trip, geçersiz verdict reddi, 415 content-type, audit sorgulanabilir |
| local VM / host CUA / browser sessions / profile | ✅ (durum) | docker görülüyor; host CUA bu ortamda `supported:false, session:headless` |
| remote | ✅ | HTTPS adresi olmadan pairing reddi, localhost'tan claim reddi |
| takeover / steer / interrupt | ✅ | boştayken temiz cevap |
| güvenlik sınırları | ✅ | yabancı Host 403, Host'suz 403, cross-origin 403, internal API 401, 5MB gövde 413, 4 path-traversal denemesi bloke |
| SSE | ✅ | `text/event-stream`, hello frame, canlı patch'ler (UI'da doğrulandı) |

### 2.3 Canlı ajan davranışları (gerçek claude motoru)
| Senaryo | Sonuç |
|---|---|
| Düz tur (PONG) | ✅ ~10s, cevap doğru, token/maliyet sayacı işliyor |
| `ask_bot` delegasyonu | ✅ Chief → Scout → cevap geri katlandı; comms kanalı ("Chief ⇄ Scout") oluştu |
| `create_workflow` | ✅ chief workflow yarattı, adımlar/bağımlılıklar UI'da |
| `update_workflow_step` (delege edilen bot) | ✅ **düzeltmeden sonra** — Scout adımı `blocked` işaretledi + output yazdı (dürüst davranış) |
| `queue_review` (delege edilen bot) | ✅ **düzeltmeden sonra** — Scout kuyruğa yazabildi |
| Özyineleme sınırı | ✅ depth-1 turda ask_bot/delegate_bot/create_bot yok; "one hop" hatası hiç oluşmadı |
| Review kuyruğu onay/iptal | ✅ pending → dismissed; gönderim yok |
| Bot kendini zamanladı | ✅ "Probe daily" günlük 09:00, sahibi doğru, nextRunAt hesaplandı |
| Zamanlanmış (cron) çalışma | ✅ Watch (15dk) 3 kez kendiliğinden koştu; 2'si `quiet`; One-shot koştu; Probe tick (5dk) tetiklendi |
| İzin kartı (shell/filesystem) | ✅ yeni izole Claude turu: Bash allow/deny/always-allow ve sonraki otomatik izin; dış workspace `Write` deny, dosya oluşmadı, audit `denied` |
| Mesaj düzenleme / dallanma | ✅ `live5`: 14/14; iki sürüm kardeş dal, `activeLeafId` iki yöne doğru geçiyor |
| Çok botlu oda + hop sınırı | ✅ `live6`: iki bot sıralı konuştu; bir zincirleme mention çalıştı; üçüncü hop oluşmadı |
| Project Room izolasyonu | ✅ `live6`: proje talimatı prompt'a girdi; oda transkripti özel bot görevine sızmadı; workspace korundu |
| Motor failover | ✅ `live8` düzeltme sonrası ilk koşu: kontrollü 429 sonrası Codex'e devir, geçmiş bildirimi ve token cevabı; tekrar koşusu Codex kullanım limitiyle durdu |
| Hafıza / journal | ✅ `live9`: 8/8; ayrıca otomatik uzun-konuşma digest planlama + task kalıcılığı eklendi ve regresyon testleri geçti |
| Diğer motorlar | ⚠️ Codex/Grok geçti; Kimi 0.27.0 boş `end_turn`; Droid/OpenCode Go oturumsuz; DeepSeek 3 dk sonra iptal |

### 2.4 Arayüz turu (tarayıcı)
Ekran görüntüleriyle doğrulandı: sohbet + workflow/review kartları, Review queue (retry/sil), Workflows (cancel),
Org chart (canlı/bitmiş), Automations (haftalık takvim + Webhooks sekmesi), Plugins (Composio kataloğu, anahtar uyarısı),
Ayarlar (General/Connections/Local VM/Security/Voice/Mobile), bot ayarları (Chief of Staff, peer onayı, model, kullanım
sayaçları, hafıza, Skill Center). Konsolda hata yok.

---

## 3. Bulgular

### 3.1 Düzeltilen hatalar (bu oturumda)
| # | Bulgu | Dosya | Durum |
|---|---|---|---|
| 1 | Delege edilen bot workflow adımını güncelleyemiyordu (thread eşitliği şartı) | `server/index.ts` + `server/workflows.ts` (`canUpdateStep`) | ✅ düzeltildi + test |
| 2 | Delege edilen turda **agents MCP hiç yüklenmiyordu** → `update_workflow_step`/`queue_review` imkânsız | `server/drivers/agents-proxy.ts` (`visibleTools`), `server/index.ts` | ✅ düzeltildi + test + canlı doğrulama |
| 3 | Takılan `sending` review kayıtları kurtarılamıyordu | `server/review-queue.ts` (`recoverStuckDeliveries`) | ✅ düzeltildi + test + canlı |
| 4 | "sent" durumu gerçekten gönderildiği anlamına gelmiyordu | `server/review-queue.ts` (`deliveryOutcome`) | ✅ düzeltildi + 5 test |
| 5 | Başarısız gönderim tekrar denenemiyordu | `server/index.ts` + `ReviewQueuePage` (Retry) | ✅ eklendi + canlı |
| 6 | Org chart karşılıklı delegasyonda bot gizliyordu | `src/lib/org-chart.ts` | ✅ düzeltildi + 3 test |
| 7 | Ölü kod: review silme / workflow iptal | yeni route'lar + UI | ✅ eklendi + canlı |
| 8 | SSE/POST yarışı: onay sonrası UI "SENDING"de takılıyordu | `src/state/store.tsx` (updatedAt guard) | ✅ düzeltildi + canlı |
| 9 | `POST /api/bots` SSE yayını yapmıyordu (ikinci istemci botu görmüyordu) | `server/index.ts` | ✅ düzeltildi |
| 10 | Routine doğrulama hataları **500** dönüyordu (400 olmalı) | `server/routines.ts` (`invalid()`) | ✅ düzeltildi + 5 test |
| 11 | `modelSelection.instanceId` string olmayan değerle kaydediliyordu | `server/index.ts` | ✅ 400 doğrulaması eklendi |
| 12 | Test sahtesi (`fake-acp-cli`) `session/load`'da mcpServers'ı yok sayıyordu | `server/testing/fake-acp-cli.ts` | ✅ düzeltildi |
| 13 | Oda/Project Room turları botun seçili modelini ve effort'unu sağlayıcıya göndermiyordu; host CLI varsayılan modele düşüyordu | `server/index.ts` + `server/comms.test.ts` | ✅ düzeltildi + regresyon testi + canlı 11/11 |
| 14 | Claude CLI sağlayıcı 429/billing hatasını yalnız başarısız `result` olarak taşıyor, failover sınıflandırıcısına `runtime.error` ulaşmıyordu | `server/drivers/claude.ts` + `server/testing/fake-claude-cli.ts` + test | ✅ düzeltildi + test + canlı devir |
| 15 | `/api/config` fallback zincirini kabul ediyor fakat `saveConfig()` diske yazmıyordu | `server/config.ts` + `server/index.test.ts` | ✅ düzeltildi + kalıcılık testi + canlı devir |
| 16 | Claude `acceptEdits` nedeniyle MausCrew dosya izin kapısını atlıyordu | `server/drivers/claude.ts` + test | ✅ manual kip + PreToolUse broker hook'u; dış workspace Write canlı deny/audit |
| 17 | Claude host ayarları, üst dizin talimatları ve kişisel bağlayıcıları miras alıyordu | `server/index.ts`, `server/drivers/claude.ts` + test | ✅ özel workspace, project/local settings, strict MCP ve her tur taze sağlayıcı oturumu; canlı izolasyon |
| 18 | Varsayılan browser/network politikası gözetimsiz web araştırmasına izin veriyordu | governance action/policy engine/loader + test | ✅ Browser/Network ASK, `WebSearch` sınıflandırması ve eski politika migrasyonu |
| 19 | Bot oluşturma adı yok sayılıyor ve aynı isimler kabul ediliyordu | `server/index.ts` + test | ✅ ad doğrulama + büyük/küçük harf duyarsız 409 tekillik |
| 20 | Uzak cihaz için tekil GET route'u yoktu | `server/index.ts` | ✅ `GET /api/remote/devices/:id` eklendi |
| 21 | Uzun konuşma digest'i otomatik planlanmıyor ve task'a kalıcı yazılmıyordu | `server/index.ts`, `server/store.ts` + test | ✅ otomatik harvest + task digest kalıcılığı |
| 22 | Ana istemci başlangıç chunk'ı 1,3 MB idi | `src/App.tsx`, `vite.config.ts` | ✅ ikincil yüzeyler lazy-load; ana chunk 380,12 kB |
| 23 | Claude sürücü türü `claude` sanıldığı için izolasyon ve taze oturum dalları çalışmıyordu | `server/index.ts` | ✅ gerçek `claudeAgent` türüne bağlandı; canlı cwd/MCP kanıtı |
| 24 | Paketlenmiş uygulama soğuk Windows başlangıcında 20 sn sınırını aşıp sağlıklı sunucuyu erken kapatıyordu | `electron/main.mjs` | ✅ başlangıç penceresi 60 sn; yeniden paketleme, sessiz kurulum ve canlı health doğrulaması |

### 3.2 Güvenlik risklerinin kapanış durumu
- **R1 kapandı:** `WebSearch` browser/network olarak sınıflandırılıyor; varsayılan Browser ve Network
  kararları `ASK`. Eski gömülü politika güvenli varsayılana migrate ediliyor. Test ve canlı audit kanıtı var.
- **R2/R4 kapandı:** Claude turları botun özel workspace'inde, `project,local` setting kaynakları ve
  `--strict-mcp-config` ile açılıyor. Canlı tur yalnız MausCrew'in `computer/agents/routines/mauscrew`
  MCP'lerini gördü; host Gmail/Drive/Calendar araçları ve üst dizin `CLAUDE.md` içeriği görünmedi.
- **R3 kapandı:** Claude varsayılanı `manual`; Bash/Write/Edit/MultiEdit/NotebookEdit PreToolUse hook'u
  mevcut permission broker'a bağlandı. Dış workspace `Write` kartta reddedildi, hedef dosya oluşmadı
  ve audit sonucu `denied` oldu. Bash allow/deny/always-allow ile sonraki otomatik onay canlı doğrulandı.

### 3.3 Not edilen, hata olmayan davranışlar
- Proje `workspacePath` mutlak her yolu kabul eder (ev dizininin kendisi hariç) — tasarım.
- Local VM bu makinede "durable workspace eksik; yeniden oluştur" diyor — **dokunulmadı** (yıkıcı).
- Kimi CLI 0.27.0 oturum açmış görünse de `session/new` boş model listesi verdi ve araçsız smoke turunu
  metinsiz `end_turn` ile bitirdi; sürücü 0.29.1 davranışına göre yazılmış. CLI yükseltmesiyle tekrar test edilmeli.
- Droid ve OpenCode Go ikili dosyaları kurulu olduğu için `state:available`, fakat `authenticated:false`.
  Droid açık bir giriş hatası verdi; OpenCode Go abonelik modeli ACP kataloğunda görünmedi.
- DeepSeek Harness `turn.started`/`session.started` üretti ama üç dakikada cevap vermedi; iptal sonrası
  `turn.completed(ok:false, stopReason:cancelled)` ile temiz kapandı.

---

## 4. Kalan testler (yapılacak)

| # | Test | Nasıl | Ön koşul |
|---|---|---|---|
| ~~K1~~ | ~~Tam test paketi~~ | ✅ **1040 geçti / 16 skip / 0 hata** | — |
| ~~K2~~ | ~~Zamanlanmış çalışma~~ | ✅ "Probe tick" kendiliğinden koştu ve `completed` oldu | — |
| ~~K3~~ | ~~İzin kartı akışı~~ | ✅ Bash allow/deny/always-allow + sonraki otomatik izin; dış workspace Write deny + audit | — |
| ~~K3b~~ | ~~Kart gösterilen araçla tam karar akışı~~ | ✅ allow/deny/always-allow canlı; 15 dk timeout fail-closed kod yolu yapılandırıldı (canlı 15 dk bekletilmedi) | — |
| ~~K4~~ | ~~Oda (group) turu: @mention ile çok botlu konuşma~~ | ✅ `live6` 11/11 paketinin oda kısmı geçti | — |
| ~~K5~~ | ~~Proje odası izolasyonu: proje talimatlarının prompt'a girmesi~~ | ✅ talimat + ayrı transkript + workspace doğrulandı | — |
| K6 | Diğer motorlarda smoke tur | ⚠️ Codex/Grok geçti; Kimi sürümü eski; Droid/OpenCode oturumsuz; DeepSeek timeout | motor kurulumu/giriş |
| ~~K7~~ | ~~Motor failover~~ | ✅ `live8` düzeltme sonrası koşuda kontrollü 429 sonrası Claude → Codex devrini, geçmiş bildirimini ve başarılı cevabı doğruladı; tekrar koşusunda Codex kullanım limiti görüldü | — |
| K8 | Bilgisayar kullanımı (PC control) | Local VM'i yeniden oluşturup `computer` aracıyla ekran görüntüsü/tıklama | **yıkıcı** — kullanıcı onayı şart |
| K9 | Composio/Plugins bağlantısı | Composio project key gerekiyor | anahtar |
| K10 | Sesli yanıt (TTS) | ElevenLabs anahtarı gerekiyor | anahtar |
| K11 | Mobil uzak erişim uçtan uca | Tailscale Serve + HTTPS adresi + telefon eşleme | ağ kurulumu |
| ~~K12~~ | ~~Mesaj dallanma (branching) / düzenleme~~ | ✅ `live5` 14/14 geçti | — |
| ~~K13~~ | ~~Hafıza/digest~~ | ✅ `live9` 8/8 journal/enjeksiyon; otomatik uzun konuşma digest planlama ve task kalıcılığı regresyon testli | — |
| K14 | DeepSeek Harness turu | ❌ başladı, üç dakikada yanıt vermedi; kontrollü iptal temiz tamamlandı | runtime teşhisi |
| ~~K15~~ | ~~Electron paketleme ve kurulu uygulama~~ | ✅ `pnpm package:win`; v0.1.45 EXE/ZIP/blockmap/latest.yml üretildi, 23/23 Electron betiği parse edildi, `/S` kurulum exit 0, kurulu app health geçti | yayın ayrıca onay ister |

Yerel EXE: `release/MausCrew-0.1.45-setup.exe` (109.606.862 bayt), SHA-256
`B3C85F676F0EAD7D8E89AA08FB920FBBF9FDC2FCEA015ED5A50FD7332AB43102`.
ZIP SHA-256: `FBD425353AA5D537A46249140A3A37CFAE6711755CD127858396A218B175792D`.
Kurulu EXE `0.1.45.0`; paketlenmiş sunucu `127.0.0.1:8799/api/health` üzerinde
`app:mauscrew`, `static:true` ve doğru ürün sahibi bilgisiyle yanıt verdi.

---

## 5. Değiştirilen dosyalar (bu oturum)

```
server/index.ts                     — workflow step yetkisi, agents entegrasyonu derinlik kapsamı,
                                      review delete + workflow cancel route'ları, retry, teslimat
                                      verdict'i, bot create broadcast, modelSelection doğrulaması
server/workflows.ts                 — canUpdateStep()
server/review-queue.ts              — deliveryOutcome(), recoverStuckDeliveries()
server/routines.ts                  — invalid() ile 400'lük doğrulama hataları
server/drivers/agents-proxy.ts      — visibleTools(): depth kapağında sadece raporlama araçları
server/testing/fake-acp-cli.ts      — session/load'da mcpServers, tools/list'e bakan ask/delegate modları,
                                      yeni "list-agent-tools" modu
server/index.ts                     — Room turlarında seçili model/effort normalizasyonu ve dispatch
server/comms.test.ts                — Room modelinin ACP CLI'a taşındığı regresyon testi
server/config.ts                    — fallbackChain kalıcılığı
server/index.test.ts                — fallbackChain diske yazma regresyon testi
server/drivers/claude.ts            — başarısız provider result'ını runtime.error'a taşıma
server/drivers/claude.test.ts       — rate-limit olay regresyonu
server/testing/fake-claude-cli.ts   — rate-limited test modu
server/drivers/claude.ts            — manual izin kipi, PreToolUse broker hook'u, strict settings/MCP izolasyonu
server/governance/action.ts         — WebSearch sınıflandırması
server/governance/policy-engine.ts  — güvenli browser/network ASK varsayılanları
server/governance/policy-loader.ts  — eski açık ağ varsayılanının migrasyonu
server/store.ts                     — otomatik task digest kalıcılığı
server/index.ts                     — isimli/tekil bot create, remote device GET, otomatik digest,
                                      Claude özel workspace/taze oturum ve doğru driverKind
src/App.tsx, vite.config.ts          — ikincil sayfaları lazy-load + üretim chunk bölme
eslint.config.js                    — test-sweep Node/web çalışma ortamı global kapsamı
src/lib/org-chart.ts                — döngü koruması, atamaların gerçek tarihe göre sıralanması
src/state/store.tsx                 — deleteReview/cancelWorkflow/reviewDeleted, updatedAt yarış koruması
src/components/ReviewQueuePage.tsx  — Retry + geçmişten silme
src/components/WorkflowsPage.tsx    — Cancel
testler: server/workflows.test.ts, server/review-queue.test.ts, server/routines.test.ts,
         server/comms.test.ts, server/drivers/agents-proxy.test.ts, server/drivers/claude.test.ts,
         server/config.test.ts, server/index.test.ts, src/lib/org-chart.test.ts
test-sweep/scripts/live5.mjs         — canlı branching
test-sweep/scripts/live6.mjs         — canlı room/project
test-sweep/scripts/live7.mjs         — çok motorlu smoke
test-sweep/scripts/live8.mjs         — canlı failover
test-sweep/scripts/live9.mjs         — canlı journal/memory
test-sweep/scripts/live1.mjs         — lint için kullanılmayan argüman işaretlemesi
test-sweep/scripts/probe5.mjs        — lint için kullanılmayan yardımcı temizliği
release/MausCrew-0.1.45-setup.exe   — yerel NSIS paket (yayınlanmadı/kurulmadı)
release/MausCrew-0.1.45-x64.zip     — yerel taşınabilir paket
electron/main.mjs                   — soğuk Windows başlangıcı için 60 sn server health penceresi
```

## 6. Temizlik
```bash
rm -rf /c/Users/umuti/AppData/Local/Temp/mc-rig      # rig verisi
# test-sweep/ klasörü de silinebilir; depoya kalıcı bir şey eklemez
```
