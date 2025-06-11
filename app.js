// Global variables
let chart;
let tickHistory = [];
let totalTickCount = 0; // Track total number of ticks generated
let lastPrice = 10000;
let tickInterval;
let contractActive = false;
let contractStartPrice = null;
let contractStartTickNumber = 0; // Track which tick number the contract started at
let contractTicks = [];
let contractDuration = 0;
let contractMinTicks = 0;
let isUpDirection = true; // Default to up direction

// WebSocket variables
let ws = null;
const currentSymbol = '1HZ100V'; // Fixed symbol - no longer changeable
let subscriptionId = null;
let lastTickTime = null; // Store the last tick timestamp to detect new ticks

// DOM Elements
const currentPriceElement = document.getElementById('currentPrice');
const priceDirectionElement = document.getElementById('priceDirection');
const tickHistoryElement = document.getElementById('tickHistory');
const durationSlider = document.getElementById('duration');
const durationValueElement = document.getElementById('durationValue');
const minUpticksSlider = document.getElementById('minUpticks');
const minUpticksValueElement = document.getElementById('minUpticksValue');
const minTicksLabel = document.getElementById('minTicksLabel');
const upDirectionBtn = document.getElementById('upDirection');
const downDirectionBtn = document.getElementById('downDirection');
const stakeInput = document.getElementById('stake');
const houseEdgeInput = document.getElementById('houseEdge');
const placeTradeButton = document.getElementById('placeTradeBtn');
const fairPriceElement = document.getElementById('fairPrice');
const appliedHouseEdgeElement = document.getElementById('appliedHouseEdge');
const totalPriceElement = document.getElementById('totalPrice');
const contractsElement = document.getElementById('contracts');
const potentialPayoutElement = document.getElementById('potentialPayout');
const tradeSummaryElement = document.getElementById('tradeSummary');
const activeContractElement = document.getElementById('activeContract');
const contractProgressElement = document.getElementById('contractProgress');
const upTickCountElement = document.getElementById('upTickCount');
const upTickTargetElement = document.getElementById('upTickTarget');
const progressBarElement = document.getElementById('progressBar');
const resultNotificationElement = document.getElementById('resultNotification');
const resultTitleElement = document.getElementById('resultTitle');
const resultMessageElement = document.getElementById('resultMessage');
const closeNotificationButton = document.getElementById('closeNotification');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the chart
    initChart();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start generating ticks
    startTickGenerator();
    
    // Initial calculations update
    updateCalculations();
});

// Initialize Plotly chart
function initChart() {
    const chartElement = document.getElementById('priceChart');
    
    const data = [{
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines+markers',
        line: {
            color: '#3498db',
            width: 2
        },
        marker: {
            size: 6,
            color: []
        },
        name: 'Price'
    }];
    
    const layout = {
        title: `Price Chart - ${currentSymbol}`,
        xaxis: {
            title: 'Tick',
            showgrid: true,
            zeroline: false
        },
        yaxis: {
            title: 'Price',
            showgrid: true,
            zeroline: false,
            tickformat: ',.2f'
        },
        margin: { t: 50, l: 50, r: 30, b: 50 },
        hovermode: 'closest',
        showlegend: false,
        shapes: [],
        annotations: []
    };
    
    const config = {
        responsive: true,
        displayModeBar: false
    };
    
    Plotly.newPlot(chartElement, data, layout, config);
    chart = chartElement;
}

