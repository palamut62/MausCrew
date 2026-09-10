# Buzz Agent Referans Haritası

İnceleme tabanı: Buzz `82656ff`, MausCrew `e331e2a`.

## Buzz nasıl yapıyor?

`buzz-agent`, ACP üzerinden stdio JSON-RPC alan bağımsız bir aktördür. Her ACP session kendi model seçimini, konuşma geçmişini, iptal kanalını, kullanım sayaçlarını, MCP registry'sini ve context handoff sayacını taşır. Model döngüsü LLM çağrısı, permission broker, MCP tool çağrısı ve tool sonucunun yeniden modele verilmesi şeklindedir. Context eşiğinde eski geçmişi düz kesmek yerine özet/handoff üretir. Tool ve history boyutları sınırlıdır; cancellation LLM ve tool beklemelerine yayılır.

Kimlik Buzz genelinde Nostr public key ile temsil edilir. `buzz-acp` aynı kimlik altında birden fazla process çalıştırabilir; queue aynı channel'ın eşzamanlı işlenmesini engeller. Failure mode'lar provider timeout, bozuk ACP frame, tool timeout, permission cevapsızlığı, context/output limiti ve child-process crash'tir. Concurrency session ve tool seviyesinde limitlidir.

## MausCrew şu anda nasıl yapıyor?

`BotRecord` kalıcı bot kimliği, görevleri, provider cursor'ları, model seçimi, peer approval ve memory alanlarını taşır. `ProviderDriver` ve `ProviderInstance`, provider-specific runtime'ları ortak `RuntimeEvent` akışına çevirir. Task transcript'i provider'dan bağımsız ana süreklilik kaynağıdır. DeepSeek bridge uzun ömürlü process, cancellation ve approval mailbox sağlar; diğer provider sürücüleri aynı contract'a uyar.

Eksik ortak katman, her bot için canonical runtime session kaydı ve merkezi status state machine'dir. Durum bugün provider event'leri, mesajlar ve UI türetimleri arasında dağılmıştır. Standart heartbeat/stale modeli yoktur.

## Ne taşınmalı?

- Agent'ı kimliği ve session sınırı olan bağımsız aktör kabul etme.
- Session state izolasyonu, merkezi cancellation ve bounded history/tool output.
- Context eşiğine bağlı checkpoint/handoff.
- Provider-neutral runtime lifecycle ve usage event'leri.
- Crash'in yalnız ilgili session/task'i durdurması.

## Ne taşınmamalı?

- Nostr keypair zorunluluğu.
- Aynı görünür kimlik altında çok process'i MausCrew agent kimliği sanma.
- Buzz'a mesaj gönderme zorunluluğuna özgü reply guard.
- Rust subprocess mimarisini tüm internal agent'lara dayatma.

## MausCrew karşılığı ne olacak?

`AgentIdentity`, `AgentSession` ve `AgentRuntime` Crew Core domain modelleri olacaktır. Mevcut `BotRecord.id` ilk migration'da identity id olarak korunacak; provider cursor'ları session'a bağlanacaktır. `ProviderDriver` geriye dönük adapter olarak kalacak ve ileride `AgentProvider` yüzeyine sarılacaktır. Status yalnız `AgentStatusMachine` üzerinden değişecek; UI event store ve persistent domain state'ten türetecektir.

## Teknik özet

| Başlık | Buzz | MausCrew hedefi |
|---|---|---|
| Purpose | ACP-compliant tool-using actor | Local-first isolated agent runtime |
| Inputs | ACP prompt, config, MCP servers | Task, identity, provider, policy, inbox item |
| Outputs | ACP updates, tool calls, usage | Crew events, task effects, audited tool calls |
| State | Per-session in-memory history | SQLite session plus bounded live context |
| Events | ACP session updates, relay events | Typed `CrewEvent` lifecycle |
| Interfaces | ACP, MCP, provider HTTP | AgentProvider, ToolManager, EventBus |
| Failure modes | Timeout, cancel, crash, limits | Same plus stale and persisted recovery |
| Concurrency | Session/tool caps | Global and per-agent caps |
| Security | Permission broker before MCP | Permission engine at tool boundary |
