import websocket
import json
import threading
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DerivTickFetcher:
    def __init__(self):
        self.ws = None
        self.current_symbol = "R_50"
        self.last_tick_time = None
        self.latest_tick_data = None
        self.is_connected = False
        self.lock = threading.Lock()
        self.connect()
    
    def connect(self):
        """Connect to Deriv WebSocket with auto-reconnect"""
        try:
            logger.info("🔌 Connecting to Deriv WebSocket...")
            self.ws = websocket.WebSocketApp(
                "wss://blue.derivws.com/websockets/v3?app_id=16929",
                on_open=self.on_open,
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close
            )
            
            # Start WebSocket in a separate thread
            self.ws_thread = threading.Thread(target=self.ws.run_forever)
            self.ws_thread.daemon = True
            self.ws_thread.start()
            
            # Wait a moment for connection
            time.sleep(1)
            
        except Exception as e:
            logger.error(f"❌ Error connecting to WebSocket: {e}")
            self.reconnect()
    
    def on_open(self, ws):
        """Called when WebSocket connection opens"""
        logger.info("✅ WebSocket connected successfully")
        self.is_connected = True
        # Request initial tick for current symbol
        self.request_tick(self.current_symbol)
    
    def on_message(self, ws, message):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(message)
            
            if data.get('msg_type') == 'history' and data.get('history'):
                with self.lock:
                    current_time = data['history']['times'][0]
                    current_price = data['history']['prices'][0]
                    
                    # Always store the latest tick data
                    self.latest_tick_data = {
                        'price': current_price,
                        'time': current_time,
                        'symbol': self.current_symbol
                    }
                        
        except json.JSONDecodeError as e:
            logger.error(f"❌ Error parsing message: {e}")
        except Exception as e:
            logger.error(f"❌ Error handling message: {e}")
    
    def on_error(self, ws, error):
        """Handle WebSocket errors"""
        logger.error(f"❌ WebSocket error: {error}")
        self.is_connected = False
    
    def on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket close"""
        logger.warning(f"🔌 WebSocket closed: {close_status_code} - {close_msg}")
        self.is_connected = False
        self.reconnect()
    
    def reconnect(self):
        """Reconnect to WebSocket after a delay"""
        logger.info("🔄 Attempting to reconnect in 2 seconds...")
        time.sleep(2)
        self.connect()
    
    def request_tick(self, symbol):
        """Request latest tick for a symbol"""
        if not self.is_connected or not self.ws:
            return False
            
        try:
            message = {
                "ticks_history": symbol,
                "count": 1,
                "end": "latest"
            }
            self.ws.send(json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"❌ Error sending tick request: {e}")
            self.is_connected = False
            self.reconnect()
            return False
    
    def get_latest_tick(self, symbol):
        """Get latest tick for a symbol, returns new tick data or None"""
        # Change symbol if needed
        if symbol != self.current_symbol:
            logger.info(f"🔄 Changing symbol from {self.current_symbol} to {symbol}")
            self.current_symbol = symbol
            self.last_tick_time = None  # Reset for new symbol
        
        # Request latest tick once
        if not self.request_tick(symbol):
            return None
        
        # Wait for response
        time.sleep(0.2)
        
        # Check if we have new tick data
        with self.lock:
            if (self.latest_tick_data and 
                self.latest_tick_data.get('symbol') == symbol):
                
                current_tick_time = self.latest_tick_data.get('time')
                
                # Check if this is a new tick (different timestamp)
                if self.last_tick_time is None or current_tick_time != self.last_tick_time:
                    # We have a new tick!
                    tick_data = self.latest_tick_data.copy()
                    self.last_tick_time = current_tick_time  # Update last tick time
                    logger.info(f"🎯 Returning new tick: {tick_data['price']} at {tick_data['time']}")
                    return tick_data
                else:
                    logger.debug(f"⏸️ Same timestamp {current_tick_time}, no new tick")
                    return None
        
        # No tick data available
        logger.debug(f"⏰ No tick data available for {symbol}")
        return None

# Global instance
tick_fetcher = None

def get_tick_fetcher():
    """Get or create the global tick fetcher instance"""
    global tick_fetcher
    if tick_fetcher is None:
        tick_fetcher = DerivTickFetcher()
    return tick_fetcher
