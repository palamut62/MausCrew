# Buzz to MausCrew Gap Analysis

İnceleme tarihi: 2026-09-09. Kaynak snapshot: Buzz `82656ff`; hedef snapshot: MausCrew `e331e2a`. `Var` yalnız production code ve ilgili seam görüldüğünde kullanılmıştır. `Kısmi`, davranışın bir bölümü var fakat kabul kriterinin tamamı bağlı değil demektir.

| Özellik | Buzz | MausCrew | Eksik | Aksiyon |
|---|---|---|---|---|
| Agent identity | Var, Nostr key | Kısmi, `BotRecord` id/name/profile | Domain identity ile runtime session ayrımı | `AgentIdentity` ve migration adapter |
| Event Bus | Var, relay/event pipeline | Kısmi, provider `RuntimeEvent` ve UI broadcast | Tüm domain için canonical envelope | `CrewEvent`, registry, bounded EventBus |
| Event Store | Var, relay DB | Yok | Immutable project-scoped history | SQLite `events`, append/replay API |
| Status state machine | Dağıtık lifecycle var | Yok | Canonical status ve transition guard | Merkezi `AgentStatusMachine` |
| Heartbeat | Var, harness/presence | Yok | Agent heartbeat ve stale detection | Configurable heartbeat monitor |
| Agent runtime | Var | Kısmi, provider instances ve task transcript | Persisted session/state isolation modeli | `AgentRuntime` facade ve session table |
| Structured handoff | Context handoff var; agent collaboration relay mesajlı | Kısmi, persistent delegations | Evidence, accept/complete/reject lifecycle | `AgentHandoff` ve handoff service |
| Routing/wakeup | Var, relay queue/pool | Kısmi, mentions/delegations/routines | Tek router, reason ve priority inbox | Router plus bounded `AgentInbox` |
| Task graph | Workflow DAG var | Kısmi, workflow step DAG | Canonical task/dependency tabloları | Task service, cycle guard, ready-set |
| Parallel execution | Var, pool | Kısmi, farklı bot turn'leri çalışabilir | DAG scheduler ve merkezi limit | Scheduler, `maxConcurrentAgents` |
| ACP | Var | Yok, provider driver contract var | ACP transport/capability adapter | `AgentProvider` facade ve ACP provider |
| MCP | Var | Kısmi, registry/mount/grants var | Tüm built-in tool'larda tek enforcement seam | `ToolManager`, built-in providers |
| Shell güvenliği | Var | Kısmi, provider/container'a göre değişiyor | Ortak cwd/timeout/output/tree-kill kontratı | Windows dahil boundary tests |
| Permission engine | Var, broker | Kısmi, MCP grants, disabled tools, provider/peer approvals | Genel allow/ask/deny matrisi | Policy evaluation at ToolManager |
| Approval | Var | Kısmi, provider, peer, bot creation ve review approval | Ortak approval state ve request-changes | SQLite approval service |
| Audit | Var, hash-chain | Kısmi, redacted append-only NDJSON | Tam producer coverage, integrity, tool table | SQLite audit v2 plus legacy reader |
| Workflow | Var, YAML executor | Kısmi, persistent JSON DAG manager | YAML, auto-execution, approval, full resume | Definition/run split and scheduler |
| Git workspace | Var, repo/branch surfaces | Kısmi, branching tests ve git flows | Branch timeline/domain workspace | Phase 7 adapter and projections |
| Review pipeline | Var/kısmi | Kısmi, persistent review queue | Tester-reviewer-human pipeline binding | Workflow template plus policy |
| Memory | Var, engram/context | Kısmi güçlü, shared/profile/journal/task memory | Explicit session/project/agent records, checkpoint threshold | Preserve files, add metadata/checkpoints |
| Model provider | Var | Kısmi, model selection/catalog per driver | Ortak complete/stream/capability/usage facade, fallback audit | `ModelProvider` and fallback chain |
| Local models | Var, OpenAI-compatible | Kısmi, provider-dependent | First-class Ollama/LM Studio adapter contract | Implement behind ModelProvider |
| Shared compute | Var, mesh | Kısmi experiments | Stable compute abstraction only | Phase 9 `ComputeProvider` |
| Activity timeline | Var | Kısmi, messages/activity/project summary | Tek persisted multi-domain timeline | Event projection UI |
| Agent inspector | Var/kısmi | Kısmi bot/settings/runtime views | Heartbeat, queue, tool, session, usage in one view | Phase 7 inspector |
| Retry/recovery | Var | Kısmi, provider failover and delegation recovery | Central typed retry policy | Retry service with audited reason |
| Cancellation | Var | Kısmi, provider/turn/delegation/workflow paths | Unified task/agent/workflow/all propagation | Cancellation token tree |

## Korunacak mevcut production seam'leri

- `server/contracts.ts`: provider-neutral runtime event ve driver contract.
- `server/store.ts`: bot/task/transcript ownership ve provider-independent continuity.
- `server/workflows.ts`: persistent DAG validation, ownership checks, recovery ve cancel.
- `server/delegations.ts`: persistent peer work queue, recovery ve approval.
- `server/mcp/registry.ts`: per-bot MCP grants ve disabled-tool enforcement.
- `server/audit/audit-store.ts`: append-only redacted NDJSON legacy audit.
- `server/memory/store.ts`: bounded shared/agent journal/profile memory.
- `src/lib/project-activity.ts`: mevcut UI projection başlangıcı.

