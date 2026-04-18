import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Navigation  
  activePage: 'chat',
  setActivePage: (page) => set({ activePage: page }),

  // Session
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  // Chat
  messages: [],
  isTyping: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, { ...msg, id: Date.now() + Math.random() }] })),
  clearMessages: () => set({ messages: [] }),
  setTyping: (v) => set({ isTyping: v }),

  // Market data
  marketData: {},
  setMarketData: (commodity, data) => set((s) => ({ marketData: { ...s.marketData, [commodity]: data } })),

  // Map state
  mapCommodity: 'corn',
  mapData: [],
  setMapCommodity: (c) => set({ mapCommodity: c }),
  setMapData: (d) => set({ mapData: d }),

  // Sidebar (mobile)
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  // Tools used in last query
  lastToolsUsed: [],
  setLastToolsUsed: (tools) => set({ lastToolsUsed: tools }),
}));

export default useStore;
