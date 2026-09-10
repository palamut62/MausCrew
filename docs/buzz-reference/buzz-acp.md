# Buzz ACP Referans Haritası

## Buzz nasıl yapıyor?

`buzz-acp`, relay event'lerini ACP konuşan Codex, Claude Code, Goose veya özel agent subprocess'lerine bağlayan harness'tir. Channel/thread scope'a göre session cache tutar, mention ve reply'ları queue'ya alır, lazy pool ile ilk işe kadar process başlatmayabilir, owner komutlarıyla cancel/rotate/shutdown uygular ve crash sonrası tek bir respawn yoluna sahiptir. Idle timeout ile mutlak turn timeout ayrıdır. Heartbeat prompt'u ile presence heartbeat'i ayrı kavramlardır.

Girdiler relay event'leri, agent command/config ve control frame'leridir. Çıktılar ACP prompt/update'leri, relay mesajları, lifecycle/usage observation event'leridir. Queue/pool, session scope ve in-flight turn state taşır. Author gate ve workflow provenance kontrolü agent'a ulaşmadan önce uygulanır.

## MausCrew şu anda nasıl yapıyor?

`ProviderDriver`/`ProviderInstance` provider başlatma, turn gönderme, interruption, model discovery ve runtime event normalization sağlar. Claude, Codex ve diğer native sürücüler provider-specific continuation'ları task-owned transcript ile birleştirir. Bu güçlü bir provider adapter temelidir; fakat resmi ACP wire adapter'ı, ACP capability negotiation'ı ve ortak session lifecycle kaydı yoktur.

## Ne taşınmalı?

- ACP ayrıntılarını Crew Core'dan saklayan adapter.
- `initialize`, session create/load, prompt, cancel ve update mapping'i.
- Lazy wakeup, bounded queue ve crash/respawn politikası.
- Session scope ve provider continuation ayrımı.
- Idle ve wall-clock timeout'larının ayrı uygulanması.

## Ne taşınmamalı?

- Relay/channel üyeliği, Nostr owner key ve relay control event formatları.
- Tek Buzz kimliğine bağlı N process semantiği.
- Buzz CLI üzerinden cevap yayınlama kontratı.

## MausCrew karşılığı ne olacak?

Yeni `AgentProvider` interface'i `startSession`, `send`, `cancel`, `dispose` ve capability bilgisini sunacak. Var olan `ProviderDriver`, ilk adapter implementasyonu olacak. ACP provider ayrı modülde JSON-RPC stdio transport ile Codex/Claude/Goose komutlarını çalıştıracak; core yalnız canonical runtime event görecek. Session ownership bot/task'e ait kalacak.

## Teknik özet

| Başlık | Buzz | MausCrew hedefi |
|---|---|---|
| Purpose | Relay ile ACP agent arasında harness | Crew Core ile harici agent arasında adapter |
| Inputs | Mentions, controls, heartbeats | Routed inbox item, session config |
| Outputs | ACP prompts and relay replies | Canonical runtime events |
| State | Pool, queue, scoped sessions | Persisted session metadata, live process map |
| Events | Relay and observer lifecycle | `agent.*`, `message.*`, `tool.*` |
| Interfaces | Relay WS, ACP stdio | AgentProvider plus AcpTransport |
| Failure modes | Spawn, timeout, stale event | Spawn, protocol, timeout, crash, recovery |
| Concurrency | Agent pool and channel lock | Global limit and per-agent serialization |
| Security | Owner/provenance gate | Router auth plus permission boundary |
