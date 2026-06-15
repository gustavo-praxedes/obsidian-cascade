# Plano de Execução — Plugin Obsidian GP

> Versão: 1.0 — baseada em PLUGIN-OBSIDIAN-1.1 + análise dos scripts atuais
> Data: 2026-06-14

---

## 1. Contexto e ponto de partida

Local dos scripts base: D:\OBSIDIAN\02-ARQUIVO\OBSIDIAN\SCRIPTS

### O que já existe nos scripts

Os 7 scripts atuais formam um núcleo funcional completo e bem testado. O plugin não parte do zero — ele porta, envolve e expõe esse código como plugin nativo.

| Script             | O que faz                                                                 | Status de porta |
|--------------------|---------------------------------------------------------------------------|-----------------|
| `vaultConfig.js`   | Paths, renders, helpers de data, validadores, tabelas de meses/dias       | Porta direta → `PathService` + `ConfigService` |
| `vaultFiles.js`    | I/O do vault, ensure de arquivos, repair de estrutura anual/mensal        | Porta direta → `FileService` + `RepairService` |
| `vaultUtils.js`    | Extração, deduplicação, marcação, inserção, predicados de seção           | Porta direta → `TaskService` (parser + seções) |
| `vaultRecurring.js`| Regras de recorrência, `appliesOnDate`, `datesInMonthForTask`             | Porta direta → `RecurrenceService` |
| `migrateTasks.js`  | Orquestrador da cadeia de migração (5 etapas)                             | Porta direta → `MigrationService` |
| `newNote.js`       | Cria pastas e arquivos anual/mensal/diário                                | Porta direta → `NoteService` |
| `goToday.js`       | Abre a nota do dia no workspace                                           | Porta direta → comando `open-today` |
| `normalizerTitles.js` | Normaliza nomes, resolve conflitos, escuta `create`                   | Porta direta → `NormalizerService` |

### Comportamentos críticos já implementados (não podem regredir)

- Cadeia: `RECORRENTES.md → anual → mensal → diário → diário seguinte`
- `RECORRENTES.md` é somente leitura pela automação
- `🔁` fica no anual; cópias operacionais não têm `🔁`
- `📅` pendente migra com atraso; `⏳` vencida vira `- [-]`
- `⏰` é preservado em todas as transformações
- Deduplicação por chave estável (ignora datas, tags, IDs, `🔁`)
- Subtarefas concluídas/canceladas não são copiadas na migração
- Repair de estrutura anual e mensal sem perda de dados
- Normalização com anti-loop (`GP_NORMALIZER_RENAMES`) e resolução de conflitos por incremento de timestamp
- Predicados de seção aceitam formato com alias wikilink `[[path|ALIAS]]`

---

## 2. Decisões travadas (não discutir nas fases)

- Plugin nativo Obsidian (sem Electron externo, sem Node puro)
- Substitui orquestração do Templater — sem modo legado
- Modular: vários arquivos `.js` em `src/`
- Idiomas obrigatórios: `pt-BR` e `en-US`
- Sem hardcoded: toda estrutura configurável
- `RECORRENTES.md` continua sendo fonte somente leitura, usar o arquivo D:\OBSIDIAN\02-ARQUIVO\TAREFAS\202606101111-01-RECORRENTES.md como referência para entender o funcionamento. O usuário cria o arquivo e aponta para o plugin usar. 
- Status essenciais de migração não podem ser desabilitados
- Tasks avaliado como plugin parceiro, não substituído
- Calendar integrado ao plugin
- Não há compatibilidade permanente com scripts antigos após implantação

---

## 3. Nome e identidade

- **Nome provisório do plugin**: `obsidian-cascade`
- **ID no manifest**: `cascade`
- **Nome público** (pendente decisão): sugestão `Cascade`

---

## 4. Estrutura de arquivos do plugin

