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
    // Chart.js will automatically register the annotation plugin
    // since we included the script in the HTML
    
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
                pointRadius: 4,
                pointBackgroundColor: function(context) {
                    // Color points based on direction (up/down)
                    const index = context.dataIndex;
                    const value = context.dataset.data[index];
                    const previousValue = index > 0 ? context.dataset.data[index - 1] : value;
                    
                    if (value > previousValue) {
                        return '#4caf50'; // Green for up
                    } else if (value < previousValue) {
                        return '#f44336'; // Red for down
                    } else {
                        return '#9e9e9e'; // Gray for no change
                    }
                },
                pointBorderColor: function(context) {
                    // Match border color with background color
                    const index = context.dataIndex;
                    const value = context.dataset.data[index];
                    const previousValue = index > 0 ? context.dataset.data[index - 1] : value;
                    
                    if (value > previousValue) {
                        return '#4caf50'; // Green for up
                    } else if (value < previousValue) {
                        return '#f44336'; // Red for down
                    } else {
                        return '#9e9e9e'; // Gray for no change
                    }
                }
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
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const value = context.dataset.data[index];
                            const previousValue = index > 0 ? context.dataset.data[index - 1] : value;
                            
                            let direction = '';
                            if (value > previousValue) {
                                direction = '↑ Up';
                            } else if (value < previousValue) {
                                direction = '↓ Down';
                            } else {
                                direction = '→ Same';
                            }
                            
                            return `Price: ${value.toFixed(5)} (${direction})`;
                        }
                    }
                }
            }
        }
    });
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
    
    // Select first symbol by default
    if (activeSymbols.length > 0) {
        selectedSymbol = activeSymbols[0].symbol;
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
        time: time
    });
    
    // Keep only the last 20 ticks
    if (tickHistory.length > 20) {
        tickHistory.shift();
    }
    
    // Update chart
    updateChart();
    
    // Always update UI, even for history to ensure initial display is correct
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
    let contractStartIndex = tickHistory.length - 1;
    let contractTicks = [];
    
    // Create a copy of current tick history for reference
    const startPrice = tickHistory[contractStartIndex].price;
    
    // Add contract visualization to chart
    addContractToChart(contractStartIndex, duration, minUpticks);
    
    // For simulation purposes, we'll create some fake ticks
    // In a real implementation, we would use the actual incoming ticks
    const simulateTrade = () => {
        // Simulate a new tick
        tickCount++;
        
        // Randomly determine if it's an up tick (50% chance)
        const isUpTick = Math.random() > 0.5;
        if (isUpTick) {
            upTickCount++;
        }
        
        // Generate a random price change (between -0.05% and +0.05%)
        const priceChange = startPrice * (isUpTick ? 0.0005 : -0.0005);
        const newPrice = startPrice + (priceChange * tickCount);
        
        // Store tick info for visualization
        contractTicks.push({
            index: contractStartIndex + tickCount,
            price: newPrice,
            isUp: isUpTick
        });
        
        // Update contract visualization
        updateContractProgress(contractTicks, tickCount, duration, minUpticks, upTickCount);
        
        // Update progress
        placeTradeButton.textContent = `Trading... (${tickCount}/${duration}) - ${upTickCount} up-ticks`;
        
        // Check if we've reached the duration
        if (tickCount >= duration) {
            clearInterval(tradeInterval);
            
            // Determine outcome
            const won = upTickCount >= minUpticks;
            
            // Update contract visualization with final result
            updateContractResult(won, contractTicks);
            
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
        }
    };
    
    // Start the simulation
    tradeInterval = setInterval(simulateTrade, 1000);
}

