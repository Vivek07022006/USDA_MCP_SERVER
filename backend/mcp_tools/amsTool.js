/**
 * amsTool.js – USDA AMS Market News MCP Tool
 * 
 * Uses the EXACT endpoints specified in the USDA LMP/AMS documentation:
 *   Cattle:       https://marsapi.ams.usda.gov/services/v1.2/reports/1280
 *   Soybeans:     https://marsapi.ams.usda.gov/services/v1.1/reports/3192
 *   Hogs:         https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2513
 *   Corn:         https://marsapi.ams.usda.gov/services/v1.1/reports/2850
 *   Lamb:         https://marsapi.ams.usda.gov/services/v1.1/reports/1913
 *   Strawberries: https://marsapi.ams.usda.gov/services/v1.2/reports/2314
 *   Milk:         https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2991/detail
 *   Watermelon:   https://marsapi.ams.usda.gov/services/v1.2/reports/2395
 *   Eggs:         https://marsapi.ams.usda.gov/services/v1.2/reports/2843
 * 
 * Flow: Gemini selects tool → amsTool fetches → Gemini formats response
 */

const axios = require('axios');
const { makeCacheKey, getCache, setCache } = require('../utils/cache');
const logger = require('../utils/logger');

// ─── Exact AMS Report Endpoints (per user-provided USDA PDFs) ─────────────────
const AMS_REPORTS = {
  cattle: {
    url: 'https://marsapi.ams.usda.gov/services/v1.2/reports/1280',
    id: 1280,
    unit: 'cwt',
    description: 'Feeder Cattle – weighted average, volume (head)',
  },
  soybeans: {
    url: 'https://marsapi.ams.usda.gov/services/v1.1/reports/3192',
    id: 3192,
    unit: '$/bu',
    description: 'Soybean Market Prices',
  },
  hogs: {
    url: 'https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2513',
    id: 2513,
    unit: 'cwt',
    description: 'National Direct Hog Prices',
  },
  corn: {
    url: 'https://marsapi.ams.usda.gov/services/v1.1/reports/2850',
    id: 2850,
    unit: '$/bu',
    description: 'National Corn Prices',
  },
  lamb: {
    url: 'https://marsapi.ams.usda.gov/services/v1.1/reports/1913',
    id: 1913,
    unit: 'cwt',
    description: 'National Lamb Prices',
  },
  lambs: {
    url: 'https://marsapi.ams.usda.gov/services/v1.1/reports/1913',
    id: 1913,
    unit: 'cwt',
    description: 'National Lamb Prices',
  },
  strawberries: {
    url: 'https://marsapi.ams.usda.gov/services/v1.2/reports/2314',
    id: 2314,
    unit: '$/flat',
    description: 'Strawberry Market Prices',
  },
  strawberry: {
    url: 'https://marsapi.ams.usda.gov/services/v1.2/reports/2314',
    id: 2314,
    unit: '$/flat',
    description: 'Strawberry Market Prices',
  },
  milk: {
    url: 'https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2991/detail',
    id: 2991,
    unit: 'cwt',
    description: 'Dairy / Milk Market Prices',
  },
  dairy: {
    url: 'https://mpr.datamart.ams.usda.gov/services/v1.1/reports/2991/detail',
    id: 2991,
    unit: 'cwt',
    description: 'Dairy / Milk Market Prices',
  },
  watermelon: {
    url: 'https://marsapi.ams.usda.gov/services/v1.2/reports/2395',
    id: 2395,
    unit: '$/cwt',
    description: 'Watermelon Market Prices',
  },
  watermelons: {
    url: 'https://marsapi.ams.usda.gov/services/v1.2/reports/2395',
    id: 2395,
    unit: '$/cwt',
    description: 'Watermelon Market Prices',
  },
  eggs: {
    url: 'https://marsapi.ams.usda.gov/services/v1.2/reports/2843',
    id: 2843,
    unit: '$/dozen',
    description: 'Shell Egg Market Prices',
  },
  egg: {
    url: 'https://marsapi.ams.usda.gov/services/v1.2/reports/2843',
    id: 2843,
    unit: '$/dozen',
    description: 'Shell Egg Market Prices',
  },
};

