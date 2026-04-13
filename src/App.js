/* eslint-disable no-use-before-define */
import React, { useState, useEffect, useRef } from 'react';
import './App.css'; 
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart as RechartsPie, Pie, Cell, LineChart, Line } from 'recharts';
import { Activity, Wallet, Sparkles, X, ShoppingBag, Zap, Home, PieChart as PieChartIcon, LogOut, TrendingUp, Send, DollarSign, ArrowUpRight, ArrowDownRight, FileText, PanelLeftClose, PanelLeftOpen, Moon, Sun } from 'lucide-react';
import { io } from "socket.io-client";
import { signInWithGoogle, db } from './firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore'; 

// 🔌 SOCKET CONNECTION
const socket = io("http://localhost:5000", {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

const COLORS = {
  TSLA: '#d946ef', AAPL: '#3b82f6', NVDA: '#22c55e', MSFT: '#f59e0b',
  JPM: '#6366f1', GS: '#ec4899'
};
const OIL_COLOR = '#f97316';
const MACRO_COLORS = {
  SP500: '#0ea5e9',
  NASDAQCOM: '#8b5cf6',
  VIXCLS: '#ef4444',
  GOLDAMGBD228NLBM: '#eab308'
};
const MACRO_LABELS = {
  SP500: 'S&P 500',
  NASDAQCOM: 'Nasdaq',
  VIXCLS: 'VIX',
  GOLDAMGBD228NLBM: 'Gold'
};

const DEFAULT_WATCHLIST = ['TSLA', 'NVDA', 'AAPL', 'MSFT'];
const CHAT_WELCOME = {
  sender: 'bot',
  text: "Hello Yash! I am your **WealthOS AI Assistant**. 🤖\n\nI can help with:\n📈 Stock predictions\n📊 Expense analysis\n⚔️ Stock comparisons\n📈 SIP calculations\n🏛️ Tax tips\n🪙 Crypto insights\n🧮 Quick math\n\nType **\"Help\"** to see everything I can do!"
};

// ⭐ STAR BACKGROUND
const StarBackground = () => {
  const stars = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100 + '%',
    top: Math.random() * 100 + '%',
    delay: Math.random() * 5 + 's'
  }));
  return (
    <div className="star-container">
      {stars.map(s => (
        <div key={s.id} className="star" style={{ left: s.left, top: s.top, animationDelay: s.delay }} />
      ))}
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const firebaseUser = await signInWithGoogle();
    if (firebaseUser) {
      setUser(firebaseUser);
    } else {
      // 🚨 DEMO MODE BYPASS: If Firebase fails, we still let you in!
      setTimeout(() => {
        setUser({ displayName: "Yash P. Sinha", email: "demo@wealthos.com" });
      }, 1000);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div style={loginStyles.container}>
        <StarBackground />
        <div className="login-glass" style={loginStyles.card}>
          <div style={loginStyles.logoWrapper}><Activity size={48} color="#3b82f6" /></div>
          <h1 style={{ color: '#fff', fontSize: '32px', marginBottom: '10px' }}>WealthOS</h1>
          <button onClick={handleLogin} className="glow-btn" style={loginStyles.button}>
            {loading ? "Accessing Mainframe..." : "Initialize System"}
          </button>
        </div>
      </div>
    );
  }

  return <WealthDashboard user={user} logout={() => setUser(null)} />;
}