```
obsidian-gp-agenda/
├── manifest.json
├── main.js                  ← entry point compilado (esbuild)
├── styles.css
├── package.json
├── esbuild.config.mjs
├── src/
│   ├── main.ts              ← Plugin class, onload/onunload
│   ├── app/
│   │   ├── lifecycle.ts     ← StartupOrchestrator
│   │   ├── commands.ts      ← Registro de comandos
│   │   └── events.ts        ← Registro de eventos vault
│   ├── config/
│   │   ├── defaults.ts      ← Valores padrão de todas as settings
│   │   ├── schema.ts        ← Tipos e interfaces das settings
│   │   └── settings-tab.ts  ← PluginSettingTab do Obsidian
│   ├── i18n/
│   │   ├── index.ts         ← Função t(key) + seleção de idioma
│   │   ├── pt-BR.ts
│   │   └── en-US.ts
│   ├── notes/
│   │   ├── path-service.ts       ← Porta de vaultConfig (paths + renders)
│   │   ├── note-service.ts       ← Porta de newNote + goToday
│   │   ├── template-service.ts   ← Aplicação de templates por tipo/pasta
│   │   ├── frontmatter-service.ts← created/updated
│   │   └── normalizer-service.ts ← Porta de normalizerTitles
│   ├── calendar/
│   │   ├── calendar-view.ts      ← ItemView do Obsidian
│   │   └── calendar-service.ts   ← Lógica de navegação e criação
│   ├── tasks/
│   │   ├── task-parser.ts        ← Porta de vaultUtils (extração/chave)
│   │   ├── task-serializer.ts    ← Porta de vaultUtils (transformação)
│   │   ├── recurrence-service.ts ← Porta de vaultRecurring
│   │   ├── migration-service.ts  ← Porta de migrateTasks
│   │   ├── status-service.ts     ← Status essenciais + customizados
│   │   └── checkbox-menu.ts      ← Menu de clique direito/toque longo
│   └── vault/
│       ├── file-service.ts       ← Porta de vaultFiles (I/O)
│       ├── lock-service.ts       ← Mutex para operações concorrentes
│       └── repair-service.ts     ← Porta de repairAnnualLog/repairMonthlyLog
└── tests/
    ├── unit/
    │   ├── path-service.test.ts
    │   ├── task-parser.test.ts
    │   ├── recurrence-service.test.ts
    │   └── normalizer-service.test.ts
    └── integration/
        └── migration-service.test.ts
```

---

## 5. Schema de settings

```typescript
interface CascadeSettings {
  // Geral
  language: "pt-BR" | "en-US" | "auto";
  agendaRoot: string;              // default: Em banco, usuário define pasta. 
  openTodayOnStartup: boolean;     // default: true
  runMigrationOnStartup: boolean;  // default: true
  runNormalizerOnStartup: boolean; // default: true

  // Startup delay / condição de sincronização
  startupDelaySeconds: number;          // default: 5
  startupWaitCondition:
    | "fixed"            // apenas espera o delay
    | "until-daily"      // espera até a nota diária aparecer
    | "until-vault-idle" // espera até N segundos sem mudança no vault
    | "combined";        // delay mínimo + idle máximo
  startupWaitMaxSeconds: number;        // default: 30
  startupVaultIdleSeconds: number;      // default: 3

  // Notas periódicas
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  monthlyEnabled: boolean;
  yearlyEnabled: boolean;
  operationalYearStartMonth: number;    // default: 1 (Janeiro)

  // Formatos de nome de arquivo
  dailyFormat: string;    // default: "YYYYMMdd0000-DDD" (DDD = nome do dia)
  monthlyFormat: string;  // default: "YYYYmm000000-MMM"
  yearlyFormat: string;   // default: "YYYY00000000-YYYY"
  noteFormat: string;     // default: "YYYYMMddHHmm-SLUG"

  // Normalizador
  normalizerEnabled: boolean;      // default: true
  normalizerUppercase: boolean;    // default: true
  normalizerAccents: boolean;      // default: true (preserva acentos)
  normalizerTimestamp: boolean;    // default: true
  normalizerScopes: string[];      // default: ["01-AGENDA"]
  normalizerIgnored: string[];     // default: ["02-ARQUIVO/OBSIDIAN/TEMPLATES"]

  // Templates
  templatesFolder: string;
  dailyTemplate: string;
  weeklyTemplate: string;
  monthlyTemplate: string;
  yearlyTemplate: string;
  folderTemplates: Array<{ folder: string; template: string }>;

  // Tarefas
  recurringTasksPath: string;      // default: atual hardcoded, ajustar
  taskGlobalFilter: string;        // default: "#tasks" Configurável pelo user
  taskSetCreatedDate: boolean;     // default: false
  taskSetDoneDate: boolean;        // default: false
  migrationEnabled: boolean;       // default: true
  cancelExpiredScheduled: boolean; // default: true (cancela ⏳ vencida)

  // Status
  essentialStatuses: StatusDef[];  // protegidos, não removíveis
  customStatuses: StatusDef[];     // criados pelo usuário

  // Calendário
  calendarFirstDayOfWeek: 0 | 1;  // 0=Dom, 1=Seg
  calendarShowWeekNumbers: boolean;
  calendarOpenInNewLeaf: boolean;
  calendarConfirmCreate: boolean;

  // Propriedades (frontmatter)
  frontmatterEnabled: boolean;
  frontmatterCreatedKey: string;   // default: "created"
  frontmatterUpdatedKey: string;   // default: "updated"
  frontmatterDateFormat: string;   // default: "yyyy-MM-dd'T'HH:mm"
  frontmatterIgnoredPaths: string[];
}

interface StatusDef {
  symbol: string;       // ex: ">"
  label: string;        // ex: "Migrada"
  icon?: string;        // ex: "➡️"
  essential: boolean;   // não pode ser removido se true
}
```

