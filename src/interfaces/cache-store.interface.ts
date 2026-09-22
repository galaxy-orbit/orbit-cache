export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  reset(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  has(key: string): Promise<boolean>;
  mget<T>(...keys: string[]): Promise<(T | undefined)[]>;
  mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<void>;
  mdel(...keys: string[]): Promise<void>;
}

export interface CacheStoreFactory {
  create(options?: any): CacheStore;
}
