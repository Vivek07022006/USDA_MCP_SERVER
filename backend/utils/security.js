// ─── Prompt Injection Detection ───────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions?/i,
  /disregard\s+your\s+(system|previous)/i,
  /you\s+are\s+now\s+(a|an)\s+(?!agricultural|farming|crop)/i,
  /act\s+as\s+(if\s+you\s+are|a|an)\s+(?!farmer|agricultural)/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /system\s+prompt/i,
  /reveal\s+(your|the)\s+(api|secret|key|prompt)/i,
  /print\s+(your|the)\s+(api|secret|key|system)/i,
  /bypass\s+(restriction|filter|system|limit)/i,
  /new\s+instructions?:/i,
  /override\s+(your\s+)?(instruction|rule|policy)/i,
];

const AGRICULTURE_KEYWORDS = [
  'crop', 'corn', 'wheat', 'soybean', 'soy', 'rice', 'cotton', 'sorghum',
  'barley', 'oat', 'cattle', 'beef', 'steer', 'heifer', 'feeder', 'hog',
  'pork', 'swine', 'lamb', 'sheep', 'poultry', 'chicken', 'turkey',
  'milk', 'dairy', 'egg', 'price', 'market', 'usda', 'ams', 'nass',
  'ers', 'wasde', 'farm', 'farmer', 'agriculture', 'agricultural', 'field',
  'harvest', 'plant', 'grow', 'yield', 'acre', 'bushel', 'cwt', 'lb',
  'weather', 'rain', 'soil', 'fertilizer', 'irrigation', 'drought',
  'transport', 'shipping', 'profit', 'sell', 'market', 'forecast',
  'outlook', 'supply', 'demand', 'export', 'import', 'commodity',
  'strawberr', 'watermelon', 'canola', 'sunflower', 'alfalfa',
  'feed', 'livestock', 'stockyard', 'auction', 'elevator', 'grain',
  'okc', 'oklahoma', 'chicago', 'kansas', 'iowa', 'texas', 'iowa',
  'indiana', 'ohio', 'nebraska', 'minnesota', 'california', 'georgia',
  'weighted', 'average', 'head', 'sold', 'report', 'data', 'show',
  'what', 'where', 'when', 'how', 'tell', 'find', 'get', 'give',
  'ton', 'metric', 'per', 'cwt', 'bushel', 'production', 'planted',
  'season', 'spring', 'summer', 'fall', 'winter', 'planting',
  'moisture', 'recommendation', 'best', 'optimal', 'suitable',
];

function detectPromptInjection(input) {
  if (!input || typeof input !== 'string') return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

function isAgricultureQuery(input) {
  if (!input || typeof input !== 'string') return false;
  const lower = input.toLowerCase();
  // Allow short greetings / general questions
  if (lower.length < 10) return true;
  return AGRICULTURE_KEYWORDS.some((kw) => lower.includes(kw));
}

function sanitizeInput(obj) {
  if (typeof obj === 'string') {
    return obj
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .substring(0, 2000); // Max 2000 chars
  }
  if (Array.isArray(obj)) return obj.map(sanitizeInput);
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return obj;
}

function validateLocation(location) {
  if (!location || typeof location !== 'string') return false;
  if (location.length < 2 || location.length > 100) return false;
  return /^[a-zA-Z0-9\s,.\-']+$/.test(location);
}

function validateCropName(crop) {
  if (!crop || typeof crop !== 'string') return false;
  return /^[a-zA-Z\s]+$/.test(crop) && crop.length <= 50;
}

module.exports = {
  detectPromptInjection,
  isAgricultureQuery,
  sanitizeInput,
  validateLocation,
  validateCropName,
};
