/**
 * weatherTool.js – OpenWeatherMap MCP Tool
 * Uses: https://api.openweathermap.org/data/2.5/weather
 *       https://api.openweathermap.org/data/2.5/forecast
 *       https://api.openweathermap.org/geo/1.0/direct
 */

const axios = require('axios');
const { makeCacheKey, getCache, setCache } = require('../utils/cache');
const logger = require('../utils/logger');

const OW_BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_BASE = 'https://api.openweathermap.org/geo/1.0';

// US State capitals for instant coord resolution (no extra API call)
const STATE_COORDS = {
  alabama: { lat: 32.37, lon: -86.30, city: 'Montgomery, AL' },
  alaska: { lat: 58.30, lon: -134.42, city: 'Juneau, AK' },
  arizona: { lat: 33.45, lon: -112.07, city: 'Phoenix, AZ' },
  arkansas: { lat: 34.75, lon: -92.28, city: 'Little Rock, AR' },
  california: { lat: 38.58, lon: -121.49, city: 'Sacramento, CA' },
  colorado: { lat: 39.74, lon: -104.98, city: 'Denver, CO' },
  connecticut: { lat: 41.76, lon: -72.68, city: 'Hartford, CT' },
  delaware: { lat: 39.16, lon: -75.52, city: 'Dover, DE' },
  florida: { lat: 30.44, lon: -84.28, city: 'Tallahassee, FL' },
  georgia: { lat: 33.75, lon: -84.39, city: 'Atlanta, GA' },
  idaho: { lat: 43.62, lon: -116.20, city: 'Boise, ID' },
  illinois: { lat: 39.80, lon: -89.65, city: 'Springfield, IL' },
  indiana: { lat: 39.79, lon: -86.15, city: 'Indianapolis, IN' },
  iowa: { lat: 41.59, lon: -93.62, city: 'Des Moines, IA' },
  kansas: { lat: 39.05, lon: -95.69, city: 'Topeka, KS' },
  kentucky: { lat: 38.19, lon: -84.86, city: 'Frankfort, KY' },
  louisiana: { lat: 30.45, lon: -91.19, city: 'Baton Rouge, LA' },
  maine: { lat: 44.33, lon: -69.77, city: 'Augusta, ME' },
  maryland: { lat: 38.98, lon: -76.49, city: 'Annapolis, MD' },
  massachusetts: { lat: 42.36, lon: -71.06, city: 'Boston, MA' },
  michigan: { lat: 42.73, lon: -84.55, city: 'Lansing, MI' },
  minnesota: { lat: 44.95, lon: -93.10, city: 'Saint Paul, MN' },
  mississippi: { lat: 32.30, lon: -90.18, city: 'Jackson, MS' },
  missouri: { lat: 38.57, lon: -92.18, city: 'Jefferson City, MO' },
  montana: { lat: 46.60, lon: -112.02, city: 'Helena, MT' },
  nebraska: { lat: 40.81, lon: -96.68, city: 'Lincoln, NE' },
  nevada: { lat: 39.16, lon: -119.77, city: 'Carson City, NV' },
  'new hampshire': { lat: 43.21, lon: -71.54, city: 'Concord, NH' },
  'new jersey': { lat: 40.22, lon: -74.76, city: 'Trenton, NJ' },
  'new mexico': { lat: 35.69, lon: -105.94, city: 'Santa Fe, NM' },
  'new york': { lat: 42.65, lon: -73.76, city: 'Albany, NY' },
  'north carolina': { lat: 35.78, lon: -78.64, city: 'Raleigh, NC' },
  'north dakota': { lat: 46.81, lon: -100.78, city: 'Bismarck, ND' },
  ohio: { lat: 39.96, lon: -83.00, city: 'Columbus, OH' },
  oklahoma: { lat: 35.47, lon: -97.52, city: 'Oklahoma City, OK' },
  oregon: { lat: 44.95, lon: -123.03, city: 'Salem, OR' },
  pennsylvania: { lat: 40.27, lon: -76.88, city: 'Harrisburg, PA' },
  'rhode island': { lat: 41.82, lon: -71.42, city: 'Providence, RI' },
  'south carolina': { lat: 34.00, lon: -81.03, city: 'Columbia, SC' },
  'south dakota': { lat: 44.37, lon: -100.35, city: 'Pierre, SD' },
  tennessee: { lat: 36.16, lon: -86.78, city: 'Nashville, TN' },
  texas: { lat: 30.27, lon: -97.74, city: 'Austin, TX' },
  utah: { lat: 40.58, lon: -111.89, city: 'Salt Lake City, UT' },
  vermont: { lat: 44.26, lon: -72.58, city: 'Montpelier, VT' },
  virginia: { lat: 37.54, lon: -77.44, city: 'Richmond, VA' },
  washington: { lat: 47.04, lon: -122.90, city: 'Olympia, WA' },
  'west virginia': { lat: 38.33, lon: -81.61, city: 'Charleston, WV' },
  wisconsin: { lat: 43.07, lon: -89.40, city: 'Madison, WI' },
  wyoming: { lat: 41.14, lon: -104.82, city: 'Cheyenne, WY' },
  // Cities
  chicago: { lat: 41.88, lon: -87.63, city: 'Chicago, IL' },
  'new york city': { lat: 40.71, lon: -74.01, city: 'New York City, NY' },
  nyc: { lat: 40.71, lon: -74.01, city: 'New York City, NY' },
  'los angeles': { lat: 34.05, lon: -118.24, city: 'Los Angeles, CA' },
  'kansas city': { lat: 39.10, lon: -94.58, city: 'Kansas City, MO' },
  minneapolis: { lat: 44.98, lon: -93.27, city: 'Minneapolis, MN' },
  memphis: { lat: 35.15, lon: -90.05, city: 'Memphis, TN' },
  'st. louis': { lat: 38.63, lon: -90.20, city: 'St. Louis, MO' },
  omaha: { lat: 41.25, lon: -95.99, city: 'Omaha, NE' },
  dallas: { lat: 32.78, lon: -96.80, city: 'Dallas, TX' },
  houston: { lat: 29.76, lon: -95.36, city: 'Houston, TX' },
  'oklahoma city': { lat: 35.47, lon: -97.52, city: 'Oklahoma City, OK' },
  okc: { lat: 35.47, lon: -97.52, city: 'Oklahoma City, OK' },
  wichita: { lat: 37.69, lon: -97.33, city: 'Wichita, KS' },
  'des moines': { lat: 41.59, lon: -93.62, city: 'Des Moines, IA' },
  decatur: { lat: 39.84, lon: -88.95, city: 'Decatur, IL' },
};

