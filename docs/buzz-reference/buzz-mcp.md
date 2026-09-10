# Buzz MCP Referans Haritası

## Buzz nasıl yapıyor?

`buzz-agent` MCP server'larını subprocess olarak açar, tool'ları fully-qualified adlarla registry'ye kaydeder, çakışmaları reddeder ve her LLM tool çağrısını permission broker'dan geçirir. Tool sonucu byte budget ile kırpılır. `buzz-dev-mcp` shell, read, image, string replacement, search ve todo yüzeyi sağlar. Path işlemlerinde canonicalization/traversal kontrolü; shell'de timeout, cancellation ve process cleanup bulunur.

## MausCrew şu anda nasıl yapıyor?

`server/mcp/registry.ts` bot bazlı server grant, secret environment çözümü, disabled-tool kontrolü ve MCP instruction üretimi sağlar. Container ve DeepSeek composition katmanları MCP mount üretir. Bazı provider'lar filesystem/shell'i doğrudan kendi runtime sandbox'ında sunar. Bu nedenle MCP desteği vardır, ancak tüm built-in filesystem, shell, git, search ve test işlemlerini kapsayan tek bir `ToolManager` enforcement seam'i yoktur.

## Ne taşınmalı?

- Her tool çağrısında tek permission/audit boundary.
- Qualified tool registry ve conservative capability classification.
- Project-root canonical path kontrolü.
- Shell timeout, output budget, cancellation ve process-tree cleanup.
- Büyük output'u artifact'e taşıyıp context'e sınırlı özet verme.

## Ne taşınmamalı?

- Buzz CLI'yi genel shell tool içine gömme.
- Yalnız Unix process davranışlarına güvenme.
- Agent business logic'inde MCP server implementation ayrıntısı.

## MausCrew karşılığı ne olacak?

`ToolManager.execute(context, call)` sırası: validate, resolve permission, gerekirse approval oluştur ve suspend et, execute, redact, audit, event emit. Built-in tool provider'ları bu sınırın arkasında olacaktır. Mevcut MCP registry external server catalog olarak korunacak. Windows process-tree termination ve root isolation gerçek integration testleriyle doğrulanacaktır.

## Teknik özet

| Başlık | Buzz | MausCrew hedefi |
|---|---|---|
| Purpose | Agent tool boundary | Tüm agent tool'ları için zorunlu boundary |
| Inputs | MCP definitions and calls | ToolCall plus AgentExecutionContext |
| Outputs | Bounded ToolResult | Result, artifact, audit and events |
| State | Server registry/processes | Registry, grants, running-call map |
| Events | ACP tool updates | `tool.started/completed/failed` |
| Interfaces | rmcp stdio | ToolProvider and external MCP adapter |
| Failure modes | Collision, timeout, overflow | Same plus traversal and policy denial |
| Concurrency | Parallel tool cap | Per-agent and global caps |
| Security | Permission broker | Fail-closed permission plus root isolation |
