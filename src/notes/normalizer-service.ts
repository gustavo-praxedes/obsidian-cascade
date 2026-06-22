import { TFile, normalizePath, type Vault } from "obsidian";
import type { CascadeSettings } from "../config/schema";
import { titleSlug } from "./path-service";

const RENAMES = new Set<string>();

export class NormalizerService {
  constructor(
    private readonly vault: Vault,
    private readonly settings: CascadeSettings,
  ) {}

  async normalizeFile(file: TFile): Promise<void> {
    if (!this.settings.normalizerEnabled || RENAMES.has(file.path) || !this.inScope(file.path)) return;
    const folder = file.parent?.path ?? "";
    const extension = file.extension ? `.${file.extension}` : "";
    const timestamp = this.settings.addTimestamp ? timestampFromName(file.basename) : "";
    
    let slug = file.basename.replace(/^\d{12}-?/, "");
    if (this.settings.normalizerCase !== "none" || !this.settings.normalizerAccents) {
      // Basic slugification if we are modifying case or accents
      slug = slug.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
    }
    if (!this.settings.normalizerAccents) {
      slug = slug.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    }
    if (this.settings.normalizerCase === "uppercase") slug = slug.toUpperCase();
    else if (this.settings.normalizerCase === "lowercase") slug = slug.toLowerCase();

    const basename = `${timestamp}${timestamp && slug ? "-" : ""}${slug}`;
    const target = normalizePath(`${folder}/${basename}${extension}`);
    if (target === file.path) return;
    const unique = await this.uniquePath(target);
    RENAMES.add(file.path);
    try {
      await this.vault.rename(file, unique);
    } finally {
      RENAMES.delete(file.path);
    }
  }

  async normalizeAll(): Promise<void> {
    if (this.settings.normalizeDelaySeconds > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, this.settings.normalizeDelaySeconds * 1000));
    }
    for (const file of this.vault.getMarkdownFiles()) {
      await this.normalizeFile(file);
    }
  }

  private inScope(path: string): boolean {
    const ignored = this.settings.normalizerIgnored.some((prefix) => path.startsWith(prefix));
    if (ignored) return false;
    return this.settings.normalizerScopes.length === 0 || this.settings.normalizerScopes.some((prefix) => path.startsWith(prefix));
  }

  private async uniquePath(path: string): Promise<string> {
    if (!this.vault.getAbstractFileByPath(path)) return path;
    const dot = path.lastIndexOf(".");
    const base = dot === -1 ? path : path.slice(0, dot);
    const ext = dot === -1 ? "" : path.slice(dot);
    let index = 1;
    while (this.vault.getAbstractFileByPath(`${base}-${String(index).padStart(2, "0")}${ext}`)) index += 1;
    return `${base}-${String(index).padStart(2, "0")}${ext}`;
  }
}

function timestampFromName(name: string): string {
  const existing = name.match(/^(\d{12})/)?.[1];
  if (existing) return existing;
  const now = new Date();
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
