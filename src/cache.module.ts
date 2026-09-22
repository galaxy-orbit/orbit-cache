import type { DynamicModule } from '@galaxy-stack/orbit-core';
import { CacheService, CACHE_SERVICE, CACHE_OPTIONS } from './cache.service';
import type { CacheStore } from './interfaces/cache-store.interface';
import { MemoryStore } from './stores/memory.store';

export interface CacheModuleOptions {
  store?: CacheStore;
  ttl?: number;
  max?: number;
  isGlobal?: boolean;
}

export interface CacheModuleAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<CacheModuleOptions> | CacheModuleOptions;
  inject?: any[];
  isGlobal?: boolean;
}

export class CacheModule {
  static register(options: CacheModuleOptions = {}): DynamicModule {
    const store = options.store || new MemoryStore({ 
      max: options.max, 
      ttl: options.ttl 
    });

    return {
      module: CacheModule,
      global: options.isGlobal ?? false,
      providers: [
        {
          provide: CACHE_OPTIONS,
          useValue: options,
        },
        {
          provide: CACHE_SERVICE,
          useValue: new CacheService({ store, ttl: options.ttl, max: options.max }),
        },
        {
          provide: CacheService,
          useExisting: CACHE_SERVICE,
        },
      ],
      exports: [CACHE_SERVICE, CacheService],
    };
  }

  static registerAsync(options: CacheModuleAsyncOptions): DynamicModule {
    return {
      module: CacheModule,
      global: options.isGlobal ?? false,
      imports: options.imports || [],
      providers: [
        {
          provide: CACHE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: CACHE_SERVICE,
          useFactory: (opts: CacheModuleOptions) => {
            const store = opts.store || new MemoryStore({ 
              max: opts.max, 
              ttl: opts.ttl 
            });
            return new CacheService({ store, ttl: opts.ttl, max: opts.max });
          },
          inject: [CACHE_OPTIONS],
        },
        {
          provide: CacheService,
          useExisting: CACHE_SERVICE,
        },
      ],
      exports: [CACHE_SERVICE, CacheService],
    };
  }
}