### Status essenciais protegidos

| Símbolo | Significado   | Pode remover? |
|---------|---------------|---------------|
| ` `     | Aberta        | Não           |
| `/`     | Em progresso  | Não           |
| `x`     | Concluída     | Não           |
| `-`     | Cancelada     | Não           |
| `>`     | Migrada       | Não           |
| `<`     | Agendada      | Não           |
---

## 6. Fases de implementação

---

### Fase 1 — Fundação

**Objetivo**: Plugin carrega, tem settings e executa o comando `Abrir hoje`.

**Pré-requisito**: nenhum. Começa do zero.

**Entregáveis**:

1. `manifest.json` com `id`, `name`, `version`, `minAppVersion`, `author`
2. `package.json` com devDependencies: `obsidian`, `typescript`, `esbuild`
3. `esbuild.config.mjs` gerando `main.js` bundled
4. `src/main.ts` com classe plugin, `onload`, `onunload`, carregamento de settings
5. `src/config/schema.ts` com a interface `GPAgendaSettings`
6. `src/config/defaults.ts` com todos os valores padrão
7. `src/config/settings-tab.ts` com aba de configuração básica (apenas campos essenciais da Fase 1)
8. `src/i18n/` com `pt-BR` e `en-US` para strings da Fase 1
9. `src/notes/path-service.ts` — porta completa de `vaultConfig.js`:
   - `annualPath`, `monthlyPath`, `dailyPath`, `yearFolder`, `monthFolder`
   - `renderAnnualLog`, `renderMonthlyLog`, `renderDailyLog`
   - `dateInfo`, `operationalYear`, `operationalMonths`
   - `isAnnualBase`, `isMonthlyBase`, `isDailyBase`
   - `normalizeText`, `titleSlug`, `dateFromDailyTitle`
10. `src/vault/file-service.ts` — porta de `vaultFiles.js` (apenas `read`, `write`, `ensureFolder`, `ensureFile`)
11. `src/notes/note-service.ts` — porta de `newNote.js` e `goToday.js`
12. `src/app/commands.ts` com os comandos iniciais:
    - `gp-agenda:open-today` — abre/cria nota do dia
    - `gp-agenda:create-daily` — apenas cria, sem abrir
    - `gp-agenda:reprocess` — roda migração manualmente

**Critérios de aceite**:
- Plugin aparece na lista de plugins do Obsidian
- Settings abre sem erro
- Comando `Abrir nota diária` cria a estrutura de pastas e abre a nota diária no padrão correto
- Path gerado é idêntico ao do script atual para a mesma data
- Não há conflito com Templater rodando ao mesmo tempo

**Riscos da fase**:
- Conflito de criação com Templater (ambos ouvindo eventos)
- `esbuild` não bundlando corretamente dependências internas

