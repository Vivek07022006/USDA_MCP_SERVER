import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import { fetchMapPrices, fetchWeather, fetchAMSPrices } from '../services/api';
import useStore from '../store';
import { translations } from '../translations';

const CITIES = [
  { value: 'nyc', label: 'New York City, NY', lat: 40.7128, lon: -74.0060, state: 'New York' },
  { value: 'washington', label: 'Washington, DC', lat: 38.9072, lon: -77.0369, state: 'District of Columbia' },
  { value: 'boston', label: 'Boston, MA', lat: 42.3601, lon: -71.0589, state: 'Massachusetts' },
  { value: 'chicago', label: 'Chicago, IL', lat: 41.8781, lon: -87.6298, state: 'Illinois' },
  { value: 'kc', label: 'Kansas City, MO', lat: 39.0997, lon: -94.5786, state: 'Missouri' },
  { value: 'desmoines', label: 'Des Moines, IA', lat: 41.5868, lon: -93.6250, state: 'Iowa' },
  { value: 'okc', label: 'Oklahoma City, OK', lat: 35.4676, lon: -97.5164, state: 'Oklahoma' },
  { value: 'dallas', label: 'Dallas, TX', lat: 32.7767, lon: -96.7970, state: 'Texas' },
  { value: 'atlanta', label: 'Atlanta, GA', lat: 33.7490, lon: -84.3880, state: 'Georgia' },
  { value: 'denver', label: 'Denver, CO', lat: 39.7392, lon: -104.9903, state: 'Colorado' },
  { value: 'miami', label: 'Miami, FL', lat: 25.7617, lon: -80.1918, state: 'Florida' },
  { value: 'seattle', label: 'Seattle, WA', lat: 47.6062, lon: -122.3321, state: 'Washington' },
];

const COMMODITIES = [
  { value: 'corn', label: '🌽 Corn' },
  { value: 'soybeans', label: '🌿 Soybeans' },
  { value: 'wheat', label: '🌾 Wheat' },
  { value: 'cattle', label: '🐄 Cattle' },
  { value: 'rice', label: '🍚 Rice' },
  { value: 'cotton', label: '🧶 Cotton' },
  { value: 'strawberries', label: '🍓 Strawberries' },
  { value: 'oranges', label: '🍊 Oranges' },
  { value: 'milk', label: '🥛 Milk' },
];

// Helper to auto-fly map
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

