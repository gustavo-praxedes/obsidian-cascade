import type { CascadeSettings } from "../config/schema";

export interface DateInfo {
  date: Date;
  year: number;
  month: number;
  day: number;
  week: number;
  weekday: number;
  weekdayName: string;
  weekdayShort: string;
  monthName: string;
  monthTitle: string;
  monthShort: string;
  yyyy: string;
  mm: string;
  dd: string;
}

const WEEKDAYS_PT = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];
const SHORT_WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

export class PathService {
  constructor(private readonly settings: CascadeSettings) {}

  dateInfo(input = new Date()): DateInfo {
    const date = new Date(input.getFullYear(), input.getMonth(), input.getDate());
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = date.getDay();
    const monthName = MONTHS_PT[month - 1];
    const weekdayName = WEEKDAYS_PT[weekday];
    return {
      date,
      year,
      month,
      day,
      week: isoWeek(date),
      weekday,
      weekdayName,
      weekdayShort: SHORT_WEEKDAYS_PT[weekday],
      monthName,
      monthTitle: titleCasePt(monthName),
      monthShort: monthName.slice(0, 3),
      yyyy: String(year),
      mm: pad2(month),
      dd: pad2(day),
    };
  }

  operationalYear(date = new Date()): number {
    const info = this.dateInfo(date);
    return info.month < this.settings.operationalYearStartMonth ? info.year - 1 : info.year;
  }

  operationalMonths(year: number): number[] {
    const start = this.settings.operationalYearStartMonth;
    const startDate = new Date(year, start - 1, 1);
    return Array.from({ length: 12 }, (_, index) => new Date(startDate.getFullYear(), startDate.getMonth() + index, 1).getMonth() + 1);
  }

  yearFolder(date = new Date()): string {
    const info = this.dateInfo(date);
    return normalizeVaultPath(`${this.settings.agendaRoot}/${info.yyyy}`);
  }

  monthFolder(date = new Date()): string {
    const info = this.dateInfo(date);
    return normalizeVaultPath(`${this.yearFolder(date)}/${info.mm}`);
  }

  annualPath(date = new Date()): string {
    return normalizeVaultPath(`${this.yearFolder(date)}/${this.annualBase(date)}.md`);
  }

  monthlyPath(date = new Date()): string {
    return normalizeVaultPath(`${this.monthFolder(date)}/${this.monthlyBase(date)}.md`);
  }

  weeklyPath(date = new Date()): string {
    const info = this.dateInfo(date);
    return normalizeVaultPath(`${this.monthFolder(date)}/${renderFormat(this.settings.weeklyFormat, info)}.md`);
  }

  dailyPath(date = new Date()): string {
    return normalizeVaultPath(`${this.monthFolder(date)}/${this.dailyBase(date)}.md`);
  }

  annualBase(date = new Date()): string {
    const year = this.operationalYear(date);
    return `${year}00000000-${year}`;
  }

  monthlyBase(date = new Date()): string {
    return renderFormat(this.settings.monthlyFormat, this.dateInfo(date));
  }

  dailyBase(date = new Date()): string {
    return renderFormat(this.settings.dailyFormat, this.dateInfo(date));
  }

  renderAnnualLog(date = new Date()): string {
    const year = this.operationalYear(date);
    const created = isoMinute();
    const lines = [
      "---",
      `id: ${this.annualBase(date)}`,
      "tags: [agenda/anual]",
      `created: ${created}`,
      `updated: ${created}`,
      "---",
      `# ${year}`,
      "",
    ];
    for (let index = 0; index < 12; index += 1) {
      const monthDate = new Date(year, index, 1);
      const info = this.dateInfo(monthDate);
      const link = withoutExtension(this.monthlyPath(monthDate));
      lines.push(`## [[${link}|${info.monthName}]]`, "");
    }
    return lines.join("\n").trimEnd() + "\n";
  }

  renderMonthlyLog(date = new Date()): string {
    const info = this.dateInfo(date);
    const created = isoMinute();
    const daysInMonth = new Date(info.year, info.month, 0).getDate();
    const lines = [
      "---",
      `id: ${this.monthlyBase(date)}`,
      `log: "[[${withoutExtension(this.annualPath(date))}|${info.yyyy}]]"`,
      "tags: [agenda/mensal]",
      `created: ${created}`,
      `updated: ${created}`,
      "---",
      `# ${info.monthName}`,
      "",
    ];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const current = new Date(info.year, info.month - 1, day);
      const currentInfo = this.dateInfo(current);
      const link = withoutExtension(this.dailyPath(current));
      lines.push(`## [[${link}|${currentInfo.dd} - ${currentInfo.weekdayName}]]`, "");
    }
    return lines.join("\n").trimEnd() + "\n";
  }

  renderDailyLog(date = new Date()): string {
    const info = this.dateInfo(date);
    const created = isoMinute();
    return [
      "---",
      `id: ${this.dailyBase(date)}`,
      `log: "[[${withoutExtension(this.monthlyPath(date))}|${info.monthName}]]"`,
      "tags: [agenda/diario]",
      `created: ${created}`,
      `updated: ${created}`,
      "---",
      `# ${info.dd} - ${info.weekdayName}`,
      "",
    ].join("\n");
  }

  renderNoteTitle(title: string, date = new Date()): string {
    const info = this.dateInfo(date);
    return renderFormat(this.settings.noteFormat, info).replace("SLUG", titleSlug(title));
  }

  isAnnualBase(path: string): boolean {
    return /^\d{4}00000000-\d{4}\.md$/i.test(lastSegment(path));
  }

  isMonthlyBase(path: string): boolean {
    return /^\d{6}000000-[\p{L}0-9-]+(?:\.md)?$/iu.test(lastSegment(path).normalize("NFC"));
  }

  isDailyBase(path: string): boolean {
    return /^\d{8}0000-(DOMINGO|SEGUNDA-FEIRA|TER[CÇ]A-FEIRA|QUARTA-FEIRA|QUINTA-FEIRA|SEXTA-FEIRA|S[ÁA]BADO)(?:\.md)?$/iu.test(
      lastSegment(path).normalize("NFC"),
    );
  }

  dateFromDailyTitle(title: string): Date | null {
    const match = title.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!match) return null;
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  normalizeText(value: string): string {
    return normalizeText(value);
  }
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\u0300-\u036f]/g, "");
}

export function titleSlug(value: string): string {
  const normalized = value
    .normalize("NFC")
    .replace(/\.md$/i, "")
    .replace(/^\d{12}-/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLocaleUpperCase("pt-BR");
  return normalized || "NOTA";
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

export function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
}

export function withoutExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

export function isoMinute(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function renderFormat(format: string, info: DateInfo): string {
  return format
    .replaceAll("DDD", info.weekdayName)
    .replaceAll("MMM", info.monthName)
    .replaceAll("YYYY", info.yyyy)
    .replaceAll("MM", info.mm)
    .replaceAll("mm", info.mm)
    .replaceAll("DD", info.dd)
    .replaceAll("dd", info.dd)
    .replaceAll("WW", pad2(info.week));
}

function titleCasePt(value: string): string {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1).toLocaleLowerCase("pt-BR");
}

function isoWeek(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function lastSegment(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
