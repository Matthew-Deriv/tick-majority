// Global variables
let chart;
let tickHistory = [];
let tickStream;
let activeSymbols = [];
let selectedSymbol = '';
let lastPrice = null;
let ws;

// DOM elements
const symbolSelect = document.getElementById('symbol');
const durationSlider = document.getElementById('duration');
const durationValue = document.getElementById('duration-value');
const minUpticksSlider = document.getElementById('min-upticks');
const minUpticksValue = document.getElementById('min-upticks-value');
const stakeInput = document.getElementById('stake');
const houseEdgeTypeSelect = document.getElementById('house-edge-type');
const houseEdgeInput = document.getElementById('house-edge');
const fairPriceElement = document.getElementById('fair-price');
const appliedHouseEdgeElement = document.getElementById('applied-house-edge');
const totalPriceElement = document.getElementById('total-price');
const contractsElement = document.getElementById('contracts');
const potentialPayoutElement = document.getElementById('potential-payout');
const summaryStatementElement = document.getElementById('summary-statement');
const placeTradeButton = document.getElementById('place-trade');
const currentTickElement = document.querySelector('#current-tick span');
const tickDirectionElement = document.querySelector('#tick-direction span');
const tickHistoryElement = document.querySelector('#tick-history span');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    connectWebSocket();
    setupEventListeners();
});

// Initialize Chart.js
function initChart() {
    const ctx = document.getElementById('tickChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price',
                data: [],
                borderColor: '#2a9d8f',
                backgroundColor: 'rgba(42, 157, 143, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 3,
                pointBackgroundColor: '#2a9d8f'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Tick'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Price'
                    }
                }
            },
            animation: {
                duration: 0
            }
        }
    });
}

// Connect to Deriv WebSocket API
function connectWebSocket() {
    // Create WebSocket connection
    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    
    ws.onopen = function(evt) {
        console.log('Connection opened');
        // Get active symbols once connected
        requestActiveSymbols();
    };
    
    ws.onmessage = function(msg) {
        const response = JSON.parse(msg.data);
        
        // Handle different message types
        if (response.msg_type === 'active_symbols') {
            handleActiveSymbols(response.active_symbols);
        } else if (response.msg_type === 'tick') {
            handleTickUpdate(response.tick);
        } else if (response.msg_type === 'history') {
            handleTickHistory(response.history);
        }
    };
    
    ws.onclose = function(evt) {
        console.log('Connection closed');
    };
    
    ws.onerror = function(evt) {
        console.error('WebSocket error:', evt);
    };
}

// Request active symbols from API
function requestActiveSymbols() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            active_symbols: 'brief',
            product_type: 'basic'
        }));
    }
}

// Handle active symbols response
function handleActiveSymbols(symbols) {
    activeSymbols = symbols;
    
    // Clear existing options
    symbolSelect.innerHTML = '';
    
    // Add options for each symbol
    symbols.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol.symbol;
        option.textContent = `${symbol.display_name} (${symbol.symbol})`;
        symbolSelect.appendChild(option);
    });
    
    // Select first symbol by default
    if (symbols.length > 0) {
        selectedSymbol = symbols[0].symbol;
        symbolSelect.value = selectedSymbol;
        subscribeToTickStream(selectedSymbol);
    }
}

// Subscribe to tick stream for a symbol
function subscribeToTickStream(symbol) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Unsubscribe from previous stream if exists
        if (tickStream) {
            ws.send(JSON.stringify({
                forget: tickStream
            }));
        }
        
        // Subscribe to new tick stream
        ws.send(JSON.stringify({
            ticks: symbol,
            subscribe: 1
        }));
        
        // Request recent tick history
        ws.send(JSON.stringify({
            ticks_history: symbol,
            count: 20,
            end: 'latest',
            style: 'ticks'
        }));
    }
}

// Handle tick history response
function handleTickHistory(history) {
    // Reset tick history
    tickHistory = [];
    
    // Process historical ticks
    history.prices.forEach((price, index) => {
        const timestamp = history.times[index];
        addTick({
            symbol: history.symbol,
            price: price,
            epoch: timestamp
        }, true);
    });
    
    // Update calculations
    updateCalculations();
}

