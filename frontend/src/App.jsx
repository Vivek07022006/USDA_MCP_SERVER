import React, { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import useStore from './store';
import ChatPage from './pages/ChatPage';
import MapPage from './pages/MapPage';
import LogsPage from './pages/LogsPage';
import { createSession, fetchHealth } from './services/api';

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
    <div className={`w-2 h-2 rounded-full ${status === 'ok' ? 'bg-green-400 shadow-green-400/60 shadow-sm' : 'bg-red-400'}`} 
         style={{ animation: status === 'ok' ? 'pulse 2s ease-in-out infinite' : 'none' }} />
  ),
};

const NAV_ITEMS = [
  { id: 'chat', label: 'AI Assistant', Icon: Icons.Chat },
  { id: 'map', label: 'Map Dashboard', Icon: Icons.Map },
];

export default function App() {
  const { activePage, setActivePage, setSessionId } = useStore();
  const [serverStatus, setServerStatus] = useState('checking');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Top Navigation ── */}
      <nav className="glass-card-dark border-b border-green-900/30 flex-none z-40">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-none">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center shadow-lg shadow-green-900/50">
                <Icons.Wheat />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-gray-950" />
            </div>
            <div className="hidden sm:block">
              <div className="font-display font-bold text-base gradient-text leading-tight">AgriMCP AI</div>
              <div className="text-gray-500 text-xs">USDA Smart Agriculture</div>
            </div>
          </div>

          {/* Center Nav */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1 glass-card p-1 rounded-2xl">
              {NAV_ITEMS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  id={`nav-${id}`}
                  onClick={() => { setActivePage(id); setMobileMenuOpen(false); }}
                  className={`nav-btn ${activePage === id ? 'active' : ''}`}
                >
                  <Icon />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right side removed per user request */}
        </div>
      </nav>

      {/* ── Page Content ── */}
      <div className="flex-1 overflow-hidden">
        {renderPage()}
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(5, 46, 22, 0.95)',
            color: '#dcfce7',
            border: '1px solid rgba(22,163,74,0.4)',
            borderRadius: '12px',
            backdropFilter: 'blur(12px)',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#052e16' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#052e16' } },
        }}
      />
    </div>
  );
}
