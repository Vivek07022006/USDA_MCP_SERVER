const axios = require('axios');
const { makeCacheKey, getCache, setCache } = require('../utils/cache');
const { validateLocation, validateCropName } = require('../utils/security');
const logger = require('../utils/logger');

const NASS_BASE = 'https://quickstats.nass.usda.gov/api/api_GET/';

const NASS_COMMODITY_MAP = {
  corn: 'CORN', maize: 'CORN',
  wheat: 'WHEAT', 'hard red winter wheat': 'WHEAT, WINTER',
  soybeans: 'SOYBEANS', soybean: 'SOYBEANS', soy: 'SOYBEANS',
  rice: 'RICE', cotton: 'UPLAND COTTON', sorghum: 'SORGHUM',
  milo: 'SORGHUM', barley: 'BARLEY', oats: 'OATS', canola: 'CANOLA',
  cattle: 'CATTLE', hogs: 'HOGS', lambs: 'SHEEP & LAMBS',
  milk: 'MILK', eggs: 'EGGS',
};

/**
 * MCP Tool: get_crop_prices
 * Fetches from USDA NASS QuickStats API.
 */
async function getCropPrices({ location, commodity, year = new Date().getFullYear() }) {
  if (!validateLocation(location)) return { error: true, message: 'Invalid location.', retryable: false };
  const crop = commodity;
  if (!validateCropName(crop)) return { error: true, message: 'Invalid commodity name.', retryable: false };

  const cacheKey = makeCacheKey('getCropPrices', { location, crop, year });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  const nassKey = process.env.USDA_NASS_API_KEY;
  if (!nassKey) return { error: true, message: 'USDA_NASS_API_KEY not configured.', retryable: false };

  const commodityDesc = NASS_COMMODITY_MAP[crop.toLowerCase()] || crop.toUpperCase();
  const stateName = location.toUpperCase().replace(/\s+/g, ' ');

  try {
    for (const tryYear of [year, year - 1]) {
      const response = await axios.get(NASS_BASE, {
        params: {
          key: nassKey,
          commodity_desc: commodityDesc,
          statisticcat_desc: 'PRICE RECEIVED',
          freq_desc: 'ANNUAL',
          reference_period_desc: 'MARKETING YEAR',
          year: tryYear,
          agg_level_desc: 'STATE',
          state_name: stateName,
          format: 'JSON',
        },
        timeout: 10000,
      });

      const records = response.data?.data;
      if (records && records.length > 0) {
        const latest = records[records.length - 1];
        const priceVal = latest.Value?.replace(',', '');
        if (priceVal && priceVal !== '(D)' && priceVal !== '(Z)' && !isNaN(parseFloat(priceVal))) {
          const result = {
            crop: crop.toLowerCase(), location, price: parseFloat(priceVal),
            unit: latest.unit_desc || 'BU', year: parseInt(latest.year),
            source: 'USDA NASS QuickStats', sourceUrl: 'https://quickstats.nass.usda.gov',
          };
          setCache(cacheKey, result, 300);
          return result;
        }
      }
    }

    // National fallback
    const natResp = await axios.get(NASS_BASE, {
      params: {
        key: nassKey, commodity_desc: commodityDesc,
        statisticcat_desc: 'PRICE RECEIVED', freq_desc: 'ANNUAL',
        reference_period_desc: 'MARKETING YEAR', year: year - 1,
        agg_level_desc: 'NATIONAL', format: 'JSON',
      },
      timeout: 10000,
    });

    const natRecords = natResp.data?.data;
    if (natRecords && natRecords.length > 0) {
      const latest = natRecords[natRecords.length - 1];
      const priceVal = latest.Value?.replace(',', '');
      if (priceVal && !isNaN(parseFloat(priceVal))) {
        const result = {
          crop: crop.toLowerCase(), location: 'National Average',
          price: parseFloat(priceVal), unit: latest.unit_desc || 'BU',
          year: parseInt(latest.year), source: 'USDA NASS QuickStats (National)',
          sourceUrl: 'https://quickstats.nass.usda.gov',
          note: `State-level data for ${location} not available; showing national average.`,
        };
        setCache(cacheKey, result, 300);
        return result;
      }
    }

    return { error: true, message: `No price data found for ${crop} in ${location} from USDA NASS.`, retryable: true };
  } catch (err) {
    logger.error(`NASS API error: ${err.message}`);
    return { error: true, message: `USDA NASS API unavailable: ${err.message}`, retryable: true };
  }
}

/**
 * MCP Tool: get_price_history
 */
