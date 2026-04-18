import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import { fetchMapPrices, fetchWeather, fetchAMSPrices, fetchWASDE } from '../services/api';

const CITIES = [
  { value: 'nyc', label: 'New York City, NY', lat: 40.7128, lon: -74.0060, state: 'new york' },
  { value: 'washington', label: 'Washington, DC', lat: 38.9072, lon: -77.0369, state: 'virginia' },
  { value: 'boston', label: 'Boston, MA', lat: 42.3601, lon: -71.0589, state: 'massachusetts' },
  { value: 'chicago', label: 'Chicago, IL', lat: 41.8781, lon: -87.6298, state: 'illinois' },
  { value: 'kc', label: 'Kansas City, MO', lat: 39.0997, lon: -94.5786, state: 'missouri' },
  { value: 'desmoines', label: 'Des Moines, IA', lat: 41.5868, lon: -93.6250, state: 'iowa' },
  { value: 'okc', label: 'Oklahoma City, OK', lat: 35.4676, lon: -97.5164, state: 'oklahoma' },
];

const COMMODITIES = [
  { value: 'corn', label: '🌽 Corn' },
  { value: 'soybeans', label: '🌿 Soybeans' },
  { value: 'wheat', label: '🌾 Wheat' },
  { value: 'cattle', label: '🐄 Cattle' },
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
        fetchAMSPrices(comm),
        fetchWeather(cityObj.state) // The weather API uses state names internally, close enough
      ]);

      if (amsRes.status === 'fulfilled' && amsRes.value.success) {
        setAmsData(amsRes.value.data);
      }
      if (wxRes.status === 'fulfilled' && wxRes.value.success) {
        setWeatherData(wxRes.value.data);
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
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-black/40">
      
      {/* ── Left side: Map Area ── */}
      <div className="flex-1 relative flex flex-col">
        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 right-4 z-[400] flex items-center justify-between pointer-events-none">
          <div className="glass-card-dark px-4 py-2 rounded-xl pointer-events-auto shadow-xl border border-green-900/40">
            <h2 className="font-display font-bold text-lg gradient-text">Map Dashboard</h2>
          </div>
          
          <div className="flex gap-2 pointer-events-auto shadow-xl">
            {/* Area Dropdown */}
            <select
              value={cityVal}
              onChange={(e) => setCityVal(e.target.value)}
              className="input-agri appearance-none py-2 px-4 rounded-xl text-sm font-medium bg-gray-900/90 border border-green-800/50 cursor-pointer"
            >
              {CITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            
            {/* Crop Dropdown */}
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="input-agri appearance-none py-2 px-4 rounded-xl text-sm font-medium bg-gray-900/90 border border-green-800/50 cursor-pointer"
            >
              {COMMODITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Map Instance */}
        <div className="flex-1 w-full h-full z-0">
          <MapContainer center={[selectedCity.lat, selectedCity.lon]} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <MapController center={[selectedCity.lat, selectedCity.lon]} zoom={10} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com">CartoDB</a>'
            />
            {/* Main city marker */}
            <CircleMarker
              center={[selectedCity.lat, selectedCity.lon]}
              radius={15}
              fillColor="#22c55e"
              fillOpacity={0.4}
              color="#22c55e"
              weight={2}
            >
              <Tooltip permanent direction="bottom" className="!bg-gray-900 !text-green-400 !border-green-800 font-bold mt-2">
                {selectedCity.label}
              </Tooltip>
            </CircleMarker>
          </MapContainer>
        </div>
      </div>

      {/* ── Right side: Information Panel ── */}
      <div className="w-full md:w-80 lg:w-96 flex-none bg-gray-950 border-l border-green-900/30 flex flex-col p-4 overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10">
        <h3 className="text-xl font-bold text-white mb-1">{selectedCity.label}</h3>
        <p className="text-xs text-green-400/80 mb-6 uppercase tracking-widest font-semibold flex items-center gap-1">
          <span>📡</span> Live Agricultural Intelligence
        </p>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 opacity-60">
            <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin"></div>
            <div className="text-sm text-green-500 font-medium">Syncing USDA feeds...</div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Quick Pricing */}
            {amsData && !amsData.error ? (
               <div className="glass-card-dark p-4 rounded-2xl border border-amber-500/20">
                <div className="text-xs text-gray-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                  <span className="text-amber-400">💰</span> Current Market Price
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-green-400">${amsData.weightedAvg?.toFixed(2) || 'N/A'}</div>
                    <div className="text-xs text-gray-500 mt-1 capitalize">{commodity} per {amsData.unit}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-300">${amsData.lowPrice?.toFixed(2)} - ${amsData.highPrice?.toFixed(2)}</div>
                    <div className="text-xs text-gray-600 mt-0.5">Price Range</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card-dark p-4 rounded-2xl border border-gray-800 text-sm text-gray-500">
                No active AMS pricing for {commodity} in this region.
              </div>
            )}

            {/* General Advice (Mocked for localized feel as requested) */}
            <div className="glass-card p-4 rounded-2xl bg-green-900/10 border-green-800/30">
               <div className="text-xs text-green-400 font-bold mb-2 flex items-center gap-2">
                 <span>🌾</span> Agronomy Insights
               </div>
               <p className="text-sm text-gray-300 leading-relaxed">
                 Based on current USDA historical patterns for <strong className="text-white capitalize">{commodity}</strong> near <strong className="text-white">{selectedCity.label}</strong>, optimal yield windows occur when soil moisture remains above 40%. The current transport infrastructure remains highly favorable.
               </p>
            </div>

            {/* Weather Module */}
            <div className="glass-card-dark p-4 rounded-2xl border border-sky-900/30">
              <div className="text-xs text-sky-400 font-bold mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span>🌤️</span> Regional Weather
              </div>
              {weatherData && !weatherData.error ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={`https://openweathermap.org/img/wn/${weatherData.current?.icon}@2x.png`}
                      alt="weather" className="w-12 h-12 flex-none drop-shadow-md"
                    />
                    <div>
                      <div className="text-2xl font-bold text-white">{weatherData.current?.temperature?.toFixed(0)}°F</div>
                      <div className="text-xs text-gray-400 capitalize">{weatherData.current?.description}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-black/30 p-2 rounded-lg text-gray-400">💧 Humidity: <span className="text-white">{weatherData.current?.humidity}%</span></div>
                    <div className="bg-black/30 p-2 rounded-lg text-gray-400">💨 Wind: <span className="text-white">{weatherData.current?.windSpeed}mph</span></div>
                  </div>
                  
                  {/* Forecast strip */}
                  <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between">
                    {weatherData.forecast?.slice(0, 4).map((d, i) => (
                      <div key={i} className="text-center">
                        <div className="text-[10px] text-gray-500 uppercase">{new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}</div>
                        <div className="text-sm font-semibold text-gray-200 mt-1">{d.maxTemp?.toFixed(0)}°</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-500">Weather data unavailable</div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
