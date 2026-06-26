import { App, PluginSettingTab } from "obsidian";
import type CascadePlugin from "../main";
import { SECTIONS_META, isSectionVisible, createSectionContext } from "./settings-section";
import type { SettingsSection } from "./settings-section";

import { GeneralSection } from "./sections/general-section";
import { AgendaSection } from "./sections/agenda-section";
import { MigrationSection } from "./sections/migration-section";
import { NormalizationSection } from "./sections/normalization-section";
import { TasksSection } from "./sections/tasks-section";
import { CheckboxSection } from "./sections/checkbox-section";
import { CalendarSection } from "./sections/calendar-section";
import { FrontmatterSection } from "./sections/frontmatter-section";
import { AdvancedSection } from "./sections/advanced-section";

const SECTION_CLASSES: Record<string, new () => SettingsSection> = {
  general: GeneralSection,
  agenda: AgendaSection,
  migration: MigrationSection,
  normalization: NormalizationSection,
  tasks: TasksSection,
  checkbox: CheckboxSection,
  calendar: CalendarSection,
  frontmatter: FrontmatterSection,
  advanced: AdvancedSection,
};

export class CascadeSettingTab extends PluginSettingTab {
  private activeSection = "general";
  private searchQuery = "";
  private savedIndicator: HTMLElement | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private navContainer: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private sections: SettingsSection[];
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    app: App,
    private readonly plugin: CascadePlugin,
  ) {
    super(app, plugin);
    this.sections = Object.entries(SECTION_CLASSES).map(([id, Cls]) => {
      const s = new Cls();
      return Object.defineProperty(s, "id", { value: id }) as SettingsSection;
    });
  }

  private t(key: string): string {
    return this.plugin.i18n.t(key as any);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderSkipLink(containerEl);
    this.renderHeader(containerEl);
    this.renderSearch(containerEl);
    this.navContainer = containerEl.createDiv({
      cls: "cascade-settings-nav",
      attr: { role: "tablist", "aria-label": this.t("sectionSettings") },
    });
    this.renderNav();
    this.renderContent(containerEl);
    this.registerKeyboardShortcuts();
  }

  hide(): void {
    this.unregisterKeyboardShortcuts();
  }

  /* ============================================
     SKIP LINK (a11y)
     ============================================ */

  private renderSkipLink(parent: HTMLElement): void {
    const link = parent.createEl("a", {
      cls: "cascade-skip-link",
      text: this.t("skipToContent"),
      attr: { href: "#cascade-settings-content" },
    });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const content = parent.querySelector("#cascade-settings-content") as HTMLElement;
      content?.focus();
    });
  }

  /* ============================================
     HEADER
     ============================================ */

  private renderHeader(parent: HTMLElement): void {
    const header = parent.createDiv({ cls: "cascade-settings-header" });
    const titleRow = header.createDiv({ cls: "cascade-settings-header__actions" });
    titleRow.createEl("h2", { text: "Cascade" });
    this.savedIndicator = titleRow.createSpan({
      cls: "cascade-settings-saved",
      text: `✓ ${this.t("settingsSaved")}`,
      attr: { "aria-live": "polite", role: "status" },
    });
  }

  /* ============================================
     SEARCH
     ============================================ */

  private renderSearch(parent: HTMLElement): void {
    this.searchInput = parent.createEl("input", {
      cls: "cascade-settings-search",
      attr: {
        type: "search",
        placeholder: this.t("settingsSearchPlaceholder"),
        "aria-label": this.t("settingsSearchPlaceholder"),
        role: "searchbox",
      },
    });
    this.searchInput.addEventListener("input", () => {
      this.searchQuery = this.searchInput?.value.toLowerCase().trim() ?? "";
      this.renderContent(parent);
    });
  }

  /* ============================================
     NAVIGATION
     ============================================ */

  private renderNav(): void {
    if (!this.navContainer) return;
    if (!isSectionVisible(this.activeSection, this.plugin.settings)) {
      this.activeSection = "general";
    }
    this.navContainer.empty();
    for (const section of SECTIONS_META) {
      if (!isSectionVisible(section.id, this.plugin.settings)) continue;
      const isActive = section.id === this.activeSection;
      const btn = this.navContainer.createEl("button", {
        cls: `cascade-settings-nav__item${isActive ? " is-active" : ""}`,
        attr: {
          role: "tab",
          "aria-selected": String(isActive),
          "aria-controls": "cascade-settings-content",
          tabindex: isActive ? "0" : "-1",
        },
      });
      btn.createSpan({ cls: "cascade-settings-nav__icon", text: section.icon });
      btn.createSpan({ text: this.t(section.labelKey) });
      btn.addEventListener("click", () => {
        this.activeSection = section.id;
        this.searchQuery = "";
        if (this.searchInput) this.searchInput.value = "";
        this.renderNav();
        this.renderContent(this.containerEl);
        this.focusActiveTab();
      });
      btn.addEventListener("keydown", (e) => {
        this.handleTabKeydown(e, section.id);
      });
    }
  }

  private handleTabKeydown(e: KeyboardEvent, currentId: string): void {
    const visibleIds = SECTIONS_META
      .filter((s) => isSectionVisible(s.id, this.plugin.settings))
      .map((s) => s.id);
    const currentIndex = visibleIds.indexOf(currentId);

    let nextIndex = currentIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % visibleIds.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + visibleIds.length) % visibleIds.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = visibleIds.length - 1;
    } else {
      return;
    }

    this.activeSection = visibleIds[nextIndex];
    this.renderNav();
    this.renderContent(this.containerEl);
    this.focusActiveTab();
  }

  private focusActiveTab(): void {
    const activeTab = this.navContainer?.querySelector('.cascade-settings-nav__item[aria-selected="true"]') as HTMLElement;
    activeTab?.focus();
  }

  /* ============================================
     CONTENT
     ============================================ */

  private renderContent(parent: HTMLElement): void {
    const existing = parent.querySelector(".cascade-settings-section-v2");
    if (existing) existing.remove();

    const content = parent.createDiv({
      cls: "cascade-settings-section-v2",
      attr: {
        id: "cascade-settings-content",
        role: "tabpanel",
        tabindex: "0",
        "aria-labelledby": `tab-${this.activeSection}`,
      },
    });

    const sectionHeading = content.createEl("h3", {
      text: this.t(SECTIONS_META.find((s) => s.id === this.activeSection)?.labelKey ?? "sectionGeneral"),
      attr: { class: "sr-only" },
    });
    sectionHeading.addClass("sr-only");

    const section = this.sections.find((s) => s.id === this.activeSection);
    if (!section) return;

    const ctx = createSectionContext(this.app, this.plugin, content, () => this.display());

    if (this.searchQuery) {
      this.renderFilteredSection(section, ctx, content);
    } else {
      section.render(ctx);
    }
  }

  private renderFilteredSection(
    section: SettingsSection,
    ctx: ReturnType<typeof createSectionContext>,
    container: HTMLElement,
  ): void {
    section.render(ctx);
    const items = container.querySelectorAll(".setting-item");
    items.forEach((item) => {
      const text = item.textContent?.toLowerCase() ?? "";
      const matches = text.includes(this.searchQuery);
      (item as HTMLElement).style.display = matches ? "" : "none";
    });

    const cards = container.querySelectorAll(".cascade-card");
    cards.forEach((card) => {
      const visibleItems = card.querySelectorAll('.setting-item:not([style*="display: none"])');
      (card as HTMLElement).style.display = visibleItems.length === 0 ? "none" : "";
    });
  }

  /* ============================================
     KEYBOARD SHORTCUTS
     ============================================ */

  private registerKeyboardShortcuts(): void {
    this.unregisterKeyboardShortcuts();
    this.keydownHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        this.searchInput?.focus();
        this.searchInput?.select();
      }
      if (e.key === "Escape" && document.activeElement === this.searchInput) {
        if (this.searchInput) {
          this.searchInput.value = "";
        }
        this.searchQuery = "";
        this.searchInput?.blur();
        this.renderContent(this.containerEl);
      }
    };
    document.addEventListener("keydown", this.keydownHandler);
  }

  private unregisterKeyboardShortcuts(): void {
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  /* ============================================
     UTILITIES
     ============================================ */

  showSaved(): void {
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedIndicator?.addClass("is-visible");
    this.savedTimer = setTimeout(() => {
      this.savedIndicator?.removeClass("is-visible");
    }, 1500);
  }
}