// Handle tick update
function handleTickUpdate(tick) {
    // Store tick stream ID for unsubscribe
    tickStream = tick.id;
    
    // Add new tick
    addTick(tick, false);
    
    // Update calculations
    updateCalculations();
}

// Add a tick to history and update chart
function addTick(tick, isHistory) {
    const price = parseFloat(tick.price);
    const time = new Date(tick.epoch * 1000).toLocaleTimeString();
    
    // Add to tick history
    tickHistory.push({
        price: price,
        time: time
    });
    
    // Keep only the last 20 ticks
    if (tickHistory.length > 20) {
        tickHistory.shift();
    }
    
    // Update chart
    updateChart();
    
    // Update UI if not loading history
    if (!isHistory) {
        // Update current price
        currentTickElement.textContent = price.toFixed(5);
        
        // Update direction
        if (lastPrice !== null) {
            if (price > lastPrice) {
                tickDirectionElement.textContent = '↑ Up';
                tickDirectionElement.style.color = 'green';
            } else if (price < lastPrice) {
                tickDirectionElement.textContent = '↓ Down';
                tickDirectionElement.style.color = 'red';
            } else {
                tickDirectionElement.textContent = '→ Same';
                tickDirectionElement.style.color = 'gray';
            }
        }
        
        // Update last price
        lastPrice = price;
        
        // Update tick history display
        updateTickHistoryDisplay();
    }
}

// Update chart with tick history
function updateChart() {
    // Update chart data
    chart.data.labels = tickHistory.map((tick, index) => index + 1);
    chart.data.datasets[0].data = tickHistory.map(tick => tick.price);
    
    // Update chart
    chart.update();
}

// Update tick history display
function updateTickHistoryDisplay() {
    // Show last 5 ticks with direction indicators
    const lastFiveTicks = tickHistory.slice(-5).map((tick, index, arr) => {
        if (index === 0 || arr[index - 1] === undefined) {
            return tick.price.toFixed(5);
        }
        
        const prevPrice = arr[index - 1].price;
        if (tick.price > prevPrice) {
            return `${tick.price.toFixed(5)} ↑`;
        } else if (tick.price < prevPrice) {
            return `${tick.price.toFixed(5)} ↓`;
        } else {
            return `${tick.price.toFixed(5)} →`;
        }
    });
    
    tickHistoryElement.textContent = lastFiveTicks.join(' | ');
}

// Setup event listeners
function setupEventListeners() {
    // Symbol selection change
    symbolSelect.addEventListener('change', (e) => {
        selectedSymbol = e.target.value;
        subscribeToTickStream(selectedSymbol);
    });
    
    // Duration slider change
    durationSlider.addEventListener('input', (e) => {
        const duration = parseInt(e.target.value);
        durationValue.textContent = `${duration} ticks`;
        
        // Update min-upticks max value
        minUpticksSlider.max = duration;
        
        // Ensure min-upticks is not greater than duration
        if (parseInt(minUpticksSlider.value) > duration) {
            minUpticksSlider.value = duration;
            minUpticksValue.textContent = `${duration} ticks`;
        }
        
        updateCalculations();
    });
    
    // Min-upticks slider change
    minUpticksSlider.addEventListener('input', (e) => {
        const minUpticks = parseInt(e.target.value);
        minUpticksValue.textContent = `${minUpticks} ticks`;
        updateCalculations();
    });
    
    // Stake input change
    stakeInput.addEventListener('input', updateCalculations);
    
    // House edge type change
    houseEdgeTypeSelect.addEventListener('change', updateCalculations);
    
    // House edge input change
    houseEdgeInput.addEventListener('input', updateCalculations);
    
    // Place trade button
    placeTradeButton.addEventListener('click', placeTrade);
}

// Calculate binomial coefficient (n choose k)
function binomialCoefficient(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 1; i <= k; i++) {
        result *= (n + 1 - i) / i;
    }
    
    return Math.round(result);
}

