# Buzz Workflow Referans Haritası

## Buzz nasıl yapıyor?

`buzz-workflow` YAML tanımını parse/validate eder ve side-effect'leri `ActionSink` interface'ine bırakır. Step action'ları, timeout, koşul, retry ve approval benzeri kontrol akışları schema'da tanımlıdır. Relay workflow event'lerini ve persistence'ı koordine eder. Template kaynak metni ile render edilmiş metin ayrı taşınır; yetkili owner/provenance korunur.

## MausCrew şu anda nasıl yapıyor?

`WorkflowManager`, JSON dosyasında kalıcı workflow ve step kayıtları tutar. Dependency varlığı, self-dependency ve cycle kontrol edilir. Step yalnız dependency'leri done ise running/done olabilir. Atanmış botun kendi step'ini güncellemesi server-side doğrulanır. Restart sırasında belirsiz running step blocked yapılır ve retry/cancel desteklenir. `create_workflow` ve `update_workflow_step` agent proxy yüzeyinde bulunur.

Eksikler YAML definition parser, ayrı definition/run modeli, otomatik DAG scheduler, concurrency limit, approval step, merkezi retry ve tam resume executor'dır. Mevcut yapı esas olarak agent'ların durum raporladığı kalıcı plan yöneticisidir.

## Ne taşınmalı?

- YAML parse ve strict validation.
- Definition ile run state ayrımı.
- DAG-ready step scheduling ve bağımsız step'lerin paralel yürütülmesi.
- Persisted approval/wait/cancel/retry state.
- Side-effect adapter ve canonical workflow event'leri.

## Ne taşınmamalı?

- Relay, community veya Nostr event zorunluluğu.
- MausCrew'de kullanılmayacak sosyal/hosted workflow action'ları.
- İlk sürümde genel amaçlı expression language.

## MausCrew karşılığı ne olacak?

Mevcut `WorkflowRecord` adapter ile yeni `workflow_definitions`, `workflow_runs` ve `workflow_steps` tablolarına taşınacak. Scheduler ready set'i dependency state'ten türetecek, `maxConcurrentAgents` sınırı uygulayacak ve tüm transition'ları event/audit ile atomik kaydedecek. Eski API bir süre compatibility facade olarak kalacak.

## Teknik özet

| Başlık | Buzz | MausCrew hedefi |
|---|---|---|
| Purpose | YAML event-driven automation | Local persistent crew orchestration |
| Inputs | Definition, trigger, owner | YAML/manual start and Crew events |
| Outputs | Actions and workflow events | Routed tasks, approvals, run state |
| State | DB workflow/run state | SQLite definition/run/step state |
| Events | `KIND_WORKFLOW_*` | `workflow.*` and task events |
| Interfaces | ActionSink | WorkflowActionSink and Router |
| Failure modes | Invalid schema, timeout, action error | Same plus crash/restart and deadlock |
| Concurrency | Executor controlled | DAG ready-set plus configurable cap |
| Security | Owner/provenance | Project and permission scoped actions |
