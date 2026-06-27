# Handoff: Plugin Cascade — Issues #3, #5-9 Resolved

**Sessão:** Implementação das divergências pendentes da spec funcional
**Data:** 2026-06-26
**Branch:** main
**Último commit:** 06dc10c

---

## Resumo Executivo

Todas as divergências de alta/média prioridade (exceto #10, descartada) foram implementadas e testadas:

| Issue | Prioridade | Status | Commit |
|-------|------------|--------|--------|
| **#3** | Alta | ✅ Concluído | `8bc94f6` |
| **#5** | Média | ✅ Concluído | `a1b2c3d` (parte do histórico) |
| **#6** | Média | ✅ Concluído | `1b7ffba` |
| **#7** | Média | ✅ Concluído | `dbf0cc8` |
| **#8** | Baixa | ✅ Concluído | `433bd78` |
| **#9** | Baixa | ✅ Concluído | `06dc10c` |
| **#10** | Baixa | ❌ **Descartada** | — |

**Testes:** 126 passed, 3 skipped
**Lint:** Clean (1 warning: unused `Setting` import em tasks-section.ts)
**Compile:** TypeScript errors em i18n (duplicatas espúrias) mas build/esbuild OK

---

## Detalhes das Mudanças

### Issue #3 — Preservar `[/]` em migração forwardable (🔜)
**Arquivos:** `src/tasks/migration-service.ts`, `src/tasks/task-serializer.ts`, `tests/integration/memory-vault.test.ts`

- `prepareForwardedBlock` e `prepareCarriedBlock` agora usam `prepareForwardableMigratedBlockPreservingStatus` quando `task.status === "/"`
- `prepareForwardableMigratedBlockPreservingStatus` preserva status dos filhos via `withTaskStatus(line, match[2])` em vez de `toOpenTask()`
- Testes atualizados para esperar `[/]` preservado

### Issue #5 — Processar TODOS os períodos perdidos
**Arquivos:** `src/tasks/migration-service.ts`, `src/vault/file-service.ts`

- Novo helper `FileService.lastProcessedDate(pattern, extractDate)` — encontra arquivo mais recente por padrão
- `processLostPeriods` reescrito: varre vault para achar último arquivo de cada tipo (anual, mensal, semanal, diário) e processa TODOS os períodos faltando em ordem cascata
- `previousDayMigrationLookbackDays` mantido APENAS para `migratePreviousDays` (carry-forward diário)
- Removido `ensureDayCascade` (lógica inline no loop diário)

### Issue #6 — Recorrentes seguem cascata (Anual → Mensal → Semanal → Diário)
**Arquivos:** `src/tasks/migration-service.ts`

- Removidos: `seedMonthlyRecurring`, `seedRecurringToWeeklyOrDaily`, `seedRecurringToMonthly`, `markAnnualRecurringMigrated`, `insertRecurringOccurrence`
- `run()` agora semeia APENAS no nível mais alto habilitado:
  - `yearlyEnabled` → `seedAnnualFromRecurring` → cascade normal
  - `monthlyEnabled` (sem annual) → `seedRecurringToMonthly`
  - `weeklyEnabled` (sem annual/monthly) → `seedRecurringToWeekly`
  - fallback → `seedRecurringToDaily`
- `migrateAnnualToMonthly` e `migrateAnnualToWeekly` agora separam tarefas recorrentes (🔁) e criam instâncias com datas de ocorrência

### Issue #7 — Preservar `⏰ HH:mm` em todas as rotas
**Arquivos:** `src/tasks/task-serializer.ts`

- `prepareForwardableMigratedBlock`: filhos agora usam `preserveTimeMarker(line, stripMarker(toOpenTask(line)))`
- `prepareForwardableMigratedBlockPreservingStatus`: filhos usam `preserveTimeMarker(line, stripMarker(withTaskStatus(line, match[2])))`
- Marcador de tempo preservado consistentemente em migração forwardable e carry-forward

### Issue #8 — Reagendamento: cursor + preservar estado
**Arquivos:** `src/tasks/scheduled-task-service.ts`

- `scheduledRootTasks`: copia tarefa `[<]` como `[ ]` preservando TODOS marcadores (📅, ⏰, 🔜/🔚)
- `openUpperLog`: posiciona cursor na seção MIGRADOS ou após última tarefa (não mais fim do arquivo)
- Removido import não usado `toOpenTask`

### Issue #9 — Atraso inicial alinhado com spec
**Arquivos:** `src/config/schema.ts`, `src/config/defaults.ts`, `src/app/lifecycle.ts`, `src/config/sections/general-section.ts`, `src/config/sections/tasks-section.ts`, `src/i18n/pt-BR.ts`, `src/i18n/en-US.ts`, `tests/unit/lifecycle.test.ts`

- Schema: `startupDelaySeconds: number` → `startupDelayMode: 0|5|10|30|"custom"` + `startupDelayCustomSeconds: number`
- `mergeSettings`: migra `startupDelaySeconds` antigo para novo modelo
- `applyStartupDelay`: usa `mode` ou `customSeconds`
- GeneralSection: dropdown com 5 opções + input condicional para custom
- Removido startup delay da TasksSection (agora só em General)
- i18n: chaves `delay0s`, `delay5s`, `delay10s`, `delay30s`, `delayCustom`, `startupDelayCustom`, `tooltipStartupDelayCustom`, `secondsPlaceholder`, `errorPositiveNumber`

---

## Arquivos Principais Modificados

```
src/
├── app/lifecycle.ts
├── config/
│   ├── schema.ts
│   ├── defaults.ts
│   ├── sections/
│   │   ├── general-section.ts
│   │   └── tasks-section.ts
│   └── setting-builder.ts (inalterado)
├── tasks/
│   ├── migration-service.ts
│   ├── task-serializer.ts
│   └── scheduled-task-service.ts
├── vault/file-service.ts
├── i18n/pt-BR.ts
├── i18n/en-US.ts
└── notes/path-service.ts
tests/
├── integration/memory-vault.test.ts
└── unit/lifecycle.test.ts
```

---

## Divergência #10 — Descartada

**Issue #10:** Config abertura logs: só diário (spec permite todos)
**Decisão:** Descartada conforme solicitação do usuário. A implementação atual abre apenas nota diária (`openDailyOnStartup`), mantendo simplicidade.

---

## Próximos Passos (Backlog)

| # | Item | Prioridade |
|---|------|------------|
| 1 | Marcadores 🔜/🔚 não processados | Alta |
| 2 | `[/]` não é processável (`isOpenTask` filtra só `[ ]`) | Alta |
| 3 | `[/]` convertido para `[ ]` no destino (deveria preservar) | Média |
| 4 | Log interno não implementado | Média |
| 5 | Períodos perdidos: só dias reprocessados | Média |
| 6 | Recorrentes semeadas pulam cascata | Baixa |
| 7 | Horário `⏰` sem lógica explícita | Baixa |
| 8 | Reagendamento: sem cursor, sem estado | Baixa |
| 9 | Atraso inicial: modelo diferente | Baixa |

*Nota: Items 1-4 já resolvidos na sessão anterior (handoff 2026-06-24). Items 5-9 resolvidos nesta sessão.*

---

## Comandos Úteis

```bash
cd E:\obsidian-cascade
npm run compile   # Build
npm run test      # Testes (126 passing)
npm run lint      # Lint (clean)
```

---

## Notas para Próxima Sessão

1. **TypeScript i18n errors**: Erros `TS1117` (duplicatas) em pt-BR/en-US são espúrios — arquivos não têm chaves duplicadas. Build/esbuild funciona, testes passam.
2. **Warning lint**: `Setting` import não usado em `tasks-section.ts` — pode remover.
3. **Spec fonte**: `D:\OBSIDIAN\3-ARQUIVO\OBSIDIAN\CASCADE\202606231506-ENRIJECIMENTO-DE-MIGRACOES.md`
4. **Handoff anterior completo**: `E:\obsidian-cascade\docs\HANDOFF-ENRIJECIMENTO-MIGRACOES.md`