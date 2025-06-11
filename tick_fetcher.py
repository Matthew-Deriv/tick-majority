import asyncio
import websockets
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket API URL
WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=16929"

# Simple timestamp tracking for 1HZ100V only
last_tick_time = None
last_request_time = 0
FIXED_SYMBOL = '1HZ100V'

async def fetch_latest_tick(symbol):
    """
    Fetch latest tick for 1HZ100V from Deriv WebSocket API
    Each call creates a fresh WebSocket connection (like sample.py)
    
    Args:
        symbol (str): The trading symbol to fetch data for (should be '1HZ100V')
    
    Returns:
        dict: The tick data if new, None if same timestamp
    """
    global last_tick_time, last_request_time
    import time
    
    # Only process requests for our fixed symbol
    if symbol != FIXED_SYMBOL:
        logger.warning(f"⚠️ Ignoring request for {symbol} - only {FIXED_SYMBOL} is supported")
        return None
    
    # Throttle requests - only allow one request per 100ms
    current_time = time.time()
    if current_time - last_request_time < 0.1:
        logger.debug(f"⏸️ Throttling request for {symbol}")
        return None
    
    last_request_time = current_time
    
    # Request payload for fetching latest tick
    request_message = {
        "ticks_history": symbol,
        "count": 1,
        "end": "latest"
    }
    
    try:
        # Create fresh WebSocket connection for each request (like sample.py)
        async with websockets.connect(WS_URL) as websocket:
            await websocket.send(json.dumps(request_message))
            response = await websocket.recv()
            data = json.loads(response)
            
            if data.get('msg_type') == 'history' and data.get('history'):
                tick_time = data['history']['times'][0]
                tick_price = data['history']['prices'][0]
                
                # Check if this is a new tick (different timestamp)
                if last_tick_time is None or tick_time != last_tick_time:
                    # Update last tick time
                    last_tick_time = tick_time
                    
                    tick_data = {
                        'price': tick_price,
                        'time': tick_time,
                        'symbol': symbol
                    }
                    
                    logger.info(f"🎯 New tick for {symbol}: {tick_price} at {tick_time}")
                    return tick_data
                else:
                    logger.debug(f"⏸️ Same timestamp {tick_time} for {symbol}, no new tick")
                    return None
            else:
                logger.error(f"❌ Invalid response for {symbol}: {data}")
                return None
                
    except Exception as e:
        logger.error(f"❌ Error fetching tick for {symbol}: {e}")
        return None

def get_latest_tick(symbol):
    """
    Synchronous wrapper for async fetch_latest_tick function
    
    Args:
        symbol (str): The trading symbol to fetch data for
    
    Returns:
        dict: The tick data if new, None if same timestamp
    """
    return asyncio.run(fetch_latest_tick(symbol))
