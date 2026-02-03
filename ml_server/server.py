from flask import Flask, jsonify
from flask_cors import CORS
import random

app = Flask(__name__)
CORS(app)

@app.route('/predict', methods=['GET'])
def predict():
    # Simulate an AI prediction
    predicted_price = round(random.uniform(140, 160), 2)
    return jsonify({
        'price': predicted_price,
        'signal': 'BUY' if predicted_price > 150 else 'SELL',
        'confidence': round(random.uniform(0.80, 0.99), 2)
    })

if __name__ == '__main__':
    print("🦁 Python ML Brain Active on Port 5001")
    app.run(port=5001)