// 📊 MAIN DASHBOARD
const WealthDashboard = ({ user, logout }) => {
  const [masterData, setMasterData] = useState([]);
  const [visibleData, setVisibleData] = useState([]);
  const [timeRange, setTimeRange] = useState('1Y');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState(Object.keys(COLORS));
  const [pnlRange, setPnlRange] = useState('daily');
  
  // 🇮🇳 WALLET & EXPENSES
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [walletBalance, setWalletBalance] = useState(1250000);
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [realizedPnL, setRealizedPnL] = useState(0);
  const [expenses, setExpenses] = useState([
    { id: 1, category: 'Food', desc: 'Starbucks Indiranagar', amount: 450, time: '10:00 AM' },
    { id: 2, category: 'Travel', desc: 'Uber Premier', amount: 320, time: '09:15 AM' }
  ]);

  // 🤖 INTERACTIVE AI CHAT
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([CHAT_WELCOME]);
  const messagesEndRef = useRef(null);

  // ⭐ PRO TRADING UX STATE
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [favoriteSymbols, setFavoriteSymbols] = useState(['TSLA', 'NVDA']);
  const [alertSymbol, setAlertSymbol] = useState('TSLA');
  const [alertComparator, setAlertComparator] = useState('>');
  const [alertTarget, setAlertTarget] = useState('');
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [showOrderTicket, setShowOrderTicket] = useState(false);
  const [orderSide, setOrderSide] = useState('BUY');
  const [orderSymbol, setOrderSymbol] = useState('TSLA');
  const [orderQty, setOrderQty] = useState(1);
  const [orderFeePct, setOrderFeePct] = useState(0.2);
  
  // 🔥 FIREBASE SYNC: LOAD DATA ON MOUNT
  useEffect(() => {
    if (!user || user.email === "demo@wealthos.com") {
      setIsDataLoaded(true); // Skip actual firebase for demo users
      return;
    }
    const loadUserData = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.walletBalance !== undefined) setWalletBalance(data.walletBalance);
          if (data.holdings) setHoldings(data.holdings);
          if (data.transactions) setTransactions(data.transactions);
          if (data.expenses) setExpenses(data.expenses);
          if (data.realizedPnL !== undefined) setRealizedPnL(data.realizedPnL);
          if (data.watchlist) setWatchlist(data.watchlist);
          if (data.favoriteSymbols) setFavoriteSymbols(data.favoriteSymbols);
          if (data.priceAlerts) setPriceAlerts(data.priceAlerts);
          if (data.chatMessages && data.chatMessages.length > 0) setMessages(data.chatMessages);
        }
      } catch (err) {
        console.error("Error loading user data from Firestore:", err);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadUserData();
  }, [user]);

  // 🔥 FIREBASE SYNC: SAVE DATA ON CHANGE
  useEffect(() => {
    if (!isDataLoaded || !user || user.email === "demo@wealthos.com") return;
    
    // Slight debounce so it doesn't slam firestore on consecutive clicks
    const saveTimeout = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          walletBalance,
          holdings,
          transactions,
          expenses,
          realizedPnL,
          watchlist,
          favoriteSymbols,
          priceAlerts,
          chatMessages: messages,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Error saving user data to Firestore:", err);
      }
    }, 1000);
    
    return () => clearTimeout(saveTimeout);
  }, [walletBalance, holdings, transactions, expenses, realizedPnL, watchlist, favoriteSymbols, priceAlerts, messages, isDataLoaded, user]);

  // ✏️ MANUAL EXPENSE FORM STATE
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('Food');

  // 📰 NEWS & 📈 FORECAST STATES
  const [news, setNews] = useState([]);
  const [newsFeedSource, setNewsFeedSource] = useState('loading');
  const [forecastData, setForecastData] = useState({});
  const [oilRawSeries, setOilRawSeries] = useState([]);
  const [oilMeta, setOilMeta] = useState({ latest: null, changePct: null, name: 'WTI Crude Oil', currency: 'USD' });
  const [showOilOverlay, setShowOilOverlay] = useState(true);
  const [macroSnapshot, setMacroSnapshot] = useState({ source: 'loading', metrics: {} });
  const [macroOverlay, setMacroOverlay] = useState({ SP500: true, NASDAQCOM: false, VIXCLS: false, GOLDAMGBD228NLBM: false });
  const [showGlobalBriefing, setShowGlobalBriefing] = useState(true);
  const [isBriefingExpanded, setIsBriefingExpanded] = useState(true);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [serviceHealth, setServiceHealth] = useState({ node: 'checking', ml: 'checking' });
  const [serviceBanner, setServiceBanner] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const hasAutoBriefedRef = useRef(false);

  useEffect(() => {
    fetch('http://localhost:5001/news')
      .then(res => res.json())
      .then(data => {
        setNews(data.news || []);
        setNewsFeedSource(data.source || 'unknown');
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const rangeMap = { '1M': '1mo', '6M': '6mo', '1Y': '1y', '5Y': '1y' };
    const range = rangeMap[timeRange] || '1y';

    fetch(`http://localhost:5001/oil-history?range=${range}`)
      .then(res => res.json())
      .then(data => {
        const closes = Array.isArray(data?.series) ? data.series.map(p => Number(p.close)).filter(v => Number.isFinite(v) && v > 0) : [];
        if (closes.length < 2) {
          setOilRawSeries([]);
          return;
        }

        const base = closes[0] || 1;
        const normalized = closes.map(v => Number((((v - base) / base) * 100).toFixed(2)));
        setOilRawSeries(normalized);
        setOilMeta({
          latest: data?.latest ?? null,
          changePct: data?.changePct ?? null,
          name: data?.name || 'WTI Crude Oil',
          currency: data?.currency || 'USD'
        });
      })
      .catch(() => {
        setOilRawSeries([]);
      });
  }, [timeRange]);

  useEffect(() => {
    const rangeMap = { '1M': '1mo', '6M': '6mo', '1Y': '1y', '5Y': '1y' };
    const range = rangeMap[timeRange] || '1y';

    fetch(`http://localhost:5001/macro-snapshot?range=${range}`)
      .then(res => res.json())
      .then(data => {
        setMacroSnapshot({
          source: data?.source || 'unknown',
          metrics: data?.metrics || {}
        });
      })
      .catch(() => {
        setMacroSnapshot({ source: 'offline', metrics: {} });
      });
  }, [timeRange]);

  useEffect(() => {
    const pollHealth = async () => {
      const check = async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return 'down';
          return 'up';
        } catch {
          return 'down';
        }
      };

      const [node, ml] = await Promise.all([
        check('http://localhost:5000/health'),
        check('http://localhost:5001/health')
      ]);
      setServiceHealth({ node, ml });
    };

    pollHealth();
    const id = setInterval(pollHealth, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onConnect = () => setSocketStatus('connected');
    const onDisconnect = () => setSocketStatus('reconnecting');
    const onConnectError = () => setSocketStatus('reconnecting');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected) setSocketStatus('connected');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  useEffect(() => {
    const down = [];
    if (serviceHealth.node === 'down') down.push('Node API');
    if (serviceHealth.ml === 'down') down.push('Python ML');
    if (socketStatus !== 'connected') down.push('Live Market Socket');

    if (down.length > 0) {
      setServiceBanner(`⚠️ Reliability Notice: ${down.join(', ')} ${down.length > 1 ? 'are' : 'is'} currently degraded.`);
    } else {
      setServiceBanner('');
    }
  }, [serviceHealth, socketStatus]);

  const handlePredict = async (symbol) => {
    // Extract history for this symbol from visibleData
    const history = visibleData.map(d => d[symbol]).filter(v => v != null);
    try {
      const res = await fetch('http://localhost:5001/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history })
      });
      const data = await res.json();

      if (!Array.isArray(data?.forecast) || data.forecast.length === 0) {
        setServiceBanner(`⚠️ Forecast unavailable for ${symbol} right now. Try again shortly.`);
        return;
      }

      setForecastData(prev => ({
        ...prev,
        [symbol]: data.forecast
      }));
    } catch (e) {
      console.error(e);
      setServiceBanner(`⚠️ Forecast request failed for ${symbol}.`);
    }
  };

  const chartData = React.useMemo(() => {
    let result = [...visibleData];
    const keys = Object.keys(forecastData).filter(k => Array.isArray(forecastData[k]) && forecastData[k].length > 0);
    if (keys.length > 0 && result.length > 0) {
      const forecastLength = Math.max(...keys.map(k => forecastData[k].length));
      for (let i = 0; i < forecastLength; i++) {
        let row = { time: `Day ${i + 1}` };
        keys.forEach(k => {
          if (forecastData[k][i] !== undefined) {
            row[`${k}_F`] = forecastData[k][i];
          }
        });
        result.push(row);
      }
    }

    if (showOilOverlay && oilRawSeries.length > 0 && result.length > 0) {
      const targetLength = Math.min(visibleData.length, result.length);
      for (let i = 0; i < targetLength; i++) {
        const idx = targetLength <= 1
          ? 0
          : Math.round((i / (targetLength - 1)) * (oilRawSeries.length - 1));
        const value = oilRawSeries[idx];
        if (Number.isFinite(value)) {
          result[i] = { ...result[i], OIL: value };
        }
      }
    }

    const macroKeys = Object.keys(macroOverlay).filter(k => macroOverlay[k]);
    if (macroKeys.length > 0 && result.length > 0) {
      macroKeys.forEach(metricKey => {
        const metricSeries = macroSnapshot?.metrics?.[metricKey]?.series || [];
        const values = metricSeries.map(p => Number(p?.value)).filter(v => Number.isFinite(v) && v > 0);
        if (values.length < 2) return;

        const base = values[0] || 1;
        const normalized = values.map(v => Number((((v - base) / base) * 100).toFixed(2)));
        const targetLength = Math.min(visibleData.length, result.length);
        for (let i = 0; i < targetLength; i++) {
          const idx = targetLength <= 1 ? 0 : Math.round((i / (targetLength - 1)) * (normalized.length - 1));
          if (normalized[idx] !== undefined) {
            result[i] = { ...result[i], [`MACRO_${metricKey}`]: normalized[idx] };
          }
        }
      });
    }

    return result;
  }, [visibleData, forecastData, oilRawSeries, showOilOverlay, macroOverlay, macroSnapshot]);

  useEffect(() => {
    if (hasAutoBriefedRef.current) return;
    if (news.length === 0) return;

    const metricEntries = Object.entries(macroSnapshot.metrics || {}).filter(([, val]) => val && val.latest !== null).slice(0, 3);
    const macroLine = metricEntries.length > 0
      ? metricEntries.map(([key, val]) => `${MACRO_LABELS[key] || key}: ${Number(val.latest).toLocaleString('en-IN')} (${val.changePct >= 0 ? '+' : ''}${Number(val.changePct || 0).toFixed(2)}%)`).join(' | ')
      : 'Macro feed is loading. Oil and index overlays will appear shortly.';

    const topHoldings = holdings.slice(0, 3).map(h => h.symbol).join(', ') || 'No current holdings';
    const topNews = news.slice(0, 2).map(n => `• ${n.headline}`).join('\n');

    setMessages(prev => [
      ...prev,
      {
        sender: 'bot',
        text: `🌍 **Global Market Briefing**\n${topNews || '• Tracking live macro headlines'}\n\n📊 **Macro Pulse:** ${macroLine}\n💼 **Your Focus Holdings:** ${topHoldings}\n\nI can explain impact on your holdings — ask: **"How do war headlines impact my portfolio?"**`
      }
    ]);
    hasAutoBriefedRef.current = true;
  }, [news, macroSnapshot, holdings]);

  const totalSpentToday = expenses.reduce((a, b) => a + b.amount, 0);

  const toggleSymbol = (symbol) => {
    setSelectedSymbols(prev => {
      if (prev.includes(symbol)) {
        const filtered = prev.filter(s => s !== symbol);
        return filtered.length > 0 ? filtered : prev;
      }
      return [...prev, symbol];
    });
  };

  const statusTone = (status) => {
    if (status === 'up' || status === 'connected') {
      return { bg: '#dcfce7', fg: '#166534', label: 'Healthy' };
    }
    if (status === 'checking' || status === 'connecting') {
      return { bg: '#fef9c3', fg: '#854d0e', label: 'Checking' };
    }
    return { bg: '#fee2e2', fg: '#991b1b', label: 'Degraded' };
  };

  const getLatestPrice = React.useCallback((symbol) => {
    return masterData[masterData.length - 1]?.[symbol] || 0;
  }, [masterData]);

  const toggleFavorite = (symbol) => {
    setFavoriteSymbols(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
  };

  const orderedWatchlist = React.useMemo(() => {
    return [...watchlist].sort((a, b) => {
      const aFav = favoriteSymbols.includes(a) ? 1 : 0;
      const bFav = favoriteSymbols.includes(b) ? 1 : 0;
      return bFav - aFav;
    });
  }, [watchlist, favoriteSymbols]);

  const openOrderTicket = (side, symbol) => {
    setOrderSide(side);
    setOrderSymbol(symbol);
    setOrderQty(1);
    setShowOrderTicket(true);
  };

  const addPriceAlert = () => {
    const target = parseFloat(alertTarget);
    if (!alertSymbol || Number.isNaN(target) || target <= 0) return;

    setPriceAlerts(prev => [
      {
        id: Date.now(),
        symbol: alertSymbol,
        comparator: alertComparator,
        target,
        triggered: false,
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);
    setAlertTarget('');
  };

  const pnlTimelineData = React.useMemo(() => {
    const bucketCount = pnlRange === 'daily' ? 7 : pnlRange === 'weekly' ? 8 : 6;
    const now = new Date();
    const buckets = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const d = new Date(now);
      if (pnlRange === 'daily') d.setDate(now.getDate() - i);
      if (pnlRange === 'weekly') d.setDate(now.getDate() - i * 7);
      if (pnlRange === 'monthly') d.setMonth(now.getMonth() - i);

      const start = new Date(d);
      if (pnlRange === 'daily') {
        start.setHours(0, 0, 0, 0);
      } else if (pnlRange === 'weekly') {
        const day = start.getDay();
        start.setDate(start.getDate() - day);
        start.setHours(0, 0, 0, 0);
      } else {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      }

      const end = new Date(start);
      if (pnlRange === 'daily') end.setDate(end.getDate() + 1);
      if (pnlRange === 'weekly') end.setDate(end.getDate() + 7);
      if (pnlRange === 'monthly') end.setMonth(end.getMonth() + 1);

      let bucketRealized = 0;
      transactions.forEach(t => {
        const time = new Date(t.time);
        if (time >= start && time < end) {
          bucketRealized += t.type === 'SELL' ? Number(t.amount || 0) : -Number(t.amount || 0);
        }
      });

      const unrealized = holdings.reduce((sum, h) => {
        const current = getLatestPrice(h.symbol);
        return sum + (current * h.qty - h.totalInvested);
      }, 0);

      buckets.push({
        label: pnlRange === 'monthly' ? start.toLocaleDateString('en-IN', { month: 'short' }) : start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        realized: Number(bucketRealized.toFixed(2)),
        unrealized: Number(unrealized.toFixed(2))
      });
    }

    return buckets;
  }, [transactions, holdings, pnlRange, getLatestPrice]);

  useEffect(() => {
    if (masterData.length === 0 || priceAlerts.length === 0) return;

    setPriceAlerts(prev => {
      let changed = false;

      const next = prev.map(alert => {
        if (alert.triggered) return alert;
        const currentPrice = getLatestPrice(alert.symbol);
        const triggered = alert.comparator === '>' ? currentPrice > alert.target : currentPrice < alert.target;

        if (triggered) {
          changed = true;
          const msg = `🔔 Alert Triggered: ${alert.symbol} is now ₹${currentPrice.toFixed(2)} (${alert.comparator} ₹${alert.target})`;
          setMessages(m => [...m, { sender: 'bot', text: msg }]);

          fetch('http://localhost:5000/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stock: alert.symbol,
              price: currentPrice.toFixed(2),
              balance: walletBalance.toFixed(2),
              action: 'Alert',
              customMessage: `WealthOS Price Alert: ${alert.symbol} is ₹${currentPrice.toFixed(2)} (${alert.comparator} ₹${alert.target})`
            })
          }).catch(() => {});

          return { ...alert, triggered: true, triggeredAt: new Date().toISOString() };
        }

        return alert;
      });

      return changed ? next : prev;
    });
  }, [masterData, walletBalance, getLatestPrice, priceAlerts.length]);

  useEffect(() => {
    const convertToINR = (data) => {
      return data.map(point => {
        const newPoint = { ...point };
        Object.keys(COLORS).forEach(sym => {
          if (newPoint[sym]) newPoint[sym] = newPoint[sym] * 85; 
        });
        return newPoint;
      });
    };

    socket.on('marketHistory', (data) => setMasterData(convertToINR(data)));
    socket.on('marketPulse', (newData) => setMasterData(prev => [...prev, ...convertToINR(newData)]));
    return () => { socket.off('marketHistory'); socket.off('marketPulse'); };
  }, []);

  useEffect(() => {
    if (masterData.length === 0) return;
    const now = new Date();
    let cutoffDate = new Date();
    switch (timeRange) {
      case '1M': cutoffDate.setMonth(now.getMonth() - 1); break;
      case '6M': cutoffDate.setMonth(now.getMonth() - 6); break;
      case '1Y': cutoffDate.setFullYear(now.getFullYear() - 1); break;
      case '5Y': cutoffDate.setFullYear(now.getFullYear() - 5); break;
      default: cutoffDate.setFullYear(now.getFullYear() - 1);
    }
    const filtered = masterData.filter(pt => new Date(pt.time) > cutoffDate);
    
    // 🔥 Normalize to % change from first point so all stocks fit on same scale
    if (filtered.length > 0) {
      const baseline = filtered[0];
      const normalized = filtered.map(pt => {
        const newPt = { time: pt.time };
        Object.keys(COLORS).forEach(sym => {
          if (baseline[sym] && baseline[sym] !== 0) {
            newPt[sym] = parseFloat((((pt[sym] - baseline[sym]) / baseline[sym]) * 100).toFixed(2));
          } else {
            newPt[sym] = 0;
          }
        });
        return newPt;
      });
      setVisibleData(normalized);
    } else {
      setVisibleData(filtered);
    }
  }, [masterData, timeRange]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // 🤖 AI PREDICTION LOGIC
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg = { sender: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');

    const upperInput = userMsg.text.toUpperCase();
    const lowerInput = userMsg.text.toLowerCase();

    // 0. Trade Execution Command
    const buyMatch = upperInput.match(/BUY\s+([A-Z]+)/);
    const sellMatch = upperInput.match(/SELL\s+([A-Z]+)/);
    if (buyMatch && Object.keys(COLORS).includes(buyMatch[1])) {
      handleBuy(buyMatch[1]);
      return;
    }
    if (sellMatch && Object.keys(COLORS).includes(sellMatch[1])) {
      handleSell(sellMatch[1]);
      return;
    }

    // Keep local calculator reliability
    if (upperInput.includes('CALCULATE') || upperInput.includes('CALC') || lowerInput.match(/^\d[\d\s+\-*/().%]*$/)) {
      try {
        const expr = userMsg.text.replace(/[^0-9+\-*/().%\s]/g, '').replace(/%/g, '/100');
        if (expr.trim()) {
          // eslint-disable-next-line no-new-func
          const result = Function('"use strict";return (' + expr + ')')();
          setMessages(prev => [...prev, { sender: 'bot', text: `🧮 **Result:** ${userMsg.text.replace(/calculate\s*/i, '')} = **${Number(result).toLocaleString('en-IN')}**` }]);
        } else {
          setMessages(prev => [...prev, { sender: 'bot', text: "🧮 Give me a math expression like 'Calculate 50000 * 1.12'" }]);
        }
      } catch {
        setMessages(prev => [...prev, { sender: 'bot', text: "🧮 I couldn't compute that. Try a valid expression." }]);
      }
      return;
    }

    setIsChatLoading(true);
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          context: { walletBalance, holdings, expenses }
        }),
        signal: controller.signal
      });

      clearTimeout(t);

      if (!res.ok) {
        throw new Error(`Chat API failed: ${res.status}`);
      }

      const data = await res.json();
      const reply = data?.reply || '⚠️ AI is temporarily unavailable. Please try again.';
      setMessages(prev => [...prev, { sender: 'bot', text: reply, explainability: data?.explainability || [] }]);

      if (data?.action?.type) {
        const action = data.action;
        if (action.type === 'buy' && action.symbol) {
          openOrderTicket('BUY', action.symbol);
          setOrderQty(action.qty || 1);
        } else if (action.type === 'sell' && action.symbol) {
          openOrderTicket('SELL', action.symbol);
          setOrderQty(action.qty || 1);
        } else if (action.type === 'predict' && action.symbol) {
          await handlePredict(action.symbol);
        } else if (action.type === 'show_news') {
          setActiveTab('news');
        } else if (action.type === 'portfolio_summary') {
          setActiveTab('portfolio');
          const totalCurrent = holdings.reduce((sum, h) => sum + (getLatestPrice(h.symbol) * h.qty), 0);
          const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
          const pnl = totalCurrent - totalInvested;
          setMessages(prev => [...prev, {
            sender: 'bot',
            text: `📊 **Portfolio Snapshot**\n• Holdings: **${holdings.length}**\n• Invested: **₹${totalInvested.toLocaleString('en-IN', {maximumFractionDigits:0})}**\n• Current Value: **₹${totalCurrent.toLocaleString('en-IN', {maximumFractionDigits:0})}**\n• Unrealized P&L: **${pnl >= 0 ? '+' : ''}₹${pnl.toLocaleString('en-IN', {maximumFractionDigits:0})}**`
          }]);
        }
      }
      if (data?.fallback) {
        setServiceBanner('⚠️ Gemini is degraded. Running on reliability fallback response mode.');
      }
    } catch (err) {
      console.error('Chat Error:', err);
      setMessages(prev => [...prev, { sender: 'bot', text: '🔌 AI Engine is currently offline or timing out. Please try again in a moment.' }]);
      setServiceBanner('⚠️ Chat service is currently unstable. Check backend health status.');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleBuy = async (symbol, qty = 1) => {
    const price = masterData[masterData.length - 1]?.[symbol] || 0;
    const totalCost = price * qty;
    setWalletBalance(prev => prev - totalCost);
    setHoldings(prev => {
      const existing = prev.find(h => h.symbol === symbol);
      if (existing) {
        return prev.map(h => h.symbol === symbol ? { ...h, qty: h.qty + qty, totalInvested: h.totalInvested + totalCost } : h);
      }
      return [...prev, { symbol, qty, avgPrice: price, totalInvested: totalCost }];
    });
    setIsChatOpen(true);
    setMessages(prev => [...prev, { sender: 'bot', text: `🚀 **Trade Executed:** Purchased **${qty}** Unit(s) of **${symbol}** at ₹${price.toLocaleString('en-IN', {maximumFractionDigits:0})}.` }]);
    
    // Send SMS via Twilio
    try {
      await fetch('http://localhost:5000/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: symbol, price: price.toFixed(2), balance: (walletBalance - totalCost).toFixed(2), action: 'Buy' })
      });
    } catch (e) { console.log("SMS Error:", e); }
    
    // Log Transaction
    setTransactions(prev => [{ id: Date.now(), type: 'BUY', symbol, qty, price, amount: totalCost, time: new Date().toISOString() }, ...prev]);
  };

  const handleSell = async (symbol, qty = 1) => {
    const existing = holdings.find(h => h.symbol === symbol);
    if (!existing || existing.qty < qty) {
      alert(`You do not own enough shares of ${symbol} to sell ${qty} units.`);
      return;
    }
    const price = masterData[masterData.length - 1]?.[symbol] || 0;
    const proceeds = price * qty;
    setWalletBalance(prev => prev + proceeds);
    
    setHoldings(prev => {
      const h = prev.find(item => item.symbol === symbol);
      if (!h) return prev;
      const avgPrice = h.totalInvested / h.qty;
      const newQty = h.qty - qty;
      const newTotalInvested = h.totalInvested - (avgPrice * qty);
      if (newQty <= 0) {
        return prev.filter(item => item.symbol !== symbol);
      }
      return prev.map(item => item.symbol === symbol ? { ...item, qty: newQty, totalInvested: newTotalInvested } : item);
    });

    const avgPrice = existing.totalInvested / existing.qty;
    const realized = (price - avgPrice) * qty;
    setRealizedPnL(prev => prev + realized);
    
    setIsChatOpen(true);
    setMessages(prev => [...prev, { sender: 'bot', text: `💰 **Trade Executed:** Sold **${qty}** Unit(s) of **${symbol}** at ₹${price.toLocaleString('en-IN', {maximumFractionDigits:0})}.` }]);
    
    // Send SMS via Twilio
    try {
      await fetch('http://localhost:5000/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: symbol, price: price.toFixed(2), balance: (walletBalance + proceeds).toFixed(2), action: 'Sell' })
      });
    } catch (e) { console.log("SMS Error:", e); }
    
    // Log Transaction
    setTransactions(prev => [{ id: Date.now(), type: 'SELL', symbol, qty, price, amount: proceeds, time: new Date().toISOString() }, ...prev]);
  };

  const handlePlaceOrder = async () => {
    const qty = Math.max(1, Number(orderQty || 1));
    if (!orderSymbol) return;
    if (orderSide === 'BUY') await handleBuy(orderSymbol, qty);
    else await handleSell(orderSymbol, qty);
    setShowOrderTicket(false);
  };

  const addMockExpense = () => {
    const cost = 3500;
    setExpenses(prev => [{ id: Date.now(), category: 'Shopping', desc: 'Myntra Sneakers', amount: cost, time: 'Just Now' }, ...prev]);
    setWalletBalance(prev => prev - cost);
    setIsChatOpen(true);
    
    setMessages(prev => [...prev, { sender: 'bot', text: `📉 **Expense Detected:** ₹${cost} on Shopping.` }]);
    
    setTimeout(() => {
      const futureValue = (cost * Math.pow((1 + 0.15), 20)).toFixed(0);
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: `💡 **Wealth Insight:** Investing this ₹${cost} could have yielded **₹${Number(futureValue).toLocaleString('en-IN')}** in 20 years!` 
      }]);
    }, 1500);
  };

  // ✏️ ADD MANUAL EXPENSE
  const handleAddExpense = () => {
    const amount = parseFloat(newExpenseAmount);
    if (!newExpenseDesc.trim() || isNaN(amount) || amount <= 0) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    setExpenses(prev => [{ id: Date.now(), category: newExpenseCategory, desc: newExpenseDesc.trim(), amount, time: timeStr }, ...prev]);
    setWalletBalance(prev => prev - amount);
    setNewExpenseDesc('');
    setNewExpenseAmount('');
    setNewExpenseCategory('Food');
    setShowExpenseForm(false);
    setIsChatOpen(true);
    setMessages(prev => [...prev, { sender: 'bot', text: `📉 **Expense Logged:** ₹${amount.toLocaleString('en-IN')} on ${newExpenseCategory} — "${newExpenseDesc.trim()}"` }]);
  };

  return (
    <div className="dashboard-enter premium-shell" style={{ ...styles.container, background: isDarkMode ? '#020617' : '#f8fafc' }}>
      {/* SIDEBAR */}
      <aside className="premium-sidebar" style={{ ...styles.sidebar, width: isSidebarCollapsed ? '86px' : '260px', transition: 'width 0.25s ease' }}>
        <div style={{padding:'25px', display:'flex', alignItems:'center', gap:'12px'}}>
          <Activity color="#3b82f6" size={28} />
          {!isSidebarCollapsed && <h2 style={{color:'#fff', margin:0, fontSize:'20px'}}>WealthOS</h2>}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <div style={styles.menu}>
          <div onClick={()=>setActiveTab('dashboard')} style={activeTab === 'dashboard' ? styles.menuItemActive : styles.menuItem}><Home size={20}/>{!isSidebarCollapsed && 'Dashboard'}</div>
          <div onClick={()=>setActiveTab('portfolio')} style={activeTab === 'portfolio' ? styles.menuItemActive : styles.menuItem}><PieChartIcon size={20}/>{!isSidebarCollapsed && 'Portfolio'}</div>
          <div onClick={()=>setActiveTab('ledger')} style={activeTab === 'ledger' ? styles.menuItemActive : styles.menuItem}><FileText size={20}/>{!isSidebarCollapsed && 'Ledger & History'}</div>
          <div onClick={()=>setActiveTab('news')} style={activeTab === 'news' ? styles.menuItemActive : styles.menuItem}><Activity size={20}/>{!isSidebarCollapsed && 'Market News'}</div>
          <div onClick={()=>{ setActiveTab('dashboard'); setIsChatOpen(true); }} style={styles.menuItem}><Zap size={20}/>{!isSidebarCollapsed && 'AI Insights'}</div>
        </div>
        <div style={styles.userProfile}>
          <div style={styles.avatar}>{user.displayName ? user.displayName[0] : 'Y'}</div>
          {!isSidebarCollapsed && <div>
            <div style={{color:'#fff', fontWeight:'bold', fontSize:'14px'}}>{user.displayName || 'Guest'}</div>
            <div style={{color:'#94a3b8', fontSize:'11px'}}>Pro Member</div>
          </div>}
          <button onClick={logout} style={{marginLeft:'auto', background:'none', border:'none', cursor:'pointer'}}><LogOut color="#ef4444" size={18}/></button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="premium-main" style={{ ...styles.main, background: isDarkMode ? '#020617' : 'transparent' }}>
        <header className="premium-header" style={styles.header}>
          <div>
            <h1 style={{fontSize:'26px', fontWeight:'800', margin:0, color: isDarkMode ? '#e2e8f0' : '#1e293b'}}>Welcome back, Yash 👋</h1>
            <p style={{color: isDarkMode ? '#94a3b8' : '#64748b', margin:0}}>Your financial intelligence terminal is active.</p>
          </div>
          <div style={styles.headerActions}>
             <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
               <span style={{fontSize:'11px', fontWeight:700, borderRadius:'999px', padding:'6px 10px', background: statusTone(serviceHealth.node).bg, color: statusTone(serviceHealth.node).fg}}>
                 Node: {statusTone(serviceHealth.node).label}
               </span>
               <span style={{fontSize:'11px', fontWeight:700, borderRadius:'999px', padding:'6px 10px', background: statusTone(serviceHealth.ml).bg, color: statusTone(serviceHealth.ml).fg}}>
                 ML: {statusTone(serviceHealth.ml).label}
               </span>
               <span style={{fontSize:'11px', fontWeight:700, borderRadius:'999px', padding:'6px 10px', background: statusTone(socketStatus).bg, color: statusTone(socketStatus).fg}}>
                 Socket: {statusTone(socketStatus).label}
               </span>
             </div>
             <button
               onClick={() => setIsDarkMode(!isDarkMode)}
               style={{
                 border: 'none',
                 borderRadius: '10px',
                 padding: '10px',
                 cursor: 'pointer',
                 background: isDarkMode ? '#0f172a' : '#e2e8f0',
                 color: isDarkMode ? '#f8fafc' : '#0f172a'
               }}
             >
               {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
             </button>
             <div style={styles.walletBadge}>
                <Wallet size={18} color="#fff"/> 
                <span>₹{walletBalance.toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
             </div>
          </div>
        </header>

        {activeTab === 'dashboard' && showGlobalBriefing && (
          <section style={{
            marginBottom: '14px',
            border: '1px solid #dbeafe',
            borderRadius: '14px',
            background: '#f8fbff',
            boxShadow: '0 10px 24px rgba(30,64,175,0.08)'
          }}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom: isBriefingExpanded ? '1px solid #dbeafe' : 'none'}}>
              <button
                onClick={() => setIsBriefingExpanded(prev => !prev)}
                style={{border:'none', background:'transparent', cursor:'pointer', color:'#1e3a8a', fontWeight:800, fontSize:'13px'}}
              >
                {isBriefingExpanded ? '▼' : '▶'} Global Briefing Dropdown — what's happening and how your portfolio may react
              </button>
              <button
                onClick={() => setShowGlobalBriefing(false)}
                style={{border:'none', background:'transparent', cursor:'pointer', color:'#64748b', fontWeight:700, fontSize:'12px'}}
              >
                Hide
              </button>
            </div>
            {isBriefingExpanded && (
              <div style={{padding:'12px 14px'}}>
                <div style={{display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:'12px'}}>
                  <div style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'10px'}}>
                    <div style={{fontSize:'12px', color:'#475569', marginBottom:'8px', fontWeight:700}}>World events impacting markets now</div>
                    <div style={{display:'grid', gap:'8px'}}>
                      {news.slice(0, 3).map((n, idx) => (
                        <div key={`brief-news-${idx}`} style={{fontSize:'12px', color:'#0f172a'}}>
                          <strong>{n.topic || 'Markets'}</strong> — {n.headline}
                        </div>
                      ))}
                      {news.length === 0 && (
                        <div style={{fontSize:'12px', color:'#64748b'}}>Loading global market developments...</div>
                      )}
                    </div>
                  </div>
                  <div style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'10px'}}>
                    <div style={{fontSize:'12px', color:'#475569', marginBottom:'8px', fontWeight:700}}>Live macro snapshot ({macroSnapshot.source})</div>
                    <div style={{display:'grid', gap:'6px'}}>
                      {Object.entries(macroSnapshot.metrics || {}).slice(0, 4).map(([key, m]) => (
                        <div key={`macro-${key}`} style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}>
                          <span style={{color:'#334155'}}>{MACRO_LABELS[key] || key}</span>
                          <span style={{fontWeight:700, color: Number(m?.changePct || 0) >= 0 ? '#15803d' : '#b91c1c'}}>
                            {m?.latest !== null ? Number(m.latest).toLocaleString('en-IN') : '--'} ({Number(m?.changePct || 0) >= 0 ? '+' : ''}{Number(m?.changePct || 0).toFixed(2)}%)
                          </span>
                        </div>
                      ))}
                      {Object.keys(macroSnapshot.metrics || {}).length === 0 && (
                        <div style={{fontSize:'12px', color:'#64748b'}}>Macro feed loading...</div>
                      )}
                    </div>
                  </div>
                </div>
                {masterData.length === 0 && (
                  <div style={{marginTop:'10px', fontSize:'12px', color:'#1d4ed8', fontWeight:700}}>
                    ⏳ Graph is loading... AI briefing is active with global context in the meantime.
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <section className="premium-kpi-strip" style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          marginBottom: '20px',
          padding: '12px',
          borderRadius: '14px',
          border: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
          background: isDarkMode ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
          gap: '10px'
        }}>
          <div style={styles.kpiCard}><span style={styles.kpiLabel}>Wallet</span><strong>₹{walletBalance.toLocaleString('en-IN', {maximumFractionDigits:0})}</strong></div>
          <div style={styles.kpiCard}><span style={styles.kpiLabel}>Holdings</span><strong>{holdings.length}</strong></div>
          <div style={styles.kpiCard}><span style={styles.kpiLabel}>Spent Today</span><strong>₹{totalSpentToday.toLocaleString('en-IN')}</strong></div>
          <div style={styles.kpiCard}><span style={styles.kpiLabel}>Trades</span><strong>{transactions.length}</strong></div>
        </section>

        {serviceBanner && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid #fecaca',
            background: '#fff1f2',
            color: '#9f1239',
            fontSize: '13px',
            fontWeight: 600
          }}>
            {serviceBanner}
          </div>
        )}

        {activeTab === 'dashboard' && (
        <div style={styles.grid}>
          {/* 📈 CHART CARD */}
          <div className="hover-scale premium-glass premium-hero" style={{...styles.glassCard, gridColumn: 'span 2'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
              <div>
                <h3 style={{margin:0}}>Market Overview (% Change)</h3>
                <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#22c55e', marginTop:'5px'}}>
                   <div className="pulse-dot" style={{width:'8px', height:'8px', background:'#22c55e', borderRadius:'50%'}}></div> LIVE
                </div>
              </div>
              <div style={styles.timeSelector}>
                 {['1M','6M','1Y','5Y'].map(r => 
                   <button key={r} onClick={()=>setTimeRange(r)} style={timeRange === r ? styles.timeBtnActive : styles.timeBtn}>{r}</button>
                 )}
               </div>
            </div>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', gap:'10px', flexWrap:'wrap'}}>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                {Object.keys(COLORS).map(sym => (
                  <button
                    key={`chip-${sym}`}
                    onClick={() => toggleSymbol(sym)}
                    style={{
                      border: '1px solid #cbd5e1',
                      padding: '5px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      background: selectedSymbols.includes(sym) ? COLORS[sym] : '#fff',
                      color: selectedSymbols.includes(sym) ? '#fff' : '#475569'
                    }}
                  >
                    {sym}
                  </button>
                ))}
                <button
                  onClick={() => setShowOilOverlay(prev => !prev)}
                  style={{
                    border: '1px solid #fdba74',
                    padding: '5px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    background: showOilOverlay ? OIL_COLOR : '#fff7ed',
                    color: showOilOverlay ? '#fff' : '#9a3412'
                  }}
                >
                  OIL (WTI)
                </button>
                {Object.keys(MACRO_COLORS).map(metricKey => (
                  <button
                    key={`macro-chip-${metricKey}`}
                    onClick={() => setMacroOverlay(prev => ({ ...prev, [metricKey]: !prev[metricKey] }))}
                    style={{
                      border: `1px solid ${MACRO_COLORS[metricKey]}`,
                      padding: '5px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      background: macroOverlay[metricKey] ? MACRO_COLORS[metricKey] : '#fff',
                      color: macroOverlay[metricKey] ? '#fff' : '#334155'
                    }}
                  >
                    {MACRO_LABELS[metricKey]}
                  </button>
                ))}
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'10px', fontSize:'12px', color:'#64748b'}}>
                <span style={{display:'inline-flex', alignItems:'center', gap:'6px'}}><span style={{width:16, height:2, background:'#334155', display:'inline-block'}}/> Historical</span>
                <span style={{display:'inline-flex', alignItems:'center', gap:'6px'}}><span style={{width:16, height:2, borderTop:'2px dashed #334155', display:'inline-block'}}/> Forecast</span>
                {showOilOverlay && (
                  <span style={{display:'inline-flex', alignItems:'center', gap:'6px', color:'#9a3412'}}>
                    <span style={{width:16, height:2, background:OIL_COLOR, display:'inline-block'}}/> Oil {oilMeta.latest ? `${oilMeta.currency} ${Number(oilMeta.latest).toFixed(2)}` : ''}
                  </span>
                )}
                {Object.keys(MACRO_COLORS).filter(metricKey => macroOverlay[metricKey]).map(metricKey => (
                  <span key={`macro-legend-${metricKey}`} style={{display:'inline-flex', alignItems:'center', gap:'6px', color:'#334155'}}>
                    <span style={{width:16, height:2, background:MACRO_COLORS[metricKey], display:'inline-block'}}/> {MACRO_LABELS[metricKey]}
                  </span>
                ))}
              </div>
            </div>

            <div style={{height:'350px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    {selectedSymbols.map(sym => (
                      <linearGradient key={sym} id={`grad-${sym}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[sym]} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={COLORS[sym]} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                    <linearGradient id="grad-oil" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={OIL_COLOR} stopOpacity={0.14}/>
                      <stop offset="95%" stopColor={OIL_COLOR} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="time" hide/>
                  {/* 🔥 FIX: AUTO SCALE = MOUNTAIN-SHAPED LINES */}
                  <YAxis 
                    orientation="right" 
                    tickFormatter={(v)=>`${v > 0 ? '+' : ''}${v.toFixed(0)}%`} 
                    domain={['dataMin - 5', 'dataMax + 5']} 
                    stroke="#94a3b8" 
                    fontSize={12}
                    width={60}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 20px rgba(0,0,0,0.1)'}}
                    formatter={(value, name) => [`${value > 0 ? '+' : ''}${Number(value).toFixed(2)}%`, name]}   
                    labelFormatter={(label) => `📅 ${label}`}
                  />
                  <Legend />
                  {selectedSymbols.map((sym) => (
                    <Area 
                      key={sym} 
                      type="monotone" 
                      dataKey={sym} 
                      stroke={COLORS[sym]} 
                      fill={`url(#grad-${sym})`} 
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  {selectedSymbols.map((sym) => (
                    <Area 
                      key={`${sym}_F`} 
                      type="monotone" 
                      dataKey={`${sym}_F`} 
                      stroke={COLORS[sym]} 
                      strokeDasharray="5 5"
                      fill="none" 
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  {showOilOverlay && (
                    <Area
                      key="OIL"
                      type="monotone"
                      dataKey="OIL"
                      stroke={OIL_COLOR}
                      fill="url(#grad-oil)"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {Object.keys(MACRO_COLORS).filter(metricKey => macroOverlay[metricKey]).map(metricKey => (
                    <Area
                      key={`MACRO_${metricKey}`}
                      type="monotone"
                      dataKey={`MACRO_${metricKey}`}
                      stroke={MACRO_COLORS[metricKey]}
                      fill="none"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
               {['NVDA', 'TSLA', 'AAPL'].map(s => (
                 <React.Fragment key={s}>
                   <button onClick={()=>handleBuy(s)} style={styles.actionBtn}>
                      <TrendingUp size={16}/> BUY {s}
                   </button>
             <button onClick={()=>openOrderTicket('BUY', s)} style={{...styles.actionBtn, background:'#f8fafc', border:'1px solid #cbd5e1', color:'#0f172a'}}>
               🧾 Ticket
             </button>
                   <button onClick={()=>handlePredict(s)} style={{...styles.actionBtn, background:'#d946ef', color:'#fff', border:'none'}}>
                      🔮 Predict {s}
                   </button>
                 </React.Fragment>
               ))}
            </div>
          </div>

          {/* ⭐ WATCHLIST + ALERTS */}
          <div className="hover-scale premium-glass" style={styles.glassCard}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
              <h3 style={{margin:0}}>Watchlist & Alerts</h3>
              <span style={{fontSize:'11px', color:'#64748b'}}>{watchlist.length} symbols</span>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'8px', marginBottom:'14px'}}>
              {orderedWatchlist.map(sym => {
                const price = getLatestPrice(sym);
                return (
                  <div key={sym} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:'10px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <button onClick={() => toggleFavorite(sym)} style={{border:'none', background:'transparent', cursor:'pointer', fontSize:'15px'}}>
                        {favoriteSymbols.includes(sym) ? '⭐' : '☆'}
                      </button>
                      <strong style={{fontSize:'13px'}}>{sym}</strong>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <span style={{fontSize:'12px', color:'#334155'}}>₹{price.toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                      <button onClick={() => openOrderTicket('BUY', sym)} style={{fontSize:'10px', border:'none', borderRadius:'6px', background:'#2563eb', color:'#fff', padding:'4px 8px', cursor:'pointer'}}>Buy</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{padding:'10px', borderRadius:'10px', background:'#f8fafc', border:'1px solid #e2e8f0'}}>
              <div style={{fontWeight:700, fontSize:'12px', color:'#334155', marginBottom:'8px'}}>Price Alert</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr auto', gap:'6px', alignItems:'center'}}>
                <select value={alertSymbol} onChange={(e) => setAlertSymbol(e.target.value)} style={{padding:'6px', borderRadius:'7px', border:'1px solid #cbd5e1', fontSize:'12px'}}>
                  {Object.keys(COLORS).map(sym => <option key={sym} value={sym}>{sym}</option>)}
                </select>
                <select value={alertComparator} onChange={(e) => setAlertComparator(e.target.value)} style={{padding:'6px', borderRadius:'7px', border:'1px solid #cbd5e1', fontSize:'12px'}}>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                </select>
                <input value={alertTarget} onChange={(e) => setAlertTarget(e.target.value)} type="number" placeholder="Target" style={{padding:'6px', borderRadius:'7px', border:'1px solid #cbd5e1', fontSize:'12px'}} />
                <button onClick={addPriceAlert} style={{padding:'7px 10px', border:'none', borderRadius:'7px', background:'#0f172a', color:'#fff', fontSize:'11px', cursor:'pointer'}}>Set</button>
              </div>
              <div style={{marginTop:'8px', maxHeight:'86px', overflowY:'auto'}}>
                {priceAlerts.slice(0, 4).map(a => (
                  <div key={a.id} style={{fontSize:'11px', color: a.triggered ? '#16a34a' : '#475569', marginBottom:'4px'}}>
                    {a.symbol} {a.comparator} ₹{a.target} {a.triggered ? '✅ triggered' : '⏳ pending'}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 💸 EXPENSE CARD */}
          <div className="hover-scale premium-glass" style={styles.glassCard}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
              <h3 style={{margin:0}}>Recent Expenses</h3>
              <div style={{display:'flex', gap:'6px'}}>
                <button onClick={()=>setShowExpenseForm(!showExpenseForm)} style={{...styles.addBtn, background: showExpenseForm ? '#ef4444' : '#2563eb'}}>{showExpenseForm ? '✕ Cancel' : '+ Add'}</button>
                <button onClick={addMockExpense} style={styles.addBtn}>+ Demo</button>
              </div>
            </div>
            
            {/* ✏️ MANUAL EXPENSE FORM */}
            {showExpenseForm && (
              <div style={{background:'#f8fafc', borderRadius:'12px', padding:'12px', marginBottom:'15px', border:'1px solid #e2e8f0'}}>
                <input 
                  style={{width:'100%', padding:'8px 10px', borderRadius:'8px', border:'1px solid #e2e8f0', outline:'none', fontSize:'13px', marginBottom:'8px', boxSizing:'border-box'}} 
                  placeholder="Description (e.g. Zomato Order)" 
                  value={newExpenseDesc} 
                  onChange={e => setNewExpenseDesc(e.target.value)}
                />
                <div style={{display:'flex', gap:'8px', marginBottom:'8px'}}>
                  <input 
                    style={{flex:1, padding:'8px 10px', borderRadius:'8px', border:'1px solid #e2e8f0', outline:'none', fontSize:'13px'}} 
                    type="number" 
                    placeholder="₹ Amount" 
                    value={newExpenseAmount} 
                    onChange={e => setNewExpenseAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                  />
                  <select 
                    style={{padding:'8px 10px', borderRadius:'8px', border:'1px solid #e2e8f0', outline:'none', fontSize:'13px', background:'#fff', cursor:'pointer'}} 
                    value={newExpenseCategory} 
                    onChange={e => setNewExpenseCategory(e.target.value)}
                  >
                    <option>Food</option>
                    <option>Travel</option>
                    <option>Shopping</option>
                    <option>Bills</option>
                    <option>Entertainment</option>
                    <option>Health</option>
                    <option>Other</option>
                  </select>
                </div>
                <button 
                  onClick={handleAddExpense} 
                  style={{width:'100%', padding:'9px', background:'#2563eb', color:'#fff', border:'none', borderRadius:'8px', fontWeight:'bold', fontSize:'13px', cursor:'pointer'}}
                >
                  Add Expense
                </button>
              </div>
            )}
            <div style={{overflowY:'auto', height:'320px'}}>
              {expenses.map(exp => (
                <div key={exp.id} style={styles.expenseItem}>
                  <div style={styles.iconBox}><ShoppingBag size={18}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:'bold', color:'#334155'}}>{exp.desc}</div>
                    <div style={{fontSize:'11px', color:'#94a3b8'}}>{exp.time}</div>
                  </div>
                  <div style={{color:'#ef4444', fontWeight:'bold'}}>- ₹{exp.amount}</div>
                </div>
              ))}
            </div>
            <div style={styles.totalBox}>
              Total Spent Today: <span style={{color:'#0f172a'}}>₹{expenses.reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
            </div>
          </div>
        </div>
        )}

        {/* 📰 NEWS TAB */}
        {activeTab === 'news' && (
          <div className="hover-scale premium-glass" style={styles.glassCard}>
            <h2 style={{marginTop:0, marginBottom:'20px'}}>Live Market Headlines</h2>
            <div style={{marginBottom:'14px', padding:'10px 12px', borderRadius:'10px', background:'#eff6ff', color:'#1e3a8a', fontSize:'12px', fontWeight:600}}>
              📡 Real-time exchange headlines and macro events • Feed: {newsFeedSource}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              {news.length > 0 ? news.map((n, i) => (
                <div key={i} style={{
                  padding:'20px', 
                  borderRadius:'12px', 
                  background: '#f8fafc', 
                  borderLeft: '8px solid #3b82f6'
                }}>
                  <div style={{fontWeight:'700', fontSize:'16px', color:'#1e293b'}}>{n.headline}</div>
                  <div style={{fontSize:'11px', color:'#64748b', marginTop:'8px'}}>
                    {(n.source || 'market feed')} • {n.publishedAt || 'latest'}
                  </div>
                  <div style={{fontSize:'13px', color:'#1d4ed8', marginTop:'8px', fontWeight:'600'}}>
                    Topic: {n.topic || 'Markets'}
                  </div>
                  {n.impact && (
                    <div style={{fontSize:'13px', color:'#334155', marginTop:'8px', lineHeight:1.5}}>
                      <strong>Likely effect:</strong> {n.impact}
                    </div>
                  )}
                  {n.url && (
                    <a href={n.url} target="_blank" rel="noreferrer" style={{display:'inline-block', marginTop:'10px', fontSize:'12px', color:'#1d4ed8', fontWeight:700}}>
                      Read full story ↗
                    </a>
                  )}
                </div>
              )) : <div>Loading global financial streams...</div>}
            </div>
          </div>
        )}

        {/* 📋 PORTFOLIO TAB */}
        {activeTab === 'portfolio' && (
        <div>
          {/* Portfolio Summary Cards */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'20px', marginBottom:'25px'}}>
            {(() => {
              const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
              const totalCurrent = holdings.reduce((sum, h) => {
                const currentPrice = masterData[masterData.length - 1]?.[h.symbol] || 0;
                return sum + (currentPrice * h.qty);
              }, 0);
              const totalPL = totalCurrent - totalInvested;
              const plPercent = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(2) : '0.00';
              return (
                <>
                  <div className="hover-scale premium-glass" style={styles.glassCard}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div>
                        <div style={{color:'#64748b', fontSize:'12px', fontWeight:'600', marginBottom:'4px'}}>Total Invested</div>
                        <div style={{fontSize:'24px', fontWeight:'800', color:'#0f172a'}}>₹{totalInvested.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
                      </div>
                      <div style={{width:'44px', height:'44px', background:'#eff6ff', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <DollarSign size={22} color="#2563eb"/>
                      </div>
                    </div>
                  </div>
                  <div className="hover-scale premium-glass" style={styles.glassCard}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div>
                        <div style={{color:'#64748b', fontSize:'12px', fontWeight:'600', marginBottom:'4px'}}>Current Value</div>
                        <div style={{fontSize:'24px', fontWeight:'800', color:'#0f172a'}}>₹{totalCurrent.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
                      </div>
                      <div style={{width:'44px', height:'44px', background:'#f0fdf4', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <TrendingUp size={22} color="#22c55e"/>
                      </div>
                    </div>
                  </div>
                  <div className="hover-scale premium-glass" style={styles.glassCard}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div>
                        <div style={{color:'#64748b', fontSize:'12px', fontWeight:'600', marginBottom:'4px'}}>Total P&L</div>
                        <div style={{fontSize:'24px', fontWeight:'800', color: totalPL >= 0 ? '#22c55e' : '#ef4444'}}>
                          {totalPL >= 0 ? '+' : ''}₹{totalPL.toLocaleString('en-IN', {maximumFractionDigits:0})}
                          <span style={{fontSize:'13px', fontWeight:'600', marginLeft:'6px'}}>({plPercent}%)</span>
                        </div>
                      </div>
                      <div style={{width:'44px', height:'44px', background: totalPL >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        {totalPL >= 0 ? <ArrowUpRight size={22} color="#22c55e"/> : <ArrowDownRight size={22} color="#ef4444"/>}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'25px'}}>
            {/* Holdings Table */}
            <div className="hover-scale premium-glass" style={styles.glassCard}>
              <h3 style={{margin:'0 0 20px 0'}}>Your Holdings</h3>
              {holdings.length === 0 ? (
                <div style={{textAlign:'center', padding:'60px 20px', color:'#94a3b8'}}>
                  <TrendingUp size={48} color="#cbd5e1" style={{marginBottom:'15px'}}/>
                  <div style={{fontSize:'16px', fontWeight:'600', color:'#64748b', marginBottom:'8px'}}>No Holdings Yet</div>
                  <div style={{fontSize:'13px'}}>Go to Dashboard and buy some stocks to build your portfolio!</div>
                  <button onClick={()=>setActiveTab('dashboard')} style={{...styles.actionBtn, marginTop:'20px', maxWidth:'200px', margin:'20px auto 0'}}>
                    <Home size={16}/> Go to Dashboard
                  </button>
                </div>
              ) : (
                <div>
                  {/* Table Header */}
                  <div className="premium-table-head" style={{display:'grid', gridTemplateColumns:'1.5fr 0.8fr 1fr 1fr 1fr 1fr', padding:'10px 0', borderBottom:'2px solid #e2e8f0', fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px'}}>
                    <div>Stock</div>
                    <div style={{textAlign:'center'}}>Qty</div>
                    <div style={{textAlign:'right'}}>Avg Price</div>
                    <div style={{textAlign:'right'}}>Current</div>
                    <div style={{textAlign:'right'}}>P&L</div>
                    <div style={{textAlign:'right'}}>Action</div>
                  </div>
                  {/* Table Rows */}
                  {holdings.map(h => {
                    const currentPrice = masterData[masterData.length - 1]?.[h.symbol] || 0;
                    const avgPrice = h.totalInvested / h.qty;
                    const pl = (currentPrice - avgPrice) * h.qty;
                    const plPercent = ((currentPrice - avgPrice) / avgPrice * 100).toFixed(2);
                    return (
                      <div className="premium-table-row" key={h.symbol} style={{display:'grid', gridTemplateColumns:'1.5fr 0.8fr 1fr 1fr 1fr 1fr', padding:'14px 0', borderBottom:'1px solid #f1f5f9', alignItems:'center'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                          <div style={{width:'32px', height:'32px', borderRadius:'8px', background: COLORS[h.symbol] || '#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'11px', fontWeight:'800'}}>
                            {h.symbol.slice(0,2)}
                          </div>
                          <div>
                            <div style={{fontWeight:'700', color:'#0f172a', fontSize:'14px'}}>{h.symbol}</div>
                            <div style={{fontSize:'11px', color:'#94a3b8'}}>Equity</div>
                          </div>
                        </div>
                        <div style={{textAlign:'center', fontWeight:'600', color:'#334155'}}>{h.qty}</div>
                        <div style={{textAlign:'right', color:'#64748b', fontSize:'13px'}}>₹{avgPrice.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
                        <div style={{textAlign:'right', fontWeight:'600', color:'#0f172a', fontSize:'13px'}}>₹{currentPrice.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontWeight:'700', color: pl >= 0 ? '#22c55e' : '#ef4444', fontSize:'13px'}}>
                            {pl >= 0 ? '+' : ''}₹{pl.toLocaleString('en-IN', {maximumFractionDigits:0})}
                          </div>
                          <div style={{fontSize:'11px', color: pl >= 0 ? '#22c55e' : '#ef4444'}}>
                            {pl >= 0 ? '↑' : '↓'} {plPercent}%
                          </div>
                        </div>
                        <div style={{textAlign:'right', display:'flex', justifyContent:'flex-end', gap:'5px'}}>
                          <button onClick={()=>handleSell(h.symbol)} style={{background:'#ef4444', color:'#fff', border:'none', padding:'4px 10px', borderRadius:'6px', fontSize:'11px', fontWeight:'bold', cursor:'pointer' }}>
                            Sell
                          </button>
                          <button onClick={()=>handleBuy(h.symbol)} style={{background:'#2563eb', color:'#fff', border:'none', padding:'4px 10px', borderRadius:'6px', fontSize:'11px', fontWeight:'bold', cursor:'pointer' }}>
                            Buy
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Buy from Portfolio */}
              {holdings.length > 0 && (
                <div style={{marginTop:'20px', display:'flex', gap:'10px', flexWrap:'wrap'}}>
                  {Object.keys(COLORS).map(s => (
                    <button key={s} onClick={()=>handleBuy(s)} style={{...styles.actionBtn, flex:'none', padding:'8px 16px', fontSize:'12px'}}>
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Allocation Pie Chart */}
            <div className="hover-scale premium-glass" style={styles.glassCard}>
              <h3 style={{margin:'0 0 20px 0'}}>Allocation</h3>
              {holdings.length === 0 ? (
                <div style={{textAlign:'center', padding:'40px 20px', color:'#94a3b8'}}>
                  <PieChartIcon size={40} color="#cbd5e1" style={{marginBottom:'10px'}}/>
                  <div style={{fontSize:'13px'}}>Buy stocks to see allocation</div>
                </div>
              ) : (
                <>
                  <div style={{height:'220px'}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={holdings.map(h => {
                            const currentPrice = masterData[masterData.length - 1]?.[h.symbol] || 0;
                            return { name: h.symbol, value: parseFloat((currentPrice * h.qty).toFixed(0)) };
                          })}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {holdings.map((h) => (
                            <Cell key={h.symbol} fill={COLORS[h.symbol] || '#94a3b8'} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Value']} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div style={{marginTop:'15px'}}>
                    {holdings.map(h => {
                      const currentPrice = masterData[masterData.length - 1]?.[h.symbol] || 0;
                      const currentVal = currentPrice * h.qty;
                      const totalVal = holdings.reduce((s, hh) => s + ((masterData[masterData.length - 1]?.[hh.symbol] || 0) * hh.qty), 0);
                      const pct = totalVal > 0 ? ((currentVal / totalVal) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={h.symbol} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f1f5f9'}}>
                          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                            <div style={{width:'10px', height:'10px', borderRadius:'3px', background: COLORS[h.symbol] || '#94a3b8'}}/>
                            <span style={{fontSize:'13px', fontWeight:'600', color:'#334155'}}>{h.symbol}</span>
                          </div>
                          <span style={{fontSize:'13px', color:'#64748b', fontWeight:'600'}}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        )}

        {/* 📜 LEDGER & HISTORY TAB */}
        {activeTab === 'ledger' && (
        <div style={{display:'grid', gap:'20px'}}>
          <div className="premium-glass" style={styles.glassCard}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px'}}>
            <h2 style={{margin:0, color:'#0f172a'}}>PnL Timeline</h2>
            <div style={styles.timeSelector}>
              {['daily','weekly','monthly'].map(r => (
                <button key={r} onClick={() => setPnlRange(r)} style={pnlRange === r ? styles.timeBtnActive : styles.timeBtn}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{height:'240px'}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pnlTimelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN', {maximumFractionDigits:0})}`} />
                <Legend />
                <Line type="monotone" dataKey="realized" stroke="#2563eb" strokeWidth={2} dot={false} name="Realized" />
                <Line type="monotone" dataKey="unrealized" stroke="#22c55e" strokeWidth={2} dot={false} name="Unrealized" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginTop:'10px', fontSize:'12px', color:'#64748b'}}>
            <span>Realized PnL: <strong style={{color:'#1d4ed8'}}>₹{realizedPnL.toLocaleString('en-IN', {maximumFractionDigits:0})}</strong></span>
            <span>Unrealized PnL: <strong style={{color:'#15803d'}}>₹{holdings.reduce((sum, h) => sum + (getLatestPrice(h.symbol) * h.qty - h.totalInvested), 0).toLocaleString('en-IN', {maximumFractionDigits:0})}</strong></span>
          </div>
        </div>

  <div className="premium-glass" style={styles.glassCard}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
            <h2 style={{margin:0, color:'#0f172a'}}>Transaction History</h2>
            <div style={{fontSize:'13px', color:'#64748b'}}>Total Trades: {transactions.length} | Wallet: ₹{walletBalance.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
          </div>
          
          {transactions.length === 0 ? (
            <div style={{textAlign:'center', padding:'60px 20px', color:'#94a3b8'}}>
              <FileText size={48} color="#cbd5e1" style={{marginBottom:'15px'}}/>
              <div style={{fontSize:'16px', fontWeight:'600', color:'#64748b', marginBottom:'8px'}}>No Transactions Yet</div>
              <div style={{fontSize:'13px'}}>Buy or Sell stocks to see your history logged here!</div>
              <button onClick={()=>setActiveTab('dashboard')} style={{...styles.actionBtn, marginTop:'20px', maxWidth:'200px', margin:'20px auto 0'}}>
                <Home size={16}/> Go to Dashboard
              </button>
            </div>
          ) : (
            <div>
              {/* Table Header */}
              <div className="premium-table-head" style={{display:'grid', gridTemplateColumns:'1fr 2fr 1fr 1.5fr', padding:'12px 15px', borderBottom:'2px solid #e2e8f0', fontSize:'12px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px'}}>
                <div>Type</div>
                <div>Stock</div>
                <div style={{textAlign:'right'}}>Price Ref</div>
                <div style={{textAlign:'right'}}>Time</div>
              </div>
              {/* Rows */}
              <div style={{maxHeight:'500px', overflowY:'auto'}}>
                {transactions.map(t => (
                  <div className="premium-table-row" key={t.id} style={{display:'grid', gridTemplateColumns:'1fr 2fr 1fr 1.5fr', padding:'14px 15px', borderBottom:'1px solid #f1f5f9', alignItems:'center'}}>
                    <div>
                      <span style={{padding:'4px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'bold', background: t.type === 'BUY' ? '#dbeafe' : '#fce7f3', color: t.type === 'BUY' ? '#2563eb' : '#db2777'}}>
                        {t.type}
                      </span>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <div style={{width:'24px', height:'24px', borderRadius:'6px', background: COLORS[t.symbol] || '#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'9px', fontWeight:'800'}}>
                        {t.symbol.slice(0,2)}
                      </div>
                      <span style={{fontWeight:'700', color:'#0f172a', fontSize:'14px'}}>{t.symbol}</span>
                      <span style={{fontSize:'11px', color:'#94a3b8'}}>{t.qty || 1} Qty</span>
                    </div>
                    <div style={{textAlign:'right', fontWeight:'600', color:'#0f172a', fontSize:'13px'}}>
                      ₹{t.price.toLocaleString('en-IN', {maximumFractionDigits:0})}
                    </div>
                    <div style={{textAlign:'right', color:'#64748b', fontSize:'12px'}}>
                      {new Date(t.time).toLocaleString('en-IN', { dateStyle:'short', timeStyle: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
        )}

        {showOrderTicket && (
          <div style={{position:'fixed', inset:0, background:'rgba(2,6,23,0.45)', zIndex:120, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{width:'420px', background:'#fff', borderRadius:'16px', padding:'18px', boxShadow:'0 20px 50px rgba(15,23,42,0.25)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
                <h3 style={{margin:0}}>Order Ticket</h3>
                <button onClick={() => setShowOrderTicket(false)} style={{border:'none', background:'transparent', cursor:'pointer', fontSize:'18px'}}>✕</button>
              </div>
              <div style={{display:'grid', gap:'10px'}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                  <select value={orderSide} onChange={(e) => setOrderSide(e.target.value)} style={{padding:'10px', borderRadius:'10px', border:'1px solid #cbd5e1'}}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                  <select value={orderSymbol} onChange={(e) => setOrderSymbol(e.target.value)} style={{padding:'10px', borderRadius:'10px', border:'1px solid #cbd5e1'}}>
                    {Object.keys(COLORS).map(sym => <option key={sym} value={sym}>{sym}</option>)}
                  </select>
                </div>
                <input type="number" min="1" value={orderQty} onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value || 1)))} placeholder="Quantity" style={{padding:'10px', borderRadius:'10px', border:'1px solid #cbd5e1'}} />
                <input type="number" min="0" step="0.01" value={orderFeePct} onChange={(e) => setOrderFeePct(Number(e.target.value || 0))} placeholder="Fee %" style={{padding:'10px', borderRadius:'10px', border:'1px solid #cbd5e1'}} />
                <div style={{padding:'10px', borderRadius:'10px', background:'#f8fafc', border:'1px solid #e2e8f0', fontSize:'13px', color:'#334155'}}>
                  <div>Latest Price: <strong>₹{getLatestPrice(orderSymbol).toLocaleString('en-IN', {maximumFractionDigits:0})}</strong></div>
                  <div>Estimated Cost: <strong>₹{(getLatestPrice(orderSymbol) * orderQty).toLocaleString('en-IN', {maximumFractionDigits:0})}</strong></div>
                  <div>Estimated Fees: <strong>₹{((getLatestPrice(orderSymbol) * orderQty) * (orderFeePct / 100)).toLocaleString('en-IN', {maximumFractionDigits:0})}</strong></div>
                </div>
                <button onClick={handlePlaceOrder} style={{padding:'11px', border:'none', borderRadius:'10px', background: orderSide === 'BUY' ? '#2563eb' : '#dc2626', color:'#fff', fontWeight:700, cursor:'pointer'}}>
                  Confirm {orderSide}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🤖 NEW INTERACTIVE CHAT WINDOW */}
        {isChatOpen && (
          <div className="premium-chat-window" style={styles.chatWindow}>
            <div style={styles.chatHeader}>
              <div style={{display:'flex', gap:'10px', alignItems:'center'}}><Sparkles size={16} color="#fff"/> AI Assistant</div>
              <X size={18} onClick={()=>setIsChatOpen(false)} style={{cursor:'pointer', color:'#fff'}}/>
            </div>
            <div style={{padding:'10px 12px', borderBottom:'1px solid #e2e8f0', display:'flex', gap:'8px', flexWrap:'wrap'}}>
              {['Risk report', 'Rebalance plan', 'What changed today?'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setChatInput(prompt)}
                  style={{border:'1px solid #dbeafe', background:'#eff6ff', color:'#1d4ed8', borderRadius:'999px', padding:'4px 9px', fontSize:'11px', cursor:'pointer'}}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div style={{padding:'15px', height:'300px', overflowY:'auto', background:'#f8fafc'}}>
              {messages.map((m,i) => (
                <div key={i} style={{marginBottom:'10px', display:'flex', justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start'}}>
                  <div>
                    <div className={m.sender === 'user' ? '' : 'premium-bot-bubble'} style={m.sender === 'user' ? styles.userBubble : styles.botBubble}>
                      <div dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
                    </div>
                    {m.sender === 'bot' && Array.isArray(m.explainability) && m.explainability.length > 0 && (
                      <div style={{marginTop:'6px', background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'8px 10px', maxWidth:'320px'}}>
                        <div style={{fontSize:'11px', fontWeight:700, color:'#3730a3', marginBottom:'4px'}}>Why this suggestion?</div>
                        <ul style={{margin:0, paddingLeft:'16px', fontSize:'11px', color:'#4338ca'}}>
                          {m.explainability.slice(0, 3).map((e, idx) => <li key={idx}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div style={{marginBottom:'10px', display:'flex', justifyContent:'flex-start'}}>
                  <div style={styles.botBubble}>⏳ Thinking with reliability safeguards...</div>
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>
            
            {/* 💬 CHAT INPUT AREA */}
            <div style={styles.chatInputArea}>
              <input 
                style={styles.input} 
                placeholder="Ask: 'Predict TSLA'..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button onClick={handleSendMessage} style={styles.sendBtn}><Send size={16}/></button>
            </div>
          </div>
        )}

        {!isChatOpen && (
       <button onClick={()=>setIsChatOpen(true)} className="premium-fab" style={styles.fab}>
             <Sparkles size={24}/>
          </button>
        )}
      </main>
    </div>
  );
};

// 💅 STYLES
const loginStyles = {
  container: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  card: { padding: '40px', borderRadius: '24px', textAlign: 'center', width: '380px', color: '#fff' },
  logoWrapper: { background: 'rgba(59, 130, 246, 0.2)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' },
  button: { width: '100%', padding: '14px', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop:'20px' }
};

const styles = {
  container: { display: 'flex', height: '100vh', background: '#f8fafc' },
  sidebar: { width: '260px', background: 'linear-gradient(180deg, #020617 0%, #0f172a 45%, #111827 100%)', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(148,163,184,0.14)', boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.03)' },
  menu: { padding: '20px' },
  menuItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#94a3b8', cursor: 'pointer', borderRadius: '12px', marginBottom: '5px', border: '1px solid transparent' },
  menuItemActive: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#fff', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: '12px', fontWeight: 'bold', marginBottom: '5px', boxShadow: '0 10px 24px rgba(37,99,235,0.34)' },
  userProfile: { marginTop: 'auto', padding: '20px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #1e293b' },
  avatar: { width: '36px', height: '36px', background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', boxShadow: '0 8px 18px rgba(59,130,246,0.4)' },
  
  main: { flex: 1, padding: '30px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  headerActions: { display:'flex', gap:'20px', alignItems:'center'},
  walletBadge: { background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)', color: '#fff', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', display: 'flex', gap: '10px', boxShadow: '0 10px 24px rgba(37,99,235,0.32)' },
  kpiCard: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px', borderRadius: '10px', background: 'linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: '14px', boxShadow: '0 8px 18px rgba(15,23,42,0.06)' },
  kpiLabel: { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 },
  
  grid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' },
  glassCard: { background: 'linear-gradient(165deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.92) 100%)', borderRadius: '24px', padding: '25px', boxShadow: '0 20px 45px -20px rgba(15,23,42,0.35)', border: '1px solid #e2e8f0', backdropFilter: 'blur(8px)' },
  
  timeSelector: { display: 'flex', gap: '5px', background:'#f1f5f9', padding:'4px', borderRadius:'10px' },
  timeBtn: { border: 'none', background: 'transparent', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color:'#64748b', fontWeight:'600' },
  timeBtnActive: { border: 'none', background: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color:'#0f172a', fontWeight:'bold', boxShadow:'0 2px 4px rgba(0,0,0,0.05)' },

  actionBtn: { flex: 1, padding: '12px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', borderRadius: '12px', color: '#1d4ed8', fontWeight: 'bold', cursor: 'pointer', display:'flex', justifyContent:'center', gap:'8px', boxShadow: '0 8px 20px rgba(59,130,246,0.15)' },
  addBtn: { fontSize: '11px', padding: '6px 12px', background: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight:'bold' },
  
  expenseItem: { display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
  iconBox: { width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' },
  totalBox: { marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', color: '#64748b', fontSize:'13px' },
  
  fab: { position: 'fixed', bottom: '30px', right: '30px', width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 14px 35px rgba(79,70,229,0.5)', zIndex: 90, display:'flex', alignItems:'center', justifyContent:'center' },
  chatWindow: { position: 'fixed', bottom: '30px', right: '30px', width: '350px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '20px', boxShadow: '0 28px 55px -20px rgba(15,23,42,0.45)', zIndex: 100, overflow: 'hidden', border: '1px solid #dbeafe' },
  chatHeader: { padding: '15px 20px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems:'center' },
  
  userBubble: { background: '#2563eb', color: '#fff', padding: '10px 14px', borderRadius: '12px 12px 0 12px', fontSize: '13px', lineHeight:'1.4', maxWidth:'80%' },
  botBubble: { background: '#fff', color: '#0f172a', padding: '10px 14px', borderRadius: '12px 12px 12px 0', fontSize: '13px', border:'1px solid #e2e8f0', boxShadow:'0 2px 4px rgba(0,0,0,0.02)', lineHeight:'1.4', maxWidth:'80%' },
  
  chatInputArea: { padding: '10px', background: '#fff', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' },
  input: { flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '13px' },
  sendBtn: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px', width: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};

export default App;