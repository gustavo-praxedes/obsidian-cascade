import { TFile, WorkspaceLeaf, type App } from "obsidian";
import { FileService } from "../vault/file-service";
import { RepairService } from "../vault/repair-service";
import { PathService } from "./path-service";
import { TemplateService } from "./template-service";

export class NoteService {
  constructor(
    private readonly app: App,
    private readonly paths: PathService,
    private readonly files: FileService,
    private readonly repair: RepairService,
    private readonly templates: TemplateService,
  ) {}

  async createAnnual(date = new Date()): Promise<TFile> {
    const path = this.paths.annualPath(date);
    const title = this.paths.annualBase(date);
    const fallback = this.renderAnnual(date);
    const content = await this.templates.render("yearly", path, fallback, this.paths.dateInfo(date), title);
    const file = await this.files.ensureFile(path, content);
    await this.repairIfNeeded(path, "yearly", date);
    return file;
  }

  async createMonthly(date = new Date()): Promise<TFile> {
    await this.createAnnual(date);
    const path = this.paths.monthlyPath(date);
    const title = this.paths.monthlyBase(date);
    const fallback = this.renderMonthly(date);
    const content = await this.templates.render("monthly", path, fallback, this.paths.dateInfo(date), title);
    const file = await this.files.ensureFile(path, content);
    await this.repairIfNeeded(path, "monthly", date);
    return file;
  }

  async createWeekly(date = new Date()): Promise<TFile> {
    await this.createMonthly(date);
    const path = this.paths.weeklyPath(date);
    const title = this.paths.weeklyBase(date);
    const fallback = this.renderWeekly(date);
    const content = await this.templates.render("weekly", path, fallback, this.paths.dateInfo(date), title);
    const file = await this.files.ensureFile(path, content);
    await this.repairIfNeeded(path, "weekly", date);
    return file;
  }

  async createDaily(date = new Date()): Promise<TFile> {
    if (this.paths.weeklyEnabled()) await this.createWeekly(date);
    else await this.createMonthly(date);
    const path = this.paths.dailyPath(date);
    const title = this.paths.dailyBase(date);
    const fallback = this.renderDaily(date);
    const content = await this.templates.render("daily", path, fallback, this.paths.dateInfo(date), title);
    const file = await this.files.ensureFile(path, content);
    await this.repairIfNeeded(path, "daily", date);
    return file;
  }

  async openToday(): Promise<TFile> {
    const file = await this.createDaily(new Date());
    await this.openFile(file);
    return file;
  }

  async openDate(date: Date): Promise<TFile> {
    const file = await this.createDaily(date);
    await this.openFile(file);
    return file;
  }

  private async openFile(file: TFile): Promise<void> {
    const leaf: WorkspaceLeaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }

  private async repairIfNeeded(path: string, kind: "yearly" | "monthly" | "weekly" | "daily", date: Date): Promise<void> {
    const content = await this.files.read(path);
    const repaired =
      kind === "yearly"
        ? this.repair.repairAnnualLog(content, date)
        : kind === "monthly"
          ? this.repair.repairMonthlyLog(content, date)
          : kind === "weekly"
            ? this.repair.repairWeeklyLog(content, date)
            : this.repair.repairDailyLog(content, date);
    if (repaired !== content) await this.files.write(path, repaired);
  }

  private renderAnnual(date: Date): string {
    return this.paths.renderAnnualLog(date);
  }

  private renderMonthly(date: Date): string {
    return this.paths.renderMonthlyLog(date);
  }

  private renderWeekly(date: Date): string {
    return this.paths.renderWeeklyLog(date);
  }

  private renderDaily(date: Date): string {
    return this.paths.renderDailyLog(date);
  }
}
