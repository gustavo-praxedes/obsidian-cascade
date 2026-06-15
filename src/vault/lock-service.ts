export class LockService {
  private locked = false;

  async runExclusive<T>(operation: () => Promise<T>, timeoutMs = 30000): Promise<T> {
    const start = Date.now();
    while (this.locked) {
      if (Date.now() - start > timeoutMs) {
        throw new Error("Cascade operation timed out waiting for lock.");
      }
      await sleep(50);
    }
    this.locked = true;
    try {
      return await operation();
    } finally {
      this.locked = false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
