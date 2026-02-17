from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from sklearn.linear_model import LinearRegression

app = Flask(__name__)
CORS(app)

# 🧠 EXISTING PREDICTION LOGIC
@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    prices = data.get('history', [])
    if len(prices) < 5:
        return jsonify({"error": "Need more data points"}), 400

    X = np.array(range(len(prices))).reshape(-1, 1)
    y = np.array(prices).reshape(-1, 1)
    model = LinearRegression().fit(X, y)
    
    slope = model.coef_[0][0]
    current_price = prices[-1]
    estimated_r = max(0.05, min(0.25, (slope / current_price) * 252))

    return jsonify({
        "1yr": round(current_price * (1 + estimated_r)**1, 2),
        "5yr": round(current_price * (1 + estimated_r)**5, 2),
        "10yr": round(current_price * (1 + estimated_r)**10, 2),
        "rate": round(estimated_r * 100, 2)
    })

# 🍔 NEW: OPPORTUNITY COST ENGINE (For Goldman Sachs Demo)
@app.route('/opportunity-cost', methods=['POST'])
def calculate_cost():
    data = request.json
    amount = float(data.get('amount', 0))
    # We use a standard 12% aggressive growth for the "Opportunity" logic
    rate = 0.12 
    future_val = amount * (1 + rate)**10
    
    return jsonify({
        "future_value": round(future_val, 2),
        "message": f"Bhai, this ${amount} could grow to ${round(future_val, 2)} in 10 years."
    })

if __name__ == '__main__':
    print("WealthOS ML Inference Server Active | Port 5001")
    app.run(port=5001)