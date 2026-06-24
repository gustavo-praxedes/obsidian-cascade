# Handoff: Plugin Cascade — Log Interno & Settings UI

**Sessão:** Implementação de log interno e padronização dos submenus nas settings
**Data:** 2026-06-24
**Próxima sessão:** Implementar divergências pendentes entre spec e código (prioridade alta: #1 Marcadores 🔜/🔚, #2 `[/]` processável)

---

## Contexto

O plugin **Cascade** (`E:\obsidian-cascade`) é um plugin Obsidian para migração temporal de tarefas em cascata (anual → mensal → semanal → diário). A especificação funcional está em:

```
D:\OBSIDIAN\3-ARQUIVO\OBSIDIAN\CASCADE\202606231506-ENRIJECIMENTO-DE-MIGRACOES.md
```

Handoff anterior com divergências completas: `E:\obsidian-cascade\HANDOFF-ENRIJECIMENTO-MIGRACOES.md`

---

## O que foi feito nesta sessão

### 1. Log Interno (Divergência #4 — resolvida)

**Novo módulo:** `src/logging/log-service.ts`

- Arquivo único `.md` (default: `cascade-log.md`)
- Configurações: pasta, nome do arquivo, retenção em dias
- Se o nome contiver `/`, é tratado como caminho completo (ignora pasta)
- Toggle on/off (desligado por padrão)
- Buffer com flush a cada 500ms
- 4 categorias com toggle individual:
  - `loggingStartup` — lifecycle/início
  - `loggingMigration` — operações de migração
  - `loggingNormalizer` — normalização de arquivos
  - `loggingErrors` — erros gerais

**Arquivos modificados:**
- `src/config/schema.ts` — campos `loggingEnabled`, `loggingFolder`, `loggingFilename`, `loggingRetentionDays`, `loggingStartup`, `loggingMigration`, `loggingNormalizer`, `loggingErrors`
- `src/config/defaults.ts` — defaults correspondentes
- `src/config/settings-tab.ts` — sub-menu "Log Interno" na aba Avançado
- `src/main.ts` — `LogService` instanciado no `onload()`, exposto como `this.log`
- `src/app/lifecycle.ts` — `this.log.startup.info/debug()`
- `src/tasks/migration-service.ts` — `this.log.migration.info()`
- `src/notes/normalizer-service.ts` — `this.log.normalizer.info/error()` (log opcional via `?`)
- `tests/integration/memory-vault.test.ts` — atualizado para novo construtor do `MigrationService`

### 2. Submenus Indentados (Settings UI)

**Novo método:** `renderSubSection()` genérico com classe CSS `cascade-settings-subsection`

**CSS:** `styles.css`
```css
.cascade-settings-subsection {
  margin-left: 16px;
  border-left: 2px solid var(--background-modifier-border);
  padding-left: 12px;
}
```

**Submenus criados:**

| Seção | Submenus |
|-------|----------|
| Agenda | Anual, Mensal, Semanal, Diário |
| Normalização | Configurações, Substituições |
| Tarefas | Migração |
| Frontmatter | Configurações |
| Avançado | Log Interno |

---

## Commits realizados

| Hash | Mensagem | Tipo |
|------|----------|------|
| `c5c1702` | feat: implement log interno com categorias configuraveis | feat |
| `8c7165f` | feat: submenus indentados e padronizacao do settings UI | feat |

**Versão:** 0.1.3 (versionamento automático via tags, não alterar manualmente)

---

## Divergências pendentes (HANDOFF completo)

| # | Prioridade | Descrição |
|---|-----------|-----------|
| 1 | Alta | Marcadores 🔜/🔚 não processados |
| 2 | Alta | `[/]` não é processável (`isOpenTask` filtra só `[ ]`) |
| 3 | Média | `[/]` convertido para `[ ]` no destino (deveria preservar) |
| 5 | Média | Períodos perdidos: só dias reprocessados |
| 6 | Baixa | Recorrentes semeadam pulam cascata |
| 7 | Baixa | Horário `⏰` sem lógica explícita |
| 8 | Baixa | Reagendamento: sem cursor, sem estado |
| 9 | Baixa | Atraso inicial: modelo diferente |
| 10 | Baixa | Abertura de logs: só diário |

---

## Arquivos principais do plugin

```
src/
├── main.ts                    (entry point, wiring de serviços)
├── app/
│   ├── lifecycle.ts           (startup orchestrator)
│   ├── commands.ts            (command palette)
│   └── events.ts              (vault event registry)
├── config/
│   ├── schema.ts              (CascadeSettings interface)
│   ├── defaults.ts            (DEFAULT_SETTINGS, mergeSettings)
│   └── settings-tab.ts        (UI de configurações)
├── logging/
│   └── log-service.ts         (serviço de log)
├── notes/
│   ├── note-service.ts        (CRUD de notas)
│   ├── path-service.ts        (date math, paths)
│   ├── normalizer-service.ts  (renomeação de arquivos)
│   └── template-service.ts    (templates)
├── tasks/
│   ├── migration-service.ts   (core: migração em cascata)
│   ├── task-parser.ts         (extração de tarefas)
│   ├── task-serializer.ts     (transformação de tarefas)
│   └── recurrence-service.ts  (regras de recorrência)
└── vault/
    ├── file-service.ts        (leitura/escrita de arquivos)
    └── lock-service.ts        (mutex assíncrono)
```

---

## Comandos Úteis

```bash
npm run compile    # Build
npm run test       # Testes
npm run lint       # Lint
```

---

## Suggested Skills

- `customize-opencode` — se houver necessidade de ajustar configuração do opencode para o projeto
- Consultar `E:\SKILLS\1.SKILLS-PRO\handoff\SKILL.md` para formato de handoff

---

## Notas para o Próximo Agente

1. Comece pelas divergências de **alta prioridade** (#1 e #2) — Impactam o comportamento central de migração
2. A spec é o documento fonte: `D:\OBSIDIAN\3-ARQUIVO\OBSIDIAN\CASCADE\202606231506-ENRIJECIMENTO-DE-MIGRACOES.md`
3. Handoff completo com todas as divergências: `E:\obsidian-cascade\HANDOFF-ENRIJECIMENTO-MIGRACOES.md`
4. Os testes em `tests/` cobrem os comportamentos atuais — 6 falhas pré-existentes (não relacionadas a esta sessão)
5. Cuidado com `taskKey`/`taskLooseKey` — a dedup depende disso
6. `LockService` previne migrações concorrentes — mantenha `runExclusive`
7. `NORMALIZATION_RENAMES` Set previne loops — não remova
8. **Não alterar versão em `manifest.json`** — versionamento é automático via tags