/**
 * Resolve location string → { lat, lon, city }
 */
async function resolveLocation(location) {
  const lower = location.toLowerCase().trim();

  // 1. Check our local fast-lookup table first
  if (STATE_COORDS[lower]) return STATE_COORDS[lower];

  // 2. OpenWeather Geocoding API for exact city resolution
  if (process.env.OPENWEATHER_API_KEY) {
    try {
      const resp = await axios.get(`${GEO_BASE}/direct`, {
        params: { q: `${location},US`, limit: 1, appid: process.env.OPENWEATHER_API_KEY },
        timeout: 6000,
      });
      if (resp.data?.length > 0) {
        const loc = resp.data[0];
        return { lat: loc.lat, lon: loc.lon, city: `${loc.name}, ${loc.state || 'US'}` };
      }
    } catch (err) {
      logger.warn(`Geocoding API failed: ${err.message}`);
    }
  }

  return null; // Caller must handle
}

/**
 * MCP Tool: get_weather
 * Fetches current conditions + 5-day forecast from OpenWeather.
 * Returns structured agricultural advice.
 */
async function getWeather({ location }) {
  if (!location || typeof location !== 'string') {
    return { error: true, message: 'Invalid location provided.', retryable: false };
  }

  const cacheKey = makeCacheKey('getWeather_v2', { location });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return {
      error: true,
      message: 'OPENWEATHER_API_KEY not configured. Cannot fetch real weather data.',
      retryable: false,
      source: 'OpenWeatherMap',
    };
  }

  const coords = await resolveLocation(location);
  if (!coords) {
    return {
      error: true,
      message: `Could not resolve location "${location}" to coordinates. Try a US state name or city.`,
      retryable: false,
      source: 'OpenWeatherMap',
    };
  }

  try {
    const [currResp, fcastResp] = await Promise.all([
      axios.get(`${OW_BASE}/weather`, {
        params: { lat: coords.lat, lon: coords.lon, appid: apiKey, units: 'imperial' },
        timeout: 8000,
      }),
      axios.get(`${OW_BASE}/forecast`, {
        params: { lat: coords.lat, lon: coords.lon, appid: apiKey, units: 'imperial', cnt: 40 },
        timeout: 8000,
      }),
    ]);

    const curr = currResp.data;
    const forecastList = fcastResp.data.list;

    // Aggregate into daily buckets
    const dailyMap = {};
    for (const item of forecastList) {
      const day = item.dt_txt.split(' ')[0];
      if (!dailyMap[day]) {
        dailyMap[day] = {
          date: day,
          maxTemp: item.main.temp_max,
          minTemp: item.main.temp_min,
          rainfall: item.rain?.['3h'] || 0,
          humidity: item.main.humidity,
          description: item.weather[0].description,
          windSpeed: item.wind.speed,
          icon: item.weather[0].icon,
        };
      } else {
        dailyMap[day].maxTemp = Math.max(dailyMap[day].maxTemp, item.main.temp_max);
        dailyMap[day].minTemp = Math.min(dailyMap[day].minTemp, item.main.temp_min);
        dailyMap[day].rainfall += item.rain?.['3h'] || 0;
      }
    }

    const forecast = Object.values(dailyMap).slice(0, 5);
    const agriAdvice = generateWeatherAdvice(curr, forecast);

    const result = {
      location: coords.city || location,
      coordinates: { lat: coords.lat, lon: coords.lon },
      current: {
        temperature: curr.main.temp,
        feelsLike: curr.main.feels_like,
        humidity: curr.main.humidity,
        windSpeed: curr.wind.speed,
        description: curr.weather[0].description,
        icon: curr.weather[0].icon,
        pressure: curr.main.pressure,
        visibility: curr.visibility,
        rainfall: curr.rain?.['1h'] || 0,
        uvIndex: null, // requires separate endpoint
      },
      forecast,
      agriAdvice,
      soilMoistureRisk: assessSoilMoisture(curr, forecast),
      source: 'OpenWeatherMap',
      sourceUrl: 'https://openweathermap.org',
    };

    setCache(cacheKey, result, 600); // 10-min cache
    return result;
  } catch (err) {
    logger.error(`OpenWeather API failed for ${location}: ${err.message}`);
    return {
      error: true,
      message: `OpenWeatherMap API error: ${err.message}`,
      retryable: true,
      source: 'OpenWeatherMap',
    };
  }
}

