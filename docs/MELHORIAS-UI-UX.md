# Plano de Melhorias UI/UX para o Cascade Settings

> **Resumo Executivo**  
> A aba de configurações tem uma base sólida (layout baseado em cartões, busca, navegação por abas, i18n), mas sofre com padrões inconsistentes, hierarquia visual fraca, falta de feedbacks e baixa descoberta para usuários avançados. O código tem ~900 linhas com padrões repetidos que podem ser componentizados.

## 1. ARQUITETURA & SAÚDE DO CÓDIGO

| Problema | Impacto | Solução |
|----------|---------|---------|
| **`renderSection` com switch monolítona** (150+ linhas) | Difícil de manter, testar e estender | Extrair cada seção para sua própria classe/módulo (`GeneralSection`, `AgendaSection`, etc.) |
| **Helpers repetidos** (`addTooltipedSetting`, `addToggle`, `addText`) | APIs inconsistentes, lógica duplicada | Criar uma API fluente `SettingBuilder`: `SettingBuilder.toggle(key).name(...).tooltip(...).onChange(...).build()` |
| **Manipuladores de evento embutidos e manipulação direta do DOM** | Frágil, difícil de testar | Usar consistentemente a API `Setting` do Obsidian; evitar `createEl`/`addEventListener` bruto |
| **Nenhuma interface TypeScript para definições de configurações** | Nenhuma validação em tempo de compilação | Definir um esquema `SettingDef` (tipo, chave, rótulo, dica, validação, dependências) |
| **Strings fixas no TypeScript** (`"Custom..."`, `"None"`) | Quebra o i18n | Mover todas as strings da UI para `pt-BR.ts` / `en-US.ts` |

## 2. ARQUITETURA DE INFORMAÇÃO & NAVEGAÇÃO

### Problemas Atuais
- **9 abas de nível superior**, mas algumas são condicionais (Migração, Normalização, Tarefas, Frontmatter, Avançado) — usuários não sabem que existem até ativar o toggle pai.
- **Não há busca no código** (CSS tem `.cascade-settings-search` mas o TS não a renderiza).
- **Rótulos das abas usam ícones + texto**, mas os ícones são emoji (tamanho inconsistente, sem fallback).
- **Nenhuma navegação por teclado** entre abas (teclas Tab/Setas).

### Reestruturação Proposta da IA

```
└─ GERAL (sempre visível)
    ├─ Idioma
    ├─ Comportamento na inicialização
    └─ Botão de início manual
│
├─ AGENDA (sempre visível)
    ├─ Pasta raiz & estrutura (toggles Anual/Mensal/Semanal/Diário)
    ├─ Formatos de caminho (agrupados por período)
    ├─ Modelos (agrupados por período)
    └─ Pastas (agrupados por período)
│
├─ TAREFAS & MIGRAÇÃO (visível quando migrationEnabled)
    ├─ Fonte das tarefas recorrentes
    ├─ Gatilhos de migração (inicialização, abertura manual, atraso)
    ├─ Comportamento: datas de criação/conclusão, cancelar expiradas, lookback, completar famílias automaticamente
    └─ Filtro global de tarefas
│
├─ CAIXA DE SELEÇÃO & STATUS (sempre visível)
    ├─ Status essenciais (somente leitura, com legenda visual)
    ├─ Status personalizados (editor inline: símbolo, rótulo, ícone, exibir no menu)
    └─ Formulário para adicionar status
│
├─ CALENDÁRIO (sempre visível)
    ├─ Botão de fita
    ├─ Primeiro dia da semana
    ├─ Números de semana
    ├─ Abrir em nova aba
    └─ Confirmar criação
│
├─ NORMALIZADOR DE ARQUIVOS (visível quando normalizerEnabled)
    ├─ Transformação de caixa (dropdown com visualização ao vivo)
    ├─ Remoção de acentos
    ├─ Prefixo de timestamp
    ├─ Substituições (editor de tabela com adicionar/remover)
    └─ Escopos & caminhos ignorados (textarea, um por linha)
│
├─ FRONTMATTER (visível quando frontmatterEnabled)
    ├─ Ativar toggle
    ├─ Chaves Criado/Atualizado
    ├─ Formato de data (com visualização)
    └─ Caminhos ignorados
│
└─ AVANÇADO (visível quando loggingEnabled)
    ├─ Pasta/nome/retenção de logs
    ├─ Categorias de log (inicialização, migração, normalizador, erros)
    ├─ Botões Importar/Exportar/Restaurar
    └─ Depuração: mostrar estado interno
```

## 3. DESIGN VISUAL & HIERARQUIA

