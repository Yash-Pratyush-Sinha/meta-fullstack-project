import React, { useState, useEffect, useRef } from 'react';
import './App.css'; 
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import { Activity, Wallet, Sparkles, X, ShoppingBag, Zap, Home, PieChart as PieChartIcon, LogOut, Search, Bell, TrendingUp, Send, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { io } from "socket.io-client";
import { signInWithGoogle, logoutUser } from './firebase'; 

// 🔌 SOCKET CONNECTION
const socket = io("http://localhost:5000");

const COLORS = {
  TSLA: '#d946ef', AAPL: '#3b82f6', NVDA: '#22c55e', MSFT: '#f59e0b',
  JPM: '#6366f1', GS: '#ec4899'
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
  
  // 🇮🇳 WALLET & EXPENSES
  const [walletBalance, setWalletBalance] = useState(1250000);
  const [holdings, setHoldings] = useState([]);
  const [expenses, setExpenses] = useState([
    { id: 1, category: 'Food', desc: 'Starbucks Indiranagar', amount: 450, time: '10:00 AM' },
    { id: 2, category: 'Travel', desc: 'Uber Premier', amount: 320, time: '09:15 AM' }
  ]);
  
  // 🤖 INTERACTIVE AI CHAT
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { sender: 'bot', text: "Hello Yash! I am your **WealthOS AI Assistant**. 🤖\n\nI can help with:\n📈 Stock predictions\n📊 Expense analysis\n⚔️ Stock comparisons\n📈 SIP calculations\n🏛️ Tax tips\n🪙 Crypto insights\n🧮 Quick math\n\nType **\"Help\"** to see everything I can do!" }
  ]);
  const messagesEndRef = useRef(null);

  // ✏️ MANUAL EXPENSE FORM STATE
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('Food');

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
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    // Add user message
    const userMsg = { sender: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput("");

    // Simulate AI Thinking
    setTimeout(() => {
      let botResponse = "";
      const upperInput = userMsg.text.toUpperCase();
      const lowerInput = userMsg.text.toLowerCase();

      // 1. Stock Prediction Logic
      const foundStock = Object.keys(COLORS).find(sym => upperInput.includes(sym));
      
      if (foundStock) {
        const currentPrice = masterData[masterData.length - 1]?.[foundStock] || 0;
        const predictedPrice = (currentPrice * 1.15).toFixed(0); // Simulate +15% growth
        botResponse = `🔮 **AI Prediction for ${foundStock}:**\n\nCurrent indicators suggest a **BULLISH** trend. \n\n📉 Current: ₹${currentPrice.toLocaleString()}\n📈 **Target (6M): ₹${Number(predictedPrice).toLocaleString()}**\n\nRecommendation: **STRONG BUY** 🚀`;
      } 
      // 2. Expense Logic
      else if (upperInput.includes("EXPENSE") || upperInput.includes("SPEND") || upperInput.includes("SPENDING")) {
         const total = expenses.reduce((a,b)=>a+b.amount,0);
         botResponse = `📊 You have spent **₹${total}** today. If you cut this by 20% and invested in Nifty Bees, you'd save **₹${(total*0.2*30).toFixed(0)}** per month!`;
      }
      // 3. Greeting
      else if (upperInput.includes("HI") || upperInput.includes("HELLO") || upperInput.includes("HEY") || upperInput.includes("SUP") || upperInput.includes("GOOD MORNING") || upperInput.includes("GOOD EVENING")) {
        const greetings = [
          "Hey Yash! Ready to make some money today? 💰",
          "Hello! Your AI Market Analyst is online and ready. What can I help you with? 🚀",
          "Hey there! Markets are looking interesting today. Ask me anything! 📊"
        ];
        botResponse = greetings[Math.floor(Math.random() * greetings.length)];
      }
      // 4. Wallet / Balance
      else if (upperInput.includes("WALLET") || upperInput.includes("BALANCE") || upperInput.includes("HOW MUCH")) {
        botResponse = `💰 **Wallet Balance:** ₹${walletBalance.toLocaleString('en-IN', {maximumFractionDigits:0})}\n\nYou're doing great! Keep investing wisely.`;
      }
      // 5. Portfolio / Holdings summary
      else if (upperInput.includes("PORTFOLIO") || upperInput.includes("HOLDING") || upperInput.includes("MY STOCKS") || upperInput.includes("INVESTMENT")) {
        const stockSummary = Object.keys(COLORS).map(sym => {
          const price = masterData[masterData.length - 1]?.[sym] || 0;
          return `• **${sym}**: ₹${price.toLocaleString('en-IN', {maximumFractionDigits:0})}`;
        }).join('\n');
        botResponse = `📋 **Live Market Prices:**\n\n${stockSummary}\n\nWant me to predict any of these? Just say "Predict [STOCK]"!`;
      }
      // 6. Compare stocks
      else if (upperInput.includes("COMPARE") || upperInput.includes("VS") || upperInput.includes("VERSUS") || upperInput.includes("BETTER")) {
        const mentioned = Object.keys(COLORS).filter(sym => upperInput.includes(sym));
        if (mentioned.length >= 2) {
          const prices = mentioned.map(sym => ({ sym, price: masterData[masterData.length - 1]?.[sym] || 0 }));
          const best = prices.reduce((a, b) => a.price > b.price ? a : b);
          botResponse = `⚔️ **${mentioned.join(' vs ')}:**\n\n${prices.map(p => `• **${p.sym}**: ₹${p.price.toLocaleString('en-IN', {maximumFractionDigits:0})}`).join('\n')}\n\n🏆 **${best.sym}** is currently priced higher. Based on momentum, I'd lean towards **${best.sym}** for short-term gains!`;
        } else {
          botResponse = "⚔️ Tell me which stocks to compare! E.g., **'Compare TSLA vs NVDA'**";
        }
      }
      // 7. SIP / Mutual Funds / Savings advice
      else if (upperInput.includes("SIP") || upperInput.includes("MUTUAL FUND") || upperInput.includes("SAVE") || upperInput.includes("SAVING")) {
        const monthly = 10000;
        const years = 20;
        const rate = 0.12;
        const futureValue = (monthly * (Math.pow(1 + rate/12, years*12) - 1) / (rate/12)).toFixed(0);
        botResponse = `📈 **SIP Calculator:**\n\nIf you invest **₹${monthly.toLocaleString()}/month** for **${years} years** at 12% CAGR:\n\n💰 **You'd accumulate: ₹${Number(futureValue).toLocaleString('en-IN')}**\n\nThat's the power of compounding! Start early, stay consistent. 🚀`;
      }
      // 8. Tax advice
      else if (upperInput.includes("TAX") || upperInput.includes("80C") || upperInput.includes("DEDUCTION") || upperInput.includes("LTCG") || upperInput.includes("STCG")) {
        botResponse = `🏛️ **Tax Tips for Investors:**\n\n• **LTCG** (Long-Term): Gains > ₹1L taxed at **10%** (held >1 year)\n• **STCG** (Short-Term): Taxed at **15%** (held <1 year)\n• **Section 80C**: Save up to **₹1.5L** via ELSS mutual funds\n• **Section 80D**: Health insurance premiums — up to **₹25K**\n\n💡 Pro tip: Hold investments >1 year to benefit from LTCG exemption!`;
      }
      // 9. Crypto
      else if (upperInput.includes("CRYPTO") || upperInput.includes("BITCOIN") || upperInput.includes("BTC") || upperInput.includes("ETHEREUM") || upperInput.includes("ETH")) {
        botResponse = `🪙 **Crypto Insights:**\n\nCrypto markets are highly volatile. Here's my take:\n\n• **Bitcoin (BTC)**: Digital gold — good for long-term store of value\n• **Ethereum (ETH)**: The backbone of DeFi & smart contracts\n• **Risk**: Extremely high — only invest what you can afford to lose\n\n⚠️ In India, crypto gains are taxed at **30%** flat with **1% TDS**. Be cautious!`;
      }
      // 10. Help / What can you do
      else if (upperInput.includes("HELP") || upperInput.includes("WHAT CAN YOU") || upperInput.includes("FEATURE") || upperInput.includes("COMMANDS") || upperInput.includes("OPTIONS")) {
        botResponse = `🤖 **Here's what I can do:**\n\n📈 **"Predict TSLA"** — AI stock prediction\n📊 **"My expenses"** — Spending analysis\n💰 **"My balance"** — Wallet info\n📋 **"Portfolio"** — Live stock prices\n⚔️ **"Compare TSLA vs NVDA"** — Head-to-head\n📈 **"SIP calculator"** — Compounding magic\n🏛️ **"Tax tips"** — Indian tax advice\n🪙 **"Crypto"** — Crypto insights\n📰 **"Market news"** — Latest updates\n🧮 **"Calculate"** — Quick math\n💡 **"Tip" / "Quote"** — Motivation\n\nJust type naturally — I understand! 😊`;
      }
      // 11. Market news / updates
      else if (upperInput.includes("NEWS") || upperInput.includes("UPDATE") || upperInput.includes("MARKET TODAY") || upperInput.includes("WHATS HAPPENING")) {
        const headlines = [
          "📰 **Market Update:**\n\n• Nifty 50 surged **1.2%** led by IT stocks\n• FIIs turned net buyers after 3 weeks of selling\n• RBI holds repo rate steady at **6.5%**\n• NVIDIA hits new ATH on AI chip demand\n\n🔥 Sentiment: **BULLISH** — Consider buying the dip!",
          "📰 **Market Update:**\n\n• US Fed signals potential rate cut in Q2\n• Indian rupee strengthens to ₹82.3 per USD\n• Auto sector rallies on strong monthly sales\n• Gold prices hit ₹72,000/10g — safe haven demand\n\n📊 Sentiment: **CAUTIOUSLY OPTIMISTIC**",
          "📰 **Market Update:**\n\n• Tech stocks lead global rally\n• Sensex crosses 80,000 milestone\n• Crude oil falls 3% — good for India\n• Banking sector shows strong Q3 results\n\n💪 Sentiment: **STRONG BUY** on Indian markets!"
        ];
        botResponse = headlines[Math.floor(Math.random() * headlines.length)];
      }
      // 12. Calculator / Math
      else if (upperInput.includes("CALCULATE") || upperInput.includes("CALC") || lowerInput.match(/^\d[\d\s+\-*/().%]*$/)) {
        try {
          const expr = userMsg.text.replace(/[^0-9+\-*/().%\s]/g, '').replace(/%/g, '/100');
          if (expr.trim()) {
            const result = Function('"use strict";return (' + expr + ')')();
            botResponse = `🧮 **Result:** ${userMsg.text.replace(/calculate\s*/i, '')} = **${Number(result).toLocaleString('en-IN')}**`;
          } else {
            botResponse = "🧮 Give me a math expression! E.g., **'Calculate 50000 * 1.12'** or just type **'25000 + 18000'**";
          }
        } catch {
          botResponse = "🧮 I couldn't compute that. Try something like **'Calculate 50000 * 1.12'** or **'25000 + 18000'**";
        }
      }
      // 13. Tips / Quotes / Motivation
      else if (upperInput.includes("TIP") || upperInput.includes("QUOTE") || upperInput.includes("MOTIVAT") || upperInput.includes("INSPIRE") || upperInput.includes("ADVICE")) {
        const quotes = [
          "💡 **\"The stock market is a device for transferring money from the impatient to the patient.\"** — Warren Buffett",
          "💡 **\"An investment in knowledge pays the best interest.\"** — Benjamin Franklin",
          "💡 **\"Risk comes from not knowing what you're doing.\"** — Warren Buffett",
          "💡 **\"The best time to plant a tree was 20 years ago. The second best time is now.\"** — Chinese Proverb",
          "💡 **\"Do not save what is left after spending; spend what is left after saving.\"** — Warren Buffett",
          "💡 **\"Compound interest is the eighth wonder of the world.\"** — Albert Einstein",
          "💡 **\"Price is what you pay. Value is what you get.\"** — Warren Buffett"
        ];
        botResponse = quotes[Math.floor(Math.random() * quotes.length)];
      }
      // 14. Thank you
      else if (upperInput.includes("THANK") || upperInput.includes("THANKS") || upperInput.includes("THX") || upperInput.includes("APPRECIATE")) {
        const thanks = [
          "You're welcome, Yash! Happy to help. Keep building wealth! 💰🚀",
          "Anytime! That's what I'm here for. Ask me anything! 😊",
          "My pleasure! Remember — consistency is the key to wealth. 📈"
        ];
        botResponse = thanks[Math.floor(Math.random() * thanks.length)];
      }
      // 15. Who are you / About
      else if (upperInput.includes("WHO ARE YOU") || upperInput.includes("YOUR NAME") || upperInput.includes("ABOUT YOU") || upperInput.includes("WHAT ARE YOU")) {
        botResponse = "🤖 I'm **WealthOS AI** — your personal financial analyst powered by machine learning.\n\nI can predict stocks, analyze expenses, compare investments, calculate SIPs, and give you market insights.\n\nBuilt with ❤️ by **Yash Pratyush Sinha**.";
      }
      // 16. Bye / Exit
      else if (upperInput.includes("BYE") || upperInput.includes("GOODBYE") || upperInput.includes("SEE YOU") || upperInput.includes("GTFO") || upperInput.includes("EXIT")) {
        botResponse = "👋 See you later, Yash! Keep stacking those gains. May your portfolio only go up! 📈🚀";
      }
      // 17. Joke / Fun
      else if (upperInput.includes("JOKE") || upperInput.includes("FUNNY") || upperInput.includes("LAUGH") || upperInput.includes("LOL")) {
        const jokes = [
          "😂 Why did the stock market investor break up with the bond market?\n\nBecause there was **no interest**! 📉",
          "😂 What's a stockbroker's favorite type of music?\n\n**Stock 'n' Roll!** 🎸",
          "😂 Why don't traders ever get lost?\n\nBecause they always follow the **trends!** 📊",
          "😂 I told my wife I made a killing in the stock market.\n\nShe said, **\"Who did you murder?\"** �"
        ];
        botResponse = jokes[Math.floor(Math.random() * jokes.length)];
      }
      // 18. Weather (fun response)
      else if (upperInput.includes("WEATHER") || upperInput.includes("TEMPERATURE") || upperInput.includes("RAIN")) {
        botResponse = "🌤️ I'm a **financial** AI, not a weather one! 😄\n\nBut I can tell you the **market climate** — it's looking **bullish** with a chance of **profits!** ☀️📈";
      }
      // 19. Time / Date
      else if (upperInput.includes("TIME") || upperInput.includes("DATE") || upperInput.includes("TODAY")) {
        const now = new Date();
        botResponse = `🕐 **Current Time:** ${now.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', hour12:true})}\n📅 **Date:** ${now.toLocaleDateString('en-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}\n\n${now.getHours() < 15 && now.getHours() >= 9 ? "📈 **Markets are OPEN!** Time to trade!" : "🔒 Markets are closed. Plan your next move!"}`;
      }
      // 20. Default fallback — smarter
      else {
        const fallbacks = [
          `🤔 Hmm, I'm not sure about **"${userMsg.text}"**, but I'm great at stocks, expenses & finance!\n\nTry: **"Help"** to see everything I can do!`,
          `I didn't quite get that, but here's a tip: **diversify your portfolio** across sectors for lower risk! 📊\n\nType **"Help"** to see my full capabilities.`,
          `That's beyond my expertise right now! But ask me about **stocks, SIPs, taxes, or expenses** — I'll blow your mind! 🧠\n\nType **"Help"** for the full menu.`
        ];
        botResponse = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    }, 800);
  };

  const handleBuy = async (symbol) => {
    const price = masterData[masterData.length - 1]?.[symbol] || 0;
    setWalletBalance(prev => prev - price);
    setHoldings(prev => {
      const existing = prev.find(h => h.symbol === symbol);
      if (existing) {
        return prev.map(h => h.symbol === symbol ? { ...h, qty: h.qty + 1, totalInvested: h.totalInvested + price } : h);
      }
      return [...prev, { symbol, qty: 1, avgPrice: price, totalInvested: price }];
    });
    setIsChatOpen(true);
    setMessages(prev => [...prev, { sender: 'bot', text: `🚀 **Trade Executed:** Purchased 1 Unit of **${symbol}** at ₹${price.toLocaleString('en-IN', {maximumFractionDigits:0})}.` }]);
    
    // Send SMS via Twilio
    try {
      await fetch('http://localhost:5000/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: symbol, price: price.toFixed(2), balance: (walletBalance - price).toFixed(2) })
      });
    } catch (e) { console.log("SMS Error:", e); }
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
    <div className="dashboard-enter" style={styles.container}>
      {/* SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={{padding:'25px', display:'flex', alignItems:'center', gap:'12px'}}>
          <Activity color="#3b82f6" size={28} />
          <h2 style={{color:'#fff', margin:0, fontSize:'20px'}}>WealthOS</h2>
        </div>
        <div style={styles.menu}>
          <div onClick={()=>setActiveTab('dashboard')} style={activeTab === 'dashboard' ? styles.menuItemActive : styles.menuItem}><Home size={20}/> Dashboard</div>
          <div onClick={()=>setActiveTab('portfolio')} style={activeTab === 'portfolio' ? styles.menuItemActive : styles.menuItem}><PieChartIcon size={20}/> Portfolio</div>
          <div onClick={()=>{ setActiveTab('dashboard'); setIsChatOpen(true); }} style={styles.menuItem}><Zap size={20}/> AI Insights</div>
        </div>
        <div style={styles.userProfile}>
          <div style={styles.avatar}>{user.displayName ? user.displayName[0] : 'Y'}</div>
          <div>
            <div style={{color:'#fff', fontWeight:'bold', fontSize:'14px'}}>{user.displayName || 'Guest'}</div>
            <div style={{color:'#94a3b8', fontSize:'11px'}}>Pro Member</div>
          </div>
          <button onClick={logout} style={{marginLeft:'auto', background:'none', border:'none', cursor:'pointer'}}><LogOut color="#ef4444" size={18}/></button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={{fontSize:'26px', fontWeight:'800', margin:0, color:'#1e293b'}}>Welcome back, Yash 👋</h1>
            <p style={{color:'#64748b', margin:0}}>Your financial intelligence terminal is active.</p>
          </div>
          <div style={styles.headerActions}>
             <div style={styles.walletBadge}>
                <Wallet size={18} color="#fff"/> 
                <span>₹{walletBalance.toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
             </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
        <div style={styles.grid}>
          {/* 📈 CHART CARD */}
          <div className="hover-scale" style={{...styles.glassCard, gridColumn: 'span 2'}}>
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

            <div style={{height:'350px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visibleData}>
                  <defs>
                    {Object.keys(COLORS).map(sym => (
                      <linearGradient key={sym} id={`grad-${sym}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[sym]} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={COLORS[sym]} stopOpacity={0}/>
                      </linearGradient>
                    ))}
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
                    formatter={(value, name) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, name]}
                    labelFormatter={(label) => `📅 ${label}`}
                  />
                  <Legend />
                  {Object.keys(COLORS).map((sym) => (
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
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
               {['NVDA', 'TSLA', 'AAPL'].map(s => (
                 <button key={s} onClick={()=>handleBuy(s)} style={styles.actionBtn}>
                    <TrendingUp size={16}/> BUY {s}
                 </button>
               ))}
            </div>
          </div>

          {/* 💸 EXPENSE CARD */}
          <div className="hover-scale" style={styles.glassCard}>
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

        {/* 📋 PORTFOLIO PAGE */}
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
                  <div className="hover-scale" style={styles.glassCard}>
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
                  <div className="hover-scale" style={styles.glassCard}>
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
                  <div className="hover-scale" style={styles.glassCard}>
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
            <div className="hover-scale" style={styles.glassCard}>
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
                  <div style={{display:'grid', gridTemplateColumns:'1.5fr 0.8fr 1fr 1fr 1fr', padding:'10px 0', borderBottom:'2px solid #e2e8f0', fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px'}}>
                    <div>Stock</div>
                    <div style={{textAlign:'center'}}>Qty</div>
                    <div style={{textAlign:'right'}}>Avg Price</div>
                    <div style={{textAlign:'right'}}>Current</div>
                    <div style={{textAlign:'right'}}>P&L</div>
                  </div>
                  {/* Table Rows */}
                  {holdings.map(h => {
                    const currentPrice = masterData[masterData.length - 1]?.[h.symbol] || 0;
                    const avgPrice = h.totalInvested / h.qty;
                    const pl = (currentPrice - avgPrice) * h.qty;
                    const plPercent = ((currentPrice - avgPrice) / avgPrice * 100).toFixed(2);
                    return (
                      <div key={h.symbol} style={{display:'grid', gridTemplateColumns:'1.5fr 0.8fr 1fr 1fr 1fr', padding:'14px 0', borderBottom:'1px solid #f1f5f9', alignItems:'center'}}>
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
            <div className="hover-scale" style={styles.glassCard}>
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
        {/* 🤖 NEW INTERACTIVE CHAT WINDOW */}
        {isChatOpen && (
          <div style={styles.chatWindow}>
            <div style={styles.chatHeader}>
              <div style={{display:'flex', gap:'10px', alignItems:'center'}}><Sparkles size={16} color="#fff"/> AI Assistant</div>
              <X size={18} onClick={()=>setIsChatOpen(false)} style={{cursor:'pointer', color:'#fff'}}/>
            </div>
            <div style={{padding:'15px', height:'300px', overflowY:'auto', background:'#f8fafc'}}>
              {messages.map((m,i) => (
                <div key={i} style={{marginBottom:'10px', display:'flex', justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start'}}>
                  <div style={m.sender === 'user' ? styles.userBubble : styles.botBubble}>
                    <div dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
                  </div>
                </div>
              ))}
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
          <button onClick={()=>setIsChatOpen(true)} style={styles.fab}>
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
  sidebar: { width: '260px', background: '#0f172a', display: 'flex', flexDirection: 'column' },
  menu: { padding: '20px' },
  menuItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#94a3b8', cursor: 'pointer', borderRadius: '12px', marginBottom: '5px' },
  menuItemActive: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#fff', background: '#2563eb', borderRadius: '12px', fontWeight: 'bold', marginBottom: '5px' },
  userProfile: { marginTop: 'auto', padding: '20px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #1e293b' },
  avatar: { width: '36px', height: '36px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' },
  
  main: { flex: 1, padding: '30px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  headerActions: { display:'flex', gap:'20px', alignItems:'center'},
  walletBadge: { background: '#2563eb', color: '#fff', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', display: 'flex', gap: '10px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' },
  
  grid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' },
  glassCard: { background: '#fff', borderRadius: '24px', padding: '25px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' },
  
  timeSelector: { display: 'flex', gap: '5px', background:'#f1f5f9', padding:'4px', borderRadius:'10px' },
  timeBtn: { border: 'none', background: 'transparent', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color:'#64748b', fontWeight:'600' },
  timeBtnActive: { border: 'none', background: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color:'#0f172a', fontWeight:'bold', boxShadow:'0 2px 4px rgba(0,0,0,0.05)' },

  actionBtn: { flex: 1, padding: '12px', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', display:'flex', justifyContent:'center', gap:'8px' },
  addBtn: { fontSize: '11px', padding: '6px 12px', background: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight:'bold' },
  
  expenseItem: { display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
  iconBox: { width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' },
  totalBox: { marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', color: '#64748b', fontSize:'13px' },
  
  fab: { position: 'fixed', bottom: '30px', right: '30px', width: '60px', height: '60px', borderRadius: '50%', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 10px 30px rgba(37, 99, 235, 0.4)', zIndex: 90, display:'flex', alignItems:'center', justifyContent:'center' },
  chatWindow: { position: 'fixed', bottom: '30px', right: '30px', width: '350px', background: '#fff', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', zIndex: 100, overflow: 'hidden', border: '1px solid #e2e8f0' },
  chatHeader: { padding: '15px 20px', background: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems:'center' },
  
  userBubble: { background: '#2563eb', color: '#fff', padding: '10px 14px', borderRadius: '12px 12px 0 12px', fontSize: '13px', lineHeight:'1.4', maxWidth:'80%' },
  botBubble: { background: '#fff', color: '#0f172a', padding: '10px 14px', borderRadius: '12px 12px 12px 0', fontSize: '13px', border:'1px solid #e2e8f0', boxShadow:'0 2px 4px rgba(0,0,0,0.02)', lineHeight:'1.4', maxWidth:'80%' },
  
  chatInputArea: { padding: '10px', background: '#fff', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' },
  input: { flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '13px' },
  sendBtn: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px', width: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};

export default App;