function generateWeatherAdvice(current, forecast) {
  const advice = [];
  const temp = current.main.temp;
  const humidity = current.main.humidity;
  const wind = current.wind.speed;

  if (temp > 95) advice.push('⚠️ Heat stress alert: Consider irrigation and shade for sensitive crops.');
  if (temp < 32) advice.push('⚠️ Frost risk: Protect cold-sensitive crops immediately.');
  if (temp < 28) advice.push('🧊 Hard freeze risk: Cover perennial crops and citrus.');
  if (humidity > 85) advice.push('🍄 High humidity: Elevated fungal disease risk. Apply preventive fungicides.');
  if (humidity > 80) advice.push('💧 Humidity favorable for disease spread. Monitor crops closely.');
  if (wind > 30) advice.push('💨 High winds: Delay spraying and aerial operations.');
  if (wind > 20) advice.push('🌬️ Moderate winds: Be cautious with herbicide applications.');
  if (humidity < 25) advice.push('🌵 Very low humidity: Increase irrigation immediately.');

  const rainDays = forecast.filter((d) => d.rainfall > 0.05).length;
  if (rainDays >= 4) advice.push('🌧️ Wet week ahead: Plan field operations for dry windows.');
  if (rainDays >= 3) advice.push('☔ Multiple rain events expected: Consider delaying herbicide application.');
  if (rainDays === 0) advice.push('☀️ Dry week ahead: Ensure adequate irrigation is scheduled.');

  const maxForecastTemp = Math.max(...forecast.map((d) => d.maxTemp));
  if (maxForecastTemp > 100) advice.push('🔥 Extreme heat forecasted: Implement heat stress management protocols.');

  if (advice.length === 0) advice.push('✅ Favorable conditions for most field operations this week.');
  return advice;
}

