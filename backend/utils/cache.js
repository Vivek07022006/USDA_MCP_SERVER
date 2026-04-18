// ─── In-Memory LRU Cache ──────────────────────────────────────────────────────
const MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE) || 500;
const cacheStore = new Map();
const cacheExpiry = new Map();

function makeCacheKey(toolName, params) {
  return `${toolName}:${JSON.stringify(params)}`;
}

function getCache(key) {
  if (!cacheStore.has(key)) return { hit: false };
  const expiry = cacheExpiry.get(key);
  if (expiry && Date.now() > expiry) {
    cacheStore.delete(key);
    cacheExpiry.delete(key);
    return { hit: false };
  }
  return { hit: true, data: cacheStore.get(key) };
}

function setCache(key, value, ttlSeconds = 300) {
  // LRU eviction
  if (cacheStore.size >= MAX_SIZE) {
    const firstKey = cacheStore.keys().next().value;
    cacheStore.delete(firstKey);
    cacheExpiry.delete(firstKey);
  }
  cacheStore.set(key, value);
  cacheExpiry.set(key, Date.now() + ttlSeconds * 1000);
}

function clearCache() {
  cacheStore.clear();
  cacheExpiry.clear();
}

function getCacheStats() {
  return {
    size: cacheStore.size,
    maxSize: MAX_SIZE,
    keys: Array.from(cacheStore.keys()).slice(0, 20),
  };
}

module.exports = { makeCacheKey, getCache, setCache, clearCache, getCacheStats };
