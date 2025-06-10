// Global variables
let chart;
let tickHistory = []; // Real market data only
let contractTicks = []; // Separate array for contract simulation
let tickStream;
let activeSymbols = [];
let selectedSymbol = '';
let lastPrice = null;
let ws;
let isContractActive = false; // Flag to track if a contract is active
let contractStartPrice = null; // Store contract start price
let contractStartIndex = null; // Store contract start index

// DOM elements
const symbolSelect = document.getElementById('symbol');
const durationSlider = document.getElementById('duration');
const durationValue = document.getElementById('duration-value');
const minUpticksSlider = document.getElementById('min-upticks');
const minUpticksValue = document.getElementById('min-upticks-value');
const stakeInput = document.getElementById('stake');
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
    
    // Create notification container
    createNotificationContainer();
});

// Create notification container
function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '1000';
    document.body.appendChild(container);
}

// Show notification
function showNotification(title, message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.backgroundColor = type === 'success' ? 'rgba(75, 180, 179, 0.9)' : 
                                        type === 'error' ? 'rgba(255, 68, 79, 0.9)' : 
                                        'rgba(39, 168, 224, 0.9)';
    notification.style.color = 'white';
    notification.style.padding = '15px';
    notification.style.marginBottom = '10px';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    notification.style.minWidth = '250px';
    notification.style.maxWidth = '350px';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease-in-out';
    
    const titleElement = document.createElement('h4');
    titleElement.style.margin = '0 0 5px 0';
    titleElement.style.fontWeight = 'bold';
    titleElement.textContent = title;
    
    const messageElement = document.createElement('p');
    messageElement.style.margin = '0';
    messageElement.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '10px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = 'white';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontWeight = 'bold';
    closeButton.onclick = () => {
        removeNotification(notification);
    };
    
    notification.style.position = 'relative';
    notification.appendChild(closeButton);
    notification.appendChild(titleElement);
    notification.appendChild(messageElement);
    
    container.appendChild(notification);
    
    // Trigger reflow to enable transition
    notification.offsetHeight;
    notification.style.opacity = '1';
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            removeNotification(notification);
        }, duration);
    }
}