---

### Fase 2 — Notas Periódicas

**Objetivo**: Criar, recuperar e abrir diário/semanal/mensal/anual sem Templater.

**Pré-requisito**: Fase 1 concluída e aceita.

**Entregáveis**:

1. `src/vault/repair-service.ts` — porta de `repairAnnualLog` e `repairMonthlyLog` de `vaultFiles.js`:
   - `hasAnnualStructure`, `hasMonthlyStructure`
   - `repairAnnualLog`, `repairMonthlyLog`
   - `insertBlocksIntoSection`, `appendRecovered`
   - Funções auxiliares: `splitLines`, `sectionEnd`, `taskBlocksInRange`, `addBlocks`
2. `src/vault/file-service.ts` completado:
   - `ensureAnnualLog`, `ensureMonthlyLog`, `ensureDailyLog`
   - `ensureStructuredFile`
3. `src/notes/template-service.ts`:
   - Substitui folder templates do Templater
   - Suporte a variáveis: `{{date}}`, `{{title}}`, `{{year}}`, `{{month}}`, `{{day}}`
   - Template por tipo (daily/monthly/yearly) e por pasta
4. `src/notes/note-service.ts` completado:
   - Cria anual, mensal semanal e diário em cascata
   - Recupera arquivos malformados via `RepairService`
   - Evita duplicação com verificação antes de criar
5. `src/app/lifecycle.ts` — `StartupOrchestrator` parcial:
   - Delay configurável
   - Condição `"fixed"`: espera N segundos e executa
   - Log de execução no console

**Critérios de aceite**:
- Criar diário/semanal/mensal/anual funciona sem Templater ativo
- H1, YAML, links e seções seguem exatamente o padrão atual dos renders
- Arquivo malformado é reparado sem perda de tarefas existentes
- Arquivo vazio recebe estrutura completa
- Calendar interno (mesmo que básico) consegue abrir nota correta ao clicar no dia
- Templates personalizados são aplicados corretamente por tipo e por pasta

**Riscos da fase**:
- Repair pode perder tarefas se a lógica de `taskBlocksInRange` não for portada fielmente
- Templates com sintaxe do Templater (`<% tp... %>`) não funcionam no plugin — documentar limitação

---

### Fase 3 — Tarefas e Recorrência

**Objetivo**: Migração em cascata funcionando nativamente.

**Pré-requisito**: Fase 2 concluída e aceita.

**Entregáveis**:

1. `src/tasks/task-parser.ts` — porta de `vaultUtils.js` (extração e chaves):
   - `taskMatch`, `taskKey`, `taskLooseKey`, `isUsefulTask`
   - `extractTasks`, `extractTasksWithSubtasks`, `extractRecurringTasks`
   - `extractSectionTasks`, `extractRootTasks`
   - `sectionBounds`, `rootSectionBounds`, `sectionText`, `rootText`
   - `metadataDate`, `occurrenceMarker`, `hasScheduledDate`, `isScheduledForDate`
   - `monthPredicate`, `dayPredicate`, `migratedPredicate`
2. `src/tasks/task-serializer.ts` — porta de `vaultUtils.js` (transformação e marcação):
   - `toOpenTask`, `withTaskStatus`, `stripRecurrence`
   - `withOccurrenceDate`, `withDueDate`, `prepareRecurringTask`
   - `uniqueNewTasks`, `uniqueNewPreparedTasks`
   - `markMigrated`, `markCancelled`
   - `markMigratedInSection`, `markMigratedInRoot`
   - `insertAfterH1`, `insertIntoSection`
   - `replaceTaskInSection`, `replaceTaskInRoot`
   - `uniqueNewTasksForSection`
3. `src/tasks/recurrence-service.ts` — porta completa de `vaultRecurring.js`:
   - `recurrenceRule`, `recurrenceBaseDate`
   - `dueDateInTask`, `scheduledDateInTask`, `startDateInTask`, `firstDateInTask`
   - `dayFromRule`, `monthFromRule`, `ordinalFromRule`, `weekIndex`
   - `appliesOnDate` (suporte: every day, every weekday, every week [on X], every N weeks, every month, every N months, every year [on X])
   - `datesInMonthForTask`
