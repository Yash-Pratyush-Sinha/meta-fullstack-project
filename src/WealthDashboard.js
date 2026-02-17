import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Activity, Wallet, Sparkles, X, TrendingUp, TrendingDown, Coffee, ShoppingBag, CreditCard, DollarSign } from 'lucide-react';
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const COLORS = {
  TSLA: '#d946ef', AAPL: '#3b82f6', NVDA: '#22c55e', MSFT: '#f59e0b',
  JPM: '#6366f1', GS: '#ec4899', 'GC=F': '#d4af37', 'SI=F': '#c0c0c0'
};

const WealthDashboard = ({ user, logout }) => {
  // 📊 MARKET STATE
  const [masterData, setMasterData] = useState([]);
  const [visibleData, setVisibleData] = useState([]);
  const [timeRange, setTimeRange] = useState('1Y');
  const [selectedStock, setSelectedStock] = useState('TSLA');
  
  // 💰 WALLET & PORTFOLIO STATE
  const [walletBalance, setWalletBalance] = useState(100000);
  const [holdings, setHoldings] = useState({ TSLA: 0, AAPL: 0, NVDA: 0, MSFT: 0 }); // Track quantity
  
  // 💸 EXPENSE STATE
  const [expenses, setExpenses] = useState([
    { id: 1, category: 'Food', desc: 'Starbucks Coffee', amount: 5.50, time: '10:00 AM' },
    { id: 2, category: 'Travel', desc: 'Uber to Campus', amount: 12.00, time: '09:15 AM' },
    { id: 3, category: 'Shopping', desc: 'Amazon Order', amount: 45.99, time: 'Yesterday' }
  ]);

  // 🤖 AI STATE
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on('marketHistory', (data) => setMasterData(data));
    socket.on('marketPulse', (newData) => setMasterData(prev => [...prev, ...newData]));
    return () => { socket.off('marketHistory'); socket.off('marketPulse'); };
  }, []);

  // Filter Data Logic
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
    setVisibleData(filtered);
  }, [masterData, timeRange]);

  // Scroll Chat
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const currentPrice = masterData[masterData.length - 1]?.[selectedStock] || 0;

  // 🟢 BUY LOGIC
  const handleBuy = async () => {
    if (walletBalance < currentPrice) return alert("Insufficient Funds!");
    
    setWalletBalance(prev => prev - currentPrice);
    setHoldings(prev => ({ ...prev, [selectedStock]: (prev[selectedStock] || 0) + 1 }));
    
    // Simulate SMS
    await fetch('http://localhost:5000/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: selectedStock, price: currentPrice.toFixed(2), balance: (walletBalance - currentPrice).toFixed(2) })
    });

    setIsChatOpen(true);
    setMessages(prev => [...prev, { sender: 'bot', text: `✅ BUY EXECUTED: 1 Unit of ${selectedStock} @ $${currentPrice.toFixed(2)}` }]);
  };

  // 🔴 SELL LOGIC
  const handleSell = async () => {
    if (!holdings[selectedStock] || holdings[selectedStock] <= 0) return alert(`You don't own any ${selectedStock}!`);

    setWalletBalance(prev => prev + currentPrice);
    setHoldings(prev => ({ ...prev, [selectedStock]: prev[selectedStock] - 1 }));

    setIsChatOpen(true);
    setMessages(prev => [...prev, { sender: 'bot', text: `✅ SELL EXECUTED: 1 Unit of ${selectedStock} @ $${currentPrice.toFixed(2)}` }]);
  };

  // 💸 ADD EXPENSE & CALCULATE OPPORTUNITY COST
  const addMockExpense = async () => {
    const cost = 150.00; // Example: Fancy Dinner
    const newExpense = { id: Date.now(), category: 'Food', desc: 'Weekend Dinner', amount: cost, time: 'Just Now' };
    setExpenses(prev => [newExpense, ...prev]);
    setWalletBalance(prev => prev - cost);

    // 🧠 AI ANALYSIS
    setIsChatOpen(true);
    setMessages(prev => [...prev, { sender: 'bot', text: `⚠️ Expense Detected: $${cost} for Dinner.` }]);
    setIsTyping(true);

    try {
      // Ask Python ML Server for Opportunity Cost
      const response = await fetch('http://localhost:5001/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: [100, 102, 105, 110, 115] }) // Mock history for quick calc
      });
      const result = await response.json();
      
      setTimeout(() => {
        setIsTyping(false);
        const futureValue = (cost * (1 + (result.rate / 100) * 10)).toFixed(2); // 10 Year Compound
        setMessages(prev => [...prev, { 
          sender: 'bot', 
          text: `💡 Opportunity Cost Alert: If you had invested this $${cost} in ${selectedStock} instead, it could have grown to $${futureValue} in 10 years!` 
        }]);
      }, 1500);
    } catch (e) { setIsTyping(false); }
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <nav style={styles.nav}>
        <div style={styles.brand}>
          <Activity color="#2563eb" size={28} />
          <h1 style={styles.title}>WealthOS <span style={styles.badge}>ULTIMATE</span></h1>
        </div>
        <div style={styles.wallet}><Wallet size={16} /> ${walletBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
      </nav>

      <div style={styles.mainGrid}>
        
        {/* LEFT COL: CHART & TRADING */}
        <div style={styles.glassCard}>
          <div style={styles.chartHeader}>
             <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
               <select value={selectedStock} onChange={(e) => setSelectedStock(e.target.value)} style={styles.select}>
                {Object.keys(COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div>
                 <div style={styles.bigPrice}>${currentPrice.toFixed(2)}</div>
                 <div style={styles.holdingTag}>You Own: {holdings[selectedStock] || 0} Units</div>
              </div>
             </div>
             <div style={styles.timeSelector}>
               {['1M','6M','1Y','5Y'].map(r => <button key={r} onClick={()=>setTimeRange(r)} style={styles.timeBtn}>{r}</button>)}
             </div>
          </div>

          <div style={{ height: '450px', width: '100%', marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visibleData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" hide />
                <YAxis 
                  domain={['dataMin', 'dataMax']}
                  orientation="right" 
                  tickFormatter={(v)=>`$${Math.round(v)}`} 
                  width={50} 
                  stroke="#64748b" 
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={styles.tooltip}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend />
                {Object.keys(COLORS).map(sym => (
                  <Line 
                    key={sym} 
                    type="monotone" 
                    dataKey={sym} 
                    stroke={COLORS[sym]} 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 🟢🔴 BUY / SELL BUTTONS */}
          <div style={styles.tradeControls}>
            <button onClick={handleBuy} style={styles.buyBtn}>BUY {selectedStock}</button>
            <button onClick={handleSell} style={styles.sellBtn}>SELL {selectedStock}</button>
          </div>
        </div>

        {/* RIGHT COL: EXPENSE TRACKER */}
        <div style={styles.sidePanel}>
          <div style={styles.panelHeader}>
            <h3>Expense Tracker</h3>
            <button onClick={addMockExpense} style={styles.addExpBtn}>+ Add Mock Expense</button>
          </div>
          
          <div style={styles.expenseList}>
            {expenses.map(exp => (
              <div key={exp.id} style={styles.expenseItem}>
                <div style={styles.iconBox}>
                  {exp.category === 'Food' ? <Coffee size={16}/> : exp.category === 'Travel' ? <CreditCard size={16}/> : <ShoppingBag size={16}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:'bold', fontSize:'13px'}}>{exp.desc}</div>
                  <div style={{fontSize:'10px', color:'#64748b'}}>{exp.time}</div>
                </div>
                <div style={{fontWeight:'bold', color:'#ef4444'}}>-${exp.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
          
          <div style={styles.budgetSummary}>
             <div style={{fontSize:'12px', color:'#64748b'}}>Total Spent Today</div>
             <div style={{fontSize:'20px', fontWeight:'bold', color:'#0f172a'}}>${expenses.reduce((a,b)=>a+b.amount,0).toFixed(2)}</div>
          </div>
        </div>

      </div>

      {/* AI CHAT (Kept same as before) */}
      {isChatOpen && (
        <div style={styles.chatWindow}>
           <div style={styles.chatHeader}>
             <strong>WealthOS AI</strong>
             <X size={20} onClick={() => setIsChatOpen(false)} style={{cursor:'pointer'}} />
           </div>
           <div style={styles.chatBody}>
             {messages.map((msg, i) => (
               <div key={i} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', marginBottom:'10px', maxWidth:'90%' }}>
                 <div style={msg.sender === 'user' ? styles.userBubble : styles.botBubble}>{msg.text}</div>
               </div>
             ))}
             {isTyping && <div style={{fontSize:'10px', color:'#94a3b8'}}>AI is calculating opportunity cost...</div>}
             <div ref={messagesEndRef} />
           </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px', fontFamily: '"Inter", sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' },
  brand: { display: 'flex', gap: '10px', alignItems: 'center' },
  title: { fontSize: '22px', fontWeight: '800', margin: 0 },
  badge: { fontSize: '10px', background: '#2563eb', color: '#fff', padding: '3px 8px', borderRadius: '12px', verticalAlign: 'middle' },
  wallet: { background: '#fff', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #e2e8f0', display: 'flex', gap: '8px' },
  
  mainGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' },
  
  glassCard: { background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  chartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bigPrice: { fontSize: '28px', fontWeight: '900' },
  holdingTag: { fontSize: '11px', color: '#64748b', fontWeight: '600', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' },
  select: { padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '16px' },
  timeSelector: { display: 'flex', gap: '5px' },
  timeBtn: { border: '1px solid #e2e8f0', background: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' },
  tooltip: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '10px' },

  tradeControls: { display: 'flex', gap: '15px', marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' },
  buyBtn: { flex: 1, backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' },
  sellBtn: { flex: 1, backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(239, 68, 68, 0.2)' },

  // EXPENSE PANEL
  sidePanel: { background: '#fff', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  addExpBtn: { fontSize: '10px', background: '#0f172a', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' },
  expenseList: { flex: 1, overflowY: 'auto' },
  expenseItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' },
  iconBox: { width: '32px', height: '32px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' },
  budgetSummary: { marginTop: '20px', background: '#f8fafc', padding: '15px', borderRadius: '12px', textAlign: 'center' },

  // CHAT (Simplified for space)
  chatWindow: { position: 'fixed', bottom: '20px', right: '20px', width: '300px', height: '400px', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', zIndex: 100, border: '1px solid #e2e8f0' },
  chatHeader: { padding: '12px', background: '#0f172a', color: '#fff', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between' },
  chatBody: { flex: 1, padding: '12px', overflowY: 'auto' },
  userBubble: { background: '#2563eb', color: '#fff', padding: '8px 12px', borderRadius: '12px 12px 0 12px', fontSize: '12px' },
  botBubble: { background: '#f1f5f9', color: '#0f172a', padding: '8px 12px', borderRadius: '12px 12px 12px 0', fontSize: '12px' }
};

export default WealthDashboard;