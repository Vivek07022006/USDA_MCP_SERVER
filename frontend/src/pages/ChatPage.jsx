import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import useStore from '../store';
import { getSocket, sendChatMessage, sendChatHTTP } from '../services/api';

// ─── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  { icon: '🐄', text: 'Feeder cattle price OKC on 4/13/2026', category: 'Livestock' },
  { icon: '🌽', text: 'What is the current corn price in Iowa?', category: 'Grains' },
  { icon: '🌱', text: 'Where should I sell soybeans for max profit from Kansas?', category: 'Profit' },
  { icon: '🌤️', text: 'What is the weather forecast for farming in Texas?', category: 'Weather' },
  { icon: '🥚', text: 'What is the current shell egg price?', category: 'Livestock' },
  { icon: '📊', text: 'USDA WASDE outlook for wheat 2026', category: 'Forecast' },
  { icon: '🍓', text: 'Strawberry market prices from AMS', category: 'Specialty' },
  { icon: '🚛', text: 'Transport cost from Iowa to Chicago for corn, 100 tons', category: 'Transport' },
];

// Tool source map for display
const TOOL_META = {
  get_ams_prices:     { label: 'USDA AMS', color: 'text-green-400', icon: '📡' },
  get_crop_prices:    { label: 'USDA NASS', color: 'text-blue-400', icon: '📊' },
  get_weather:        { label: 'OpenWeather', color: 'text-sky-400', icon: '🌤️' },
  get_soil_data:      { label: 'USDA WSS', color: 'text-amber-400', icon: '🌱' },
  get_transport_cost: { label: 'USDA Transport', color: 'text-purple-400', icon: '🚛' },
  calculate_profit:   { label: 'Profit Engine', color: 'text-emerald-400', icon: '💰' },
  get_price_history:  { label: 'USDA NASS', color: 'text-blue-400', icon: '📈' },
  get_crop_production:{ label: 'USDA NASS', color: 'text-blue-400', icon: '🌾' },
  get_wasde_report:   { label: 'USDA WASDE', color: 'text-orange-400', icon: '🌍' },
  get_ers_outlook:    { label: 'USDA ERS', color: 'text-yellow-400', icon: '🔮' },
  get_crop_forecast:  { label: 'Multi-Source', color: 'text-pink-400', icon: '📉' },
  get_market_locations: { label: 'USDA AMS', color: 'text-green-400', icon: '📍' },
};

// ─── Voice Input Hook ─────────────────────────────────────────────────────────
function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = useCallback((onResult) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Voice input not supported in this browser.'); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => { setIsListening(false); toast.error('Voice input error. Try again.'); };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };

  return { isListening, startListening, stopListening };
}

// ─── Message Components ───────────────────────────────────────────────────────
function UserMessage({ message }) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[80%]">
        <div className="chat-bubble-user px-4 py-3 text-sm text-white leading-relaxed">
          {message.text}
        </div>
        <div className="text-right text-xs text-gray-600 mt-1 pr-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function AIMessage({ message }) {
  const tools = message.toolsUsed || [];
  const responseTime = message.responseTime;

  return (
    <div className="flex gap-3 animate-fade-in">
      {/* Avatar */}
      <div className="flex-none w-8 h-8 rounded-xl bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-sm shadow-lg mt-1">
        🌾
      </div>
      <div className="flex-1 min-w-0">
        {/* Tools used banner */}
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tools.map((t, i) => {
              const meta = TOOL_META[t.toolName] || { label: t.toolName, color: 'text-gray-400', icon: '⚙️' };
              return (
                <span key={i} className={`tool-badge ${t.cached ? 'opacity-70 italic' : ''}`}>
                  <span>{meta.icon}</span>
                  <span className={meta.color}>{meta.label}</span>
                  {t.success ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-red-400">✗</span>
                  )}
                  {t.cached && <span className="text-gray-500">(cached)</span>}
                </span>
              );
            })}
          </div>
        )}
        {/* Message bubble */}
        <div className="chat-bubble-ai px-4 py-3 text-sm">
          <div className="ai-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.text}
            </ReactMarkdown>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center gap-3 mt-1 pl-1">
          <span className="text-xs text-gray-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {responseTime && (
            <span className="text-xs text-gray-700">
              {(responseTime / 1000).toFixed(1)}s
            </span>
          )}
          {message.blocked && (
            <span className="text-xs text-amber-600">🛡️ filtered</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-none w-8 h-8 rounded-xl bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-sm mt-1">
        🌾
      </div>
      <div className="chat-bubble-ai px-4 py-4 flex items-center gap-1">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
        <span className="ml-2 text-xs text-gray-500">Fetching USDA data…</span>
      </div>
    </div>
  );
}