4. `src/tasks/migration-service.ts` — porta completa de `migrateTasks.js`:
   - `seedAnnualFromRecurring`
   - `migrateAnnualToMonthly`
   - `seedMonthlyRecurring`
   - `migrateMonthlyToDaily`
   - `migratePreviousDay`
   - Orquestrador com a sequência correta das 5 etapas
5. `src/vault/lock-service.ts`:
   - Mutex simples para evitar execuções concorrentes da migração
   - Timeout configurável
6. `src/app/lifecycle.ts` completado:
   - Condições `"until-daily"`, `"until-vault-idle"`, `"combined"`
   - Checa se nota diária apareceu durante a espera (evita duplicata pós-sync)
   - Registra motivo de adiamento/execução

**Critérios de aceite**:
- `RECORRENTES.md` não é modificado pela automação
- `📅` migra corretamente com atraso para dia seguinte
- `⏳` vencida ontem vira `- [-]`
- `⏰` é preservado em todas as transformações
- Subtarefas concluídas/canceladas não são copiadas na migração
- Deduplicação funciona mesmo com variação de datas entre versões da tarefa
- Migração com vault idle não cria nota duplicada após sync do iCloud/Syncthing
- Tarefas com `🛫` futuro não aparecem antes da data de início

**Riscos da fase**:
- `appliesOnDate` com intervalos (`every 2 weeks`) depende de `weekIndex` — verificar borda de ano
- `migratePreviousDay` cancela `⏳` apenas de ontem; se o vault ficou fechado por vários dias, tarefas mais antigas ficam abertas (comportamento atual — documentar como limitação conhecida)
- Concorrência entre migração e edição manual do usuário (mitigado pelo `LockService`)

---

### Fase 4 — Checkbox e Status

**Objetivo**: Menu nativo de status com suporte a customização.

**Pré-requisito**: Fase 3 concluída e aceita.

**Entregáveis**:

1. `src/tasks/status-service.ts`:
   - Lista de status essenciais protegidos (` `, `/`, `x`, `-`, `>`, `<`)
   - CRUD de status customizados via settings
   - Validação: símbolo único, não vazio, não sobrescreve essencial
   - Mapeamento símbolo → label, ícone/emoji
2. `src/tasks/checkbox-menu.ts`:
   - Menu flutuante via `Menu` do Obsidian
   - Gatilho: clique direito em checkbox / toque longo (mobile)
   - Lista todos os status disponíveis (essenciais + customizados)
   - Atualiza o status no arquivo via `FileService`
   - Compatibilidade com Tasks desligada (conforme config atual)
3. `src/config/settings-tab.ts` atualizado:
   - Seção de status customizados com add/remove/edit
   - Preview visual do menu
4. Atalhos de texto (opcional, configurável):
   - `- [S]` pode converter para status mapeado
   - Ativado/desativado por setting

**Critérios de aceite**:
- Usuário troca status por menu em qualquer checkbox
- Status essenciais aparecem sempre e não podem ser removidos
- Status customizados aparecem após os essenciais
- Menu funciona em desktop (clique direito) e mobile (toque longo)
- Mudança de status não corrompe metadados da linha (datas, tags, `⏰`)

**Riscos da fase**:
- API de menu do Obsidian pode não suportar toque longo em mobile — pesquisar alternativa
- Atalhos de texto podem conflitar com edição normal

---

### Fase 5 — Normalização e Propriedades

**Objetivo**: Nomes normalizados e frontmatter controlado nativamente.

**Pré-requisito**: Fase 4 concluída e aceita.

**Entregáveis**:

1. `src/notes/normalizer-service.ts` — porta completa de `normalizerTitles.js`:
   - `formatSlug` (preserva acentos, maiúsculas, hífen)
   - `formatTimestamp`, `incrementTimestamp`
   - `shouldHandle` (filtros: `.trash`, `.tmp`, `.bak`, `sync-conflict`, `~syncthing~`)
   - `targetBase` (preserva timestamp existente de 12 dígitos)
   - `uniquePath` (resolve conflitos incrementando HHMM)
   - `normalize` com anti-loop via Set interno
   - `scanAll` na inicialização
   - Escuta evento `create` do vault
   - Escopos e pastas ignoradas configuráveis
   - Opções: maiúsculas, acentos, timestamp, escopos
