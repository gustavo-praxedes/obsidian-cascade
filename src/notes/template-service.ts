import { TFile, type Vault } from "obsidian";
import type { CascadeSettings } from "../config/schema";
import type { DateInfo } from "./path-service";

export type TemplateKind = "daily" | "weekly" | "monthly" | "yearly" | "folder";

export class TemplateService {
  constructor(
    private readonly vault: Vault,
    private readonly settings: CascadeSettings,
  ) {}

  async render(kind: TemplateKind, path: string, fallback: string, info: DateInfo, title: string): Promise<string> {
    const templatePath = this.templatePath(kind, path);
    if (!templatePath) return fallback;
    const file = this.vault.getAbstractFileByPath(templatePath);
    if (!(file instanceof TFile)) return fallback;
    const template = await this.vault.read(file);
    return applyTemplate(template, info, title);
  }

  private templatePath(kind: TemplateKind, path: string): string {
    if (kind === "folder") {
      return this.settings.folderTemplates.find((entry) => path.startsWith(entry.folder))?.template ?? "";
    }
    const configured = {
      daily: this.settings.dailyTemplate,
      weekly: this.settings.weeklyTemplate,
      monthly: this.settings.monthlyTemplate,
      yearly: this.settings.yearlyTemplate,
      folder: "",
    }[kind];
    if (!configured) return "";
    return this.settings.templatesFolder ? `${this.settings.templatesFolder}/${configured}` : configured;
  }
}

export function applyTemplate(template: string, info: DateInfo, title: string): string {
  return template
    .replaceAll("{{date}}", `${info.yyyy}-${info.mm}-${info.dd}`)
    .replaceAll("{{title}}", title)
    .replaceAll("{{year}}", info.yyyy)
    .replaceAll("{{month}}", info.mm)
    .replaceAll("{{day}}", info.dd);
}
