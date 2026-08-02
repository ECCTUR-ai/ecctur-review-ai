export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  get<T>(key: string, maxAgeMs: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > maxAgeMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  getRaw<T>(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? (entry.data as T) : null;
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const cacheService = new CacheService();