2. `src/notes/frontmatter-service.ts`:
   - Atualiza `updated` em edições reais (evento `modify`)
   - Seta `created` apenas na criação
   - Preserva YAML válido (não transforma `tags: [x]`)
   - Ignora templates e pastas configuradas
   - Formato de data configurável (`yyyy-MM-dd'T'HH:mm`)
3. `src/app/events.ts` atualizado:
   - Registra `vault.on("create")` → `NormalizerService.normalize`
   - Registra `vault.on("modify")` → `FrontmatterService.onModify`
   - Anti-loop para ambos

**Critérios de aceite**:
- Nomes são normalizados conforme configuração de escopo
- Acentos são preservados quando habilitado
- Timestamp existente é mantido; novo arquivo recebe timestamp atual
- Conflito de nome resolve incrementando minuto até encontrar disponível
- `updated` muda apenas em edições reais, não na abertura do arquivo
- YAML não é corrompido
- Templates e pastas ignoradas não são renomeados
- Normalização não entra em loop

**Riscos da fase**:
- Evento `modify` do Obsidian dispara frequentemente — throttle necessário
- `fileManager.renameFile` atualiza links; `vault.rename` não — usar `fileManager` quando disponível (já no script atual)

---

### Fase 6 — Calendar Interno

**Objetivo**: Calendar nativo integrado ao `NoteService`.

**Pré-requisito**: Fase 5 concluída e aceita.

**Entregáveis**:

1. `src/calendar/calendar-service.ts`:
   - Gera grid mensal (array de semanas com dias)
   - Calcula se existe nota para cada dia (via `FileService`)
   - Navega entre meses
   - Identifica dia atual
2. `src/calendar/calendar-view.ts` — `ItemView` do Obsidian:
   - Renderiza grid com HTML/CSS nativo
   - Clique no dia chama `NoteService.openOrCreate(date)`
   - Destaque visual: dia atual, dias com nota, dias sem nota
   - Navegação mês anterior/próximo
   - Botão "Hoje"
   - Localizações `pt-BR` e `en-US` via `i18n`
   - Primeiro dia da semana configurável
   - Opção: abrir em leaf atual ou novo leaf
   - Opção: confirmar antes de criar nota
3. Ribbon icon para abrir o calendar
4. Comando `cascade:toggle-calendar`

**Critérios de aceite**:
- Clicar em sábado abre `SÁBADO` quando essa for a configuração de idioma
- Não há duplicata sem acento (ex: `SABADO` vs `SÁBADO`)
- Criação da nota passa pelo `NoteService`, não pelo Obsidian nativo
- Calendar funciona em mobile (touch)
- Localização troca corretamente entre `pt-BR` e `en-US`
- Dias com nota existente têm indicador visual diferente

**Riscos da fase**:
- Renderização de calendário pode ser lenta com muitas notas — cache de existência
- Acento no nome do dia (`SÁBADO`) pode causar incompatibilidade se o sistema de arquivos for case-insensitive (macOS) — testar
- Definir melhor padrão a ser adotado. 

---

### Fase 7 — Implantação Limpa

**Objetivo**: Vault real funcionando apenas com o plugin; Templater desacoplado da agenda.

**Pré-requisito**: Fases 1–6 concluídas e testadas em vault de teste.

**Entregáveis**:

1. Checklist de migração (para o usuário executar):
   - [ ] Backup do vault
   - [ ] Ativar plugin em vault de teste
   - [ ] Validar cadeia de migração no vault de teste
   - [ ] Desativar folder template do Templater para `/`
   - [ ] Desativar startup do Templater (`000000000000-STARTUP.md`)
   - [ ] Ativar plugin no vault real
   - [ ] Monitorar por 3 dias antes de desativar Templater completamente
   - [ ] Desativar Periodic Notes externo
   - [ ] Desativar Calendar externo
   - [ ] Desativar Checkbox Style Menu externo
   - [ ] Desativar Update Time on Edit externo
   - [ ] Avaliar Tasks: manter como parceiro ou desativar
   - [ ] Manter Dataview opcional
