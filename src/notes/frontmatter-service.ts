import { TFile, type App } from "obsidian";
import type { CascadeSettings } from "../config/schema";

export class FrontmatterService {
  private timers = new Map<string, number>();

  constructor(
    private readonly app: App,
    private readonly settings: CascadeSettings,
  ) {}

  schedule(file: TFile): void {
    if (!this.settings.frontmatterEnabled || this.ignored(file.path)) return;
    window.clearTimeout(this.timers.get(file.path));
    const timer = window.setTimeout(() => {
      void this.touch(file);
      this.timers.delete(file.path);
    }, 2000);
    this.timers.set(file.path, timer);
  }

  async initialize(file: TFile): Promise<void> {
    if (!this.settings.frontmatterEnabled || this.ignored(file.path)) return;
    if (!this.app.vault.getAbstractFileByPath(file.path)) return;
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        const now = formatFrontmatterDate(new Date());
        frontmatter[this.settings.frontmatterCreatedKey] ??= now;
        frontmatter[this.settings.frontmatterUpdatedKey] = now;
      });
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
  }

  private async touch(file: TFile): Promise<void> {
    if (!this.app.vault.getAbstractFileByPath(file.path)) return;
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter[this.settings.frontmatterCreatedKey] ??= formatFrontmatterDate(new Date(file.stat.ctime));
        frontmatter[this.settings.frontmatterUpdatedKey] = formatFrontmatterDate(new Date());
      });
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
  }

  private ignored(path: string): boolean {
    return this.settings.frontmatterIgnoredPaths.some((prefix) => path.startsWith(prefix));
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && /ENOENT|no such file/i.test(error.message);
}

function formatFrontmatterDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
