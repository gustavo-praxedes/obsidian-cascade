# Plano de Implementação — Fase 1: Fundação

## Objetivo
Refatorar o `settings-tab.ts` (909 linhas monolítico) em módulos separados, criar API fluente `SettingBuilder`, adicionar busca, mover strings fixas para i18n, e implementar Importar/Exportar/Restaurar.

---

## 1. Nova Estrutura de Arquivos

```
src/config/
├── schema.ts              (inalterado)
├── defaults.ts            (inalterado)
├── settings-section.ts    (NOVO — interface + contexto + classe base)
├── setting-builder.ts     (NOVO — API fluente)
├── sections/
│   ├── general-section.ts
│   ├── agenda-section.ts
│   ├── migration-section.ts
│   ├── normalization-section.ts
│   ├── tasks-section.ts
│   ├── checkbox-section.ts
│   ├── calendar-section.ts
│   ├── frontmatter-section.ts
│   └── advanced-section.ts
└── settings-tab.ts        (RESCRITO — orquestrador fino)
```

---

## 2. Arquivos a Criar

### 2.1 `src/config/settings-section.ts` (~50 linhas)

Interface e contexto compartilhado para todas as seções.

```typescript
import type { App } from "obsidian";
import type CascadePlugin from "../../main";
import type { CascadeSettings } from "./schema";
import type { I18n } from "../../i18n";

export interface SectionContext {
  app: App;
  plugin: CascadePlugin;
  settings: CascadeSettings;
  container: HTMLElement;
  save(): Promise<void>;
  refresh(): void;
  t(key: string): string;
}

export interface SettingsSection {
  readonly id: string;
  readonly icon: string;
  readonly labelKey: string;
  render(ctx: SectionContext): void;
}

export function createSectionContext(
  app: App,
  plugin: CascadePlugin,
  container: HTMLElement,
  refresh: () => void,
): SectionContext {
  return {
    app,
    plugin,
    settings: plugin.settings,
    container,
    save: async () => { await plugin.saveSettings(); },
    refresh,
    t: (key) => plugin.i18n.t(key as any),
  };
}
```

### 2.2 `src/config/setting-builder.ts` (~100 linhas)

API fluente para construir configurações com consistência.

```typescript
import { Setting } from "obsidian";
import type { SectionContext } from "./settings-section";

export class SettingBuilder {
  private ctx: SectionContext;
  private _name = "";
  private _desc = "";
  private _tooltip = "";
  private _saveAction?: (value: any) => Promise<void>;
  private _refreshOnSave = false;

  constructor(ctx: SectionContext) { this.ctx = ctx; }

  name(n: string): this { this._name = n; return this; }
  desc(d: string): this { this._desc = d; return this; }
  tooltip(t: string): this { this._tooltip = t; return this; }
  onSave(fn: (v: any) => Promise<void>): this { this._saveAction = fn; return this; }
  refresh(r = true): this { this._refreshOnSave = r; return this; }

  toggle(key: keyof CascadeSettings): Setting {
    const s = this.buildBase();
    s.addToggle(t =>
      t.setValue(this.ctx.settings[key] as boolean)
       .onChange(async v => {
         (this.ctx.settings as any)[key] = v;
         await this.finish();
       })
    );
    return s;
  }

  text(key: keyof CascadeSettings, placeholder?: string): Setting {
    const s = this.buildBase();
    s.addText(t => {
      t.setValue(String(this.ctx.settings[key] ?? ""));
      if (placeholder) t.setPlaceholder(placeholder);
      t.onChange(async v => {
        (this.ctx.settings as any)[key] = v.trim();
        void this.finish();
      });
    });
    return s;
  }

  textarea(key: keyof CascadeSettings): Setting {
    const s = this.buildBase();
    s.addTextArea(t =>
      t.setValue((this.ctx.settings[key] as string[]).join("\n"))
       .onChange(async v => {
         (this.ctx.settings as any)[key] = v.split("\n").map(s => s.trim()).filter(Boolean);
         void this.finish();
       })
    );
    return s;
  }

  dropdown(key: keyof CascadeSettings, options: [string, string][]): Setting {
    const s = this.buildBase();
    s.addDropdown(d => {
      for (const [val, label] of options) d.addOption(val, label);
      d.setValue(String(this.ctx.settings[key]));
      d.onChange(async v => {
        (this.ctx.settings as any)[key] = v;
        await this.finish();
      });
    });
    return s;
  }

  // Helpers internos
  private buildBase(): Setting {
    const s = new Setting(this.ctx.container).setName(this._name);
    if (this._desc) s.setDesc(this._desc);
    if (this._tooltip) {
      const tip = s.nameEl.createSpan({ cls: "cascade-tooltip", text: "?" });
      tip.createSpan({ cls: "cascade-tooltip__content", text: this._tooltip });
    }
    return s;
  }

  private async finish(): Promise<void> {
    await this.ctx.save();
    if (this._saveAction) await this._saveAction();
    if (this._refreshOnSave) this.ctx.refresh();
  }
}
```