2. Documentação de rollback: como reverter para Templater em caso de falha
3. Testes de regressão no vault real:
   - Apenas uma nota diária é criada (sem duplicata pós-sync)
   - `RECORRENTES.md` inalterado
   - Sábado com acento encontrado corretamente
   - `#tasks` funciona com Tasks (se mantido como parceiro)
   - Tarefas vazias não aparecem em mensal/anual

**Critérios de aceite** (todos obrigatórios antes de finalizar):
- Vault real funciona com plugin ativo e todos os plugins listados desativados
- Templater não é necessário para nenhuma função de agenda
- Não há `SEM-TITULO` ou notas com nome errado sendo criadas
- Migração roda corretamente na abertura do Obsidian
- Nenhum dado perdido na transição

---

## 7. Sequência de tarefas por fase (backlog priorizado)

### Fase 1

| # | Tarefa | Estimativa |
|---|--------|------------|
| 1.1 | Scaffolding: `manifest.json`, `package.json`, `esbuild.config.mjs` | 1h |
| 1.2 | `src/main.ts` com `onload`/`onunload` e carregamento de settings | 1h |
| 1.3 | `src/config/schema.ts` + `defaults.ts` | 1h |
| 1.4 | `src/config/settings-tab.ts` (campos da Fase 1 apenas) | 2h |
| 1.5 | `src/i18n/` (pt-BR + en-US, strings da Fase 1) | 1h |
| 1.6 | `src/notes/path-service.ts` (porta de `vaultConfig.js`) | 2h |
| 1.7 | `src/vault/file-service.ts` (porta parcial de `vaultFiles.js`) | 2h |
| 1.8 | `src/notes/note-service.ts` (porta de `newNote.js` + `goToday.js`) | 2h |
| 1.9 | `src/app/commands.ts` com 3 comandos iniciais | 1h |
| 1.10 | Teste manual: plugin carrega, settings abre, `open-today` funciona | 1h |

### Fase 2

| # | Tarefa | Estimativa |
|---|--------|------------|
| 2.1 | `src/vault/repair-service.ts` (porta de repair do `vaultFiles.js`) | 3h |
| 2.2 | `src/vault/file-service.ts` completado com `ensure*Log` | 1h |
| 2.3 | `src/notes/template-service.ts` | 2h |
| 2.4 | `src/app/lifecycle.ts` (delay fixo) | 1h |
| 2.5 | `src/calendar/calendar-view.ts` básico (clique abre nota) | 2h |
| 2.6 | Testes: create/repair de logs sem Templater | 2h |

### Fase 3

| # | Tarefa | Estimativa |
|---|--------|------------|
| 3.1 | `src/tasks/task-parser.ts` | 3h |
| 3.2 | `src/tasks/task-serializer.ts` | 3h |
| 3.3 | `src/tasks/recurrence-service.ts` | 2h |
| 3.4 | `src/vault/lock-service.ts` | 1h |
| 3.5 | `src/tasks/migration-service.ts` | 3h |
| 3.6 | `src/app/lifecycle.ts` completado (todas as condições) | 2h |
| 3.7 | Testes de migração (unit + integração) | 3h |

### Fase 4

| # | Tarefa | Estimativa |
|---|--------|------------|
| 4.1 | `src/tasks/status-service.ts` | 2h |
| 4.2 | `src/tasks/checkbox-menu.ts` | 3h |
| 4.3 | Settings: seção de status | 1h |
| 4.4 | Testes de menu em desktop e mobile | 1h |

### Fase 5

| # | Tarefa | Estimativa |
|---|--------|------------|
| 5.1 | `src/notes/normalizer-service.ts` | 3h |
| 5.2 | `src/notes/frontmatter-service.ts` | 2h |
| 5.3 | `src/app/events.ts` com throttle | 1h |
| 5.4 | Testes: normalização, loop, conflitos, frontmatter | 2h |

### Fase 6

