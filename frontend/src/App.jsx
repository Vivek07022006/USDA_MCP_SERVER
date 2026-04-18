import React, { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import useStore from './store';
import ChatPage from './pages/ChatPage';
import MapPage from './pages/MapPage';
import LogsPage from './pages/LogsPage';
import { createSession, fetchHealth } from './services/api';
import { translations } from './translations';

// Icons
const Icons = {
  Chat: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Map: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  Logs: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  Wheat: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C12 2 7 7 7 12c0 2.5 1.5 4.5 3 6M12 2c0 0 5 5 5 10 0 2.5-1.5 4.5-3 6M12 2v20M8 7c-1-.5-2-1.5-2-3M16 7c1-.5 2-1.5 2-3M8 12c-1.5-.5-3-2-3-3.5M16 12c1.5-.5 3-2 3-3.5" />
    </svg>
  ),
  Signal: ({ status }) => (
    <div className={`w-2 h-2 rounded-full ${status === 'ok' ? 'bg-green-500 shadow-green-500/30 shadow-sm' : 'bg-red-400'}`} 
         style={{ animation: status === 'ok' ? 'pulse 2s ease-in-out infinite' : 'none' }} />
  ),
};

export default function App() {
  const { activePage, setActivePage, setSessionId, language, setLanguage } = useStore();
  const [serverStatus, setServerStatus] = useState('checking');
  
  const T = translations[language];

  useEffect(() => {
    // Initialize session
    const existing = localStorage.getItem('agrimcp_session_v2');
    if (existing) {
      setSessionId(existing);
    } else {
      createSession()
        .then((r) => {
          const sid = r.sessionId;
          localStorage.setItem('agrimcp_session_v2', sid);
          setSessionId(sid);
        })
        .catch(() => {
          const fallback = `local_${Date.now()}`;
          localStorage.setItem('agrimcp_session_v2', fallback);
          setSessionId(fallback);
        });
    }

    // Check server health
    const checkHealth = async () => {
      try {
        const h = await fetchHealth();
        setServerStatus(h.status === 'ok' ? 'ok' : 'error');
      } catch {
        setServerStatus('error');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const renderPage = () => {
    if (window.location.pathname === '/secret-routes-for-logs-12345') {
      return <LogsPage />;
    }
    switch (activePage) {
      case 'chat': return <ChatPage />;
      case 'map': return <MapPage />;
      default: return <ChatPage />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white text-gray-900">
      {/* ── Top Navigation ── */}
      <nav className="glass-card border-b border-green-100 flex-none z-40 bg-white/80">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
          
          {/* Left: Logo */}
          <div className="flex items-center gap-3 flex-none">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-200">
              <Icons.Wheat />
            </div>
            <div className="hidden sm:block">
              <div className="font-display font-bold text-base text-gray-900 leading-tight">AgriMCP AI</div>
              <div className="text-gray-500 text-xs flex items-center gap-1.5">
                <Icons.Signal status={serverStatus} />
                {T.dataSource}
              </div>
            </div>
          </div>

          {/* Center: Nav Switches */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl">
            <button
              onClick={() => setActivePage('chat')}
              className={`nav-btn px-4 py-1.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all ${activePage === 'chat' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Icons.Chat />
              <span className="hidden md:inline">{T.assistant}</span>
            </button>
            <button
              onClick={() => setActivePage('map')}
              className={`nav-btn px-4 py-1.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all ${activePage === 'map' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Icons.Map />
              <span className="hidden md:inline">{T.map}</span>
            </button>
          </div>

          {/* Right: Language Selector */}
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent border border-green-200 rounded-lg px-2 py-1 text-xs font-bold text-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>

        </div>
      </nav>

      {/* ── Page Content ── */}
      <div className="flex-1 overflow-hidden relative">
        {renderPage()}
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#166534',
            border: '1px solid rgba(22,163,74,0.15)',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '600'
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
        }}
      />
    </div>
  );
}

