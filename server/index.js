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

app.post('/send-sms', async (req, res) => {
  try {
    const { stock, price, balance } = req.body;
    await twilioClient.messages.create({
      body: `WealthOS Alert: Purchased ${stock} @ ₹${price}. Wallet Balance: ₹${balance}`,
      from: process.env.TWILIO_FROM_NUMBER,
      to: process.env.USER_PHONE_NUMBER
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Twilio Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

server.listen(5000, () => {
  console.log(`WealthOS Simulation Engine Active on Port 5000`);
});