import { describe, expect, it } from "vitest";
import { RecurrenceService } from "../../src/tasks/recurrence-service";

describe("RecurrenceService", () => {
  const service = new RecurrenceService();

  it("matches daily and weekday rules", () => {
    expect(service.appliesOnDate("- [ ] Task 🔁 every day", new Date(2026, 5, 15))).toBe(true);
    expect(service.appliesOnDate("- [ ] Task 🔁 every weekday", new Date(2026, 5, 14))).toBe(false);
  });

  it("matches weekly rules with day names", () => {
    expect(service.appliesOnDate("- [ ] Task 🛫 2026-06-01 🔁 every week on Monday", new Date(2026, 5, 15))).toBe(true);
    expect(service.appliesOnDate("- [ ] Task 🛫 2026-06-01 🔁 every week on Tuesday", new Date(2026, 5, 16))).toBe(true);
  });

  it("matches monthly rules from base date", () => {
    expect(service.appliesOnDate("- [ ] Task 🛫 2026-06-15 🔁 every month", new Date(2026, 6, 15))).toBe(true);
    expect(service.appliesOnDate("- [ ] Task 🛫 2026-06-15 🔁 every month", new Date(2026, 6, 14))).toBe(false);
  });
});