### Problemas Atuais do CSS
| Problema | Evidência | Correção |
|----------|-----------|----------|
| **Espaçamento inconsistente** | Cartões usam `padding: 4px 0` vs `10px 14px`; itens de configuração `6px 14px` | Definir tokens de espaçamento (`--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 16px`, `--space-lg: 24px`) |
| **Sem estados de foco em entradas personalizadas** | Entradas de substituição, entradas de símbolo de status | Adicionar anéis `:focus-visible` que combinam com a cor de destaque do Obsidian (`--accent-color`) |
| **Botão de redefinição oculto até o hover** | `opacity: 0` → `opacity: 1` no hover do cartão | Mostrar sempre com estilo sutil; hover = ênfase |
| **Tooltip usa o caractere `?`** | Não acessível, pouco claro | Usar ícone `help-circle` (Lucide/Obsidian), `aria-label` apropriado |
| **Nenhum agrupamento visual para configurações relacionadas** | Todas as configurações planas no corpo do cartão | Adicionar `<fieldset>` / `<legend>` ou separadores visuais para grupos |
| **Dropdown para "Abrir na inicialização" mostra "None" + 4 opções** | UX: grupo de rádio é melhor para mutuamente exclusivo | Substituir por grupo de cartões de rádio (cartões visuais com marca de seleção) |

### Cor & Contraste
- Garantir que todo o texto atenda ao **WCAG AA** (4,5:1) — verificar `var(--text-muted)` em `var(--background-secondary)`
- Usar tokens de cor semânticos: `--cascade-primary`, `--cascade-warning`, `--cascade-danger`, `--cascade-success`

## 4. INTERAÇÃO & USABILIDADE

### Recursos Críticos em Falta

| Recurso | Por que importa | Implementação |
|---------|----------------|---------------|
| **Busca nas configurações** | 50+ configurações; usuários não conseguem encontrar "prefixo de timestamp" | Adicionar campo de busca no cabeçalho; filtrar itens de configuração por nome/descrição/chave; destacar correspondências |
| **Importar / Exportar / Restaurar** | Fazer backup de configuração, compartilhar entre cofres, recuperar de erros | Botões na seção Avançado; exportar JSON com versão; importar com validação & migração |
| **Visualização ao vivo para formatos de caminho** | `YYYYMMdd0001-DDD` → "202606150001-SEGUNDA-FEIRA" | Mostrar exemplo renderizado abaixo de cada entrada de formato |
| **Validação & erros inline** | Formato de data inválido, símbolo de status duplicado, campo obrigatório vazio | Mostrar texto de erro vermelho abaixo do campo; desativar salvar até ser válido |
| **Visibilidade de campos dependentes** | Formato/pasta/template semanal só importam se `weeklyEnabled` estiver ativado | Ocultar/desabilitar campos dependentes com transição suave; mostrar "Ative notas semanais para configurar" |
| **Atalhos de teclado** | Usuários avançados querem velocidade | `Cmd/Ctrl+K` → busca; `Tab`/`Shift+Tab` navegação; `Enter` para alternar; `Esc` para fechar modais |

### Micro-interações
- **Salvar com debounce** (já existe toast de 1500ms) — bom
- **Indicador de alterações não salvas** — adicionar sinalizador sujo, avisar ao navegar para fora
- **Posicionamento do toast** — atualmente no cabeçalho direito superior; usar `Notice` do Obsidian para consistência
- **Estados de carregamento** — salvamentos assíncronos devem desativar entrada brevemente, mostrar spinner

## 5. MELHORIAS ESPECÍFICAS POR COMPONENTE

### A. Entradas de Formato de Caminho** (dailyFormat, weeklyFormat, etc.)
```
Atual: [ entrada de texto                    ]
Proposta: [ entrada de texto  ] [ 👁 Visualização: 202606150001-SEGUNDA-FEIRA ]
          [ Seletor de token ▼ ]  (insere {YYYY}, {MM}, {DD}, {WW}, {DDD}, {MMM})
```

### B. Editor de Substituições
```
Atual:  [de] → [para]  [✕]   (entradas inline, DOM bruto)
Proposta: Tabela com colunas: De | Para | Ações
          [+ Adicionar Linha] abre modal com validação
          Arraste-para-reesortar (a ordem importa para encadeamento)
          Toggle de modo regex por linha
```

### C. Editor de Status
```
Atual:  Snippet de caixa de seleção + rótulo + toggle + excluir (lista plana)
Proposta: Grade de cartões para status essenciais (somente leitura, maior)
          Lista para status personalizados com edição inline:
          ┌─ [☐]  Símbolo: [x]  Rótulo: [Done____]  Ícone: [check]  [Exibir no menu ☑]  [🗑]
          └─ [+ Adicionar Status] → modal com validação (símbolo de 1 caractere, único)
```

### D. Caminho das Tarefas Recorrentes
```
Atual:  Entrada de texto
Proposta: Entrada de texto + [📁 Procurar] → modal de selecionador de arquivos (Obsidian's `SuggestModal`)
          Mostra apenas arquivos `.md`; pré-visualiza primeiras 5 linhas ao passar o mouse
```