// Remove notification with animation
function removeNotification(notification) {
    notification.style.opacity = '0';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Initialize Plotly.js chart
function initChart() {
    const chartDiv = document.getElementById('tickChart');
    
    // Create an empty chart
    const data = [{
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines+markers',
        line: {
            color: '#27A8E0',
            width: 2
        },
        marker: {
            size: 8,
            color: []  // Will be set dynamically
        },
        name: 'Price'
    }];
    
    const layout = {
        title: 'Tick Price Chart',
        xaxis: {
            title: 'Tick',
            showgrid: true,
            zeroline: false
        },
        yaxis: {
            title: 'Price',
            showgrid: true,
            zeroline: false
        },
        margin: { t: 50, l: 50, r: 30, b: 50 },
        hovermode: 'closest',
        showlegend: false,
        shapes: []  // For contract visualization
    };
    
    const config = {
        responsive: true,
        displayModeBar: false
    };
    
    Plotly.newPlot(chartDiv, data, layout, config);
    chart = chartDiv;
}

// Connect to Deriv WebSocket API
function connectWebSocket() {
    // Create WebSocket connection
    // Using app_id=1089 which is a demo app_id from Deriv
    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    
    ws.onopen = function(evt) {
        console.log('Connection opened');
        // Get active symbols once connected
        requestActiveSymbols();
    };
    
    ws.onmessage = function(msg) {
        const response = JSON.parse(msg.data);
        console.log('Received message:', response);
        
        // Handle different message types
        if (response.msg_type === 'active_symbols') {
            handleActiveSymbols(response.active_symbols);
        } else if (response.msg_type === 'tick') {
            handleTickUpdate(response.tick);
        } else if (response.msg_type === 'history') {
            handleTickHistory(response.history);
        } else if (response.error) {
            console.error('API Error:', response.error.message);
            // If there's an error with the API, try to reconnect after a delay
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            setTimeout(connectWebSocket, 5000);
        }
    };
    
    ws.onclose = function(evt) {
        console.log('Connection closed');
        // Try to reconnect after a delay
        setTimeout(connectWebSocket, 5000);
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
    // Filter symbols to only include the ones in our allowed list
    const allowedSymbols = ['1HZ100V','1HZ10V','1HZ25V','1HZ50V','1HZ75V','R_10','R_100','R_25','R_50','R_75','stpRNG','stpRNG2','stpRNG3','stpRNG4','stpRNG5','CRASH300N','CRASH500','CRASH1000','BOOM300N','BOOM500','BOOM1000'];
    
    // Filter the symbols
    activeSymbols = symbols.filter(symbol => allowedSymbols.includes(symbol.symbol));
    
    // If no symbols match our filter, use all symbols
    if (activeSymbols.length === 0) {
        console.warn('No symbols matched our filter, using all available symbols');
        activeSymbols = symbols;
    }
    
    // Clear existing options
    symbolSelect.innerHTML = '';
    
    // Add options for each symbol
    activeSymbols.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol.symbol;
        option.textContent = `${symbol.display_name} (${symbol.symbol})`;
        symbolSelect.appendChild(option);
    });
    
    // Find stpRNG in the active symbols
    const stpRNGSymbol = activeSymbols.find(symbol => symbol.symbol === 'stpRNG');
    
    // Select stpRNG by default if available, otherwise select the first symbol
    if (stpRNGSymbol) {
        selectedSymbol = 'stpRNG';
        symbolSelect.value = selectedSymbol;
    } else if (activeSymbols.length > 0) {
        selectedSymbol = activeSymbols[0].symbol;
        symbolSelect.value = selectedSymbol;
    }
    
    // Subscribe to the selected symbol's tick stream
    if (selectedSymbol) {
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
        
        // Reset contract state when changing symbols
        resetContractState();
        
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

// Reset contract state
function resetContractState() {
    isContractActive = false;
    contractTicks = [];
    contractStartPrice = null;
    contractStartIndex = null;
    
    // Clear contract visualization
    clearContractVisualization();
}

// Clear contract visualization
function clearContractVisualization() {
    // Clear shapes (annotations)
    Plotly.relayout(chart, {
        shapes: [],
        annotations: []
    });
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
        });
    });
    
    // Update calculations
    updateCalculations();
}

// Handle tick update
function handleTickUpdate(tick) {
    // Store tick stream ID for unsubscribe
    tickStream = tick.id;
    
    // Add new tick
    addTick(tick);
    
    // Update calculations
    updateCalculations();
    
    // If a contract is active, update the contract progress
    if (isContractActive) {
        updateContractWithNewTick(tick);
    }
}

// Add a tick to history and update chart
function addTick(tick) {
    console.log('Adding tick:', tick);
    
    // Get price from the appropriate field (quote for new API format, price for history)
    let tickPrice = tick.quote || tick.price;
    
    // Ensure tick has valid price
    if (!tickPrice || isNaN(parseFloat(tickPrice))) {
        console.error('Invalid tick price:', tickPrice);
        return;
    }
    
    const price = parseFloat(tickPrice);
    const time = new Date(tick.epoch * 1000).toLocaleTimeString();
    
    // Add to tick history
    tickHistory.push({
        price: price,
        time: time,
        epoch: tick.epoch
    });
    
    // Keep only the last 20 ticks
    if (tickHistory.length > 20) {
        tickHistory.shift();
    }
    
    // Update chart
    updateChart();
    
    // Update UI
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
    } else {
        tickDirectionElement.textContent = '→ Same';
        tickDirectionElement.style.color = 'gray';
    }
    
    // Update last price
    lastPrice = price;
    
    // Update tick history display
    updateTickHistoryDisplay();
    
    // Enable place trade button if we have enough ticks
    if (tickHistory.length >= 5) {
        placeTradeButton.disabled = false;
    }
}