## İstenen Buzz modüllerinin inceleme özeti

| Modül | Purpose | Inputs | Outputs | State | Events | Interfaces | Failure modes | Concurrency | Security boundary | MausCrew kararı |
|---|---|---|---|---|---|---|---|---|---|---|
| `buzz-agent` | ACP agent/tool loop | ACP prompt, model config, MCP | ACP updates, tool results | Session history/usage/cancel | Session/tool updates | ACP, MCP, model HTTP | Timeout, cancel, truncation, crash | Session/tool caps | Permission broker before tool | Runtime prensiplerini uyarla |
| `buzz-acp` | Relay-to-agent harness | Mentions, controls, config | ACP prompts, relay replies | Pool, queue, scoped sessions | Lifecycle, heartbeat, observer | Relay WS, ACP stdio | Spawn, idle/wall timeout, stale input | Bounded pool, scope lock | Author/provenance gate | Relay kısmını at, ACP adapter/pool'u uyarla |
| `buzz-dev-mcp` | Development tools | Tool calls, workspace | Bounded tool content | Child processes, todo | MCP call lifecycle | rmcp | Traversal, timeout, oversized output | Per-call async | Canonical root and cancellation | ToolManager arkasında özgün built-ins |
| `buzz-workflow` | YAML automation | Definition, trigger, approval | Actions and run events | Workflow/run/step | Workflow kinds | ActionSink | Invalid YAML, timeout, action failure | Ready actions | Owner/provenance | YAML, DAG ve sink prensibini uyarla |
| `buzz-core` | I/O-free protocol domain | Events, filters, identities | Validated core types | Yok | Kind registry | Rust types | Invalid kind/signature/filter | Saf fonksiyonlar | Crypto/tenant verification | I/O-free Crew Core types; Nostr yok |
| `buzz-audit` | Tamper-evident audit | Actor/action/detail | Hash-chain rows | Per-community sequence | Critical operation audit | AuditService | DB/lock/integrity failure | Community lock | Canonical hash chain | SQLite per-project karşılığı |
| `buzz-cli` | Agent/human command surface | CLI args/config | Signed requests, JSON result | Minimal local config | Message/workflow/agent actions | SDK and relay APIs | Validation/network/auth | Command scoped | Local validation plus relay auth | Built-in tool adları için davranış referansı; CLI kopyalama yok |
| `buzz-sdk` | Typed event/builders/broker | Typed action args | Signed event builders | Broker correlation | Agent/workflow/git events | Client/broker contracts | Invalid args, auth, correlation | Request scoped | Credential is opaque capability | Typed CrewEvent producer ve correlation fikri |
| `buzz-relay` | Single source of truth/orchestrator | WS/HTTP events | Persistence, fan-out, side effects | Connections/subscriptions/DB | Tüm Nostr kinds | DB, pubsub, workflow, audit | Auth, overload, slow client, DB | Semaphore and bounded sends | Host-derived tenant, authz | Local Application Layer/EventBus; relay/federation yok |
| `buzz-relay-mesh` | Multi-relay transport | Peer/membership/wire | Routed streams/status | Peer registry/gossip | Membership/lifecycle | Mesh endpoint/runtime | Partition, stale peer, replay | Multi-node | Membership/transport auth | Yalnız ComputeProvider abstraction |
| `desktop/` | Human control/read model | Relay queries/events, user actions | Agent/workflow/activity UI | Client cache/read models | Subscribed activity | Relay API | Reconnect, stale projection | UI async subscriptions | User approvals and access warnings | Phase 7 projection/inspector davranış referansı |

## Öncelikli riskler

1. JSON state ile yeni SQLite state'in iki bağımsız source of truth'a dönüşmesi.
2. Permission kontrolünün yalnız prompt veya provider-specific katmanda kalması.
3. Event append ile domain mutation'ın atomik olmaması.
4. Windows child-process cancellation'ın yalnız parent PID'yi durdurması.
5. Migration sırasında provider-owned cursor ile task-owned transcript sürekliliğinin bozulması.
6. Eski workflow/delegation kayıtlarının restart sırasında iki kez dispatch edilmesi.

## Phase 1 giriş kriteri

Phase 1 başlamadan SQLite library seçimi, schema migration/backup stratejisi ve JSON compatibility süresi küçük bir ADR ile sabitlenmelidir. İlk implementation mevcut davranışı değiştirmeden identity, event, audit ve status testlerini eklemelidir.

## Uygulama durumu

- Phase 0 tamamlandı: referans haritaları, gap analysis ve migration planı.
- Phase 1 tamamlandı: identity, 25 tipli event registry, bounded EventBus, immutable SQLite EventStore, hash-chain AuditStore, status state machine ve atomik lifecycle service.
- Mevcut bot/task JSON state'i henüz taşınmadı; Phase 2 runtime ilk production consumer olacaktır.