// Set up event listeners
function setupEventListeners() {
    // Direction toggle buttons
    upDirectionBtn.addEventListener('click', () => {
        if (!isUpDirection) {
            isUpDirection = true;
            upDirectionBtn.classList.add('active');
            downDirectionBtn.classList.remove('active');
            minTicksLabel.textContent = 'Minimum Up-ticks:';
            updateCalculations();
        }
    });
    
    downDirectionBtn.addEventListener('click', () => {
        if (isUpDirection) {
            isUpDirection = false;
            downDirectionBtn.classList.add('active');
            upDirectionBtn.classList.remove('active');
            minTicksLabel.textContent = 'Minimum Down-ticks:';
            updateCalculations();
        }
    });
    
    // Duration slider
    durationSlider.addEventListener('input', () => {
        const duration = parseInt(durationSlider.value);
        durationValueElement.textContent = `${duration} ticks`;
        
        // Update min upticks slider max value
        minUpticksSlider.max = duration;
        
        // If current min upticks is greater than duration, adjust it
        if (parseInt(minUpticksSlider.value) > duration) {
            minUpticksSlider.value = duration;
            minUpticksValueElement.textContent = `${duration} ticks`;
        }
        
        updateCalculations();
    });
    
    // Min upticks slider
    minUpticksSlider.addEventListener('input', () => {
        const minUpticks = parseInt(minUpticksSlider.value);
        minUpticksValueElement.textContent = `${minUpticks} ticks`;
        updateCalculations();
    });
    
    // Stake input
    stakeInput.addEventListener('input', updateCalculations);
    
    // House edge input
    houseEdgeInput.addEventListener('input', updateCalculations);
    
    // Place trade button
    placeTradeButton.addEventListener('click', placeTrade);
    
    // Close notification button
    closeNotificationButton.addEventListener('click', () => {
        resultNotificationElement.classList.add('hidden');
    });
    
    // Symbol is now fixed to 1HZ100V - no selector needed
}

// Start the tick generator
function startTickGenerator() {
    // Start fetching ticks from Flask API every 300ms
    tickInterval = setInterval(fetchTick, 300);
}

// Connect to Deriv WebSocket
function connectWebSocket() {
    console.log('🔌 Attempting to connect to WebSocket...');
    ws = new WebSocket('wss://blue.derivws.com/websockets/v3?app_id=16929');
    
    ws.onopen = function() {
        console.log('✅ WebSocket connected successfully');
        console.log('📡 WebSocket readyState:', ws.readyState);
        // Wait longer for the connection to be fully established
        setTimeout(() => {
            console.log('📡 WebSocket readyState after delay:', ws.readyState);
            if (ws.readyState === WebSocket.OPEN) {
                getLatestTick(currentSymbol);
            } else {
                console.log('⏳ WebSocket still not ready, waiting longer...');
                setTimeout(() => {
                    console.log('📡 WebSocket readyState after longer delay:', ws.readyState);
                    getLatestTick(currentSymbol);
                }, 1000);
            }
        }, 500);
    };
    
    ws.onmessage = function(event) {
        console.log('📨 WebSocket message received:', event.data);
        try {
            const data = JSON.parse(event.data);
            console.log('📊 Parsed data:', data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
            console.error('Raw message:', event.data);
        }
    };
    
    ws.onclose = function(event) {
        console.log('🔌 WebSocket disconnected');
        console.log('Close code:', event.code, 'Reason:', event.reason);
        // Attempt to reconnect after 2 seconds
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connectWebSocket();
        }, 2000);
    };
    
    ws.onerror = function(error) {
        console.error('❌ WebSocket error:', error);
        console.error('WebSocket state:', ws.readyState);
    };
}

// Get latest tick for a symbol using ticks_history
function getLatestTick(symbol) {
    console.log(`🔔 Requesting latest tick for symbol: ${symbol}`);
    console.log(`📡 WebSocket state: ${ws ? ws.readyState : 'null'}`);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        const message = {
            ticks_history: symbol,
            count: 1,
            end: "latest"
        };
        console.log(`📤 Sending ticks_history request:`, message);
        ws.send(JSON.stringify(message));
        console.log(`✅ Ticks_history request sent for ${symbol}`);
    } else {
        console.error(`❌ Cannot request tick - WebSocket not ready. State: ${ws ? ws.readyState : 'null'}`);
        console.log('WebSocket states: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED');
    }
}

