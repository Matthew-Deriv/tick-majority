from flask import Flask, send_from_directory, jsonify
import os
import argparse
from tick_fetcher import get_latest_tick

app = Flask(__name__)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/tick/<symbol>')
def get_latest_tick_api(symbol):
    """Get latest tick for a symbol"""
    try:
        tick_data = get_latest_tick(symbol)
        
        if tick_data:
            return jsonify({
                'price': tick_data['price'],
                'time': tick_data['time'],
                'symbol': tick_data['symbol'],
                'has_new_tick': True
            })
        else:
            return jsonify({
                'has_new_tick': False
            })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'has_new_tick': False
        }), 500

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Run the Tick-Majority trading app')
    parser.add_argument('--port', type=int, default=5000, help='Port to run the server on')
    args = parser.parse_args()
    
    # Disable werkzeug logging to reduce spam
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    # Run the app on the specified port
    app.run(debug=True, port=args.port)