async function getPriceHistory({ commodity, years = 5 }) {
  const crop = commodity;
  if (!validateCropName(crop)) return { error: true, message: 'Invalid commodity name.', retryable: false };

  const cacheKey = makeCacheKey('getPriceHistory', { crop, years });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  const nassKey = process.env.USDA_NASS_API_KEY;
  if (!nassKey) return { error: true, message: 'USDA_NASS_API_KEY not configured.', retryable: false };

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - years;
  const commodityDesc = NASS_COMMODITY_MAP[crop.toLowerCase()] || crop.toUpperCase();

  try {
    const response = await axios.get(NASS_BASE, {
      params: {
        key: nassKey, commodity_desc: commodityDesc,
        statisticcat_desc: 'PRICE RECEIVED', freq_desc: 'ANNUAL',
        reference_period_desc: 'MARKETING YEAR', agg_level_desc: 'NATIONAL',
        year__GE: startYear, year__LE: currentYear, format: 'JSON',
      },
      timeout: 12000,
    });

    const records = response.data?.data;
    if (!records || records.length === 0) {
      return { error: true, message: `No historical price data found for ${crop}.`, retryable: true };
    }

    const yearMap = {};
    for (const rec of records) {
      const yr = parseInt(rec.year);
      const val = parseFloat(rec.Value?.replace(',', '') || '');
      if (!isNaN(val) && val > 0 && rec.Value !== '(D)') {
        if (!yearMap[yr]) yearMap[yr] = [];
        yearMap[yr].push(val);
      }
    }

    const history = Object.entries(yearMap)
      .map(([year, prices]) => ({
        year: parseInt(year),
        price: parseFloat((prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(2)),
      }))
      .sort((a, b) => a.year - b.year);

    if (history.length === 0) return { error: true, message: `Price history data not parseable.`, retryable: true };

    const avgPrice = (history.reduce((s, h) => s + h.price, 0) / history.length).toFixed(2);
    const priceGrowthPct = history.length >= 2
      ? (((history[history.length - 1].price - history[0].price) / history[0].price) * 100).toFixed(1)
      : '0.0';

    const result = {
      crop: crop.toLowerCase(), history, averagePrice: parseFloat(avgPrice),
      priceGrowth: `${priceGrowthPct}%`, source: 'USDA NASS QuickStats',
      sourceUrl: 'https://quickstats.nass.usda.gov',
      yearsRange: `${history[0]?.year}–${history[history.length - 1]?.year}`,
    };
    setCache(cacheKey, result, 3600);
    return result;
  } catch (err) {
    logger.error(`NASS price history error: ${err.message}`);
    return { error: true, message: `USDA NASS API error: ${err.message}`, retryable: true };
  }
}

/**
 * MCP Tool: get_crop_production
 */
async function getCropProduction({ location, commodity, year = new Date().getFullYear() }) {
  const crop = commodity;
  if (!validateLocation(location)) return { error: true, message: 'Invalid location.', retryable: false };
  if (!validateCropName(crop)) return { error: true, message: 'Invalid commodity name.', retryable: false };

  const cacheKey = makeCacheKey('getCropProduction', { location, crop, year });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  const nassKey = process.env.USDA_NASS_API_KEY;
  if (!nassKey) return { error: true, message: 'USDA_NASS_API_KEY not configured.', retryable: false };

  const commodityDesc = NASS_COMMODITY_MAP[crop.toLowerCase()] || crop.toUpperCase();
  const stateName = location.toUpperCase();

  try {
    const baseParams = { key: nassKey, commodity_desc: commodityDesc, year, agg_level_desc: 'STATE', state_name: stateName, format: 'JSON' };
    const [acreageResp, yieldResp, productionResp] = await Promise.allSettled([
      axios.get(NASS_BASE, { params: { ...baseParams, statisticcat_desc: 'AREA PLANTED' }, timeout: 10000 }),
      axios.get(NASS_BASE, { params: { ...baseParams, statisticcat_desc: 'YIELD' }, timeout: 10000 }),
      axios.get(NASS_BASE, { params: { ...baseParams, statisticcat_desc: 'PRODUCTION' }, timeout: 10000 }),
    ]);

    const acreage = acreageResp.status === 'fulfilled' ? acreageResp.value.data?.data?.[0]?.Value?.replace(/,/g, '') : null;
    const yieldPerAcre = yieldResp.status === 'fulfilled' ? yieldResp.value.data?.data?.[0]?.Value?.replace(/,/g, '') : null;
    const totalProd = productionResp.status === 'fulfilled' ? productionResp.value.data?.data?.[0]?.Value?.replace(/,/g, '') : null;

    if (!acreage && !yieldPerAcre && !totalProd) {
      return { error: true, message: `No production data found for ${crop} in ${location} from USDA NASS for ${year}.`, retryable: true };
    }

    const result = {
      crop: crop.toLowerCase(), location, year,
      acresPlanted: acreage ? parseInt(acreage) : null,
      yieldPerAcre: yieldPerAcre ? parseFloat(yieldPerAcre) : null,
      totalProduction: totalProd ? parseInt(totalProd) : null,
      unit: yieldResp.status === 'fulfilled' ? yieldResp.value.data?.data?.[0]?.unit_desc : 'BU/ACRE',
      source: 'USDA NASS QuickStats', sourceUrl: 'https://quickstats.nass.usda.gov',
    };
    setCache(cacheKey, result, 3600);
    return result;
  } catch (err) {
    logger.error(`NASS production error: ${err.message}`);
    return { error: true, message: `USDA NASS production API error: ${err.message}`, retryable: true };
  }
}

module.exports = { getCropPrices, getPriceHistory, getCropProduction };