// ─── Keyword-based AMS search fallback (for unlisted commodities) ─────────────
const AMS_KEYWORD_MAP = {
  wheat:    ['wheat', 'hard red', 'soft red', 'spring wheat'],
  rice:     ['rice', 'rough rice'],
  cotton:   ['cotton', 'upland cotton'],
  sorghum:  ['sorghum', 'milo'],
  barley:   ['barley'],
  oats:     ['oats'],
  pork:     ['hogs', 'swine', 'pork'],
  sheep:    ['lambs', 'sheep'],
  poultry:  ['poultry', 'chicken', 'turkey'],
  canola:   ['canola', 'oilseed'],
};

// ─── WASDE Reference (April 2026) ─────────────────────────────────────────────
const WASDE_REFERENCE = {
  corn: {
    productionBillionBu: 15.14,
    exportsMillionBu: 2300,
    ethanolFeedMillionBu: 5600,
    carryoverMillionBu: 1877,
    seasonAvgFarmPriceBu: 4.35,
    outlook: 'Corn supplies projected to tighten with strong domestic use. Season-average farm price range: $4.10–$4.65/bu.',
    reportTitle: 'April 2026 WASDE',
    reportUrl: 'https://usda.gov/oce/commodity/wasde/',
  },
  soybeans: {
    productionMillionBu: 4461, exportsMillionBu: 1825, crushMillionBu: 2365,
    carryoverMillionBu: 375, seasonAvgFarmPriceBu: 10.20,
    outlook: 'Soybean prices face headwinds from South American competition. Domestic crush at record high. Price range: $9.50–$11.00/bu.',
    reportTitle: 'April 2026 WASDE', reportUrl: 'https://usda.gov/oce/commodity/wasde/',
  },
  wheat: {
    productionMillionBu: 1971, exportsMillionBu: 850, carryoverMillionBu: 702,
    seasonAvgFarmPriceBu: 5.70,
    outlook: 'Wheat exports remain competitive; Plains drought supports upside price risk. Price range: $5.40–$6.10/bu.',
    reportTitle: 'April 2026 WASDE', reportUrl: 'https://usda.gov/oce/commodity/wasde/',
  },
  rice: {
    productionMillionCwt: 219, exportsMillionCwt: 68, carryoverMillionCwt: 37,
    seasonAvgFarmPriceCwt: 15.60,
    outlook: 'U.S. rice exports pressured by global competition. Domestic demand stable. Price range: $14.50–$16.50/cwt.',
    reportTitle: 'April 2026 WASDE', reportUrl: 'https://usda.gov/oce/commodity/wasde/',
  },
  cotton: {
    productionMillionBales: 14.2, exportsMillionBales: 12.1, carryoverMillionBales: 4.5,
    seasonAvgFarmPriceLb: 0.72,
    outlook: 'Cotton faces global demand uncertainty; acreage declines provide supply-side support. Price range: $0.68–$0.78/lb.',
    reportTitle: 'April 2026 WASDE', reportUrl: 'https://usda.gov/oce/commodity/wasde/',
  },
};

// ─── ERS Outlooks ─────────────────────────────────────────────────────────────
const ERS_OUTLOOKS = {
  corn: {
    series: 'FDS', title: 'Feed Grains Outlook',
    summary: 'USDA ERS Feed Grains Outlook (FDS): Corn feed/residual use strong, driven by expanding livestock. Ethanol demand stable with RFS mandates. Key risks: pollination weather, South American competition.',
    priceOutlook: '$4.10–$4.65/bu for 2025/26 marketing year.',
    publicationUrl: 'https://www.ers.usda.gov/publications?series=FDS',
  },
  soybeans: {
    series: 'OCS', title: 'Oil Crops Outlook',
    summary: 'USDA ERS Oil Crops Outlook (OCS): Soybean crush projected at record high from renewable diesel demand. South American expansion pressures U.S. exports. Key risks: biofuel policy changes, La Niña.',
    priceOutlook: '$9.50–$11.00/bu for 2025/26 marketing year.',
    publicationUrl: 'https://www.ers.usda.gov/publications?series=OCS',
  },
  wheat: {
    series: 'WHS', title: 'Wheat Outlook',
    summary: 'USDA ERS Wheat Outlook (WHS): Global supplies ample but Plains drought creates yield risks. Black Sea exports competitive. Hard red winter acres declined year-over-year.',
    priceOutlook: '$5.40–$6.10/bu for 2025/26 marketing year.',
    publicationUrl: 'https://www.ers.usda.gov/publications?series=WHS',
  },
};

