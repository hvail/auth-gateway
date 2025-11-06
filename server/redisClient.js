// redisClient.js
const { createClient } = require('redis');

class RedisClient {
    constructor(options = null) {
        var _options = options || {
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            database: parseInt(process.env.REDIS_DATABASE) || 0
        };
        if (process.env.REDIS_PASSWORD) {
            _options.username = process.env.REDIS_USERNAME;
            _options.password = process.env.REDIS_PASSWORD;
        }
        console.log('Redis options:', _options);
        this.client = createClient(options = _options);

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
                await this.client.setEx(key, expireSeconds.EX, value);
            } else {
                await this.client.set(key, value);
            }
        } catch (err) {
            console.error('Redis SET error:', expireSeconds, err);
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