export default function MapPage() {
  const { language } = useStore();
  const T = translations[language];
  const [commodity, setCommodity] = useState('corn');
  const [cityVal, setCityVal] = useState('nyc');
  const [amsData, setAmsData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedCity = CITIES.find(c => c.value === cityVal) || CITIES[0];

  const loadDashboardData = useCallback(async (comm, cityObj) => {
    setLoading(true);
    try {
      const [amsRes, wxRes] = await Promise.allSettled([
        fetchAMSPrices(comm, { market: cityObj.label }),
        fetchWeather(cityObj.label)
      ]);

      if (amsRes.status === 'fulfilled' && amsRes.value.success) {
        setAmsData(amsRes.value.data);
      } else {
        // HACKATHON MOCK DATA INJECTION (If API Fails)
        const mockPrice = 300 + Math.random() * 200;
        setAmsData({
          weightedAvg: mockPrice,
          highPrice: mockPrice + 15,
          lowPrice: mockPrice - 10,
          unit: 'cwt',
          isMock: true
        });
      }

      if (wxRes.status === 'fulfilled' && wxRes.value.success) {
        setWeatherData(wxRes.value.data);
      } else {
        setWeatherData({ error: 'Weather unavailable' });
      }
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData(commodity, selectedCity);
  }, [commodity, selectedCity, loadDashboardData]);

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-white">
      
      {/* ── Left side: Map Area ── */}
      <div className="flex-1 relative flex flex-col">
        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 right-4 z-[400] flex items-center justify-between pointer-events-none">
          <div className="glass-card px-4 py-2 rounded-xl pointer-events-auto border border-green-200">
            <h2 className="font-display font-bold text-lg text-green-700">{T.map}</h2>
          </div>
          
          <div className="flex gap-2 pointer-events-auto">
            {/* Area Dropdown */}
            <select
              value={cityVal}
              onChange={(e) => setCityVal(e.target.value)}
              className="appearance-none py-2 px-4 rounded-xl text-sm font-semibold bg-white border border-green-200 text-gray-700 shadow-sm outline-none cursor-pointer"
            >
              {CITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            
            {/* Crop Dropdown */}
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="appearance-none py-2 px-4 rounded-xl text-sm font-semibold bg-white border border-green-200 text-gray-700 shadow-sm outline-none cursor-pointer"
            >
              {COMMODITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Map Instance (Light themed tiles now) */}
        <div className="flex-1 w-full h-full z-0">
          <MapContainer center={[selectedCity.lat, selectedCity.lon]} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <MapController center={[selectedCity.lat, selectedCity.lon]} zoom={10} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com">CartoDB</a>'
            />
            {/* Main city marker */}
            <CircleMarker
              center={[selectedCity.lat, selectedCity.lon]}
              radius={15}
              fillColor="#16a34a"
              fillOpacity={0.2}
              color="#16a34a"
              weight={2}
            >
              <Tooltip permanent direction="bottom" className="!bg-white !text-green-700 !border-green-200 font-bold mt-2 shadow-md">
                {selectedCity.label}
              </Tooltip>
            </CircleMarker>
          </MapContainer>
        </div>
      </div>

      {/* ── Right side: Information Panel ── */}
      <div className="w-full md:w-80 lg:w-96 flex-none bg-white border-l border-green-100 flex flex-col p-4 overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10">
        <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedCity.label}</h3>
        <p className="text-[10px] text-green-600 mb-6 uppercase tracking-widest font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          {T.dataSource}
        </p>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 opacity-60">
            <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin"></div>
            <div className="text-sm text-green-600 font-bold">{T.syncing}</div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Quick Pricing Tool */}
            <div className="glass-card p-4 rounded-2xl border border-green-100 bg-green-50/30">
              <div className="text-[10px] text-green-600 font-bold mb-3 flex items-center justify-between uppercase tracking-wide">
                <span className="flex items-center gap-1.5">💰 {T.currentMarket}</span>
                {amsData?.isMock && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px]">ESTIMATED</span>}
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-3xl font-bold text-gray-900">${amsData?.weightedAvg?.toFixed(2) || '---'}</div>
                  <div className="text-[10px] text-gray-500 mt-1 capitalize font-medium">{commodity} per {amsData?.unit || 'unit'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-gray-600">${amsData?.lowPrice?.toFixed(2)} - ${amsData?.highPrice?.toFixed(2)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{T.priceRange}</div>
                </div>
              </div>
            </div>

            {/* Dynamic Agronomy Insights */}
            <div className="glass-card p-4 rounded-2xl bg-white border border-green-100">
               <div className="text-[10px] text-green-600 font-bold mb-2 flex items-center gap-2 uppercase tracking-wide">
                 <span>🌾</span> {T.agronomyInsights}
               </div>
               <p className="text-sm text-gray-600 leading-relaxed font-medium">
                 {weatherData && weatherData.current?.temperature > 85 ? (
                   <>Extreme heat detected near <strong className="text-gray-900">{selectedCity.label}</strong>. We recommend increasing irrigation cycles for <strong className="text-gray-900 capitalize">{commodity}</strong> to prevent heat stress and maintain yield potential.</>
                 ) : weatherData && weatherData.current?.temperature < 40 ? (
                   <>Frost risk warning for <strong className="text-gray-900 capitalize">{commodity}</strong>. Consider temporary cover or thermal management strategies in the <strong className="text-gray-900">{selectedCity.state}</strong> region.</>
                 ) : (
                   <>Current conditions in <strong className="text-gray-900">{selectedCity.label}</strong> are optimal for <strong className="text-gray-900 capitalize">{commodity}</strong> development. Maintain standard nitrogen applications and monitor soil moisture above 40%.</>
                 )}
               </p>
               <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                 <span className="text-[10px] text-gray-400 font-bold uppercase">{T.marketOutlook}</span>
                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${amsData?.weightedAvg > 400 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                   {amsData?.weightedAvg > 400 ? '📈 STRONG DEMAND' : '📉 STABILIZING'}
                 </span>
               </div>
            </div>

            {/* Weather Module */}
            <div className="glass-card p-4 rounded-2xl border border-blue-50 bg-blue-50/20">
              <div className="text-[10px] text-blue-600 font-bold mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span>🌤️</span> {T.regionalWeather}
              </div>
              {weatherData && !weatherData.error ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={`https://openweathermap.org/img/wn/${weatherData.current?.icon}@2x.png`}
                      alt="weather" className="w-12 h-12 flex-none drop-shadow-md"
                    />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{weatherData.current?.temperature?.toFixed(0)}°F</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight capitalize">{weatherData.current?.description}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                    <div className="bg-white p-2 rounded-lg text-gray-500 border border-blue-100 shadow-sm">💧 {T.humidity}: <span className="text-blue-600">{weatherData.current?.humidity}%</span></div>
                    <div className="bg-white p-2 rounded-lg text-gray-500 border border-blue-100 shadow-sm">💨 {T.wind}: <span className="text-blue-600">{weatherData.current?.windSpeed}mph</span></div>
                  </div>
                  
                  {/* Forecast strip */}
                  <div className="mt-4 pt-3 border-t border-blue-100 flex justify-between">
                    {weatherData.forecast?.slice(0, 4).map((d, i) => (
                      <div key={i} className="text-center">
                        <div className="text-[9px] text-gray-400 font-bold uppercase">{new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}</div>
                        <div className="text-sm font-bold text-gray-700 mt-1">{d.maxTemp?.toFixed(0)}°</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-400 font-medium py-4 text-center">Weather data unavailable</div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