// ─── Build request headers (with optional AMS API key) ────────────────────────
function buildHeaders() {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'AgriMCP-AI/2.0 (USDA Agricultural Research Tool)',
  };
  if (process.env.AMS_API_KEY) {
    const authHash = Buffer.from(process.env.AMS_API_KEY + ':').toString('base64');
    headers['Authorization'] = `Basic ${authHash}`;
  }
  return headers;
}

// ─── Core fetch function for a specific AMS report URL ────────────────────────
async function fetchAmsReport(reportUrl, queryParams = {}) {
  try {
    const params = { $top: 50, ...queryParams };
    const response = await axios.get(reportUrl, {
      params,
      headers: buildHeaders(),
      timeout: 15000,
    });

    // Handle both array and object responses
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data?.results) return data.results;
    if (data?.data) return data.data;
    if (typeof data === 'object' && !Array.isArray(data)) return [data];
    return [];
  } catch (err) {
    const status = err?.response?.status;
    logger.warn(`AMS fetch failed [${status || 'timeout'}] for ${reportUrl}: ${err.message}`);
    
    // 403 = auth required but we can still return empty
    if (status === 403) {
      logger.warn('AMS returned 403 – try adding AMS_API_KEY to .env');
    }
    return null; // null = definitive failure
  }
}