| # | Tarefa | Estimativa |
|---|--------|------------|
| 6.1 | `src/calendar/calendar-service.ts` | 2h |
| 6.2 | `src/calendar/calendar-view.ts` completo | 4h |
| 6.3 | i18n do calendar (pt-BR + en-US) | 1h |
| 6.4 | Ribbon icon + comando toggle | 1h |
| 6.5 | Testes: acento, mobile, localização | 2h |

### Fase 7

| # | Tarefa | Estimativa |
|---|--------|------------|
| 7.1 | Testes completos em vault de teste | 4h |
| 7.2 | Documentação de migração e rollback | 2h |
| 7.3 | Execução do checklist no vault real | 2h |
| 7.4 | Monitoramento por 3 dias | — |

---

## 8. Testes obrigatórios

### Unitários (por módulo)

- `PathService`: paths idênticos ao script atual para mesmas datas em `pt-BR` e `en-US`
- `TaskParser`: `taskKey` e `taskLooseKey` para todos os formatos de emoji
- `RecurrenceService`: `appliesOnDate` para every day, every weekday, every week, every N weeks, every month, every N months, every year
- `NormalizerService`: formatação com acentos, sem acentos, conflitos, timestamps especiais (ex: `000000`)

### Integração (vault falso em memória)

- Criar diário/mensal/anual do zero → estrutura correta
- Repair de log anual malformado → tarefas preservadas
- Repair de log mensal malformado → tarefas preservadas
- Migrar `RECORRENTES.md` → anual/mensal/diário sem alterar fonte
- `⏳` vencida ontem → `- [-]` no log de ontem
- `📅` pendente ontem → migrada para hoje com status preservado
- Subtarefa concluída → não copiada na migração
- Deduplicação → tarefa não aparece duas vezes mesmo com datas diferentes
- Startup com nota diária ausente → cria; presente → abre sem duplicar
- Renomear arquivo criado sem padrão → normalizado com timestamp

### Vault real (checklist manual)

- Apenas uma nota diária criada (monitorar por 3 dias)
- `RECORRENTES.md` inalterado após migração
- Sábado com `Á` em `SÁBADO` encontrado pelo calendar
- `#tasks` funcional com plugin Tasks (se parceiro)
- Tarefas vazias ausentes em mensal/anual
- Sem `SEM-TITULO` ou nomes incorretos

---

## 9. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Conflito de criação Templater + plugin | Alta (durante transição) | Alto | Desativar startup do Templater primeiro |
| Repair perde tarefas | Média | Crítico | Testes exaustivos com fixtures; backup antes |
| Duplicata pós-sync iCloud | Alta | Alto | `StartupOrchestrator` com condição `"until-daily"` |
| `SÁBADO` vs `SABADO` (macOS) | Média | Alto | Normalização via `NFD` + predicados com `normalizeText` |
| `vault.on("modify")` muito frequente | Alta | Médio | Throttle de 2s no `FrontmatterService` |
| Licença de código de plugins externos | Baixa | Alto | Replicar comportamento, não copiar código |
| Calendar lento com muitas notas | Média | Baixo | Cache de existência de arquivos |
| Atalhos de status conflitando com edição | Média | Médio | Atalhos desativados por padrão |

---

## 10. Decisões

| Decisão | Opções | Impacto |
|---------|--------|---------|
| Nome público do plugin | `Cascade` | Identidade; necessário antes de publicar |
| Integração com Tasks | Parser próprio + Tasks parceiro | Escopo da Fase 3; preferência: parceiro |
| Calendar: do zero vs biblioteca | adaptação do plugin Calendar | Complexidade da Fase 6 |
| Weekly notes na v1 | Incluir | Escopo |
| Dashboards Dataview | Manter Dataview / views nativas | Fora do escopo das 7 fases |

---

## 11. Próxima ação imediata

Antes de escrever qualquer código:

1. Definir nome público e ID final do plugin: Será Cascade
2. Criar repositório Git com estrutura de pastas definida na Seção 4
3. Configurar `esbuild` + `TypeScript` + `eslint`
4. Executar Tarefa 1.6 (`PathService`) com testes unitários — é a função mais crítica e a base de todo o resto
5. Validar que os paths gerados são bit-a-bit idênticos aos do `vaultConfig.js` atual para pelo menos 30 datas de teste
