# Handoff: Enrijecimento de Migrações

**Sessão:** Comparação da especificação funcional com a implementação do plugin Cascade
**Data:** 2026-06-24
**Próxima sessão:** Implementar as divergências identificadas entre spec e código

---

## Contexto

O plugin **Cascade** (`E:\obsidian-cascade`) é um plugin Obsidian para migração temporal de tarefas em cascata (anual → mensal → semanal → diário). A especificação funcional está em:

```
D:\OBSIDIAN\3-ARQUIVO\OBSIDIAN\CASCADE\202606231506-ENRIJECIMENTO-DE-MIGRACOES.md
```

A comparação completa está documentada no chat (seção "Comparação: Especificação vs Implementação"). Este handoff resume as ações necessárias.

---

## Divergências Identificadas (por prioridade)

### Alta

1. **Marcadores 🔜/🔚 não processados**
   - A spec define que 🔜 (migrável) e 🔚 (efêmera) determinam o comportamento pós-migração
   - `[ ] + 🔜` → vira `[>]` ao migrar; `[ ] + 🔚` → vira `[-]` ao migrar
   - Nenhuma dessas regras está implementada
   - **Arquivos:** `src/tasks/migration-service.ts`, `src/tasks/task-parser.ts`, `src/tasks/task-serializer.ts`

2. **`[/]` (em progresso) não é processável**
   - A spec diz que `[/]` é processável junto com `[ ]`
   - `isOpenTask()` em `src/tasks/task-parser.ts:95` filtra apenas `status === " "` (espaço)
   - Tarefas `[/]` não são extraídas por `extractRootTasks`/`extractSectionTasks`
   - **Arquivo:** `src/tasks/task-parser.ts:95-97`

### Média

3. **`[/]` convertido para `[ ]` no destino da migração**
   - `prepareMigratedBlock()` em `src/tasks/task-serializer.ts:61-80` converte tudo para `[ ]`
   - A spec diz que `[/]` deve ser preservado no destino
   - **Arquivo:** `src/tasks/task-serializer.ts:61-80`

4. **Log interno não implementado**
   - A spec pede arquivo `.obsidian/plugins/plugin/log.txt` com 4 níveis (desligado/erros/resumido/detalhado)
   - Não existe nenhum sistema de logging no plugin
   - **Arquivo:** Novo módulo necessário (ex: `src/logging/log-service.ts`)

5. **Períodos perdidos: só dias são processados**
   - A spec diz que ao abrir após vários dias, todos os períodos são processados (dias, semanas, meses, anos)
   - `migratePreviousDays` processa apenas dias com lookback configurável (default: 1)
   - Não reprocessa semanas/meses/anos perdidos
   - **Arquivo:** `src/tasks/migration-service.ts:173-205`

### Baixa

6. **Recorrentes semeadas diretamente no semanal (pula cascata)**
   - `seedMonthlyRecurring` insere recorrentes diretamente no semanal/mensal
   - A spec diz que o fluxo é RECORRENTES → ANUAL → MENSAL → SEMANAL → DIÁRIO
   - **Arquivo:** `src/tasks/migration-service.ts:109-137`

7. **Horário `⏰` não garantido explicitamente**
   - Preservado por omissão (não editado), mas não há lógica explícita
   - **Arquivo:** `src/tasks/task-serializer.ts`

8. **Reagendamento: cursor não posicionado, estado não preservado**
   - `scheduled-task-service.ts` copia para clipboard e abre log superior
   - Não posiciona cursor; converte sempre para `[ ]`
   - **Arquivo:** `src/tasks/scheduled-task-service.ts`

9. **Atraso inicial: modelo diferente**
   - Spec: fixos (0/5/10/30s) + personalizado
   - Implementação: modos (`fixed`/`until-daily`/`until-vault-idle`/`combined`) + max seconds
   - **Arquivo:** `src/app/lifecycle.ts`, `src/config/schema.ts`

10. **Config de abertura de logs: só diário**
    - Spec permite configurar quais logs abrir (anual, mensal, semanal, diário)
    - Implementação: apenas `openTodayOnStartup` (diário)
    - **Arquivo:** `src/config/schema.ts`, `src/app/lifecycle.ts`

---

## Arquivos Principais para Edição

