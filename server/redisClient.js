// redisClient.js
const { createClient } = require('redis');

class RedisClient {
    constructor(options = {}) {
        this.client = createClient({
            url: options.url || process.env.REDIS_URL || 'redis://localhost:6379',
            ...(process.env.REDIS_PASSWORD && {
                password: process.env.REDIS_PASSWORD
            }),
            ...(process.env.REDIS_USERNAME && {
                username: process.env.REDIS_USERNAME
            }),
            database: typeof options.database === 'number' ?
                options.database :
                (options.db || parseInt(process.env.REDIS_DATABASE) || 0),
        });

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.connect();
    }

    async connect() {
        if (!this.client.isOpen) {
            await this.client.connect();
            console.log('Connected to Redis');
        }
    }

    async get(key) {
        try {
            return await this.client.get(key);
        } catch (err) {
            console.error('Redis GET error:', err);
            throw err;
        }
    }

    async set(key, value, expireSeconds = null) {
        try {
            if (expireSeconds) {
                await this.client.setEx(key, expireSeconds, value);
            } else {
                await this.client.set(key, value);
            }
        } catch (err) {
            console.error('Redis SET error:', err);
            throw err;
        }
    }

    async del(key) {
        try {
            return await this.client.del(key);
        } catch (err) {
            console.error('Redis DEL error:', err);
            throw err;
        }
    }

    async exists(key) {
        try {
            return await this.client.exists(key);
        } catch (err) {
            console.error('Redis EXISTS error:', err);
            throw err;
        }
    }

    // 可继续扩展其他方法：hset, hget, lpush, publish 等

    async quit() {
        if (this.client.isOpen) {
            await this.client.quit();
        }
    }
}

module.exports = RedisClient;