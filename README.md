# @galaxy-stack/orbit-cache

[![npm version](https://img.shields.io/npm/v/@galaxy-stack/orbit-cache.svg)](https://www.npmjs.com/package/@galaxy-stack/orbit-cache)
[![docs](https://img.shields.io/badge/docs-galaxy--orbit--framework.vercel.app-blue)](https://galaxy-orbit-framework.vercel.app)

Part of the [Orbit framework](https://github.com/galaxy-orbit/packages) — a NestJS-style backend framework for [Bun](https://bun.sh).

## Installation

```bash
bun add @galaxy-stack/orbit-cache
```

# @galaxy-stack/orbit-cache

## Mô tả
Module caching cho Orbit với hỗ trợ Memory store và Redis store.

## Tính năng chính

### 1. Cache Stores
- **MemoryStore**: In-memory cache (mặc định)
- **RedisStore**: Redis-based cache

### 2. Cache Decorators
```typescript
import { Cacheable, CacheEvict, CachePut } from '@galaxy-stack/orbit-cache';

class UserService {
  @Cacheable({ key: 'user:{id}', ttl: 3600 })
  async getUser(id: number) {
    return await this.db.findUser(id);
  }

  @CacheEvict({ key: 'user:{id}' })
  async updateUser(id: number, data: any) {
    return await this.db.updateUser(id, data);
  }

  @CachePut({ key: 'user:{id}', ttl: 3600 })
  async refreshUser(id: number) {
    return await this.db.findUser(id);
  }
}
```

## Cấu hình Module

### Memory Store
```typescript
import { CacheModule } from '@galaxy-stack/orbit-cache';

@Module({
  imports: [
    CacheModule.forRoot({
      store: 'memory',
      ttl: 300,  // 5 phút
      max: 100,  // Tối đa 100 items
    }),
  ],
})
class AppModule {}
```

### Redis Store
```typescript
CacheModule.forRoot({
  store: 'redis',
  url: 'redis://localhost:6379',
  ttl: 3600,
  keyPrefix: 'myapp:',
})
```

### Async Configuration
```typescript
CacheModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    store: config.get('CACHE_STORE'),
    url: config.get('REDIS_URL'),
  }),
})
```

## Cache Service

```typescript
import { CacheService } from '@galaxy-stack/orbit-cache';

class MyService {
  constructor(private cache: CacheService) {}

  async getData() {
    // Get from cache
    const cached = await this.cache.get('my-key');
    if (cached) return cached;

    // Set to cache
    const data = await fetchData();
    await this.cache.set('my-key', data, 3600);
    return data;
  }

  async clearCache() {
    await this.cache.del('my-key');
    // hoặc
    await this.cache.reset();  // Clear all
  }
}
```

## Cache Methods

```typescript
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  reset(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}
```

## TTL (Time To Live)
- Tính bằng giây
- `0` = không expire
- Mặc định: 300 (5 phút)
