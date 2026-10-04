# Buzz Mesh Referans Haritası

## Buzz nasıl yapıyor?

`buzz-relay-mesh` endpoint, peer, membership, gossip, registry, runtime ve wire katmanlarıyla relay'ler arası dağıtık yaşam döngüsü kurar. Relay ayrıca shared-compute agent boot/admission ve tunnel akışlarını koordine eder. Bu yapı membership değişimi, bağlantı kopması, stale peer, replay ve çok düğümlü concurrency gibi failure mode'ları taşır.

## MausCrew şu anda nasıl yapıyor?

MausCrew local ve remote computer provider'larına, Box çalışma alanlarına, provider abstraction'larına ve dweb proxy deneylerine sahiptir. Bunlar tam distributed inference mesh değildir. Model discovery ve execution tek bir `ComputeProvider` domain kontratı altında birleşmiş değildir.

## Ne taşınmalı?

- Yalnız `ComputeProvider` abstraction.
- `listModels` ve `execute` capability yüzeyi.
- Local/remote/shared capability metadata, health ve cancellation.
- Kullanım, fallback ve failure nedenlerinin audit edilmesi.

## Ne taşınmamalı?

- Gossip, peer membership, relay mesh ve federation.
- Distributed scheduling/consensus.
- Kubernetes, Redis veya PostgreSQL zorunluluğu.
- İlk fazlarda shared compute implementation'ı.

## MausCrew karşılığı ne olacak?

Phase 9'da core'a yalnız interface ve provider discovery kaydı eklenecek. `local`, `remote`, `shared` isimleri capability sınıflarıdır; `shared` başlangıçta unconfigured/unsupported dönebilir. ModelProvider ile ComputeProvider ayrımı korunacak: ilki model API'sini, ikincisi çalıştırma kapasitesinin nerede bulunduğunu temsil eder.

## Teknik özet

| Başlık | Buzz | MausCrew hedefi |
|---|---|---|
| Purpose | Distributed relay/shared compute | Future compute placement seam |
| Inputs | Peer and wire messages | ModelRequest plus provider selection |
| Outputs | Mesh events/results | ModelResponse plus health/usage |
| State | Peer registry and connections | Provider registry only |
| Events | Membership/gossip/lifecycle | Compute health and execution events |
| Interfaces | Mesh runtime/wire | ComputeProvider |
| Failure modes | Partition, stale peer, replay | Unavailable provider, timeout, cancel |
| Concurrency | Multi-node | Provider-specific bounded execution |
| Security | Membership and transport auth | Local config, credentials, project policy |
