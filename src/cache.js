export class ChecklistCache {
  constructor({ ttlMs = 600000, maxEntries = 100, now = Date.now } = {}) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0 || !Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("Invalid cache limits");
    }
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }
  prune() {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= this.now()) this.entries.delete(key);
    }
  }
  get(key) {
    this.prune();
    const entry = this.entries.get(key);
    return entry ? structuredClone(entry.items) : undefined;
  }
  set(key, items) {
    this.prune();
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value);
    this.entries.set(key, { items: structuredClone(items), expiresAt: this.now() + this.ttlMs });
  }
}