// Update chart with tick history
function updateChart() {
    // Create x and y arrays for the chart
    const x = tickHistory.map((tick, index) => index + 1);
    const y = tickHistory.map(tick => tick.price);
    
    // Create marker colors based on price direction
    const markerColors = tickHistory.map((tick, index, arr) => {
        if (index === 0) return '#9e9e9e'; // Gray for first point
        
        const prevPrice = arr[index - 1].price;
        if (tick.price > prevPrice) {
            return '#4BB4B3'; // Green for up
        } else if (tick.price < prevPrice) {
            return '#FF444F'; // Red for down
        } else {
            return '#9e9e9e'; // Gray for no change
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
        const padding = range * 0.1;
        
        // Update y-axis range
        Plotly.relayout(chart, {
            'yaxis.range': [minPrice - padding, maxPrice + padding]
        });
    }
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
    const houseEdge = parseFloat(houseEdgeInput.value) || 0;
    
    // Calculate fair price
    const fairPrice = binomialProbability(duration, minUpticks, 0.5);
    
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
    placeTradeButton.disabled = stake <= 0 || tickHistory.length < 5 || isContractActive;
}

// Place trade function
function placeTrade() {
    // Get form values
    const duration = parseInt(durationSlider.value);
    const minUpticks = parseInt(minUpticksSlider.value);
    const stake = parseFloat(stakeInput.value) || 0;
    
    // Disable button during trade
    placeTradeButton.disabled = true;
    placeTradeButton.textContent = 'Trading...';
    
    // Set contract as active
    isContractActive = true;
    
    // Reset contract ticks
    contractTicks = [];
    
    // Store contract start information
    contractStartIndex = tickHistory.length - 1;
    contractStartPrice = tickHistory[contractStartIndex].price;
    
    // Add contract visualization to chart
    addContractToChart(contractStartIndex, duration, minUpticks);
}

// Update contract with new tick
function updateContractWithNewTick(tick) {
    if (!isContractActive) return;
    
    // Get price from the appropriate field
    const price = parseFloat(tick.quote || tick.price);
    
    // Determine if it's an up tick compared to contract start
    const isUpTick = price > contractStartPrice;
    
    // Add to contract ticks
    contractTicks.push({
        price: price,
        isUp: isUpTick,
        epoch: tick.epoch
    });
    
    // Get contract parameters
    const duration = parseInt(durationSlider.value);
    const minUpticks = parseInt(minUpticksSlider.value);
    
    // Count up ticks
    const upTickCount = contractTicks.filter(tick => tick.isUp).length;
    
    // Update contract visualization
    updateContractProgress(upTickCount, contractTicks.length, duration, minUpticks);
    
    // Check if contract is complete
    if (contractTicks.length >= duration) {
        // Determine outcome
        const won = upTickCount >= minUpticks;
        
        // Update contract visualization with final result
        updateContractResult(won);
        
        // Display result directly on the page (no alert)
        const payout = parseFloat(potentialPayoutElement.textContent.replace('$', ''));
        const resultMessage = won ? 
            `Congratulations! You won $${payout.toFixed(2)}!` : 
            `Sorry, you lost. There were ${upTickCount} up-ticks out of ${duration}.`;
        
        // Create a result banner
        const resultBanner = document.createElement('div');
        resultBanner.className = 'result-banner';
        resultBanner.style.backgroundColor = won ? 'rgba(75, 180, 179, 0.9)' : 'rgba(255, 68, 79, 0.9)';
        resultBanner.style.color = 'white';
        resultBanner.style.padding = '15px';
        resultBanner.style.borderRadius = '8px';
        resultBanner.style.textAlign = 'center';
        resultBanner.style.margin = '15px 0';
        resultBanner.style.fontWeight = 'bold';
        resultBanner.style.fontSize = '16px';
        resultBanner.innerHTML = `<strong>${won ? 'Contract Won!' : 'Contract Lost'}</strong><br>${resultMessage}`;
        
        // Insert at the top of the page
        const container = document.querySelector('.container');
        if (container && container.firstChild) {
            container.insertBefore(resultBanner, container.firstChild);
        } else {
            document.body.insertBefore(resultBanner, document.body.firstChild);
        }
        
        // Remove the banner after 10 seconds
        setTimeout(() => {
            if (resultBanner.parentNode) {
                resultBanner.parentNode.removeChild(resultBanner);
            }
        }, 10000);
        
        // Reset contract state
        isContractActive = false;
        
        // Reset button
        placeTradeButton.disabled = false;
        placeTradeButton.textContent = 'Place Trade';
        
        console.log("Contract completed:", resultMessage);
    } else {
        // Update progress
        placeTradeButton.textContent = `Trading... (${contractTicks.length}/${duration}) - ${upTickCount} up-ticks`;
    }
}

// Add contract visualization to chart
function addContractToChart(startIndex, duration, minUpticks) {
    console.log("Adding contract visualization at index:", startIndex);
    
    // Clear existing shapes
    const shapes = [];
    const annotations = [];
    
    // Add a vertical line at the start of the contract
    shapes.push({
        type: 'line',
        x0: startIndex + 1,
        y0: 0,
        x1: startIndex + 1,
        y1: 1,
        yref: 'paper',
        line: {
            color: '#ff9800',
            width: 3,
            dash: 'dash'
        }
    });
    
    // Add a rectangle to highlight the contract duration
    shapes.push({
        type: 'rect',
        x0: startIndex + 1,
        y0: 0,
        x1: startIndex + duration + 1,
        y1: 1,
        yref: 'paper',
        fillcolor: 'rgba(255, 152, 0, 0.2)',
        line: {
            color: 'rgba(255, 152, 0, 0.7)',
            width: 2
        }
    });
    
    // Add a label for the contract details
    annotations.push({
        x: startIndex + 1 + (duration / 2),
        y: contractStartPrice,
        text: `Contract: ${minUpticks}/${duration} up-ticks`,
        showarrow: false,
        bgcolor: 'rgba(255, 152, 0, 0.9)',
        bordercolor: 'rgba(255, 152, 0, 0.9)',
        borderwidth: 1,
        borderpad: 6,
        font: {
            color: 'white',
            size: 14,
            weight: 'bold'
        }
    });
    
    // Update the chart with the new shapes and annotations
    Plotly.relayout(chart, {
        shapes: shapes,
        annotations: annotations
    });
    
    console.log("Contract visualization added");
}

// Update contract progress visualization
function updateContractProgress(upTickCount, tickCount, duration, minUpticks) {
    console.log("Updating contract progress:", upTickCount, "/", tickCount);
    
    // Update progress text
    const progressText = document.getElementById('current-tick');
    if (progressText) {
        progressText.innerHTML = `Current Price: <span>${tickHistory[tickHistory.length-1].price.toFixed(5)}</span><br>
                                 Contract Progress: <span>${upTickCount}/${tickCount} up-ticks (need ${minUpticks}/${duration})</span>`;
    }
    
    // Get the current shapes and annotations
    const layout = chart.layout || {};
    const shapes = [...(layout.shapes || [])];
    const annotations = [...(layout.annotations || [])];
    
    // Add or update progress box
    const progressBoxIndex = shapes.findIndex(shape => shape.fillcolor === 'rgba(75, 180, 179, 0.2)');
    if (progressBoxIndex >= 0) {
        shapes[progressBoxIndex].x1 = contractStartIndex + 1 + tickCount;
    } else {
        shapes.push({
            type: 'rect',
            x0: contractStartIndex + 1,
            y0: 0,
            x1: contractStartIndex + 1 + tickCount,
            y1: 1,
            yref: 'paper',
            fillcolor: 'rgba(75, 180, 179, 0.2)',
            line: {
                color: 'rgba(75, 180, 179, 0.7)',
                width: 2
            }
        });
    }
    
    // Add progress text annotation
    const progressTextIndex = annotations.findIndex(ann => ann.text && ann.text.includes('up-ticks'));
    if (progressTextIndex >= 0) {
        annotations[progressTextIndex].text = `${upTickCount}/${tickCount} up-ticks`;
        annotations[progressTextIndex].x = contractStartIndex + 1 + tickCount;
        annotations[progressTextIndex].y = tickHistory[tickHistory.length-1].price;
    } else {
        annotations.push({
            x: contractStartIndex + 1 + tickCount,
            y: tickHistory[tickHistory.length-1].price,
            text: `${upTickCount}/${tickCount} up-ticks`,
            showarrow: false,
            bgcolor: 'rgba(75, 180, 179, 0.9)',
            bordercolor: 'rgba(75, 180, 179, 0.9)',
            borderwidth: 1,
            borderpad: 4,
            font: {
                color: 'white',
                size: 12,
                weight: 'bold'
            }
        });
    }
    
    // Add tick markers as scatter points
    const upTickMarkers = contractTicks.filter(tick => tick.isUp);
    const downTickMarkers = contractTicks.filter(tick => !tick.isUp);
    
    // Create data for up ticks
    if (upTickMarkers.length > 0) {
        const upTickData = {
            x: upTickMarkers.map((_, i) => contractStartIndex + 1 + i),
            y: upTickMarkers.map(tick => tick.price),
            mode: 'markers',
            marker: {
                color: 'rgba(75, 180, 179, 0.9)',
                size: 10,
                line: {
                    color: 'white',
                    width: 2
                }
            },
            showlegend: false,
            hoverinfo: 'none',
            name: 'Up Ticks'
        };
        
        // Check if up tick trace already exists
        const upTickTraceIndex = chart.data.findIndex(trace => trace.name === 'Up Ticks');
        if (upTickTraceIndex >= 0) {
            Plotly.deleteTraces(chart, upTickTraceIndex);
        }
        
        Plotly.addTraces(chart, upTickData);
    }
    
    // Create data for down ticks
    if (downTickMarkers.length > 0) {
        const downTickData = {
            x: downTickMarkers.map((_, i) => contractStartIndex + 1 + i),
            y: downTickMarkers.map(tick => tick.price),
            mode: 'markers',
            marker: {
                color: 'rgba(255, 68, 79, 0.9)',
                size: 10,
                line: {
                    color: 'white',
                    width: 2
                }
            },
            showlegend: false,
            hoverinfo: 'none',
            name: 'Down Ticks'
        };
        
        // Check if down tick trace already exists
        const downTickTraceIndex = chart.data.findIndex(trace => trace.name === 'Down Ticks');
        if (downTickTraceIndex >= 0) {
            Plotly.deleteTraces(chart, downTickTraceIndex);
        }
        
        Plotly.addTraces(chart, downTickData);
    }
    
    // Update the chart with the new shapes and annotations
    Plotly.relayout(chart, {
        shapes: shapes,
        annotations: annotations
    });
}

// Update contract result visualization
function updateContractResult(won) {
    console.log("Updating contract result:", won ? "Won" : "Lost");
    
    // Get the current shapes and annotations
    const layout = chart.layout || {};
    const shapes = [...(layout.shapes || [])];
    const annotations = [...(layout.annotations || [])];
    
    // Add result annotation
    annotations.push({
        x: contractStartIndex + 1 + contractTicks.length,
        y: tickHistory[tickHistory.length-1].price,
        text: won ? 'Contract Won!' : 'Contract Lost',
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2,
        arrowcolor: won ? 'rgba(75, 180, 179, 0.9)' : 'rgba(255, 68, 79, 0.9)',
        bgcolor: won ? 'rgba(75, 180, 179, 0.9)' : 'rgba(255, 68, 79, 0.9)',
        bordercolor: won ? 'rgba(75, 180, 179, 0.9)' : 'rgba(255, 68, 79, 0.9)',
        borderwidth: 1,
        borderpad: 6,
        font: {
            color: 'white',
            size: 16,
            weight: 'bold'
        }
    });
    
    // Add result highlight
    shapes.push({
        type: 'rect',
        x0: contractStartIndex + 1,
        y0: 0,
        x1: contractStartIndex + 1 + contractTicks.length,
        y1: 1,
        yref: 'paper',
        fillcolor: won ? 'rgba(75, 180, 179, 0.3)' : 'rgba(255, 68, 79, 0.3)',
        line: {
            color: won ? 'rgba(75, 180, 179, 0.9)' : 'rgba(255, 68, 79, 0.9)',
            width: 3
        }
    });
    
    // Update the chart with the new shapes and annotations
    Plotly.relayout(chart, {
        shapes: shapes,
        annotations: annotations
    });
}
