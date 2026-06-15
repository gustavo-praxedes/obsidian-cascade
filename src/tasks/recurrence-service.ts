import { dueDate, firstDateInTask, scheduledDate, startDate } from "./task-parser";

const ENGLISH_DAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const ENGLISH_MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export class RecurrenceService {
  recurrenceRule(task: string): string {
    return String(task).match(/\bevery\b.+$/i)?.[0]?.trim() ?? "";
  }

  recurrenceBaseDate(task: string): Date | null {
    return dueDate(task) ?? scheduledDate(task) ?? startDate(task) ?? firstDateInTask(task);
  }

  dueDateInTask(task: string): Date | null {
    return dueDate(task);
  }

  scheduledDateInTask(task: string): Date | null {
    return scheduledDate(task);
  }

  startDateInTask(task: string): Date | null {
    return startDate(task);
  }

  firstDateInTask(task: string): Date | null {
    return firstDateInTask(task);
  }

  dayFromRule(rule: string): number | null {
    const lower = normalize(rule);
    for (const [name, index] of Object.entries(ENGLISH_DAYS)) {
      if (lower.includes(name)) return index;
    }
    return null;
  }

  monthFromRule(rule: string): number | null {
    const lower = normalize(rule);
    const found = ENGLISH_MONTHS.findIndex((month) => lower.includes(month));
    return found === -1 ? null : found;
  }

  ordinalFromRule(rule: string): number | null {
    const match = rule.match(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
    return match ? Number(match[1]) : null;
  }

  weekIndex(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    return Math.floor((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }

  appliesOnDate(task: string, candidate: Date): boolean {
    const rule = this.recurrenceRule(task).toLowerCase();
    if (!rule) return false;

    const base = this.recurrenceBaseDate(task);
    if (base && candidate < asDate(base)) return false;

    const targetDay = this.ordinalFromRule(rule) || (base ? base.getDate() : 1);
    const targetDow = this.dayFromRule(rule);

    if (rule.includes("every day")) return true;

    if (rule.includes("every weekday")) {
      return candidate.getDay() >= 1 && candidate.getDay() <= 5;
    }

    if (rule.includes("week")) {
      const intervalMatch = rule.match(/every\s+(\d+)\s+weeks?/);
      const interval = intervalMatch ? Number(intervalMatch[1]) : 1;
      const expectedDow = targetDow ?? (base ? base.getDay() : null);
      if (expectedDow == null || candidate.getDay() !== expectedDow) return false;
      if (!base) return true;
      const diffWeeks = this.weekIndex(candidate) - this.weekIndex(base);
      return diffWeeks >= 0 && diffWeeks % interval === 0;
    }

    if (rule.includes("month")) {
      if (candidate.getDate() !== targetDay) return false;
      const intervalMatch = rule.match(/every\s+(\d+)\s+months?/);
      const interval = intervalMatch ? Number(intervalMatch[1]) : 1;
      if (!base) return true;
      const diffMonths = (candidate.getFullYear() - base.getFullYear()) * 12 + candidate.getMonth() - base.getMonth();
      return diffMonths >= 0 && diffMonths % interval === 0;
    }

    if (rule.includes("year")) {
      const expectedMonth = this.monthFromRule(rule) ?? (base ? base.getMonth() : null);
      const expectedDay = targetDay || (base ? base.getDate() : 1);
      return candidate.getMonth() === expectedMonth && candidate.getDate() === expectedDay;
    }

    return false;
  }

  datesInMonthForTask(task: string, value: Date): Date[] {
    const daysInMonth = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
    const result: Date[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const candidate = new Date(value.getFullYear(), value.getMonth(), day);
      if (this.appliesOnDate(task, candidate)) result.push(candidate);
    }
    return result;
  }
}

function asDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