### 2.3 Seções (9 arquivos em `src/config/sections/`)

Cada seção implementa `SettingsSection`. Exemplo simplificado:

```typescript
// sections/general-section.ts
import { Setting } from "obsidian";
import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class GeneralSection implements SettingsSection {
  id = "general";
  icon = "⚙️";
  labelKey = "sectionGeneral";

  render(ctx: SectionContext): void {
    new SettingBuilder(ctx)
      .name(ctx.t("language"))
      .tooltip(ctx.t("tooltipLanguage"))
      .dropdown("language", [
        ["auto", "Auto"],
        ["pt-BR", "pt-BR"],
        ["en-US", "en-US"],
      ])
      .refresh()
      .build();

    new SettingBuilder(ctx)
      .name(ctx.t("startCascadeOnStartup"))
      .tooltip(ctx.t("tooltipStartOnStartup"))
      .toggle("startCascadeOnStartup")
      .refresh()
      .build();

    if (!ctx.settings.startCascadeOnStartup) {
      new Setting(ctx.container)
        .setName(ctx.t("manualStart"))
        .setDesc(ctx.t("manualStartDesc"))
        .addButton(b => b.setButtonText(ctx.t("startCascadeButton")).onClick(() => {
          // @ts-ignore
          ctx.app.commands.executeCommandById("obsidian-cascade:start-cascade");
        }));
    }
  }
}
```

#### Seções e seus cards:

| Seção | Cards | Configs principais |
|-------|-------|-------------------|
| `GeneralSection` | General, Agenda (atalho), Features (toggles) | language, startCascadeOnStartup, manualStart, todos os `*Enabled` |
| `AgendaSection` | Agenda Root, Annual, Monthly, Weekly, Daily | agendaRoot, openOnStartup, format/template/folder por período |
| `MigrationSection` | Migration | runMigrationOnStartup, runMigrationOnManualOpen |
| `NormalizationSection` | Normalization, Replacements | normalizerCase, accents, timestamp, scopes, ignoredPaths, replacements[] |
| `TasksSection` | Tasks | recurringTasksPath, taskSet*, cancelExpired, lookback, autoComplete, globalFilter, startupDelay |
| `CheckboxSection` | Checkbox | essentialStatuses (read-only), customStatuses (edit/delete), add form |
| `CalendarSection` | Calendar | ribbon, firstDayOfWeek, weekNumber, newLeaf, confirmCreate |
| `FrontmatterSection` | Frontmatter | enabled, createdKey, updatedKey, dateFormat |
| `AdvancedSection` | Internal Log, **Import/Export/Reset** | logging*, import/export/reset buttons |

### 2.4 `AdvancedSection` — Importar/Exportar/Restaurar

Card adicional no final da seção Avançado:

```typescript
// No AdvancedSection.render():
new Setting(ctx.container)
  .setName(ctx.t("settingsExport"))
  .addButton(btn =>
    btn.setButtonText(ctx.t("settingsExport"))
       .setCta()
       .onClick(() => this.exportSettings(ctx))
  );

new Setting(ctx.container)
  .setName(ctx.t("settingsImport"))
  .addButton(btn =>
    btn.setButtonText(ctx.t("settingsImport"))
       .onClick(() => this.importSettings(ctx))
  );

new Setting(ctx.container)
  .setName(ctx.t("settingsResetAll"))
  .addButton(btn =>
    btn.setButtonText(ctx.t("settingsResetAll"))
       .setWarning()
       .onClick(() => this.resetAll(ctx))
  );
```

**Exportar**: Serializa `ctx.settings` como JSON, cria `Blob`, gera link de download com nome `cascade-settings-{date}.json`.

**Importar**: Cria `<input type="file" accept=".json">`, lê o arquivo, valida com `mergeSettings()`, salva, re-renderiza. Mostra `Notice` de sucesso/erro.

**Restaurar**: `mergeSettings(null)` restaura defaults, salva, re-renderiza.

---

## 3. Arquivo a Modificar

### 3.1 `settings-tab.ts` (RESCRITO — ~150 linhas)

O novo `settings-tab.ts` orquestra:

