# Buzz Audit Referans Haritası

## Buzz nasıl yapıyor?

`buzz-audit`, community başına append-only SHA-256 hash chain tutar. Sequence, previous hash, actor, action, object, canonical JSON detail ve timestamp hash'e dahildir. Postgres advisory lock aynı community zincirine paralel append'i sıralar. Verification hem previous-hash bağını hem recomputed hash'i denetler.

## MausCrew şu anda nasıl yapıyor?

`AuditStore` günlük NDJSON dosyasına mode 0600 ile append eder ve yeni kayıtları filtreli okuyabilir. Sensitive key'leri merkezi olarak redact eder. Audit UI/endpoint yüzeyi sınırlıdır; kayıtlar hash-chain ile tamper-evident değildir ve kritik domain üreticilerinin tamamının bu store'a bağlı olduğu garanti edilmez.

## Ne taşınmalı?

- Append-only audit semantiği ve delete UI olmaması.
- Merkezi redaction.
- Actor/action/target/task/session/tool metadata.
- Sıralı append ve integrity verification.
- Permission denial, model fallback ve file/git mutation coverage.

## Ne taşınmamalı?

- Community tenancy ve Postgres advisory lock.
- Nostr public key'i zorunlu actor kimliği yapmak.
- Audit'i event store ile aynı kavram saymak: event domain gerçeği, audit güvenlik kaydıdır.

## MausCrew karşılığı ne olacak?

SQLite `audit_entries` ve `tool_calls` append-only tabloları kullanılacak. İlk migration mevcut NDJSON'u silmeyecek; read adapter iki kaynağı birleştirecek. İsteğe bağlı per-project hash-chain, SQLite transaction ve monoton sequence ile kurulacak. Tool boundary redaction sonrası audit yazar; secret ham argüman hiçbir zaman event payload'a da düşmez.

## Teknik özet

| Başlık | Buzz | MausCrew hedefi |
|---|---|---|
| Purpose | Tamper-evident security history | Local immutable critical-action history |
| Inputs | Audit action and detail | Sanitized audit draft |
| Outputs | Hash-chained row | SQLite audit/tool-call rows |
| State | Per-community chain | Per-project sequence/hash chain |
| Events | Relay-triggered audit | Critical CrewEvent subscribers plus direct boundary writes |
| Interfaces | AuditService | AuditStoreV2 |
| Failure modes | Lock, DB, integrity mismatch | DB, redaction, integrity mismatch |
| Concurrency | Advisory lock | SQLite transaction |
| Security | Canonical hash and tenant binding | Redaction, immutable API, integrity check |
