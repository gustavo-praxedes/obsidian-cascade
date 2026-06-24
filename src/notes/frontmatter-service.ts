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
        const now = formatFrontmatterDate(new Date(), this.settings.frontmatterDateFormat);
        frontmatter[this.settings.frontmatterCreatedKey] ??= now;
        frontmatter[this.settings.frontmatterUpdatedKey] = now;
      });
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
  }

  async initializeAll(): Promise<number> {
    const files = this.app.vault.getMarkdownFiles();
    let count = 0;
    for (const file of files) {
      const before = await this.readFrontmatter(file);
      await this.initialize(file);
      const after = await this.readFrontmatter(file);
      if (!before || !after || before.created !== after.created || before.updated !== after.updated) {
        count++;
      }
    }
    return count;
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      window.clearTimeout(timer);
    }
    this.timers.clear();
  }

  private async touch(file: TFile): Promise<void> {
    if (!this.app.vault.getAbstractFileByPath(file.path)) return;
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter[this.settings.frontmatterCreatedKey] ??= formatFrontmatterDate(new Date(file.stat.ctime), this.settings.frontmatterDateFormat);
        frontmatter[this.settings.frontmatterUpdatedKey] = formatFrontmatterDate(new Date(), this.settings.frontmatterDateFormat);
      });
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
  }

  private async readFrontmatter(file: TFile): Promise<Record<string, string> | null> {
    try {
      const result: Record<string, string> = {};
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        for (const [k, v] of Object.entries(fm)) {
          result[k] = String(v ?? "");
        }
      });
      return result;
    } catch {
      return null;
    }
  }

  private ignored(path: string): boolean {
    return this.settings.ignoredPaths.some((prefix) => {
      const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
      return path.startsWith(normalized) || path === prefix;
    });
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && /ENOENT|no such file/i.test(error.message);
}

export function formatFrontmatterDate(date: Date, format: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(offset) / 60));
  const om = pad(Math.abs(offset) % 60);
  const isoTz = offset === 0 ? "Z" : `${sign}${oh}:${om}`;

  const result = format
    .replace(/XXX/g, `\x00${isoTz}\x00`)
    .replace(/xx/g, `\x00${sign}${oh}${om}\x00`)
    .replace(/YYYY|yyyy/g, yyyy)
    .replace(/MM/g, MM)
    .replace(/DD|dd/g, DD)
    .replace(/HH|hh/g, HH)
    .replace(/mm/g, mm)
    .replace(/ss/g, ss)
    .replace(/\x00([+-]\d{2}:\d{2})\x00/g, "$1")
    .replace(/\x00Z\x00/g, "Z")
    .replace(/\x00([+-]\d{4})\x00/g, "$1");

  return result.replace(/''/g, "\x01").replace(/'([^']*)'/g, "$1").replace(/\x01/g, "'");
}
