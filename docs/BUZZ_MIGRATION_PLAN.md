# Buzz Fikirlerini MausCrew'e Uyarlama Planı

## Mimari yön

Buzz'ın korunacak ana fikri agent'ların bağımsız aktör olması ve kritik davranışların gözlemlenebilir event'lere dönüşmesidir. MausCrew'de relay, Nostr veya hosted federation kurulmayacaktır. Crew Core local process içinde, SQLite tek kalıcı domain kaynağı ve UI read-model tüketicisi olacaktır.

```text
Existing JSON managers and ProviderDriver
                |
        compatibility adapters
                |
       Crew Core services/events
                |
      SQLite repositories + EventBus
```

Migration boyunca JSON dosyaları bir anda silinmez. Bir domain SQLite'a geçtiğinde yazma yetkisi yalnız yeni repository'de olur; legacy dosya read/import kaynağına düşer. Dual-write kalıcı çözüm değildir.

## Fazlar ve ölçülebilir çıkışlar

### Phase 1 - Foundations

- `AgentIdentity`, `CrewEvent`, immutable SQLite event store, audit v2 ve status machine.
- Event tip registry'si talimattaki ilk listeyi kapsar.
- Transition, append-only, redaction, restart ve migration testleri geçer.
- Mevcut UI/API davranışı aynı kalır.

### Phase 2 - Runtime

- Agent session repository, isolated runtime context, heartbeat/stale monitor, bounded priority inbox ve cancellation tree.
- Runtime crash yalnız bağlı task'i paused/blocked yapar.
- Fake provider ile gerçek timer/process seam integration testleri geçer.

### Phase 3 - Collaboration

- Task/dependency DAG, ready-set scheduler, router/wakeup ve structured handoff/evidence.
- Existing delegation API yeni handoff/router'a adapter olur.
- Cycle, priority, backpressure, restart, duplicate dispatch ve parallel limit testleri geçer.

### Phase 4 - Tools

- `ToolManager` zorunlu permission/audit seam olur.
- filesystem, shell, git, search, test ve todo built-in provider'ları eklenir.
- Traversal, timeout, output artifact, tree kill, cancel, destructive command ve secret redaction testleri geçer.

### Phase 5 - ACP

- `AgentProvider` facade, ACP JSON-RPC stdio transport ve Codex/Claude/Goose launch profiles.
- ACP protocol core'a sızmaz.
- Handshake, capability, malformed frame, timeout, cancel ve crash recovery testleri geçer.

### Phase 6 - Workflow

- YAML parse/validate, definition-run ayrımı, DAG execution, approval, resume ve cancel.
- Eski `WorkflowManager` API compatibility facade olur.
- Restart sonrası exact-once claim ve dependency-ready execution testleri geçer.

### Phase 7 - Developer Experience

- Branch workspace, review pipeline, event projection activity timeline ve agent inspector.
- Human review proje ayarıyla opsiyonel olur.
- UI doğrudan SQLite'a veya runtime mutable state'e erişmez.

### Phase 8 - Memory and Models

- Session/project/agent memory metadata, 70/85 eşikli compression/checkpoint.
- `ModelProvider`, OpenAI-compatible/OpenRouter/Ollama/LM Studio ve audited fallback.
- Usage/cost projection agent inspector'a bağlanır.

### Phase 9 - Shared Compute Preparation

- Yalnız `ComputeProvider`, discovery ve remote API contract.
- Distributed inference, gossip ve federation uygulanmaz.

## İlk SQLite şeması

Tablolar: `schema_migrations`, `projects`, `agents`, `agent_sessions`, `events`, `tasks`, `task_dependencies`, `handoffs`, `handoff_evidence`, `agent_inbox`, `workflow_definitions`, `workflow_runs`, `workflow_steps`, `approvals`, `audit_entries`, `tool_calls`, `memory`, `model_usage`.

Foreign key'ler project isolation'ı zorlar. Event/audit tablolarına application-level UPDATE/DELETE API verilmez. Domain mutation, event append ve audit append mümkün olduğunda tek transaction'da yapılır.

## Modül sınırları

- `server/crew-core`: domain services, state machines, router, scheduler.
- `server/storage`: SQLite connection, migrations, repositories, legacy import.
- `server/runtime`: sessions, heartbeat, cancellation, retry.
- `server/tools`: ToolManager, policy boundary, built-in providers, MCP adapter.
- `server/providers`: AgentProvider, ModelProvider, ACP adapters.
- `src`: API/SSE read models; storage import etmez.

## Backpressure ve limitler

- Inbox bounded ve priority-aware olur; critical/high korunurken low için açık drop/replay politikası kullanılır.
- Event subscribers cursor ile SQLite'tan replay yapabilir; memory'deki queue source of truth değildir.
- Shell/test output `maxOutputBytes` sonrası artifact'e yazılır, context'e head/tail özeti girer.
- Global agent concurrency varsayılanı 4, provider ve tool alt limitleri ayrıca uygulanır.

## Commit sırası

Her madde ayrı, testli commit hedefidir: `foundation/identity`, `foundation/events`, `foundation/audit`, `runtime/status`, `runtime/heartbeat`, `runtime/inbox-router`, `tasks/graph`, `handoff`, `mcp/tools`, `permissions`, `acp`, `workflow`, `ui-projections`.

## Definition of Done doğrulaması

Talimattaki 16 adımlı akış, gerçek local SQLite ve fake yalnız dış provider boundary olacak şekilde E2E senaryosuna dönüştürülecek. App restart testin ortasında yapılacak; ikinci process geçmişi, pending approval'ı ve ready task'leri geri yükleyecek. Son doğrulamada source testlerine ek olarak paketlenmiş Electron uygulamasında Supervisor, paralel iki agent, approval ve Activity Timeline akışı çalıştırılacaktır.
