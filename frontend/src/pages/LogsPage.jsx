import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { fetchLogs } from '../services/api';

function ToolBadge({ name, success, cached }) {
  const icons = {
    get_ams_prices: '📡', get_crop_prices: '📊', get_weather: '🌤️',
    get_soil_data: '🌱', get_transport_cost: '🚛', calculate_profit: '💰',
    get_price_history: '📈', get_crop_production: '🌾', get_wasde_report: '🌍',
    get_ers_outlook: '🔮', get_crop_forecast: '📉', get_market_locations: '📍',
  };
  return (
    <span className={`tool-badge text-xs ${!success ? 'opacity-50' : ''}`}>
      {icons[name] || '⚙️'} {name.replace('get_', '').replace(/_/g, ' ')}
      {success ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
      {cached && <span className="text-gray-500 ml-0.5">⚡</span>}
    </span>
  );
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const toolCount = log.toolsUsed?.length || 0;
  const allSuccess = log.toolsUsed?.every((t) => t.success) ?? true;
  const date = new Date(log.timestamp);

  return (
    <div className={`glass-card rounded-xl overflow-hidden transition-all duration-200 ${expanded ? 'border-green-800/40' : ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
      >
        {/* Status indicator */}
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-none ${
          log.blocked ? 'bg-amber-500' : allSuccess ? 'bg-green-500' : 'bg-orange-500'
        }`} />

        {/* Query */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 truncate pr-2">{log.userQuery}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-gray-600">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {toolCount > 0 && (
              <span className="text-xs text-gray-600">{toolCount} tool{toolCount > 1 ? 's' : ''}</span>
            )}
            {log.responseTime && (
              <span className="text-xs text-gray-700">{(log.responseTime / 1000).toFixed(1)}s</span>
            )}
            {log.blocked && <span className="text-xs text-amber-600">🛡️ blocked</span>}
            {log.geminiModel && <span className="text-xs text-gray-700">{log.geminiModel}</span>}
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-600 flex-none mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3 animate-fade-in">
          {/* Tools used */}
          {log.toolsUsed?.length > 0 && (
            <div>
              <div className="text-xs text-gray-600 mb-1.5 font-medium uppercase tracking-wider">Tools Used</div>
              <div className="flex flex-wrap gap-1.5">
                {log.toolsUsed.map((t, i) => (
                  <ToolBadge key={i} name={t.toolName} success={t.success} cached={t.cached} />
                ))}
              </div>
            </div>
          )}
          {/* Response preview */}
          {log.response && (
            <div>
              <div className="text-xs text-gray-600 mb-1.5 font-medium uppercase tracking-wider">Response Preview</div>
              <div className="text-xs text-gray-400 glass-card rounded-lg px-3 py-2 leading-relaxed line-clamp-4">
                {log.response.substring(0, 300)}{log.response.length > 300 ? '…' : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [noMongo, setNoMongo] = useState(false);
  const [stats, setStats] = useState({ totalQueries: 0, successRate: 0, avgResponseTime: 0 });

  const loadLogs = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetchLogs({ page: p, limit: 15 });
      if (res.message?.includes('MongoDB')) { setNoMongo(true); setLogs([]); }
      else {
        setLogs(res.logs || []);
        setTotalPages(res.totalPages || 1);
        setTotal(res.total || 0);
        // Compute stats
        const logs = res.logs || [];
        const avgRt = logs.length > 0
          ? logs.reduce((s, l) => s + (l.responseTime || 0), 0) / logs.length
          : 0;
        const successCount = logs.filter((l) => !l.blocked && l.toolsUsed?.every((t) => t.success)).length;
        setStats({
          totalQueries: res.total || 0,
          successRate: logs.length > 0 ? ((successCount / logs.length) * 100).toFixed(0) : 0,
          avgResponseTime: (avgRt / 1000).toFixed(1),
        });
      }
    } catch {
      setNoMongo(true);
      toast.error('Could not load logs. MongoDB may be offline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(page); }, [page]);

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-green-900/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-xl gradient-text">Activity Logs</h2>
            <p className="text-gray-500 text-sm">MCP query observability — tools, timing, responses</p>
          </div>
          <button onClick={() => loadLogs(page)} className="glass-card px-4 py-2 rounded-xl text-xs text-green-400 hover:text-green-300 transition-colors">
            ↻ Refresh
          </button>
        </div>

        {/* Stats bar */}
        {!noMongo && (
          <div className="flex gap-4 mt-4">
            {[
              { label: 'Total Queries', value: stats.totalQueries, icon: '📊' },
              { label: 'Success Rate', value: `${stats.successRate}%`, icon: '✅' },
              { label: 'Avg Response', value: `${stats.avgResponseTime}s`, icon: '⏱️' },
            ].map((s, i) => (
              <div key={i} className="glass-card px-4 py-2.5 rounded-xl text-center flex items-center gap-2">
                <span className="text-lg">{s.icon}</span>
                <div>
                  <div className="text-lg font-bold text-green-300">{s.value}</div>
                  <div className="text-xs text-gray-600">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {noMongo && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🗄️</div>
            <div className="text-gray-300 font-medium mb-2">MongoDB Not Connected</div>
            <div className="text-gray-500 text-sm max-w-sm mx-auto">
              Activity logs require MongoDB. Start MongoDB locally or configure <code className="text-green-400">MONGODB_URI</code> in your .env file.
            </div>
          </div>
        )}

        {loading && !noMongo && (
          <div className="flex items-center justify-center h-40">
            <div className="text-green-400 animate-pulse">Loading logs…</div>
          </div>
        )}

        {!loading && !noMongo && logs.length === 0 && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">💬</div>
            <div className="text-gray-400">No queries logged yet. Start chatting!</div>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <div className="space-y-2">
            {logs.map((log) => <LogRow key={log._id} log={log} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="glass-card px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 transition"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="glass-card px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