```typescript
import { App, PluginSettingTab } from "obsidian";
import type CascadePlugin from "../main";
import { SECTIONS, createSectionContext } from "./settings-section";
import type { SettingsSection, SectionContext } from "./settings-section";

// Import das seções
import { GeneralSection } from "./sections/general-section";
import { AgendaSection } from "./sections/agenda-section";
// ... etc

export class CascadeSettingTab extends PluginSettingTab {
  private activeSection = "general";
  private searchQuery = "";
  private sections: SettingsSection[];

  constructor(app: App, private plugin: CascadePlugin) {
    super(app, plugin);
    this.sections = [
      new GeneralSection(),
      new AgendaSection(),
      new MigrationSection(),
      new NormalizationSection(),
      new TasksSection(),
      new CheckboxSection(),
      new CalendarSection(),
      new FrontmatterSection(),
      new AdvancedSection(),
    ];
  }

  display(): void {
    this.containerEl.empty();
    this.renderHeader(this.containerEl);
    this.renderSearch(this.containerEl);
    this.renderNav(this.containerEl);
    this.renderContent(this.containerEl);
  }

  private renderSearch(parent: HTMLElement): void {
    const input = parent.createEl("input", {
      cls: "cascade-settings-search",
      attr: {
        type: "text",
        placeholder: this.t("settingsSearchPlaceholder"),
      },
    });
    input.addEventListener("input", () => {
      this.searchQuery = input.value.toLowerCase();
      this.renderContent(this.containerEl);
    });
  }

  private renderContent(parent: HTMLElement): void {
    const content = parent.createDiv({ cls: "cascade-settings-section-v2" });
    const section = this.sections.find(s => s.id === this.activeSection);
    if (!section) return;

    const ctx = createSectionContext(this.app, this.plugin, content, () => this.display());

    if (this.searchQuery) {
      // Filtrar: renderizar só cards que tenham settings correspondentes
      this.renderFilteredSection(section, ctx);
    } else {
      section.render(ctx);
    }
  }

  private renderFilteredSection(section: SettingsSection, ctx: SectionContext): void {
    // Temporariamente interceptar SettingBuilder para filtrar
    // Por simplicidade: renderizar tudo e esconder non-matches
    section.render(ctx);
    const items = ctx.container.querySelectorAll(".setting-item");
    items.forEach(item => {
      const text = item.textContent?.toLowerCase() ?? "";
      (item as HTMLElement).style.display =
        text.includes(this.searchQuery) ? "" : "none";
    });
  }
}
```

### 3.2 `src/i18n/en-US.ts` — Adicionar chaves

```typescript
// Adicionar ao dicionário:
none: "None",
custom: "Custom...",
auto: "Auto",
```

### 3.3 `src/i18n/pt-BR.ts` — Adicionar chaves

```typescript
// Adicionar ao dicionário:
none: "Nenhum",
custom: "Personalizado...",
auto: "Auto",
```

---

## 4. Ordem de Implementação

| # | Tarefa | Dependências |
|---|--------|--------------|
| 1 | Criar `settings-section.ts` (interface + contexto) | Nenhuma |
| 2 | Criar `setting-builder.ts` (API fluente) | #1 |
| 3 | Criar `sections/` e extrair as 9 seções | #1, #2 |
| 4 | Adicionar chaves i18n (`none`, `custom`, `auto`) | Nenhuma |
| 5 | Substituir strings hardcoded nas seções | #3, #4 |
| 6 | Adicionar busca no `settings-tab.ts` | #3 |
| 7 | Implementar Importar/Exportar/Restaurar no `AdvancedSection` | #3 |
| 8 | Reescrever `settings-tab.ts` como orquestrador | #3, #6, #7 |
| 9 | Verificar build (`npm run build`) | Tudo |

---

## 5. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| `renderCard` swappava `contentContainer` — seções dependem disso | `SectionContext.container` é o card body; `SettingBuilder` usa `ctx.container` diretamente |
| `as any` casts ainda necessários para chaves dinâmicas | Manter `as any` mas documentar; futuramente usar `SettingDef` type-safe |
| Busca pode filtrar errado se settings têm nomes i18n | Buscar no texto renderizado (textContent), não nas chaves |
| Importar settings com campos novos/faltantes | `mergeSettings()` já lida com defaults — reutilizar |
| Breaking changes em chamadas externas ao settings tab | `display()` continua público; interface do `PluginSettingTab` não muda |

---

## 6. Verificação

1. `npm run build` — deve compilar sem erros
2. `npm run test` — testes existentes devem passar (nenhum depende do settings tab)
3. `npm run lint` — sem warnings novos
4. Teste manual: abrir configurações, navegar abas, buscar, importar/exportar
