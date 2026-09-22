import type { CacheStore } from '../interfaces/cache-store.interface';

interface CacheEntry<T> {
  value: T;
  expiry: number | null;
}

export interface MemoryStoreOptions {
  max?: number;
  ttl?: number;
}

export class MemoryStore implements CacheStore {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  constructor(options: MemoryStoreOptions = {}) {
    this.maxSize = options.max || Infinity;
    this.defaultTtl = options.ttl || 0;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    if (entry.expiry !== null && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // LRU: updating an existing key refreshes its recency instead of evicting
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const effectiveTtl = ttl ?? this.defaultTtl;
    const expiry = effectiveTtl > 0 ? Date.now() + effectiveTtl * 1000 : null;

    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async reset(): Promise<void> {
    this.cache.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    
    if (!pattern) {
      return allKeys;
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  async mget<T>(...keys: string[]): Promise<(T | undefined)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const { key, value, ttl } of keyValuePairs) {
      await this.set(key, value, ttl);
    }
  }

  async mdel(...keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.del(key);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry !== null && now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}