### E. Entradas de Pasta** (agendaRoot, dailyFolder, etc.)
```
Atual:  Entrada de texto
Proposta: Entrada de texto + [📁 Procurar] → seletor de pastas
          Mostrar caminho absoluto resolvido como dica
          Validar: pasta existe ou pode ser criada
```

## 6. ACESSIBILIDADE (a11y)

| Lacuna | Correção |
|--------|----------|
| Sem `aria-label` em botões apenas com ícones (redefinir, excluir, abas de navegação) | Adicionar `aria-label="Redefinir seção Agenda"` etc. |
| Tooltip `?` não acessível por teclado | Use `<button aria-describedby="tooltip-id">` + anel de foco visível |
| Indicadores de estado apenas por cor (toast verde salvo) | Adicionar ícone + texto: `✓ Configurações salvas` |
| Ausência de hierarquia de títulos | `<h2>Cascade</h2>` → `<h3>Agenda</h3>` → `<h4>Anual</h4>` |
| Painel de abas não anunciado | `role="tablist"` / `role="tab"` / `role="tabpanel"` com `aria-selected` |

## 7. MOBILE / RESPONSIVO

- **Barra de abas**: rolagem horizontal em dispositivos móveis (já existe `flex-wrap: wrap` — bom)
- **Cartões**: empilhados verticalmente (já são blocos)
- **Linhas de substituição**: envolver para coluna em telas estreitas (`flex-direction: column`)
- **Editor de status**: entradas de símbolo/rótulo/ícone empilhadas verticalmente
- **Áreas de toque**: mínimo 44×44px (verificar botões de exclusão, disparadores de dropdown)

## 8. ROTEIRO PRIORIZADO

### Fase 1 — Fundação (1-2 dias)
- [ ] Extrair renderizadores de seções para classes separadas
- [ ] Criar API fluente `SettingBuilder`
- [ ] Adicionar busca nas configurações (entrada no cabeçalho + lógica de filtro)
- [ ] Mover todas as strings fixas para os arquivos i18n
- [ ] Adicionar Importar/Exportar/Exportar na seção Avançado

### Fase 2 — UX Central (2-3 dias)
- [ ] Visualização ao vivo para entradas de formato de caminho
- [ ] Visibilidade de campos dependentes (mostrar/ocultar com animação)
- [ ] Estrutura de validação + erros inline
- [ ] Grupo de cartões de rádio para "Abrir na inicialização"
- [ ] Seletores de arquivo/pasta para entradas de caminho

### Fase 3 — Polimento (1-2 dias)
- [ ] Editor de tabela de substituições (modal + arrastar para reordenar)
- [ ] Redesenho do editor de status (cartões + edição inline)
- [ ] Auditoria de a11y: ARIA, gerenciamento de foco, títulos
- [ ] Atalhos de teclado (`Cmd+K` busca, navegação com tab)
- [ ] Ajustes responsivos para mobile

### Fase 4 — Avançado (opcional)
- [ ] Sincronização entre dispositivos (compatível com Obsidian Sync)
- [ ] Predefinições / perfis (Trabalho, Pessoal, Minimal)
- [ ] Links de documentação por seção (abrir wiki)
- [ ] Telemetria opt-in (estatísticas de uso anônimas)

## 9. ESQUECETO DE REFACTORING DE CÓDIGO

```typescript
// src/config/setting-defs.ts
export interface SettingDef {
  key: string;
  type: 'toggle' | 'text' | 'textarea' | 'dropdown' | 'radio' | 'file' | 'folder' | 'custom';
  label: string;
  description?: string;
  tooltip?: string;
  dependsOn?: string;           // chave do toggle pai
  dependsValue?: boolean;       // mostrar quando pai === true
  options?: DropdownOption[];   // para dropdown/radio
  validate?: (value: any) => string | null;  // retornar mensagem de erro
  preview?: (value: any) => string;          // renderizador de visualização ao vivo
  component?: (setting: Setting, ctx: SettingContext) => void; // renderização customizada
}

// src/config/sections/agenda-section.ts
export class AgendaSection implements SettingsSection {
  id = 'agenda';
  icon = 'calendar';
  labelKey = 'sectionAgenda';
  getSettings(defs: SettingDef[]): SettingDef[] { ... }
  render(container: HTMLElement, ctx: SettingContext): void { ... }
}
```

## 10. MÉTRICAS PARA ACOMPANHAR
- Tempo para encontrar uma configuração (busca vs navegação)
- Número de cliques para alterar o formato semanal
- Taxa de erro em formato de data inválido / símbolo duplicado
- Uso de Exportar/Importar
- Aberturas de configurações em mobile vs desktop

---

> **Próximos passos sugeridos**: Iniciar pela **Fase 1** (refatoração + busca + i18n + import/exportar) pois ela desbloqueia todo o restante e reduz a dívida técnica.