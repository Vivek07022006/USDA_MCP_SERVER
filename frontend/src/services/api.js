import axios from 'axios';
import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_URL || '';

// ─── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL ? `${BASE_URL}/api` : '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Socket.IO ─────────────────────────────────────────────────────────────────
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(BASE_URL || '/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('[WS] Connected:', socket.id));
    socket.on('disconnect', (r) => console.log('[WS] Disconnected:', r));
    socket.on('connect_error', (e) => console.error('[WS] Error:', e.message));
  }
  return socket;
}

// ─── Send chat via WebSocket ────────────────────────────────────────────────────
export function sendChatMessage({ message, sessionId, history = [] }) {
  const sock = getSocket();
  sock.emit('chat_message', { message, sessionId, history });
}

// ─── Send chat via HTTP (fallback) ─────────────────────────────────────────────
export async function sendChatHTTP({ message, sessionId, history = [] }) {
  const res = await api.post('/chat', { message, sessionId, history });
  return res.data;
}

// ─── Create session ─────────────────────────────────────────────────────────────
export async function createSession() {
  const res = await api.post('/auth/session');
  return res.data;
}

// ─── AMS prices ────────────────────────────────────────────────────────────────
export async function fetchAMSPrices(commodity, { market, reportDate } = {}) {
  const params = {};
  if (market) params.market = market;
  if (reportDate) params.reportDate = reportDate;
  const res = await api.get(`/data/ams/${commodity}`, { params });
  return res.data;
}

// ─── Weather ───────────────────────────────────────────────────────────────────
export async function fetchWeather(location) {
  const res = await api.get(`/data/weather/${encodeURIComponent(location)}`);
  return res.data;
}

// ─── Map prices ────────────────────────────────────────────────────────────────
export async function fetchMapPrices(commodity = 'corn') {
  const res = await api.get('/map/prices', { params: { commodity } });
  return res.data;
}

// ─── Profit map ────────────────────────────────────────────────────────────────
export async function fetchProfitMap({ origin, commodity, quantity }) {
  const res = await api.get('/map/profit', { params: { origin, commodity, quantity } });
  return res.data;
}

// ─── WASDE ─────────────────────────────────────────────────────────────────────
export async function fetchWASDE(commodity) {
  const res = await api.get(`/data/wasde/${commodity}`);
  return res.data;
}

// ─── ERS Outlook ───────────────────────────────────────────────────────────────
export async function fetchERS(commodity) {
  const res = await api.get(`/data/ers/${commodity}`);
  return res.data;
}

// ─── Logs ──────────────────────────────────────────────────────────────────────
export async function fetchLogs({ page = 1, limit = 20 } = {}) {
  const res = await api.get('/logs', { params: { page, limit } });
  return res.data;
}

// ─── Health ────────────────────────────────────────────────────────────────────
export async function fetchHealth() {
  const res = await api.get('/health', { baseURL: '/' });
  return res.data;
}

// ─── Tools info ────────────────────────────────────────────────────────────────
export async function fetchTools() {
  const res = await api.get('/tools');
  return res.data;
}

export default api;
