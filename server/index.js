const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// 🟢 MOCK ASSETS & STARTING PRICES
const ASSETS = {
  'TSLA': 220, 'AAPL': 175, 'NVDA': 850, 'MSFT': 410,
  'JPM': 190, 'GS': 395, 'GC=F': 2400, 'SI=F': 28
};

let marketHistory = [];

// ⚡ GENERATE 2 YEARS OF REALISTIC FAKE DATA INSTANTLY
const generateMockHistory = () => {
  console.log("🛠 Generating High-Fidelity Market Simulation...");
  const history = [];
  const now = new Date();
  const days = 730; // 2 Years

  // Start with base prices
  let currentPrices = { ...ASSETS };
  const symbols = Object.keys(currentPrices);

  for (let i = days; i > 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    let dataPoint = { time: date.toISOString().split('T')[0] }; // YYYY-MM-DD

    // Walk the price randomly for each stock with trend cycles
    symbols.forEach((symbol, idx) => {
      // Each stock gets its OWN unique phase offset so lines don't overlap
      const phase = (idx * 1.3) + (idx * 0.7);
      const cycle = Math.sin((i + phase * 50) * 0.025) * 0.018;
      const shortCycle = Math.sin((i + phase * 30) * 0.12) * 0.01;
      const microCycle = Math.sin((i + phase * 20) * 0.4) * 0.005;
      const noise = (Math.random() - 0.5) * 0.025;
      const change = 1 + cycle + shortCycle + microCycle + noise;
      currentPrices[symbol] = parseFloat((currentPrices[symbol] * change).toFixed(2));
      dataPoint[symbol] = currentPrices[symbol];
    });

    history.push(dataPoint);
  }
  return history;
};

// Generate data ONCE on server start
marketHistory = generateMockHistory();
console.log(`✅ Loaded ${marketHistory.length} days of Simulation Data`);

io.on('connection', (socket) => {
  console.log('Client connected. Sending History...');
  socket.emit('marketHistory', marketHistory);
});

// ⚡ LIVE TICKER (Updates every 2 seconds)
setInterval(() => {
  const lastPoint = marketHistory[marketHistory.length - 1];
  const newPoint = { time: new Date().toISOString() };
  
  Object.keys(ASSETS).forEach(symbol => {
    const lastPrice = lastPoint[symbol];
    const change = 1 + (Math.random() * 0.005 - 0.0025); // Small jitter
    newPoint[symbol] = parseFloat((lastPrice * change).toFixed(2));
    
    // Update last point in history so the line connects
    lastPoint[symbol] = newPoint[symbol];
  });
  
  io.emit('marketPulse', [newPoint]);
}, 2000);

// 📱 TWILIO SMS ROUTE
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Setup Gemini If Key Exists
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
const OPENROUTER_MODELS = ['meta-llama/llama-3.1-8b-instruct', 'mistralai/mistral-7b-instruct'];
const GEMINI_TIMEOUT_MS = 12000;
const GEMINI_RETRIES_PER_MODEL = 2;
const OPENROUTER_TIMEOUT_MS = 12000;
const COMPANY_TO_TICKER = {
  APPLE: 'AAPL',
  TESLA: 'TSLA',
  NVIDIA: 'NVDA',
  MICROSOFT: 'MSFT',
  JPMORGAN: 'JPM',
  GOLDMAN: 'GS'
};

const withTimeout = (promise, timeoutMs, label = 'operation') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs))
  ]);
};

const generateGeminiReply = async (prompt) => {
  if (!genAI) throw new Error('Gemini not configured');

  let lastError = null;
  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= GEMINI_RETRIES_PER_MODEL; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS, 'Gemini');
        const response = await result.response;
        const text = response.text?.() || '';

        if (text.trim()) {
          return { text, modelName, attempt };
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('No response from Gemini');
};