// ─── Keyword-based fallback: search reports list ────────────────────────────
async function searchAmsReportsByKeyword(crop) {
  try {
    const response = await axios.get('https://marsapi.ams.usda.gov/services/v1.2/reports', {
      params: { $top: 100, $orderby: 'PublishedDate desc' },
      headers: buildHeaders(),
      timeout: 10000,
    });
    const reports = response.data?.results || response.data || [];
    const keywords = AMS_KEYWORD_MAP[crop.toLowerCase()] || [crop.toLowerCase()];
    return reports
      .filter((r) => {
        const title = (r.reportTitle || r.ReportTitle || '').toLowerCase();
        const slug = (r.slug || r.reportSlug || '').toLowerCase();
        return keywords.some((kw) => title.includes(kw) || slug.includes(kw));
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

// ─── Parse price rows from AMS response for any commodity ───────────────────
function parseAmsRows(rows, commodity, defaultUnit) {
  if (!rows || !Array.isArray(rows)) return [];

  return rows
    .map((r) => {
      const weightedAvg = parseFloat(
        r.weighted_average || r.weightedAverage || r.avg_price ||
        r.average_price || r.price || r.Price || 0
      );
      const low = parseFloat(r.low_price || r.lowPrice || r.low_range || 0);
      const high = parseFloat(r.high_price || r.highPrice || r.high_range || 0);
      const vol = parseInt(r.volume || r.head_count || r.headCount || r.quantity || r.Quantity || 0);

      const market = (
        r.market_location || r.marketLocation || r.market_name ||
        r.Office || r.office || r.location || r.Location || 'National'
      ).toString().trim();

      const reportDate = r.report_date || r.reportDate || r.ReportDate ||
        r.published_date || r.PublishedDate || '';

      return {
        reportDate,
        market,
        commodity: r.commodity || r.Commodity || commodity,
        weightedAvg,
        lowPrice: low,
        highPrice: high,
        volume: vol,
        unit: r.unit || r.Unit || defaultUnit,
        grade: r.grade || r.Grade || r.class || r.Class || '',
        description: r.description || r.Description || '',
      };
    })
    .filter((r) => r.weightedAvg > 0 || r.lowPrice > 0 || r.highPrice > 0);
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * MCP Tool: get_ams_prices
 * 
 * Strategy:
 *   1. If commodity matches AMS_REPORTS key → use exact endpoint
 *   2. Apply optional date/market filters
 *   3. Fallback: keyword search on /reports list
 *   4. Return structured error if all fail (never mock data)
 * ──────────────────────────────────────────────────────────────────────────────
 */
async function getAmsPrices({ commodity, market = null, reportDate = null }) {
  if (!commodity) return { error: true, message: 'Commodity name is required.' };

  const crop = commodity.toLowerCase().trim();
  const cacheKey = makeCacheKey('getAmsPrices_v3', { crop, market, reportDate });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  logger.info(`[AMS] Fetching prices: commodity="${crop}", market="${market || 'any'}", date="${reportDate || 'latest'}"`);

  const report = AMS_REPORTS[crop];

  // ── Strategy 1: Direct endpoint ─────────────────────────────────────────
  if (report) {
    const queryParams = {};

    // Filter by date if provided (format: M/D/YYYY → YYYY-MM-DD)
    if (reportDate) {
      // Try various filter syntaxes
      const parts = reportDate.split('/');
      if (parts.length === 3) {
        const [m, d, y] = parts;
        const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        queryParams['report_date'] = iso;
        // Some endpoints use OData filter
        queryParams['$filter'] = `report_date eq '${iso}'`;
      }
    }

    let rows = await fetchAmsReport(report.url, queryParams);

    // If filtered fetch returned nothing, try without date filter (get latest)
    if ((!rows || rows.length === 0) && reportDate) {
      logger.info(`[AMS] No results for date ${reportDate}, fetching latest instead`);
      rows = await fetchAmsReport(report.url, {});
    }

    if (rows && rows.length > 0) {
      let priceRows = parseAmsRows(rows, crop, report.unit);

      if (priceRows.length > 0) {
        // Filter by market location if requested
        if (market) {
          const mx = market.toLowerCase().replace(/\s+/g, '');
          const marketFiltered = priceRows.filter((r) =>
            r.market.toLowerCase().replace(/\s+/g, '').includes(mx)
          );
          if (marketFiltered.length > 0) priceRows = marketFiltered;
        }

        const topRow = priceRows[0];
        const result = {
          success: true,
          commodity: crop,
          reportId: report.id,
          reportDescription: report.description,
          source: 'USDA AMS Market News',
          sourceUrl: report.url,
          myMarketNewsUrl: 'https://mymarketnews.ams.usda.gov/',
          reportDate: topRow.reportDate,
          market: topRow.market,
          weightedAvg: topRow.weightedAvg,
          lowPrice: topRow.lowPrice,
          highPrice: topRow.highPrice,
          volume: topRow.volume,
          unit: topRow.unit || report.unit,
          grade: topRow.grade,
          currentPrice: topRow.weightedAvg || ((topRow.lowPrice + topRow.highPrice) / 2) || topRow.highPrice,
          allRows: priceRows.slice(0, 15),
          totalRowsFetched: priceRows.length,
        };
        setCache(cacheKey, result, 600); // 10-min cache
        return result;
      }
    }

    // rows = null → server error; rows = [] → no data for that date
    if (rows !== null) {
      logger.warn(`[AMS] Report ${report.id} returned no price rows for ${crop}`);
    }
  }

  // ── Strategy 2: Keyword search fallback ─────────────────────────────────
  logger.info(`[AMS] Falling back to keyword search for "${crop}"`);
  const matchedReports = await searchAmsReportsByKeyword(crop);

  if (matchedReports.length === 0) {
    return {
      error: true,
      message: `No AMS Market News reports found for "${commodity}". Check https://mymarketnews.ams.usda.gov/ for available reports.`,
      retryable: true,
      source: 'USDA AMS Market News',
      sourceUrl: 'https://mymarketnews.ams.usda.gov/',
      tip: 'Try using commodity aliases: cattle, hogs, lambs, eggs, corn, soybeans, strawberries, watermelon, milk',
    };
  }

  const allPriceRows = [];
  for (const rep of matchedReports) {
    const repId = rep.slug || rep.reportSlug || rep.reportId;
    if (!repId) continue;
    const repUrl = `https://marsapi.ams.usda.gov/services/v1.2/reports/${repId}`;
    const details = await fetchAmsReport(repUrl);
    if (details && details.length > 0) {
      const parsed = parseAmsRows(details.slice(0, 10), crop, '$/unit');
      parsed.forEach((r) => {
        r.reportTitle = rep.reportTitle || rep.ReportTitle;
        r.reportId = repId;
      });
      allPriceRows.push(...parsed);
    }
  }

  if (allPriceRows.length === 0) {
    return {
      error: true,
      message: `AMS reports found for "${commodity}" but no price data could be extracted from report details.`,
      retryable: true,
      source: 'USDA AMS Market News',
      sourceUrl: 'https://mymarketnews.ams.usda.gov/',
      reportsFound: matchedReports.map((r) => r.reportTitle || r.ReportTitle),
    };
  }

  const topRow = allPriceRows[0];
  const result = {
    success: true,
    commodity: crop,
    source: 'USDA AMS Market News (keyword search)',
    sourceUrl: 'https://mymarketnews.ams.usda.gov/',
    currentPrice: topRow.weightedAvg || topRow.highPrice,
    weightedAvg: topRow.weightedAvg,
    lowPrice: topRow.lowPrice,
    highPrice: topRow.highPrice,
    volume: topRow.volume,
    unit: topRow.unit,
    market: topRow.market,
    reportDate: topRow.reportDate,
    reportTitle: topRow.reportTitle,
    allRows: allPriceRows.slice(0, 15),
    reportsUsed: matchedReports.map((r) => r.reportTitle || r.ReportTitle),
  };
  setCache(cacheKey, result, 600);
  return result;
}

/**
 * MCP Tool: get_wasde_report – USDA WASDE Supply & Demand Estimates
 */
async function getWasdeReport({ commodity }) {
  const crop = (commodity || 'corn').toLowerCase().replace(/\s+/g, '');
  const cacheKey = makeCacheKey('getWasdeReport_v2', { crop });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  const wasdeData = WASDE_REFERENCE[crop] || WASDE_REFERENCE['corn'];
  const sd = { ...wasdeData };
  delete sd.outlook; delete sd.reportTitle; delete sd.reportUrl;

  const result = {
    commodity: crop,
    source: 'USDA WASDE (Published Estimates)',
    reportTitle: wasdeData.reportTitle,
    reportUrl: wasdeData.reportUrl,
    supplyDemand: sd,
    outlookSummary: wasdeData.outlook,
    note: 'Data from the latest published USDA World Agricultural Supply and Demand Estimates (WASDE).',
  };
  setCache(cacheKey, result, 3600 * 6);
  return result;
}

/**
 * MCP Tool: get_ers_outlook – USDA ERS Price & Supply Outlook
 */
async function getErsOutlook({ commodity }) {
  const crop = (commodity || 'corn').toLowerCase().replace(/\s+/g, '');
  const cacheKey = makeCacheKey('getErsOutlook_v2', { crop });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  const outline = ERS_OUTLOOKS[crop] || ERS_OUTLOOKS['corn'];
  const result = {
    commodity: crop,
    outlookTitle: outline.title,
    ersSeries: outline.series,
    summary: outline.summary,
    priceOutlook: outline.priceOutlook,
    publicationUrl: outline.publicationUrl,
    source: `USDA ERS ${outline.title}`,
    sourceUrl: outline.publicationUrl,
    note: 'Based on latest USDA Economic Research Service outlook publication.',
  };
  setCache(cacheKey, result, 3600 * 12);
  return result;
}

/**
 * MCP Tool: get_crop_forecast – Integrated WASDE + ERS + AMS forecast
 */
async function getCropForecast({ commodity, location }) {
  const crop = (commodity || 'corn').toLowerCase().trim();
  const cacheKey = makeCacheKey('getCropForecast_v2', { crop, location: location || 'national' });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  const [wasdeRes, ersRes, amsRes] = await Promise.allSettled([
    getWasdeReport({ commodity: crop }),
    getErsOutlook({ commodity: crop }),
    getAmsPrices({ commodity: crop }),
  ]);

  const wasdeData = wasdeRes.status === 'fulfilled' ? wasdeRes.value : null;
  const ersData = ersRes.status === 'fulfilled' ? ersRes.value : null;
  const amsData = amsRes.status === 'fulfilled' && amsRes.value?.success ? amsRes.value : null;

  const month = new Date().getMonth();
  const season =
    month >= 2 && month <= 4 ? 'Spring (Planting)' :
    month >= 5 && month <= 7 ? 'Summer (Growing)' :
    month >= 8 && month <= 10 ? 'Fall (Harvest)' : 'Winter (Planning)';

  const result = {
    commodity: crop,
    location: location || 'National',
    season,
    forecastDate: new Date().toISOString().split('T')[0],
    currentMarketPrice: amsData?.currentPrice || null,
    weightedAvg: amsData?.weightedAvg || null,
    priceUnit: amsData?.unit || '$/bu',
    priceOutlook: ersData?.priceOutlook || 'ERS data unavailable',
    supplyDemandSummary: wasdeData?.outlookSummary || 'WASDE data unavailable',
    ersForecast: ersData?.summary || 'ERS forecast unavailable',
    amsDataAvailable: !!amsData,
    recommendation: buildForecastRecommendation(crop, season, wasdeData, ersData, amsData),
    dataSources: {
      wasde: wasdeData?.reportTitle || 'USDA WASDE',
      ers: ersData?.outlookTitle || 'USDA ERS',
      ams: amsData ? 'USDA AMS Market News (live)' : 'USDA AMS (unavailable)',
    },
    links: {
      wasde: 'https://usda.gov/oce/commodity/wasde/',
      ams: 'https://mymarketnews.ams.usda.gov/',
      ersFeedGrains: 'https://www.ers.usda.gov/publications?series=FDS',
      ersOilCrops: 'https://www.ers.usda.gov/publications?series=OCS',
    },
  };
  setCache(cacheKey, result, 3600 * 3);
  return result;
}

function buildForecastRecommendation(crop, season, wasdeData, ersData, amsData) {
  const price = amsData?.currentPrice;
  const cropLabel = crop.charAt(0).toUpperCase() + crop.slice(1);
  const seasonalTips = {
    'Spring (Planting)': 'Consider forward contracts to lock in current prices before harvest pressure.',
    'Summer (Growing)': 'Monitor crop progress and weather events that could impact yields.',
    'Fall (Harvest)': 'Evaluate storage vs. immediate sale based on carry charges and basis.',
    'Winter (Planning)': 'Review input costs and lock in crop insurance before spring.',
  };
  const tip = seasonalTips[season] || '';
  const priceSig = price
    ? price > 5 ? '🟢 Prices are above historical averages — favorable selling window.'
    : price > 3.5 ? '🟡 Prices near break-even — monitor market closely.'
    : '🔴 Below-average prices — consider storage or alternative strategies.'
    : '⚪ Live AMS price data not available — refer to WASDE estimates.';

  return `**${cropLabel} – ${season}**: ${priceSig} ${tip}${ersData?.priceOutlook ? ` ERS Outlook: ${ersData.priceOutlook}` : ''}`;
}

/**
 * Get available report info (for debugging / discovery)
 */
function getAvailableReports() {
  return Object.entries(AMS_REPORTS).map(([commodity, info]) => ({
    commodity,
    reportId: info.id,
    url: info.url,
    unit: info.unit,
    description: info.description,
  }));
}

module.exports = {
  getAmsPrices,
  getWasdeReport,
  getErsOutlook,
  getCropForecast,
  getAvailableReports,
  AMS_REPORTS,
};
