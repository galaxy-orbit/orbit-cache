import { describe, test, expect } from 'bun:test';
import { CacheService } from './cache.service';
import { MemoryStore } from './stores/memory.store';

describe('MemoryStore', () => {
  test('set/get round-trip', async () => {
    const store = new MemoryStore();
    await store.set('k', { data: 1 });
    expect(await store.get<{ data: number }>('k')).toEqual({ data: 1 });
  });

  test('has, del, reset', async () => {
    const store = new MemoryStore();
    await store.set('a', 1);
    await store.set('b', 2);
    expect(await store.has('a')).toBe(true);
    await store.del('a');
    expect(await store.get('a')).toBeUndefined();
    await store.reset();
    expect(await store.get('b')).toBeUndefined();
  });

  test('ttl expiry invalidates entries', async () => {
    const store = new MemoryStore();
    await store.set('temp', 'value', 1);
    expect(await store.get<string>('temp')).toBe('value');
    await Bun.sleep(1100);
    expect(await store.get('temp')).toBeUndefined();
    expect(await store.has('temp')).toBe(false);
  });

  test('keys(pattern) supports wildcard matching', async () => {
    const store = new MemoryStore();
    await store.set('user:1', 'a');
    await store.set('user:2', 'b');
    await store.set('post:1', 'c');
    const keys = await store.keys('user:*');
    expect(keys.sort()).toEqual(['user:1', 'user:2']);
  });

  test('mget/mset/mdel batch operations', async () => {
    const store = new MemoryStore();
    await store.mset([
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
 { key: 'c', value: 3 },
    ]);
    expect(await store.mget('a', 'b', 'missing')).toEqual([1, 2, undefined]);
    await store.mdel('a', 'b');
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get<number>('c')).toBe(3);
  });

  test('evicts oldest entry when max size exceeded', async () => {
    const store = new MemoryStore({ max: 2 });
    await store.set('first', 1);
    await store.set('second', 2);
    await store.set('third', 3);
    expect(await store.get('first')).toBeUndefined();
    expect(await store.get<number>('second')).toBe(2);
    expect(await store.get<number>('third')).toBe(3);
  });

  test('updating an existing key does not evict', async () => {
    const store = new MemoryStore({ max: 2 });
    await store.set('a', 1);
    await store.set('b', 2);
    await store.set('a', 11); // update, not insert
    await store.set('c', 3);
    expect(await store.get<number>('a')).toBe(11);
    expect(await store.get('b')).toBeUndefined();
  });
});

describe('CacheService', () => {
  test('delegates to underlying store', async () => {
    const service = new CacheService();
    await service.set('k', 'v');
    expect(await service.get<string>('k')).toBe('v');
    expect(await service.has('k')).toBe(true);
    await service.del('k');
    expect(await service.has('k')).toBe(false);
  });

  test('wrap caches function results', async () => {
    const service = new CacheService();
    let calls = 0;
    const fn = async () => { calls++; return { value: calls }; };

    const first = await service.wrap('expensive', fn);
    const second = await service.wrap('expensive', fn);

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(calls).toBe(1);
  });

  test('wrap re-executes after ttl expiry', async () => {
    const service = new CacheService();
    let calls = 0;
    const result = await service.wrap('k', async () => ++calls, 1);
    await Bun.sleep(1100);
    const again = await service.wrap('k', async () => ++calls, 1);
    expect(again).toBe(2);
  });

  test('custom default ttl on service', async () => {
    const service = new CacheService({ ttl: 1 });
    await service.set('k', 'v');
    expect(await service.get<string>('k')).toBe('v');
    await Bun.sleep(1100);
    expect(await service.get('k')).toBeUndefined();
  });
});