const generateOpenRouterReply = async (prompt) => {
  if (!OPENROUTER_API_KEY) throw new Error('OpenRouter not configured');

  let lastError = null;
  for (const modelName of OPENROUTER_MODELS) {
    try {
      const response = await withTimeout(fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'WealthOS'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: 'You are WealthOS AI. Return strict JSON only with keys: reply, explainability.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 350
        })
      }), OPENROUTER_TIMEOUT_MS, 'OpenRouter');

      if (!response.ok) {
        throw new Error(`OpenRouter status ${response.status}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (text.trim()) {
        return { text, modelName, attempt: 1 };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('No response from OpenRouter');
};

const buildLocalAdvisorFallback = (message, context = {}) => {
  const holdings = Array.isArray(context?.holdings) ? context.holdings : [];
  const walletBalance = Number(context?.walletBalance || 0);
  const expenses = Array.isArray(context?.expenses) ? context.expenses : [];

  const largestHolding = holdings.length > 0
    ? holdings.reduce((max, h) => (h.totalInvested || 0) > (max.totalInvested || 0) ? h : max, holdings[0])
    : null;

  const spendToday = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const mentionPredict = /predict|forecast|outlook/i.test(String(message || ''));

  const lines = [];
  if (mentionPredict) {
    lines.push('I can still run deterministic in-app prediction actions now (for example: **Predict AAPL**).');
  }
  lines.push(`Current wallet balance tracked: **₹${walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}**.`);
  if (largestHolding?.symbol) {
    lines.push(`Largest holding by invested amount: **${largestHolding.symbol}**.`);
  }
  lines.push(`Recorded spend in latest list: **₹${spendToday.toLocaleString('en-IN', { maximumFractionDigits: 0 })}**.`);
  lines.push('Risk check: keep position sizing moderate and maintain liquidity for volatility spikes.');

  return {
    reply: `⚠️ LLM providers are temporarily unavailable, but I can still help with a reliable local analysis:\n\n${lines.map(l => `• ${l}`).join('\n')}`,
    explainability: [
      'Gemini/OpenRouter were unavailable or timed out.',
      'Generated response from portfolio context already present in-app.',
      'Trading tools and prediction actions remain fully operational.'
    ],
    fallback: true,
    localAdvisor: true
  };
};

const detectToolAction = (rawMessage = '') => {
  const message = String(rawMessage).trim();
  const upper = message.toUpperCase();
  const tokens = upper.match(/[A-Z=]+/g) || [];

  const resolveSymbol = (raw) => {
    if (!raw) return null;
    const normalized = String(raw).toUpperCase();
    if (ASSETS[normalized]) return normalized;
    return COMPANY_TO_TICKER[normalized] || null;
  };

  const inferSymbolFromMessage = () => {
    for (const t of tokens) {
      const resolved = resolveSymbol(t);
      if (resolved) return resolved;
    }

    for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
      if (upper.includes(name)) return ticker;
    }

    return null;
  };

  const buyMatch = upper.match(/BUY\s+([A-Z=]+)(?:\s+(\d+))?/);
  if (buyMatch) {
    const symbol = resolveSymbol(buyMatch[1]);
    if (symbol) return { type: 'buy', symbol, qty: Number(buyMatch[2] || 1) };
  }

  const sellMatch = upper.match(/SELL\s+([A-Z=]+)(?:\s+(\d+))?/);
  if (sellMatch) {
    const symbol = resolveSymbol(sellMatch[1]);
    if (symbol) return { type: 'sell', symbol, qty: Number(sellMatch[2] || 1) };
  }

  const predictMatch = upper.match(/PREDICT(?:ION|IONS)?\s+(?:OF\s+)?([A-Z=]+)/);
  if (predictMatch) {
    const symbol = resolveSymbol(predictMatch[1]);
    if (symbol) return { type: 'predict', symbol };
  }

  if (/(PREDICT|PREDICTION|FORECAST|OUTLOOK)/.test(upper)) {
    const symbol = inferSymbolFromMessage();
    if (symbol) {
      return { type: 'predict', symbol };
    }
  }

  if (upper.includes('NEWS')) {
    return { type: 'show_news' };
  }

  if (upper.includes('PORTFOLIO') || upper.includes('HOLDINGS') || upper.includes('SUMMARY')) {
    return { type: 'portfolio_summary' };
  }

  return null;
};

// 🩺 HEALTH CHECK
app.get('/health', (_req, res) => {
  const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER && process.env.MY_PHONE_NUMBER);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasOpenRouter = Boolean(OPENROUTER_API_KEY);

  res.json({
    status: 'ok',
    service: 'node-backend',
    uptimeSec: Math.floor(process.uptime()),
    marketHistoryLoaded: marketHistory.length > 0,
    twilioConfigured: hasTwilio,
    geminiConfigured: hasGemini,
    openRouterConfigured: hasOpenRouter,
    socketClients: io.engine.clientsCount
  });
});

// 🤖 LLM CHAT ROUTE
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ reply: 'Please enter a message.' });
    }

    const action = detectToolAction(message);
    if (action) {
      return res.json({
        reply: `✅ Understood. Running action: **${action.type}**${action.symbol ? ` for ${action.symbol}` : ''}${action.qty ? ` (qty ${action.qty})` : ''}.`,
        action,
        explainability: [
          'Detected an explicit or inferred command in your message.',
          'Mapped company names/tickers to an in-app action safely.',
          'Action flow is deterministic and works even if LLM is down.'
        ]
      });
    }
    
    if (!genAI && !OPENROUTER_API_KEY) {
      return res.json(buildLocalAdvisorFallback(message, context));
    }
    
    const systemPrompt = `
      You are WealthOS AI, an expert, professional, and slightly witty financial advisor assistant. 
      Act as if you are directly integrated into a trading platform.
      Return strict JSON only in this shape:
      {
        "reply": "string",
        "explainability": ["reason 1", "reason 2", "reason 3"]
      }
      Keep reply concise and practical.
      
      Here is the user's current platform context context:
      - Wallet Balance: ₹${context?.walletBalance}
      - Current Portfolio Holdings: ${JSON.stringify(context?.holdings || [])}
      - Most Recent Expenses: ${JSON.stringify(context?.expenses || [])}
      
      User's message: "${message}"
    `;

    let providerResult = null;
    let providerError = null;

    if (genAI) {
      try {
        providerResult = await generateGeminiReply(systemPrompt);
      } catch (err) {
        providerError = err;
      }
    }

    if (!providerResult && OPENROUTER_API_KEY) {
      try {
        providerResult = await generateOpenRouterReply(systemPrompt);
      } catch (err) {
        providerError = err;
      }
    }

    if (!providerResult) {
      console.error('LLM providers failed:', providerError?.message || providerError);
      return res.status(200).json(buildLocalAdvisorFallback(message, context));
    }

    const { text, modelName, attempt } = providerResult;

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    if (parsed && typeof parsed.reply === 'string') {
      return res.json({
        reply: parsed.reply,
        explainability: Array.isArray(parsed.explainability) ? parsed.explainability.slice(0, 3) : [],
        meta: { model: modelName, attempt }
      });
    }

    res.json({
      reply: text,
      explainability: [
        'Response generated from current wallet and holdings context.',
        'Risk and diversification heuristics were applied.',
        'Returned in fallback text mode because JSON parse failed.'
      ],
      meta: { model: modelName, attempt }
    });
  } catch (err) {
    console.error("Gemini Error:", err);
    const action = detectToolAction(req?.body?.message || '');
    if (action) {
      return res.status(200).json({
        reply: `⚠️ AI narrative is degraded, but I can still run **${action.type}**${action.symbol ? ` for ${action.symbol}` : ''}.`,
        action,
        explainability: [
          'Primary LLM call failed after retries/timeouts.',
          'Recovered by routing to deterministic in-app action.',
          'Core trading and prediction features remain available.'
        ],
        fallback: true
      });
    }

    res.status(200).json(buildLocalAdvisorFallback(req?.body?.message, req?.body?.context));
  }
});

app.post('/send-sms', async (req, res) => {
  try {
    const { stock, price, balance, action, customMessage } = req.body;
    const actionText = action === 'Sell' ? 'Sold' : action === 'Alert' ? 'Alert' : 'Purchased';
    const body = customMessage || `WealthOS Alert: ${actionText} ${stock} @ ₹${price}. Wallet Balance: ₹${balance}`;
    // Mute twilio errors if keys are not ready, don't crash loop
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      await twilioClient.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.MY_PHONE_NUMBER
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Twilio Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

server.listen(5000, () => {
  console.log(`WealthOS Simulation Engine Active on Port 5000`);
});