| Arquivo | Divergências |
|---------|-------------|
| `src/tasks/task-parser.ts` | #1 (🔜/🔚), #2 (isOpenTask) |
| `src/tasks/task-serializer.ts` | #1 (🔜/🔚), #3 ([/] preservado), #7 (⏰) |
| `src/tasks/migration-service.ts` | #1 (🔜/🔚 regras), #5 (períodos perdidos), #6 (cascata) |
| `src/tasks/scheduled-task-service.ts` | #8 (reagendamento) |
| `src/config/schema.ts` | #9 (atraso), #10 (abertura de logs) |
| `src/config/defaults.ts` | #10 (defaults) |
| `src/app/lifecycle.ts` | #9 (atraso), #10 (abertura de logs) |
| Novo: `src/logging/log-service.ts` | #4 (log interno) |

---

## Estrutura de Referência da Spec

| Seção da Spec | Tema | Status |
|---------------|------|--------|
| §1-2 | Objetivo/Filosofia | ✅ Conforme |
| §3 | Arquivos do sistema | ✅ Conforme |
| §4 | Cascata de migração | ⚠️ Parcial |
| §5 | Estados | ✅ Conforme |
| §6 | Regras de processamento | ❌ Divergência |
| §7 | Marcadores 🔜/🔚 | ❌ Ausente |
| §8 | Datas | ✅ Conforme |
| §9 | Horários | ⚠️ Implícito |
| §10 | Recorrência | ✅ Conforme |
| §11 | Migração entre períodos | ❌ Divergência |
| §12 | Reagendamento | ⚠️ Parcial |
| §13 | Semanas | ✅ Conforme |
| §14 | Períodos perdidos | ⚠️ Parcial |
| §15 | Duplicações | ✅ Conforme |
| §16 | Conflitos dispositivos | ✅ Conforme |
| §17 | Migração automática | ✅ Conforme |
| §18 | Atraso inicial | ⚠️ Modelo diferente |
| §19 | Botão de execução | ✅ Conforme |
| §20 | Log interno | ❌ Ausente |
| §21 | Configurações | ⚠️ Parcial |
| §22 | Exemplos | ❌ Comportamento divergente |

---

## Comandos Úteis

```bash
# Build
npm run compile

# Testes
npm run test

# Lint
npm run lint
```

---

## Suggested Skills

- `customize-opencode` — se houver necessidade de ajustar configuração do opencode para o projeto
- Consultar `E:\SKILLS\1.SKILLS-PRO\handoff\SKILL.md` para formato de handoff

---

## Notas para o Próximo Agente

1. Comece pelas divergências de **alta prioridade** (#1 e #2)
2. A spec é o documento fonte: `D:\OBSIDIAN\3-ARQUIVO\OBSIDIAN\CASCADE\202606231506-ENRIJECIMENTO-DE-MIGRACOES.md`
3. Os testes existentes em `tests/` cobrem os comportamentos atuais — atualize-os após as mudanças
4. Cuidado com o `taskKey`/`taskLooseKey` — a dedup depende disso
5. O `LockService` previne migrações concorrentes — mantenha o `runExclusive`
6. O `NORMALIZATION_RENAMES` Set previne loops de normalização — não remova

---

## Progresso (2026-06-24)

### ✅ Implementado

- **#4 Log interno** — `src/logging/log-service.ts`
  - Arquivo único `.md` (configurável nome e pasta)
  - Retenção de dias configurável
  - Toggle on/off
  - Categorias: Startup, Migração, Normalização, Erros (toggle individual)
  - Integração com `lifecycle.ts`, `migration-service.ts`, `normalizer-service.ts`
  - Sub-menu "Log Interno" na aba Avançado das settings

- **Settings UI** — Submenus indentados com `renderSubSection()` genérico
  - Agenda: Anual, Mensal, Semanal, Diário
  - Normalização: Configurações, Substituições
  - Tarefas: Migração
  - Frontmatter: Configurações
  - Avançado: Log Interno

### ❌ Pendente (por prioridade)

| # | Prioridade | Divergência |
|---|-----------|-------------|
| 1 | Alta | Marcadores 🔜/🔚 não processados |
| 2 | Alta | `[/]` não é processável (`isOpenTask` filtra só `[ ]`) |
| 3 | Média | `[/]` convertido para `[ ]` no destino (deveria preservar) |
| 5 | Média | Períodos perdidos: só dias reprocessados, não semanas/meses/anos |
| 6 | Baixa | Recorrentes semeadas pulam cascata (RECORRENTES → ANUAL → ...) |
| 7 | Baixa | Horário `⏰` preservado por omissão, sem lógica explícita |
| 8 | Baixa | Reagendamento: sem cursor, sem preservar estado |
| 9 | Baixa | Atraso inicial: modelo diferente da spec |
| 10 | Baixa | Config de abertura de logs: só diário, spec permite todos |
