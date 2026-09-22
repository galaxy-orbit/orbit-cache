import type { CacheStore } from './interfaces/cache-store.interface';
import { MemoryStore, type MemoryStoreOptions } from './stores/memory.store';

export interface CacheServiceOptions {
  store?: CacheStore;
  ttl?: number;
  max?: number;
}

export class CacheService {
  private readonly store: CacheStore;
  private readonly defaultTtl: number;

  constructor(options: CacheServiceOptions = {}) {
    this.store = options.store || new MemoryStore({ 
      max: options.max, 
      ttl: options.ttl 
    });
    this.defaultTtl = options.ttl || 0;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.store.set(key, value, ttl ?? this.defaultTtl);
  }

  async del(key: string): Promise<void> {
    return this.store.del(key);
  }

  async reset(): Promise<void> {
    return this.store.reset();
  }

  async keys(pattern?: string): Promise<string[]> {
    return this.store.keys(pattern);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async mget<T>(...keys: string[]): Promise<(T | undefined)[]> {
    return this.store.mget<T>(...keys);
  }

  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    return this.store.mset(keyValuePairs);
  }

  async mdel(...keys: string[]): Promise<void> {
    return this.store.mdel(...keys);
  }

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  getStore(): CacheStore {
    return this.store;
  }
}

export const CACHE_SERVICE = Symbol('CACHE_SERVICE');
export const CACHE_OPTIONS = Symbol('CACHE_OPTIONS');
