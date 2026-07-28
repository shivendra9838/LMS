const Redis = require('ioredis');

// Redis client setup. In production, this would be a real connection string.
// For testing locally without strict redis dependencies, we wrap it in try-catch or mock it if unavailable.
const redisClient = new Redis(process.env.REDIS_URI || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      console.warn('Redis connection failed, disabling cache...');
      return null;
    }
    return Math.min(times * 50, 2000);
  }
});

let isRedisReady = false;

redisClient.on('ready', () => {
  isRedisReady = true;
  console.log('Redis Cache is ready');
});

redisClient.on('error', (err) => {
  if (isRedisReady) {
    console.error('Redis error:', err);
  }
  isRedisReady = false;
});

const getCache = async (key) => {
  if (!isRedisReady) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis get error:', err);
    return null;
  }
};

const setCache = async (key, value, ttlSeconds = 300) => {
  if (!isRedisReady) return;
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('Redis set error:', err);
  }
};

const invalidateCache = async (pattern) => {
  if (!isRedisReady) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Redis invalidate error:', err);
  }
};

module.exports = {
  redisClient,
  getCache,
  setCache,
  invalidateCache
};
