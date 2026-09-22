import 'reflect-metadata';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';
export const CACHE_MANAGER_METADATA = 'cache:manager';

export interface CacheKeyOptions {
  key?: string | ((...args: any[]) => string);
  ttl?: number;
}

export function CacheKey(key: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(CACHE_KEY_METADATA, key, target, propertyKey);
    return descriptor;
  };
}

export function CacheTTL(ttl: number): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(CACHE_TTL_METADATA, ttl, target, propertyKey);
    return descriptor;
  };
}

export function UseCache(options?: CacheKeyOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    if (options?.key) {
      Reflect.defineMetadata(CACHE_KEY_METADATA, options.key, target, propertyKey);
    }
    if (options?.ttl) {
      Reflect.defineMetadata(CACHE_TTL_METADATA, options.ttl, target, propertyKey);
    }
    return descriptor;
  };
}

export function CacheEvict(key: string | string[]): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const keys = Array.isArray(key) ? key : [key];
    Reflect.defineMetadata('cache:evict', keys, target, propertyKey);
    return descriptor;
  };
}

export function CachePut(key: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata('cache:put', key, target, propertyKey);
    return descriptor;
  };
}