function assessSoilMoisture(current, forecast) {
  const totalRain = forecast.reduce((s, d) => s + d.rainfall, 0);
  const avgHumidity = forecast.reduce((s, d) => s + d.humidity, 0) / (forecast.length || 1);

  if (totalRain > 2.0) return 'HIGH – Potential waterlogging risk; check drainage.';
  if (totalRain > 0.5 && avgHumidity > 70) return 'ADEQUATE – Good moisture conditions for most crops.';
  if (totalRain < 0.1 && avgHumidity < 50) return 'LOW – Irrigation recommended within 48 hours.';
  return 'MODERATE – Monitor soil conditions and irrigate as needed.';
}

/**
 * MCP Tool: get_soil_data
 * Reference data from USDA Web Soil Survey by major US ag state.
 */
async function getSoilData({ location }) {
  const cacheKey = makeCacheKey('getSoilData_v2', { location });
  const cached = getCache(cacheKey);
  if (cached.hit) return { ...cached.data, cached: true };

  const REGION_SOILS = {
    iowa: { type: 'Mollisol (Prairie)', ph: 6.2, organicMatter: 4.5, drainage: 'Well-drained', texture: 'Silty Clay Loam', nitrogen: 'High', phosphorus: 'Moderate' },
    illinois: { type: 'Alfisol (Forest)', ph: 6.5, organicMatter: 3.8, drainage: 'Moderately well-drained', texture: 'Silty Clay Loam', nitrogen: 'Moderate', phosphorus: 'Moderate' },
    kansas: { type: 'Mollisol (Grassland)', ph: 6.8, organicMatter: 3.2, drainage: 'Well-drained', texture: 'Clay Loam', nitrogen: 'Moderate', phosphorus: 'Low' },
    texas: { type: 'Vertisol (Clay)', ph: 7.4, organicMatter: 2.1, drainage: 'Moderately drained', texture: 'Clay', nitrogen: 'Low', phosphorus: 'Low' },
    california: { type: 'Aridisol (Desert)', ph: 7.8, organicMatter: 1.5, drainage: 'Excessively drained', texture: 'Sandy Loam', nitrogen: 'Very Low', phosphorus: 'Low' },
    minnesota: { type: 'Mollisol (Prairie)', ph: 6.0, organicMatter: 4.8, drainage: 'Well-drained', texture: 'Loam', nitrogen: 'High', phosphorus: 'High' },
    nebraska: { type: 'Mollisol', ph: 6.4, organicMatter: 3.6, drainage: 'Well-drained', texture: 'Silt Loam', nitrogen: 'Moderate', phosphorus: 'Moderate' },
    'north dakota': { type: 'Mollisol', ph: 6.8, organicMatter: 5.0, drainage: 'Moderately well-drained', texture: 'Clay Loam', nitrogen: 'High', phosphorus: 'Moderate' },
    'south dakota': { type: 'Mollisol', ph: 6.6, organicMatter: 3.8, drainage: 'Well-drained', texture: 'Silty Clay Loam', nitrogen: 'Moderate', phosphorus: 'Moderate' },
    indiana: { type: 'Mollisol/Alfisol', ph: 6.3, organicMatter: 3.5, drainage: 'Well-drained', texture: 'Silt Loam', nitrogen: 'Moderate', phosphorus: 'Moderate' },
    ohio: { type: 'Alfisol', ph: 6.1, organicMatter: 3.2, drainage: 'Moderately well-drained', texture: 'Silt Loam', nitrogen: 'Moderate', phosphorus: 'Low' },
    wisconsin: { type: 'Alfisol', ph: 6.2, organicMatter: 3.9, drainage: 'Well-drained', texture: 'Loam', nitrogen: 'Moderate', phosphorus: 'Moderate' },
    georgia: { type: 'Ultisol', ph: 5.8, organicMatter: 2.0, drainage: 'Well-drained', texture: 'Sandy Loam', nitrogen: 'Low', phosphorus: 'Low' },
    mississippi: { type: 'Entisol', ph: 6.0, organicMatter: 1.8, drainage: 'Well-drained', texture: 'Fine Sandy Loam', nitrogen: 'Low', phosphorus: 'Low' },
    missouri: { type: 'Mollisol/Ultisol', ph: 6.2, organicMatter: 3.0, drainage: 'Moderately well-drained', texture: 'Silt Loam', nitrogen: 'Moderate', phosphorus: 'Moderate' },
    oklahoma: { type: 'Mollisol/Alfisol', ph: 6.5, organicMatter: 2.8, drainage: 'Well-drained', texture: 'Loam', nitrogen: 'Moderate', phosphorus: 'Low' },
    arkansas: { type: 'Ultisol', ph: 6.0, organicMatter: 2.2, drainage: 'Moderately well-drained', texture: 'Silt Loam', nitrogen: 'Low', phosphorus: 'Low' },
  };

  const lower = location.toLowerCase().trim();
  const soilInfo = REGION_SOILS[lower];

  if (!soilInfo) {
    return {
      error: true,
      message: `Soil reference data not available for "${location}". Available: ${Object.keys(REGION_SOILS).join(', ')}.`,
      retryable: false,
      source: 'USDA Web Soil Survey Reference',
      sourceUrl: 'https://websoilsurvey.sc.egov.usda.gov',
    };
  }

  const result = {
    location,
    soil: soilInfo,
    recommendations: generateSoilRecommendations(soilInfo),
    source: 'USDA Web Soil Survey (Reference Data)',
    sourceUrl: 'https://websoilsurvey.sc.egov.usda.gov',
    note: 'Reference data from USDA Web Soil Survey. For exact field-level analysis, consult WSS directly.',
  };
  setCache(cacheKey, result, 86400);
  return result;
}

function generateSoilRecommendations(soil) {
  const recs = [];
  if (soil.ph < 5.8) recs.push('Apply agricultural lime at 2–3 tons/acre to raise pH for optimal nutrient uptake.');
  else if (soil.ph < 6.0) recs.push('Light lime application recommended to bring pH to 6.0–6.5 range.');
  if (soil.ph > 7.5) recs.push('Consider elemental sulfur to lower pH. Test micronutrient availability.');
  if (soil.organicMatter < 2.0) recs.push('Add compost (3–5 tons/acre) or winter cover crops to build organic matter.');
  if (soil.drainage === 'Excessively drained') recs.push('Sandy drainage: increase irrigation frequency; consider drip irrigation.');
  if (soil.nitrogen === 'Low' || soil.nitrogen === 'Very Low') recs.push('Soil N is deficient – apply starter N at planting and side-dress at V6.');
  if (soil.phosphorus === 'Low') recs.push('Apply P2O5 based on soil test; typical rate 60–80 lb/acre for row crops.');
  if (recs.length === 0) recs.push('Soil conditions are excellent. Maintain with regular testing every 2–3 years.');
  return recs;
}

module.exports = { getWeather, getSoilData, resolveLocation };