// Add contract visualization to chart
function addContractToChart(startIndex, duration, minUpticks) {
    // Add a vertical line to mark contract start
    if (!chart.data.datasets[1]) {
        chart.data.datasets.push({
            label: 'Contract Start',
            data: Array(chart.data.labels.length).fill(null),
            borderColor: '#ff9800',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }
    
    // Mark the starting point
    chart.data.datasets[1].data = Array(chart.data.labels.length).fill(null);
    chart.data.datasets[1].data[startIndex] = chart.data.datasets[0].data[startIndex];
    
    // Add a third dataset for contract ticks
    if (!chart.data.datasets[2]) {
        chart.data.datasets.push({
            label: 'Contract Ticks',
            data: Array(chart.data.labels.length).fill(null),
            pointBackgroundColor: [],
            pointBorderColor: [],
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: false,
            showLine: false
        });
    }
    
    // Reset contract ticks data
    chart.data.datasets[2].data = Array(chart.data.labels.length).fill(null);
    
    // Add a vertical line at the start of the contract
    const startLine = {
        type: 'line',
        xMin: startIndex,
        xMax: startIndex,
        yMin: 0,
        yMax: 1,
        borderColor: '#ff9800',
        borderWidth: 2,
        borderDash: [5, 5]
    };
    
    // Add a box to highlight the contract duration
    const contractBox = {
        type: 'box',
        xMin: startIndex,
        xMax: startIndex + duration,
        yMin: 0,
        yMax: 1,
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        borderColor: 'rgba(255, 152, 0, 0.5)',
        borderWidth: 1
    };
    
    // Add a label for the contract details
    const contractLabel = {
        type: 'label',
        xValue: startIndex,
        yValue: 0.95,
        content: `Contract: ${minUpticks}/${duration} up-ticks`,
        backgroundColor: 'rgba(255, 152, 0, 0.7)',
        color: 'white',
        font: {
            size: 12
        },
        padding: 4
    };
    
    // Update chart
    chart.update();
}

// Update contract progress visualization
function updateContractProgress(contractTicks, tickCount, duration, minUpticks, upTickCount) {
    // Reset data array
    chart.data.datasets[2].data = Array(chart.data.labels.length).fill(null);
    chart.data.datasets[2].pointBackgroundColor = [];
    chart.data.datasets[2].pointBorderColor = [];
    
    // Add each contract tick
    contractTicks.forEach(tick => {
        chart.data.datasets[2].data[tick.index] = tick.price;
        const color = tick.isUp ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)';
        chart.data.datasets[2].pointBackgroundColor[tick.index] = color;
        chart.data.datasets[2].pointBorderColor[tick.index] = color;
    });
    
    // Update progress text
    const progressText = document.getElementById('current-tick');
    if (progressText) {
        progressText.innerHTML = `Current Price: <span>${tickHistory[tickHistory.length-1].price.toFixed(5)}</span><br>
                                 Contract Progress: <span>${upTickCount}/${tickCount} up-ticks (need ${minUpticks}/${duration})</span>`;
    }
    
    chart.update();
}

// Update contract result visualization
function updateContractResult(won, contractTicks) {
    // Add a result indicator
    const resultText = document.createElement('div');
    resultText.className = 'result-indicator';
    resultText.style.backgroundColor = won ? 'rgba(76, 175, 80, 0.7)' : 'rgba(244, 67, 54, 0.7)';
    resultText.style.color = 'white';
    resultText.style.padding = '10px';
    resultText.style.borderRadius = '5px';
    resultText.style.textAlign = 'center';
    resultText.style.margin = '10px 0';
    resultText.style.fontWeight = 'bold';
    resultText.textContent = won ? 'Contract Won!' : 'Contract Lost';
    
    // Insert before the place trade button
    const placeTradeButton = document.getElementById('place-trade');
    if (placeTradeButton && placeTradeButton.parentNode) {
        placeTradeButton.parentNode.insertBefore(resultText, placeTradeButton);
    }
    
    // Update chart
    chart.update();
    
    // Remove the result indicator after 5 seconds
    setTimeout(() => {
        if (resultText.parentNode) {
            resultText.parentNode.removeChild(resultText);
        }
    }, 5000);
}
