import asyncio
import websockets
import json
import numpy as np
from flask import Flask, jsonify, request
from serpapi import GoogleSearch

app = Flask(__name__)

# WebSocket API URL
WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=16929"
DEFAULT_SYMBOL = 'R_50'  # Default symbol for GET requests

# Function to fetch candle data from WebSocket
async def fetch_candles(symbol):
    """
    Fetch candle data for a specific symbol from Deriv WebSocket API

    Args:
        symbol (str): The trading symbol to fetch data for (e.g., 'R_50', 'R_100')

    Returns:
        dict: The parsed JSON response from the WebSocket API
    """
    # Request payload for fetching historical candle data
    request_message = {
        "ticks_history": symbol,
        "adjust_start_time": 1,
        "count": 4321,
        "end": "latest",
        "start": 1,
        "style": "candles",
        "granularity": 600
    }

    async with websockets.connect(WS_URL) as websocket:
        await websocket.send(json.dumps(request_message))  # Send request
        response = await websocket.recv()  # Receive response
        return json.loads(response)  # Parse JSON

@app.route('/')
def index():
    """
    Root endpoint that provides basic information about the API
    """
    return jsonify({
        "name": "Deriv API Server",
        "description": "A Flask server that interfaces with Deriv's WebSocket API",
        "endpoints": [
            {"path": "/", "method": "GET", "description": "This information page"},
            {"path": "/candles", "method": "GET", "description": "Get volatility and drift for default symbol (R_50)"},
            {"path": "/candles", "method": "POST", "description": "Get volatility and drift for specified symbol"},
            {"path": "/active-symbols", "method": "GET", "description": "Get active symbols from Deriv API"},
            {"path": "/get_ads", "method": "POST", "description": "Get Google ads for a specified keyword"},
            {"path": "/api", "method": "POST", "description": "Unified API endpoint for all operations"}
        ]
    })

@app.route('/candles', methods=['GET', 'POST'])
def get_vol_drift_for_symbol():
    """
    Endpoint to get volatility and drift calculations for a specified symbol

    Supports both GET and POST methods:
    - GET: Always uses default symbol (R_50)
    - POST: Uses symbol from JSON body

    Returns:
        JSON: Contains volatility and drift calculations
    """
    try:
        # Determine the symbol to use
        if request.method == 'POST' and request.is_json:
            data = request.get_json()
            if not data or 'symbol' not in data:
                return jsonify({"error": "Missing symbol in request"}), 400
            symbol = data['symbol']
        else:  # GET request
            symbol = DEFAULT_SYMBOL

        # Fetch WebSocket response
        candle_data = asyncio.run(fetch_candles(symbol))

        # Validate response structure
        if 'candles' not in candle_data:
            return jsonify({"error": "Invalid response from WebSocket"}), 500

        candles = candle_data['candles']

        # Extract closing prices
        closes = [item['close'] for item in candles]

        # Calculate yearly intervals (365 days, granularity = 600s per candle)
        intervals = (1 * 365 * 86400) / 600  # 86400 is seconds per day

        # Compute **log returns**
        log_returns = np.diff(np.log(closes))

        # Calculate **Annualized Volatility**
        volatility = np.std(log_returns) * np.sqrt(intervals)

        # Calculate **Annualized Mean Return (Drift)**
        mean_return = np.mean(log_returns) * intervals

        result = {'volatility': volatility, 'drift': mean_return}
        print(f"Computed Data for {symbol}: {result}")  # Log for debugging
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api', methods=['POST'])
def api_endpoint():
    """
    Unified API endpoint for all operations

    Expects a JSON body with:
    - operation: The operation to perform
    - Additional parameters specific to the operation

    Returns:
        JSON: Operation result or error
    """
    try:
        data = request.get_json()

        if not data or 'operation' not in data:
            return jsonify({"error": "Missing operation in request"}), 400

        operation = data['operation']

        # Handle different operations
        if operation == 'volatility_drift':
            if 'symbol' not in data:
                return jsonify({"error": "Missing symbol parameter"}), 400

            # Reuse existing function by creating a mock request
            request.json = {'symbol': data['symbol']}
            return get_vol_drift_for_symbol()

        elif operation == 'get_active_symbols':
            return get_active_symbols()

        elif operation == 'get_ads':
            if 'keyword' not in data:
                return jsonify({"error": "Missing keyword parameter"}), 400
            return get_ads_for_keyword(data['keyword'])

        else:
            return jsonify({"error": f"Unknown operation: {operation}"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/active-symbols', methods=['GET'])
def get_active_symbols():
    """
    Endpoint to get active symbols from Deriv API

    Returns:
        JSON: List of active symbols
    """
    try:
        # Request payload for fetching active symbols
        request_message = {
            "active_symbols": "brief",
            "product_type": "basic"
        }

        # Fetch WebSocket response
        async def fetch_active_symbols():
            async with websockets.connect(WS_URL) as websocket:
                await websocket.send(json.dumps(request_message))
                response = await websocket.recv()
                return json.loads(response)

        active_symbols_data = asyncio.run(fetch_active_symbols())

        return jsonify(active_symbols_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_ads', methods=['POST'])
def get_ads_for_keyword(keyword=None):
    """
    Endpoint to get Google ads for a specified keyword

    Expects a JSON body with:
    - keyword: The search term to find ads for

    Returns:
        JSON: Google ads results or a message if no ads found
    """
    try:
        # Get keyword from request if not provided as parameter
        if keyword is None:
            if not request.is_json:
                return jsonify({"error": "Request must be JSON"}), 400

            data = request.get_json()
            if not data or 'keyword' not in data:
                return jsonify({"error": "Missing keyword in request"}), 400

            keyword = data['keyword']

        # Set up SerpAPI parameters
        params = {
            "api_key": "66335814a8e66287c5c8e0195b3bff2507546d70fff5455e52c4930738d7d891",
            "q": keyword,
            "gl": "us",
            "hl": "en"
        }

        # Perform the search
        search = GoogleSearch(params)
        results = search.get_dict()

        # Return ads or a message
        if results.get("ads", []):
            return jsonify(results['ads'])
        else:
            return jsonify({"message": "No ads found for this keyword"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Note: PythonAnywhere will handle the app.run() part, so we don't need the if __name__ == '__main__' block
