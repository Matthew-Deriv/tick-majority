import asyncio
import websockets
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket API URL
WS_URL = "wss://blue.derivws.com/websockets/v3?app_id=16929"

# Global variable to store last tick time per symbol
last_tick_times = {}

async def fetch_latest_tick(symbol):
    """
    Fetch latest tick for a specific symbol from Deriv WebSocket API
    
    Args:
        symbol (str): The trading symbol to fetch data for (e.g., '1HZ100V', 'R_50')
    
    Returns:
        dict: The tick data if new, None if same timestamp
    """
    global last_tick_times
    
    # Request payload for fetching latest tick
    request_message = {
        "ticks_history": symbol,
        "count": 1,
        "end": "latest"
    }
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            await websocket.send(json.dumps(request_message))
            response = await websocket.recv()
            data = json.loads(response)
            
            if data.get('msg_type') == 'history' and data.get('history'):
                current_time = data['history']['times'][0]
                current_price = data['history']['prices'][0]
                
                # Check if this is a new tick (different timestamp)
                last_time = last_tick_times.get(symbol)
                
                if last_time is None or current_time != last_time:
                    # Update last tick time for this symbol
                    last_tick_times[symbol] = current_time
                    
                    tick_data = {
                        'price': current_price,
                        'time': current_time,
                        'symbol': symbol
                    }
                    
                    logger.info(f"🎯 New tick for {symbol}: {current_price} at {current_time}")
                    return tick_data
                else:
                    logger.debug(f"⏸️ Same timestamp {current_time} for {symbol}, no new tick")
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