// ─── Main ChatPage ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { messages, addMessage, isTyping, setTyping, sessionId, setLastToolsUsed } = useStore();
  const [input, setInput] = useState('');
  const [useWebSocket, setUseWebSocket] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef([]);
  const { isListening, startListening } = useVoiceInput();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Socket.IO listeners
  useEffect(() => {
    const sock = getSocket();

    sock.on('typing', ({ typing }) => setTyping(typing));

    sock.on('chat_response', (data) => {
      const aiMsg = {
  role: 'assistant',
  text: data.response,
  toolsUsed: data.toolsUsed || [],
  responseTime: data.responseTime,
  blocked: data.blocked,
  fallbackUsed: data.fallbackUsed,
  timestamp: Date.now(),
};
      addMessage(aiMsg);
      setTyping(false);
      setLastToolsUsed(data.toolsUsed || []);

      // Update conversation history for context
      historyRef.current.push(
        { role: 'model', parts: [{ text: data.response }] }
      );
    });

    sock.on('error', (err) => {
      toast.error(err.message || 'Server error. Please try again.');
      setTyping(false);
    });

    sock.on('connect_error', () => {
      setUseWebSocket(false);
    });
    sock.on('connect', () => {
  setUseWebSocket(true);
});

    return () => {
      sock.off('typing');
      sock.off('chat_response');
      sock.off('error');
      sock.off('connect_error');
    };
  }, [addMessage, setTyping, setLastToolsUsed]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    const userMsg = { role: 'user', text: text.trim(), timestamp: Date.now() };
    addMessage(userMsg);

    // Build history for Gemini context
    const history = historyRef.current.slice(-6);
    historyRef.current.push({ role: 'user', parts: [{ text: text.trim() }] });

    setInput('');
    setTyping(true);

    if (useWebSocket) {
      sendChatMessage({ message: text.trim(), sessionId, history });
    } else {
      // HTTP fallback
      try {
        const result = await sendChatHTTP({ message: text.trim(), sessionId, history });
        const aiMsg = {
          role: 'assistant',
          text: result.response,
          toolsUsed: result.data?.payload?.toolsUsed || [],
          responseTime: result.data?.payload?.responseTime,
          blocked: result.data?.payload?.blocked,
          timestamp: Date.now(),
        };
        addMessage(aiMsg);
        historyRef.current.push({ role: 'model', parts: [{ text: result.response }] });
      } catch (err) {
        toast.error('Failed to reach server. Please try again.');
      } finally {
        setTyping(false);
      }
    }
  }, [addMessage, setTyping, sessionId, useWebSocket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleVoice = () => {
    startListening((transcript) => {
      setInput(transcript);
      inputRef.current?.focus();
    });
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full">
      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isEmpty ? (
            <WelcomeScreen onPromptClick={(p) => sendMessage(p)} />
          ) : (
            <>
              {messages.map((msg) =>
                msg.role === 'user'
                  ? <UserMessage key={msg.id} message={msg} />
                  : <AIMessage key={msg.id} message={msg} />
              )}
              {isTyping && <TypingIndicator />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Bar ── */}
        <div className="flex-none p-4 border-t border-green-900/20">
          {/* Quick suggestions removed */}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Text input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about crop prices, weather, profit analysis, AMS reports…"
              rows={1}
              disabled={isTyping}
              className="input-agri flex-1 resize-none min-h-[44px] max-h-32 py-3"
              style={{ height: 'auto' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
              id="chat-input"
            />

            {/* Voice button */}
            <button
              type="button"
              onClick={handleVoice}
              title="Voice input"
              className={`flex-none w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 glass-card ${
                isListening ? 'bg-red-900/40 border-red-500/40 text-red-400 animate-pulse' : 'text-gray-400 hover:text-green-400 hover:border-green-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex-none w-11 h-11 rounded-xl bg-green-600 hover:bg-green-500 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg 
                className={`w-5 h-5 ${isTyping ? 'animate-pulse' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Welcome / Empty State ────────────────────────────────────────────────────
function WelcomeScreen({ onPromptClick }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 animate-fade-in">
      {/* Hero */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center text-4xl shadow-2xl shadow-green-900/50">
          🌾
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm shadow-lg">
          🤖
        </div>
      </div>

      <h1 className="font-display font-bold text-2xl md:text-3xl gradient-text text-center mb-2">
        AgriMCP AI Assistant
      </h1>
      <p className="text-gray-400 text-sm text-center max-w-md mb-8 leading-relaxed">
        Powered by real USDA data sources — AMS, NASS, ERS, WASDE. Ask me about crop prices,
        livestock markets, weather, profit analysis, and more.
      </p>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {[
          { icon: '📡', label: 'USDA AMS Live', desc: '9 commodities' },
          { icon: '📊', label: 'NASS QuickStats', desc: 'All states' },
          { icon: '🌤️', label: 'Live Weather', desc: '5-day forecast' },
          { icon: '💰', label: 'Profit Engine', desc: 'Multi-route' },
        ].map((s, i) => (
          <div key={i} className="glass-card px-4 py-2.5 rounded-xl text-center">
            <div className="text-xl mb-0.5">{s.icon}</div>
            <div className="text-xs font-medium text-green-300">{s.label}</div>
            <div className="text-xs text-gray-600">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Suggested prompts removed */}

      <p className="text-xs text-gray-700 mt-6 text-center">
        🔒 Secure • Real USDA data only • No mock prices
      </p>
    </div>
  );
}
