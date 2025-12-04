import { createClient, RedisClientType } from 'redis';

export interface EmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    historyId: string;
    internalDate: string;
    subject: string;
    from: string;
    to: string;
    date: Date;
    labels: string[];
    isUnread: boolean;
}

class CacheService {
    private client: RedisClientType;
    private isConnected = false;

    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
        });

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            this.isConnected = true;
            console.log('Connected to Redis');
        });

        this.client.on('end', () => {
            this.isConnected = false;
            console.log('Disconnected from Redis');
        });
    }

    private async connect() {
        if (!this.isConnected) {
            await this.client.connect();
        }
    }

    async disconnect() {
        if (this.isConnected) {
            await this.client.disconnect();
        }
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            await this.connect();
            const data = await this.client.get(key);
            return data ? (JSON.parse(data) as T) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(key: string, data: unknown, ttlSeconds = 3600): Promise<void> {
        try {
            await this.connect();
            await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.connect();
            await this.client.del(key);
        } catch (error) {
            console.error('Cache delete error:', error);
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            await this.connect();
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Cache exists error:', error);
            return false;
        }
    }

    // Email-specific cache methods
    async cacheEmails(userId: string, emails: EmailMessage[], ttl = 1800): Promise<void> {
        const key = `emails:${userId}`;
        await this.set(key, emails, ttl);
    }

    async getCachedEmails(userId: string): Promise<EmailMessage[] | null> {
        const key = `emails:${userId}`;
        return this.get<EmailMessage[]>(key);
    }

    async cacheEmailStats(
        userId: string,
        stats: Record<string, unknown>,
        ttl = 3600,
    ): Promise<void> {
        const key = `stats:${userId}`;
        await this.set(key, stats, ttl);
    }

    async getCachedEmailStats(userId: string): Promise<Record<string, unknown> | null> {
        const key = `stats:${userId}`;
        return this.get<Record<string, unknown>>(key);
    }

    async cacheUnsubscribeInfo(
        userId: string,
        info: Record<string, unknown>[],
        ttl = 7200,
    ): Promise<void> {
        const key = `unsubscribe:${userId}`;
        await this.set(key, info, ttl);
    }

    async getCachedUnsubscribeInfo(
        userId: string,
    ): Promise<Record<string, unknown>[] | null> {
        const key = `unsubscribe:${userId}`;
        return this.get<Record<string, unknown>[]>(key);
    }

    async invalidateUserCache(userId: string): Promise<void> {
        const keys = [`emails:${userId}`, `stats:${userId}`, `unsubscribe:${userId}`];
        await Promise.all(keys.map((key) => this.del(key)));
    }

    async mget<T>(keys: string[]): Promise<(T | null)[]> {
        try {
            await this.connect();
            const results = await this.client.mGet(keys);
            return results.map((result) => (result ? (JSON.parse(result) as T) : null));
        } catch (error) {
            console.error('Cache mget error:', error);
            return keys.map(() => null);
        }
    }

    async mset(keyValuePairs: Record<string, unknown>, ttl = 3600): Promise<void> {
        try {
            await this.connect();
            const pipeline = this.client.multi();
            Object.entries(keyValuePairs).forEach(([key, value]) => {
                pipeline.setEx(key, ttl, JSON.stringify(value));
            });
            await pipeline.exec();
        } catch (error) {
            console.error('Cache mset error:', error);
        }
    }

    async getInfo(): Promise<{ memory: string; connected: boolean } | null> {
        try {
            await this.connect();
            const info = await this.client.info('memory');
            return {
                memory: info,
                connected: this.isConnected,
            };
        } catch (error) {
            console.error('Cache info error:', error);
            return null;
        }
    }

    async flushAll(): Promise<void> {
        try {
            await this.connect();
            await this.client.flushAll();
        } catch (error) {
            console.error('Cache flush error:', error);
        }
    }
}

// Singleton
let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
    if (!cacheService) {
        cacheService = new CacheService();
    }
    return cacheService;
}

export { CacheService };