// Unsubscribe from current symbol
function unsubscribeFromSymbol() {
    if (ws && ws.readyState === WebSocket.OPEN && subscriptionId) {
        const message = {
            forget: subscriptionId
        };
        ws.send(JSON.stringify(message));
        console.log(`Unsubscribed from subscription ${subscriptionId}`);
        subscriptionId = null;
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    console.log(`🔍 Processing message type: ${data.msg_type}`);
    
    if (data.msg_type === 'history' && data.history) {
        console.log(`✅ History message received!`);
        console.log(`💰 Price: ${data.history.prices[0]}`);
        console.log(`⏰ Time: ${data.history.times[0]}`);
        
        const currentTickTime = data.history.times[0];
        const currentPrice = data.history.prices[0];
        
        // Check if this is a new tick (different timestamp)
        if (lastTickTime === null || currentTickTime !== lastTickTime) {
            console.log(`🆕 New tick detected! Previous time: ${lastTickTime}, Current time: ${currentTickTime}`);
            
            // Update the last tick time
            lastTickTime = currentTickTime;
            
            // Create a tick object using the price from history
            const tick = {
                price: currentPrice,
                time: new Date(currentTickTime * 1000).toLocaleTimeString(),
                epoch: currentTickTime
            };
            
            console.log(`📊 Created tick object:`, tick);
            
            // Add the tick to history
            addTick(tick);
            
            // If a contract is active, update it
            if (contractActive) {
                updateContract(tick);
            }
        } else {
            console.log(`⏸️ Same tick time ${currentTickTime}, waiting for new tick...`);
        }
    } else {
        console.log(`ℹ️ Non-history message received:`, data);
        
        // Check for other message types
        if (data.msg_type === 'authorize') {
            console.log(`🔐 Authorization message:`, data);
        } else if (data.echo_req) {
            console.log(`📡 Echo request:`, data.echo_req);
        }
    }
}

// Fetch tick (this will be called by the interval to poll for new ticks)
async function fetchTick() {
    try {
        console.log(`🔔 Requesting latest tick for symbol: ${currentSymbol}`);
        const response = await fetch(`/api/tick/${currentSymbol}`);
        const data = await response.json();
        
        if (data.has_new_tick) {
            console.log(`✅ New tick received: ${data.price} at ${data.time}`);
            
            // Create a tick object
            const tick = {
                price: data.price,
                time: new Date(data.time * 1000).toLocaleTimeString(),
                epoch: data.time
            };
            
            console.log(`📊 Created tick object:`, tick);
            
            // Add the tick to history
            addTick(tick);
            
            // If a contract is active, update it
            if (contractActive) {
                updateContract(tick);
            }
        } else {
            console.log(`⏸️ No new tick available`);
        }
    } catch (error) {
        console.error('❌ Error fetching tick:', error);
    }
}

// Add a tick to history and update UI
function addTick(tick) {
    // Increment total tick count
    totalTickCount++;
    
    // Add tick number to the tick object
    tick.tickNumber = totalTickCount;
    
    // Add to tick history
    tickHistory.push(tick);
    
    // Keep only the last 20 ticks
    if (tickHistory.length > 20) {
        tickHistory.shift();
    }
    
    // Update the price display
    updatePriceDisplay(tick.price);
    
    // Update the chart
    updateChart();
    
    // Enable place trade button if we have at least 2 ticks and not in an active contract
    if (tickHistory.length >= 2 && !contractActive) {
        placeTradeButton.disabled = false;
    } else if (!contractActive) {
        placeTradeButton.disabled = true;
    }
}

// Update the price display
function updatePriceDisplay(price) {
    // Update current price
    currentPriceElement.textContent = price.toFixed(1);
    
    // Update direction indicator
    if (price > lastPrice) {
        priceDirectionElement.textContent = '↑';
        priceDirectionElement.className = 'up';
    } else if (price < lastPrice) {
        priceDirectionElement.textContent = '↓';
        priceDirectionElement.className = 'down';
    } else {
        priceDirectionElement.textContent = '→';
        priceDirectionElement.className = 'neutral';
    }
    
    // Update last price
    lastPrice = price;
    
    // Update tick history display
    updateTickHistoryDisplay();
}

// Update tick history display
function updateTickHistoryDisplay() {
    // Show last 5 ticks with direction indicators
    const lastFiveTicks = tickHistory.slice(-5).map((tick, index, arr) => {
        if (index === 0 || arr[index - 1] === undefined) {
            return tick.price.toFixed(1);
        }
        
        const prevPrice = arr[index - 1].price;
        if (tick.price > prevPrice) {
            return `${tick.price.toFixed(1)} ↑`;
        } else if (tick.price < prevPrice) {
            return `${tick.price.toFixed(1)} ↓`;
        } else {
            return `${tick.price.toFixed(1)} →`;
        }
    });
    
    tickHistoryElement.textContent = lastFiveTicks.join(' | ');
}

// Update the chart
function updateChart() {
    // Create x and y arrays for the chart using actual tick numbers
    const x = tickHistory.map(tick => tick.tickNumber);
    const y = tickHistory.map(tick => tick.price);
    
    // Create marker colors based on price direction
    const markerColors = tickHistory.map((tick, index, arr) => {
        if (index === 0) return '#95a5a6'; // Gray for first point
        
        const prevPrice = arr[index - 1].price;
        if (tick.price > prevPrice) {
            return '#2ecc71'; // Green for up
        } else if (tick.price < prevPrice) {
            return '#e74c3c'; // Red for down
        } else {
            return '#95a5a6'; // Gray for no change
        }
    });
    
    // Update the chart data
    Plotly.update(chart, {
        x: [x],
        y: [y],
        'marker.color': [markerColors]
    });
    
    // Calculate appropriate y-axis range
    if (tickHistory.length > 0) {
        const prices = tickHistory.map(tick => tick.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const range = maxPrice - minPrice;
        
        // Add padding to the min/max values (10% of the range)
        const padding = Math.max(range * 0.1, 0.2); // At least 0.2 padding
        
        // Update y-axis range
        Plotly.relayout(chart, {
            'yaxis.range': [minPrice - padding, maxPrice + padding]
        });
    }
    
    // Clean up old contract visualizations that are no longer visible
    cleanupOldContractVisualizations();
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

// Update calculations based on form inputs
function updateCalculations() {
    // Get form values
    const duration = parseInt(durationSlider.value);
    const minTicks = parseInt(minUpticksSlider.value);
    const stake = parseFloat(stakeInput.value) || 0;
    const houseEdge = parseFloat(houseEdgeInput.value) || 0;
    
    // Store the min ticks value for contract
    contractMinTicks = minTicks;
    
    // Calculate fair price (binomial probability)
    const fairPrice = binomialProbability(duration, minTicks, 0.5);
    
    // Total price per contract (additive house edge)
    const totalPrice = fairPrice + houseEdge;
    
    // Number of contracts
    const contracts = stake / totalPrice;
    
    // Potential payout
    const potentialPayout = contracts;
    
    // Update UI
    fairPriceElement.textContent = fairPrice.toFixed(5);
    appliedHouseEdgeElement.textContent = houseEdge.toFixed(5);
    totalPriceElement.textContent = totalPrice.toFixed(5);
    contractsElement.textContent = contracts.toFixed(2);
    potentialPayoutElement.textContent = `$${potentialPayout.toFixed(2)}`;
    
    // Update summary based on direction
    const directionText = isUpDirection ? 'up-ticks' : 'down-ticks';
    tradeSummaryElement.textContent = `For a $${stake.toFixed(2)} stake, if there are at least ${minTicks} ${directionText} in the next ${duration} ticks, you win $${potentialPayout.toFixed(2)}.`;
}

// Place a trade
function placeTrade() {
    // Get form values
    contractDuration = parseInt(durationSlider.value);
    contractMinTicks = parseInt(minUpticksSlider.value);
    
    // Set contract as active
    contractActive = true;
    
    // Store contract start price and tick number
    contractStartPrice = lastPrice;
    contractStartTickNumber = totalTickCount; // Start with current tick
    
    // Reset contract ticks
    contractTicks = [];
    
    // Disable place trade button
    placeTradeButton.disabled = true;
    
    // Show active contract panel
    activeContractElement.classList.remove('hidden');
    
    // Update contract UI based on direction
    upTickCountElement.previousElementSibling.textContent = isUpDirection ? 'Up-ticks:' : 'Down-ticks:';
    upTickTargetElement.textContent = contractMinTicks;
    
    // Add contract visualization to chart
    addContractVisualization();
    
    const directionText = isUpDirection ? 'up' : 'down';
    console.log(`Contract started at tick ${contractStartTickNumber}: ${contractDuration} ticks, min ${contractMinTicks} ${directionText}-ticks, start price: ${contractStartPrice}`);
}

// Add contract visualization to chart
function addContractVisualization() {
    // Get current chart layout
    const layout = chart.layout || {};
    
    // Clear previous contract visualizations
    Plotly.relayout(chart, {
        shapes: [],
        annotations: []
    });
    
    // Create shapes and annotations arrays
    const shapes = [];
    const annotations = [];
    
    // Add a vertical line at the start of the contract
    shapes.push({
        type: 'line',
        x0: contractStartTickNumber,
        y0: 0,
        x1: contractStartTickNumber,
        y1: 1,
        yref: 'paper',
        line: {
            color: '#f39c12',
            width: 2,
            dash: 'dash'
        }
    });
    
    // Add a rectangle to highlight the contract duration
    shapes.push({
        type: 'rect',
        x0: contractStartTickNumber,
        y0: 0,
        x1: contractStartTickNumber + contractDuration,
        y1: 1,
        yref: 'paper',
        fillcolor: 'rgba(243, 156, 18, 0.2)',
        line: {
            color: 'rgba(243, 156, 18, 0.5)',
            width: 1
        }
    });
    
    // Add a label for the contract
    const directionText = isUpDirection ? 'up' : 'down';
    annotations.push({
        x: contractStartTickNumber + (contractDuration / 2),
        y: contractStartPrice,
        text: `Contract: ${contractMinTicks}/${contractDuration} ${directionText}-ticks`,
        showarrow: false,
        bgcolor: 'rgba(243, 156, 18, 0.8)',
        bordercolor: 'rgba(243, 156, 18, 0.8)',
        borderwidth: 1,
        borderpad: 4,
        font: {
            color: 'white',
            size: 12
        }
    });
    
    // Update chart layout
    Plotly.relayout(chart, {
        shapes: shapes,
        annotations: annotations
    });
}

// Update contract with new tick
function updateContract(tick) {
    // Skip the first tick that comes at the same time as contract placement
    if (tick.tickNumber === contractStartTickNumber) {
        console.log(`Skipping tick ${tick.tickNumber} as it's the contract start tick`);
        return;
    }
    
    // Determine if it's an up tick compared to previous tick
    let isUpTick;
    if (contractTicks.length === 0) {
        // First tick in contract - compare to contract start price
        isUpTick = tick.price > contractStartPrice;
        console.log(`First contract tick: ${tick.price}, Start price: ${contractStartPrice}, Is up tick: ${isUpTick}`);
    } else {
        // Compare to previous tick
        const prevTick = contractTicks[contractTicks.length - 1];
        isUpTick = tick.price > prevTick.price;
        console.log(`Contract tick: ${tick.price}, Previous price: ${prevTick.price}, Is up tick: ${isUpTick}`);
    }
    
    // Add to contract ticks
    contractTicks.push({
        price: tick.price,
        isUp: isUpTick,
        isAboveStart: tick.price > contractStartPrice // Also track if it's above start price
    });
    
    // Count ticks based on direction
    const targetTickCount = contractTicks.filter(t => isUpDirection ? t.isUp : !t.isUp).length;
    console.log(`Contract progress: ${targetTickCount}/${contractTicks.length} ${isUpDirection ? 'up' : 'down'}-ticks, need ${contractMinTicks}/${contractDuration}`);
    
    // Update contract UI
    contractProgressElement.textContent = `${contractTicks.length}/${contractDuration}`;
    upTickCountElement.textContent = targetTickCount;
    
    // Update progress bar
    const progressPercentage = (contractTicks.length / contractDuration) * 100;
    progressBarElement.style.width = `${progressPercentage}%`;
    
    // Update contract visualization
    updateContractVisualization(targetTickCount);
    
    // Check if contract is complete
    if (contractTicks.length >= contractDuration) {
        // Determine outcome
        const won = targetTickCount >= contractMinTicks;
        
        // Complete the contract
        completeContract(won, targetTickCount);
    }
}

// Update contract visualization
function updateContractVisualization(upTickCount) {
    // Get current chart layout
    const layout = chart.layout || {};
    const shapes = [...(layout.shapes || [])];
    const annotations = [...(layout.annotations || [])];
    
    // Get the current tick number
    const currentTickNumber = totalTickCount;
    
    // Find and update the contract progress shape
    const progressShapeIndex = shapes.findIndex(shape => 
        shape.type === 'rect' && shape.fillcolor === 'rgba(52, 152, 219, 0.3)');
    
    if (progressShapeIndex >= 0) {
        // Update existing progress shape
        shapes[progressShapeIndex].x1 = currentTickNumber;
    } else {
        // Add new progress shape
        shapes.push({
            type: 'rect',
            x0: contractStartTickNumber,
            y0: 0,
            x1: currentTickNumber,
            y1: 1,
            yref: 'paper',
            fillcolor: 'rgba(52, 152, 219, 0.3)',
            line: {
                color: 'rgba(52, 152, 219, 0.7)',
                width: 1
            }
        });
    }
    
    // Find and update the progress annotation
    const directionText = isUpDirection ? 'up' : 'down';
    const progressAnnotationIndex = annotations.findIndex(ann => 
        ann.text && (ann.text.includes('up-ticks so far') || ann.text.includes('down-ticks so far')));
    
    if (progressAnnotationIndex >= 0) {
        // Update existing annotation
        annotations[progressAnnotationIndex].x = currentTickNumber;
        annotations[progressAnnotationIndex].y = lastPrice;
        annotations[progressAnnotationIndex].text = `${upTickCount} ${directionText}-ticks so far`;
    } else {
        // Add new progress annotation
        annotations.push({
            x: currentTickNumber,
            y: lastPrice,
            text: `${upTickCount} ${directionText}-ticks so far`,
            showarrow: false,
            bgcolor: 'rgba(52, 152, 219, 0.8)',
            bordercolor: 'rgba(52, 152, 219, 0.8)',
            borderwidth: 1,
            borderpad: 4,
            font: {
                color: 'white',
                size: 12
            }
        });
    }
    
    // Update chart layout
    Plotly.relayout(chart, {
        shapes: shapes,
        annotations: annotations
    });
    
    // Add markers for up and down ticks
    addTickMarkers();
}

// Add markers for up and down ticks
function addTickMarkers() {
    // Create arrays for different tick types
    const upTickIndices = [];
    const downTickIndices = [];
    const upTickPrices = [];
    const downTickPrices = [];
    
    // Populate the arrays using actual tick numbers
    contractTicks.forEach((tick, index) => {
        // Since we skip the first tick, we need to add 1 to the index
        const tickNumber = contractStartTickNumber + index + 1;
        if (tick.isUp) {
            upTickIndices.push(tickNumber);
            upTickPrices.push(tick.price);
        } else {
            downTickIndices.push(tickNumber);
            downTickPrices.push(tick.price);
        }
    });
    
    console.log(`Adding markers: ${upTickIndices.length} up ticks, ${downTickIndices.length} down ticks`);
    
    // Create data for up ticks (compared to previous tick)
    const upTickData = {
        x: upTickIndices,
        y: upTickPrices,
        mode: 'markers',
        marker: {
            color: '#2ecc71',
            size: 10,
            line: {
                color: 'white',
                width: 2
            },
            symbol: 'circle'
        },
        showlegend: false,
        name: 'Up Ticks'
    };
    
    // Create data for down ticks (compared to previous tick)
    const downTickData = {
        x: downTickIndices,
        y: downTickPrices,
        mode: 'markers',
        marker: {
            color: '#e74c3c',
            size: 10,
            line: {
                color: 'white',
                width: 2
            },
            symbol: 'circle'
        },
        showlegend: false,
        name: 'Down Ticks'
    };
    
    // Check if up tick trace already exists
    const upTickTraceIndex = chart.data.findIndex(trace => trace.name === 'Up Ticks');
    if (upTickTraceIndex >= 0) {
        Plotly.deleteTraces(chart, upTickTraceIndex);
    }
    
    // Check if down tick trace already exists
    const downTickTraceIndex = chart.data.findIndex(trace => trace.name === 'Down Ticks');
    if (downTickTraceIndex >= 0) {
        Plotly.deleteTraces(chart, downTickTraceIndex);
    }
    
    // Add the traces
    if (upTickPrices.length > 0) {
        Plotly.addTraces(chart, upTickData);
    }
    
    if (downTickPrices.length > 0) {
        Plotly.addTraces(chart, downTickData);
    }
}

// Complete the contract
function completeContract(won, targetTickCount) {
    // Store contract data before resetting
    const contractData = {
        startIndex: contractStartTickNumber,
        endIndex: contractStartTickNumber + contractDuration - 1,
        duration: contractDuration,
        minTicks: contractMinTicks,
        actualTicks: targetTickCount
    };
    
    // Reset contract active flag
    contractActive = false;
    
    // Get payout amount
    const payout = parseFloat(potentialPayoutElement.textContent.replace('$', ''));
    
    // Create result message
    const directionText = isUpDirection ? 'up' : 'down';
    const resultTitle = won ? 'Contract Won!' : 'Contract Lost';
    const resultMessage = won ? 
        `Congratulations! You won $${payout.toFixed(2)}. There were ${targetTickCount} ${directionText}-ticks out of ${contractDuration}.` : 
        `Sorry, you lost. There were ${targetTickCount} ${directionText}-ticks out of ${contractDuration}, but you needed at least ${contractMinTicks}.`;
    
    // Update notification
    resultTitleElement.textContent = resultTitle;
    resultMessageElement.textContent = resultMessage;
    resultTitleElement.className = won ? 'success-text' : 'danger-text';
    
    // Show notification
    resultNotificationElement.classList.remove('hidden');
    
    // Add final contract visualization
    finalizeContractVisualization(won, contractData);
    
    // Hide active contract panel
    setTimeout(() => {
        activeContractElement.classList.add('hidden');
        
        // Re-enable place trade button
        placeTradeButton.disabled = false;
    }, 1000);
    
    console.log(`Contract completed: ${won ? 'Won' : 'Lost'}, ${targetTickCount}/${contractDuration} ${isUpDirection ? 'up' : 'down'}-ticks`);
}

// Finalize contract visualization
function finalizeContractVisualization(won, contractData) {
    // Get current chart layout
    const layout = chart.layout || {};
    const shapes = [...(layout.shapes || [])];
    const annotations = [...(layout.annotations || [])];
    
    // Add result highlight
    shapes.push({
        type: 'rect',
        x0: contractData.startIndex,
        y0: 0,
        x1: contractData.endIndex,
        y1: 1,
        yref: 'paper',
        fillcolor: won ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)',
        line: {
            color: won ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)',
            width: 2
        }
    });
    
    // Add result annotation
    annotations.push({
        x: contractData.startIndex + (contractData.duration / 2),
        y: lastPrice,
        text: won ? 'Contract Won!' : 'Contract Lost',
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2,
        arrowcolor: won ? '#2ecc71' : '#e74c3c',
        bgcolor: won ? 'rgba(46, 204, 113, 0.8)' : 'rgba(231, 76, 60, 0.8)',
        bordercolor: won ? 'rgba(46, 204, 113, 0.8)' : 'rgba(231, 76, 60, 0.8)',
        borderwidth: 1,
        borderpad: 4,
        font: {
            color: 'white',
            size: 14,
            weight: 'bold'
        }
    });
    
    // Update chart layout
    Plotly.relayout(chart, {
        shapes: shapes,
        annotations: annotations
    });
}

// Clean up old contract visualizations that are no longer visible
function cleanupOldContractVisualizations() {
    // Get current chart layout
    const layout = chart.layout || {};
    if (!layout.shapes && !layout.annotations) return;
    
    // Get the range of visible tick numbers
    const visibleTickNumbers = tickHistory.map(tick => tick.tickNumber);
    if (visibleTickNumbers.length === 0) return;
    
    const minVisibleTick = Math.min(...visibleTickNumbers);
    const maxVisibleTick = Math.max(...visibleTickNumbers);
    
    // Filter shapes to keep only those that are visible
    const shapes = (layout.shapes || []).filter(shape => {
        // Keep shapes that don't have x coordinates (shouldn't happen but be safe)
        if (!shape.x0 && !shape.x1) return true;
        
        // Keep shapes that overlap with the visible range
        const shapeStart = Math.min(shape.x0 || 0, shape.x1 || 0);
        const shapeEnd = Math.max(shape.x0 || 0, shape.x1 || 0);
        
        // Keep if any part of the shape is visible
        return shapeEnd >= minVisibleTick && shapeStart <= maxVisibleTick;
    });
    
    // Filter annotations to keep only those that are visible
    const annotations = (layout.annotations || []).filter(annotation => {
        // Keep annotations that don't have x coordinate
        if (!annotation.x) return true;
        
        // Keep annotations that are within the visible range
        return annotation.x >= minVisibleTick && annotation.x <= maxVisibleTick;
    });
    
    // Update layout if anything was removed
    if (shapes.length !== (layout.shapes || []).length || 
        annotations.length !== (layout.annotations || []).length) {
        Plotly.relayout(chart, {
            shapes: shapes,
            annotations: annotations
        });
    }
    
    // Also clean up tick marker traces if contract is not active
    if (!contractActive) {
        const upTickTraceIndex = chart.data.findIndex(trace => trace.name === 'Up Ticks');
        const downTickTraceIndex = chart.data.findIndex(trace => trace.name === 'Down Ticks');
        
        const tracesToDelete = [];
        if (upTickTraceIndex >= 0) tracesToDelete.push(upTickTraceIndex);
        if (downTickTraceIndex >= 0) tracesToDelete.push(downTickTraceIndex);
        
        if (tracesToDelete.length > 0) {
            Plotly.deleteTraces(chart, tracesToDelete);
        }
    }
}

// Reset chart for symbol change
function resetChart() {
    // Reset tick history and counters
    tickHistory = [];
    totalTickCount = 0;
    
    // Reset contract state if active
    if (contractActive) {
        contractActive = false;
        activeContractElement.classList.add('hidden');
        placeTradeButton.disabled = true;
    }
    
    // Reset UI elements
    currentPriceElement.textContent = '-';
    priceDirectionElement.textContent = '→';
    priceDirectionElement.className = 'neutral';
    tickHistoryElement.textContent = '-';
    
    // Clear and reinitialize the chart
    Plotly.purge(chart);
    initChart();
    
    console.log(`Chart reset for symbol: ${currentSymbol}`);
}

// Reset the entire application to initial state
function resetApplication() {
    // Clear the tick interval
    if (tickInterval) {
        clearInterval(tickInterval);
    }
    
    // Reset global variables
    tickHistory = [];
    totalTickCount = 0;
    lastPrice = 10000;
    contractActive = false;
    contractStartPrice = null;
    contractStartTickNumber = 0;
    contractTicks = [];
    contractDuration = 0;
    contractMinTicks = 0;
    isUpDirection = true;
    
    // Reset UI elements
    currentPriceElement.textContent = '10000.0';
    priceDirectionElement.textContent = '→';
    priceDirectionElement.className = 'neutral';
    tickHistoryElement.textContent = '-';
    
    // Reset form values to defaults
    durationSlider.value = '7';
    durationValueElement.textContent = '7 ticks';
    minUpticksSlider.value = '3';
    minUpticksSlider.max = '7';
    minUpticksValueElement.textContent = '3 ticks';
    stakeInput.value = '10';
    houseEdgeInput.value = '0.05';
    
    // Reset direction toggle
    upDirectionBtn.classList.add('active');
    downDirectionBtn.classList.remove('active');
    minTicksLabel.textContent = 'Minimum Up-ticks:';
    
    // Reset contract UI
    activeContractElement.classList.add('hidden');
    contractProgressElement.textContent = '0/0';
    upTickCountElement.textContent = '0';
    upTickTargetElement.textContent = '0';
    progressBarElement.style.width = '0%';
    
    // Reset place trade button
    placeTradeButton.disabled = true;
    
    // Clear and reinitialize the chart
    Plotly.purge(chart);
    initChart();
    
    // Update calculations
    updateCalculations();
    
    // Restart tick generator
    startTickGenerator();
    
    console.log('Application reset to initial state');
}
