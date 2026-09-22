import type { CacheStore } from '../interfaces/cache-store.interface';

export interface RedisStoreOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  ttl?: number;
  keyPrefix?: string;
  url?: string;
}

export class RedisStore implements CacheStore {
  private client: any = null;
  private readonly options: RedisStoreOptions;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;

  constructor(options: RedisStoreOptions = {}) {
    this.options = options;
    this.keyPrefix = options.keyPrefix || '';
    this.defaultTtl = options.ttl || 0;
  }

  async connect(): Promise<void> {
    const url = this.options.url || 
      `redis://${this.options.host || 'localhost'}:${this.options.port || 6379}`;

    const socket = await Bun.connect({
      hostname: this.options.host || 'localhost',
      port: this.options.port || 6379,
      socket: {
        data: (socket, data) => {
          this.handleResponse(data);
        },
        error: (socket, error) => {
          console.error('Redis error:', error);
        },
        close: () => {
          this.client = null;
        },
      },
    });

    this.client = socket;

    if (this.options.password) {
      await this.sendCommand('AUTH', this.options.password);
    }

    if (this.options.db) {
      await this.sendCommand('SELECT', String(this.options.db));
    }
  }

  private pendingResponses: Array<{ resolve: Function; reject: Function }> = [];

  private handleResponse(data: Buffer): void {
    const response = data.toString();
    const pending = this.pendingResponses.shift();
    
    if (pending) {
      if (response.startsWith('-')) {
        pending.reject(new Error(response.slice(1).trim()));
      } else if (response.startsWith('+')) {
        pending.resolve(response.slice(1).trim());
      } else if (response.startsWith(':')) {
        pending.resolve(parseInt(response.slice(1), 10));
      } else if (response.startsWith('$')) {
        const lines = response.split('\r\n');
        const length = parseInt(lines[0].slice(1), 10);
        if (length === -1) {
          pending.resolve(null);
        } else {
          pending.resolve(lines[1]);
        }
      } else if (response.startsWith('*')) {
        pending.resolve(this.parseArray(response));
      } else {
        pending.resolve(response);
      }
    }
  }

  private parseArray(response: string): string[] {
    const lines = response.split('\r\n');
    const count = parseInt(lines[0].slice(1), 10);
    const results: string[] = [];
    
    let i = 1;
    for (let n = 0; n < count; n++) {
      if (lines[i].startsWith('$')) {
        const length = parseInt(lines[i].slice(1), 10);
        i++;
        if (length === -1) {
          results.push(undefined as any);
        } else {
          results.push(lines[i]);
          i++;
        }
      }
    }
    
    return results;
  }

  private async sendCommand(...args: string[]): Promise<any> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }

    return new Promise((resolve, reject) => {
      this.pendingResponses.push({ resolve, reject });
      
      const command = `*${args.length}\r\n${args.map(arg => 
        `$${Buffer.byteLength(arg)}\r\n${arg}`
      ).join('\r\n')}\r\n`;
      
      this.client.write(command);
    });
  }

  private prefixKey(key: string): string {
    return this.keyPrefix + key;
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.sendCommand('GET', this.prefixKey(key));
      if (result === null) return undefined;
      return JSON.parse(result) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    const serialized = JSON.stringify(value);
    const effectiveTtl = ttl ?? this.defaultTtl;

    if (effectiveTtl > 0) {
      await this.sendCommand('SETEX', prefixedKey, String(effectiveTtl), serialized);
    } else {
      await this.sendCommand('SET', prefixedKey, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.sendCommand('DEL', this.prefixKey(key));
  }

  async reset(): Promise<void> {
    if (this.keyPrefix) {
      const keys = await this.keys('*');
      if (keys.length > 0) {
        await this.sendCommand('DEL', ...keys.map(k => this.prefixKey(k)));
      }
    } else {
      await this.sendCommand('FLUSHDB');
    }
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    const result = await this.sendCommand('KEYS', this.prefixKey(pattern));
    return (result || []).map((key: string) => 
      key.slice(this.keyPrefix.length)
    );
  }

  async has(key: string): Promise<boolean> {
    const result = await this.sendCommand('EXISTS', this.prefixKey(key));
    return result === 1;
  }

  async mget<T>(...keys: string[]): Promise<(T | undefined)[]> {
    if (keys.length === 0) return [];
    
    const result = await this.sendCommand('MGET', ...keys.map(k => this.prefixKey(k)));
    return (result || []).map((value: string | null) => {
      if (value === null) return undefined;
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    });
  }

  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const { key, value, ttl } of keyValuePairs) {
      await this.set(key, value, ttl);
    }
  }

  async mdel(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.sendCommand('DEL', ...keys.map(k => this.prefixKey(k)));
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
}
