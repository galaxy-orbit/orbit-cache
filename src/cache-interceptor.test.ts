import { describe, test, expect } from 'bun:test';
import 'reflect-metadata';
import { MemoryStore } from './stores/memory.store';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheKey, CacheTTL, CacheEvict, CachePut } from './decorators/cache.decorators';

function makeService() {
  return new CacheService({ store: new MemoryStore() });
}

// The interceptor reads metadata from target.prototype + handler.name —
// so the controller class must stay stable across calls (the real wiring).
function makeContext(cls: any, handlerName: string, args: any[] = []) {
  return {
    getClass: () => cls,
    getHandler: () => cls.prototype[handlerName],
    getArgs: () => args,
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
  } as any;
}

describe('CacheInterceptor', () => {
  test('handlers without cache metadata pass straight through', async () => {
    class Plain { async list() { return 'fresh'; } }
    const interceptor = new CacheInterceptor(makeService());

    let calls = 0;
    const result = await interceptor.intercept(makeContext(Plain, 'list'), {
      handle: async () => { calls++; return 'fresh'; },
    });
    expect(result).toBe('fresh');
    expect(calls).toBe(1);
  });

  test('CacheKey caches the handler result across calls', async () => {
    class Users {
      @CacheKey('users:all')
      async getUsers() { return ['a', 'b']; }
    }

    const interceptor = new CacheInterceptor(makeService());
    let calls = 0;
    const next = { handle: async () => { calls++; return ['a', 'b']; } };

    const first = await interceptor.intercept(makeContext(Users, 'getUsers'), next);
    const second = await interceptor.intercept(makeContext(Users, 'getUsers'), next);

    expect(first).toEqual(['a', 'b']);
    expect(second).toEqual(['a', 'b']);
    expect(calls).toBe(1); // second call served from cache
  });

  test('static CacheKey hashes arguments — different args miss the cache', async () => {
    class Users {
      @CacheKey('user:byId')
      async getUser() { return null; }
    }

    const interceptor = new CacheInterceptor(makeService());
    let calls = 0;
    const next = { handle: async (id: number) => { calls++; return { id }; } };

    await interceptor.intercept(makeContext(Users, 'getUser', [1]), next as any);
    await interceptor.intercept(makeContext(Users, 'getUser', [1]), next as any);
    expect(calls).toBe(1);

    await interceptor.intercept(makeContext(Users, 'getUser', [2]), next as any);
    expect(calls).toBe(2);
  });

  test('CacheKey as function takes args directly', async () => {
    class Find {
      @CacheKey(((id: number) => `custom:${id}`) as any)
      async find(id: number) { return id * 2; }
    }

    const interceptor = new CacheInterceptor(makeService());
    let calls = 0;
    // CallHandler closes over the args — the interceptor invokes handle() bare
    const next = (id: number) => ({
      handle: async () => { calls++; return id * 2; },
    });

    await interceptor.intercept(makeContext(Find, 'find', [3]), next(3) as any);
    const cached = (await interceptor.intercept(makeContext(Find, 'find', [3]), next(3) as any)) as number;
    expect(calls).toBe(1);
    expect(cached).toBe(6);
  });

  test('CacheTTL overrides the default ttl', async () => {
    class Short {
      @CacheKey('short:ttl')
      @CacheTTL(0.05)
      async short() { return 'v'; }
    }

    const interceptor = new CacheInterceptor(makeService());
    let calls = 0;
    const next = { handle: async () => { calls++; return 'v'; } };

    await interceptor.intercept(makeContext(Short, 'short'), next as any);
    await Bun.sleep(80);
    await interceptor.intercept(makeContext(Short, 'short'), next as any);
    expect(calls).toBe(2); // expired (0.05s ttl -> expiry in ms past)
  });

  test('CacheEvict deletes keys then calls the handler', async () => {
    const service = makeService();
    await service.set('users:list', ['old']);

    class Users {
      @CacheEvict('users:list')
      async updateUser() { return 'updated'; }
    }

    const interceptor = new CacheInterceptor(service);
    let calls = 0;
    const next = { handle: async () => { calls++; return 'updated'; } };

    const result = await interceptor.intercept(makeContext(Users, 'updateUser'), next as any);
    expect(result).toBe('updated');
    expect(await service.get('users:list')).toBeUndefined();
    expect(calls).toBe(1);
  });

  test('CacheEvict supports function keys receiving args', async () => {
    const service = makeService();
    await service.set('user:7', { id: 7 });

    class Users {
      @CacheEvict(((id: number) => `user:${id}`) as any)
      async deleteUser(id: number) { return 'deleted'; }
    }

    const interceptor = new CacheInterceptor(service);
    await interceptor.intercept(makeContext(Users, 'deleteUser', [7]), {
      handle: async () => 'deleted',
    } as any);

    expect(await service.get('user:7')).toBeUndefined();
  });

  test('CachePut stores the result and returns it without pre-reading', async () => {
    const service = makeService();

    class Users {
      @CachePut('latest:user')
      async upsert() { return { updated: true }; }
    }

    const interceptor = new CacheInterceptor(service);
    let calls = 0;
    const next = { handle: async () => { calls++; return { updated: true }; } };

    const result: any = await interceptor.intercept(makeContext(Users, 'upsert'), next as any);
    expect(result).toEqual({ updated: true });
    expect(calls).toBe(1);
    expect((await service.get('latest:user')) as any).toEqual({ updated: true });
  });
});
