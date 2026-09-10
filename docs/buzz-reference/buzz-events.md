# Buzz Events Referans Haritası

## Buzz nasıl yapıyor?

Buzz'da her davranış imzalı Nostr event'tir. `buzz-core` kind registry, event/filter/verification gibi sıfır-I/O tiplerini sağlar. Relay event'i authenticate eder, doğrular, persist eder, side-effect üretir ve subscriber'lara fan-out yapar. Ephemeral presence event'leri kalıcı değildir. Bounded send buffer ve slow-client disconnect backpressure sağlar.

## MausCrew şu anda nasıl yapıyor?

Provider katmanı canonical `RuntimeEvent` üretir; server SSE/broadcast akışı ve UI store bu event'leri kullanır. Mesaj, workflow, delegasyon, audit ve project state ayrı JSON/NDJSON dosyalarında yaşar. Tüm domain işlemlerini birleştiren, correlation/causation taşıyan immutable event modeli ve replay edilebilir event store bulunmaz.

## Ne taşınmalı?

- Tek canonical event envelope.
- Append-only persistence, project/actor/correlation/causation alanları.
- Domain transaction sonrası publish ve replay cursor'u.
- Bounded subscriber queue, açık overflow politikası.
- UI için event projection, domain state için tek source of truth.

## Ne taşınmamalı?

- Kind integer registry, Schnorr signature ve NIP wire formatı.
- WebSocket relay'i local uygulamanın merkezine koyma.
- Redis pub/sub veya multi-relay federation.

## MausCrew karşılığı ne olacak?

`CrewEvent<T>` string event type ile kullanılacak. `EventStore.append` SQLite transaction içinde immutable satır ekleyecek; UPDATE API'si olmayacak. In-process `EventBus`, commit sonrası bounded subscriber'lara event iletecek. İlk event registry talimattaki agent, task, handoff, message, tool, approval, workflow ve git tiplerini kapsayacak; bilinmeyen type persist edilebilse de typed producer registry dışında üretilemeyecek.

## Teknik özet

| Başlık | Buzz | MausCrew hedefi |
|---|---|---|
| Purpose | Universal signed protocol | Internal domain integration contract |
| Inputs | Signed Nostr event | Validated CrewEvent draft |
| Outputs | Stored/fanned event | SQLite row and local subscribers |
| State | Relay DB and subscriptions | Event table and replay cursors |
| Events | Numeric kinds | Namespaced string types |
| Interfaces | Relay EVENT/REQ | EventStore and EventBus |
| Failure modes | Invalid signature, overload | Invalid payload, DB failure, overflow |
| Concurrency | Relay fan-out | Ordered append, bounded async delivery |
| Security | Crypto and tenant auth | Project scope and trusted producer context |
