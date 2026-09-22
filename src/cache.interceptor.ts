import 'reflect-metadata';
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA } from './decorators/cache.decorators';
import { CacheService } from './cache.service';

export const CACHE_EVICT_METADATA = 'cache:evict';
export const CACHE_PUT_METADATA = 'cache:put';

export interface ExecutionContext {
  getClass(): any;
  getHandler(): Function;
  getArgs(): any[];
  switchToHttp(): { getRequest(): any; getResponse(): any };
}

export interface CallHandler {
  handle(): Promise<any>;
}

export class CacheInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly defaultTtl: number = 0
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<any> {
    const handler = context.getHandler();
    const target = context.getClass();

    const evictKeys: string[] = Reflect.getMetadata(CACHE_EVICT_METADATA, target.prototype, handler.name);
    const putKey: string = Reflect.getMetadata(CACHE_PUT_METADATA, target.prototype, handler.name);

    if (evictKeys && evictKeys.length > 0) {
      for (const key of evictKeys) {
        const resolvedKey = typeof key === 'function' 
          ? (key as Function)(...context.getArgs()) 
          : key;
        await this.cacheService.del(resolvedKey);
      }
      return next.handle();
    }

    if (putKey) {
      const result = await next.handle();
      const resolvedKey = typeof putKey === 'function' 
        ? (putKey as Function)(...context.getArgs()) 
        : putKey;
      const ttl = Reflect.getMetadata(CACHE_TTL_METADATA, target.prototype, handler.name) 
        ?? this.defaultTtl;
      await this.cacheService.set(resolvedKey, result, ttl);
      return result;
    }

    const cacheKey = Reflect.getMetadata(CACHE_KEY_METADATA, target.prototype, handler.name);
    
    if (!cacheKey) {
      return next.handle();
    }

    const ttl = Reflect.getMetadata(CACHE_TTL_METADATA, target.prototype, handler.name) 
      ?? this.defaultTtl;

    const key = typeof cacheKey === 'function' 
      ? cacheKey(...context.getArgs())
      : this.buildKey(cacheKey, context);

    const cached = await this.cacheService.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = await next.handle();
    await this.cacheService.set(key, result, ttl);
    return result;
  }

  private buildKey(baseKey: string, context: ExecutionContext): string {
    const args = context.getArgs();
    if (args.length === 0) {
      return baseKey;
    }

    const argsHash = JSON.stringify(args);
    return `${baseKey}:${this.hashString(argsHash)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
