import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let redisEnabled = true;

export function getRedis(): RedisClientType | null {
    if (!redisEnabled) return null;

    if (!client) {
        client = createClient({
            url: process.env.REDIS_URL,
            socket: {
                connectTimeout: 2000, // Fail fast
            },
        });

        client.on('error', (err) => {
            console.error('Redis Client Error:', err);

            // Disable redis after first failure to stop infinite loop
            redisEnabled = false;
        });

        client
            .connect()
            .then(() => console.log('Redis connected'))
            .catch((err) => {
                console.error('Redis initial connect failed:', err);
                redisEnabled = false;
            });
    }

    return client;
}

export function getCacheService() {
    const redis = getRedis();

    return {
        async get<T>(key: string): Promise<T | null> {
            if (!redis || !redisEnabled) return null;

            try {
                const data = await redis.get(key);
                return data ? JSON.parse(data) : null;
            } catch (err) {
                console.error('Redis GET error:', err);
                redisEnabled = false;
                return null;
            }
        },

        async set(
            key: string,
            data: unknown,
            ttlSeconds = 3600,
        ): Promise<void> {
            if (!redis || !redisEnabled) return;

            try {
                await redis.setEx(key, ttlSeconds, JSON.stringify(data));
            } catch (err) {
                console.error('Redis SET error:', err);
                redisEnabled = false;
            }
        },
    };
}