// Calculate binomial probability
function binomialProbability(n, k, p) {
    let probability = 0;
    
    for (let i = k; i <= n; i++) {
        probability += binomialCoefficient(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    
    return probability;
}

// Calculate tick majority contracts
function tickMajorityContracts(stake, n, k, houseEdge, p = 0.5) {
    // Calculate fair price (binomial probability)
    const fairPrice = binomialProbability(n, k, p);
    
    // Total price per contract (additive house edge)
    const totalPrice = fairPrice + houseEdge;
    
    // Number of contracts
    const contracts = stake / totalPrice;
    
    return {
        contracts,
        fairPrice,
        houseEdge,
        totalPrice
    };
}

// Update calculations based on form inputs
function updateCalculations() {
    // Get form values
    const duration = parseInt(durationSlider.value);
    const minUpticks = parseInt(minUpticksSlider.value);
    const stake = parseFloat(stakeInput.value) || 0;
    const houseEdgeType = houseEdgeTypeSelect.value;
    let houseEdge = parseFloat(houseEdgeInput.value) || 0;
    
    // Calculate fair price
    const fairPrice = binomialProbability(duration, minUpticks, 0.5);
    
    // Adjust house edge based on type
    if (houseEdgeType === 'percentage') {
        houseEdge = fairPrice * (houseEdge / 100);
    }
    
    // Calculate contracts
    const result = tickMajorityContracts(stake, duration, minUpticks, houseEdge, 0.5);
    
    // Update UI
    fairPriceElement.textContent = result.fairPrice.toFixed(5);
    appliedHouseEdgeElement.textContent = result.houseEdge.toFixed(5);
    totalPriceElement.textContent = result.totalPrice.toFixed(5);
    contractsElement.textContent = result.contracts.toFixed(2) + ' contracts';
    
    const potentialPayout = result.contracts;
    potentialPayoutElement.textContent = '$' + potentialPayout.toFixed(2);
    
    // Update summary statement
    summaryStatementElement.textContent = `For a $${stake.toFixed(2)} stake, if there are at least ${minUpticks} up-ticks in the next ${duration} ticks, you win $${potentialPayout.toFixed(2)}.`;
    
    // Enable/disable place trade button
    placeTradeButton.disabled = stake <= 0 || tickHistory.length < 5;
}

// Place trade function (simulation)
function placeTrade() {
    // Get form values
    const duration = parseInt(durationSlider.value);
    const minUpticks = parseInt(minUpticksSlider.value);
    const stake = parseFloat(stakeInput.value) || 0;
    
    // Disable button during trade
    placeTradeButton.disabled = true;
    placeTradeButton.textContent = 'Trading...';
    
    // Simulate trade (in a real implementation, this would call the API)
    let tickCount = 0;
    let upTickCount = 0;
    let tradeInterval;
    
    // Create a copy of current tick history for reference
    const startPrice = tickHistory[tickHistory.length - 1].price;
    
    tradeInterval = setInterval(() => {
        // Check if we've reached the duration
        if (tickCount >= duration) {
            clearInterval(tradeInterval);
            
            // Determine outcome
            const won = upTickCount >= minUpticks;
            
            // Show result
            if (won) {
                const payout = parseFloat(potentialPayoutElement.textContent.replace('$', ''));
                alert(`Congratulations! You won $${payout.toFixed(2)}!`);
            } else {
                alert(`Sorry, you lost. There were ${upTickCount} up-ticks out of ${duration}.`);
            }
            
            // Reset button
            placeTradeButton.disabled = false;
            placeTradeButton.textContent = 'Place Trade';
            
            return;
        }
        
        // Wait for next tick
        if (tickHistory.length > 0 && tickHistory[tickHistory.length - 1].price !== startPrice) {
            // Count this as a tick
            tickCount++;
            
            // Check if it's an up tick
            if (tickHistory[tickHistory.length - 1].price > startPrice) {
                upTickCount++;
            }
            
            // Update progress
            placeTradeButton.textContent = `Trading... (${tickCount}/${duration})`;
        }
    }, 1000);
}
