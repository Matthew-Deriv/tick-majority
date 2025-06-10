// Global variables
let chart;
let tickHistory = [];
let lastPrice = 10000;
let tickInterval;
let contractActive = false;
let contractStartPrice = null;
let contractTicks = [];
let contractDuration = 0;
let contractMinUpticks = 0;

// DOM Elements
const currentPriceElement = document.getElementById('currentPrice');
const priceDirectionElement = document.getElementById('priceDirection');
const tickHistoryElement = document.getElementById('tickHistory');
const durationSlider = document.getElementById('duration');
const durationValueElement = document.getElementById('durationValue');
const minUpticksSlider = document.getElementById('minUpticks');
const minUpticksValueElement = document.getElementById('minUpticksValue');
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
        title: 'Price Chart',
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
}

// Start the tick generator
function startTickGenerator() {
    // Generate initial tick
    generateTick();
    
    // Generate a new tick every second
    tickInterval = setInterval(generateTick, 1000);
}

// Generate a random tick
function generateTick() {
    // Generate a random direction (50% chance up or down)
    const isUp = Math.random() >= 0.5;
    
    // Calculate new price (add or subtract 0.1)
    const newPrice = isUp ? lastPrice + 0.1 : lastPrice - 0.1;
    
    // Create a tick object
    const tick = {
        price: newPrice,
        time: new Date().toLocaleTimeString(),
        epoch: Math.floor(Date.now() / 1000)
    };
    
    // Add the tick to history
    addTick(tick);
    
    // If a contract is active, update it
    if (contractActive) {
        updateContract(tick);
    }
}

// Add a tick to history and update UI
function addTick(tick) {
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
    
    // Enable place trade button if we have enough ticks
    if (tickHistory.length >= 5 && !contractActive) {
        placeTradeButton.disabled = false;
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
    // Create x and y arrays for the chart
    const x = tickHistory.map((_, index) => index + 1);
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
    const minUpticks = parseInt(minUpticksSlider.value);
    const stake = parseFloat(stakeInput.value) || 0;
    const houseEdge = parseFloat(houseEdgeInput.value) || 0;
    
    // Calculate fair price (binomial probability)
    const fairPrice = binomialProbability(duration, minUpticks, 0.5);
    
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
    
    // Update summary
    tradeSummaryElement.textContent = `For a $${stake.toFixed(2)} stake, if there are at least ${minUpticks} up-ticks in the next ${duration} ticks, you win $${potentialPayout.toFixed(2)}.`;
}

// Place a trade
function placeTrade() {
    // Get form values
    contractDuration = parseInt(durationSlider.value);
    contractMinUpticks = parseInt(minUpticksSlider.value);
    
    // Set contract as active
    contractActive = true;
    
    // Store contract start price
    contractStartPrice = lastPrice;
    
    // Reset contract ticks
    contractTicks = [];
    
    // Disable place trade button
    placeTradeButton.disabled = true;
    
    // Show active contract panel
    activeContractElement.classList.remove('hidden');
    
    // Update contract UI
    upTickTargetElement.textContent = contractMinUpticks;
    
    // Add contract visualization to chart
    addContractVisualization();
    
    console.log(`Contract started: ${contractDuration} ticks, min ${contractMinUpticks} up-ticks, start price: ${contractStartPrice}`);
}

// Add contract visualization to chart
function addContractVisualization() {
    // Get current chart layout
    const layout = chart.layout || {};
    
    // Create shapes and annotations arrays
    const shapes = [];
    const annotations = [];
    
    // Add a vertical line at the start of the contract
    shapes.push({
        type: 'line',
        x0: tickHistory.length,
        y0: 0,
        x1: tickHistory.length,
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
        x0: tickHistory.length,
        y0: 0,
        x1: tickHistory.length + contractDuration,
        y1: 1,
        yref: 'paper',
        fillcolor: 'rgba(243, 156, 18, 0.2)',
        line: {
            color: 'rgba(243, 156, 18, 0.5)',
            width: 1
        }
    });
    
    // Add a label for the contract
    annotations.push({
        x: tickHistory.length + (contractDuration / 2),
        y: contractStartPrice,
        text: `Contract: ${contractMinUpticks}/${contractDuration} up-ticks`,
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
    // Add to contract ticks
    contractTicks.push({
        price: tick.price,
        isUp: tick.price > contractStartPrice
    });
    
    // Count up ticks
    const upTickCount = contractTicks.filter(t => t.isUp).length;
    
    // Update contract UI
    contractProgressElement.textContent = `${contractTicks.length}/${contractDuration}`;
    upTickCountElement.textContent = upTickCount;
    
    // Update progress bar
    const progressPercentage = (contractTicks.length / contractDuration) * 100;
    progressBarElement.style.width = `${progressPercentage}%`;
    
    // Update contract visualization
    updateContractVisualization(upTickCount);
    
    // Check if contract is complete
    if (contractTicks.length >= contractDuration) {
        // Determine outcome
        const won = upTickCount >= contractMinUpticks;
        
        // Complete the contract
        completeContract(won, upTickCount);
    }
}

// Update contract visualization
function updateContractVisualization(upTickCount) {
    // Get current chart layout
    const layout = chart.layout || {};
    const shapes = [...(layout.shapes || [])];
    const annotations = [...(layout.annotations || [])];
    
    // Find and update the contract progress shape
    const progressShapeIndex = shapes.findIndex(shape => 
        shape.type === 'rect' && shape.fillcolor === 'rgba(52, 152, 219, 0.3)');
    
    if (progressShapeIndex >= 0) {
        // Update existing progress shape
        shapes[progressShapeIndex].x1 = tickHistory.length;
    } else {
        // Add new progress shape
        shapes.push({
            type: 'rect',
            x0: tickHistory.length - contractTicks.length,
            y0: 0,
            x1: tickHistory.length,
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
    const progressAnnotationIndex = annotations.findIndex(ann => 
        ann.text && ann.text.includes('up-ticks so far'));
    
    if (progressAnnotationIndex >= 0) {
        // Update existing annotation
        annotations[progressAnnotationIndex].x = tickHistory.length;
        annotations[progressAnnotationIndex].y = lastPrice;
        annotations[progressAnnotationIndex].text = `${upTickCount} up-ticks so far`;
    } else {
        // Add new progress annotation
        annotations.push({
            x: tickHistory.length,
            y: lastPrice,
            text: `${upTickCount} up-ticks so far`,
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
    // Create arrays for up and down tick positions
    const upTickIndices = [];
    const downTickIndices = [];
    const upTickPrices = [];
    const downTickPrices = [];
    
    // Populate the arrays
    contractTicks.forEach((tick, index) => {
        const tickIndex = tickHistory.length - contractTicks.length + index;
        if (tick.isUp) {
            upTickIndices.push(tickIndex);
            upTickPrices.push(tick.price);
        } else {
            downTickIndices.push(tickIndex);
            downTickPrices.push(tick.price);
        }
    });
    
    // Create data for up ticks
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
            }
        },
        showlegend: false,
        name: 'Up Ticks'
    };
    
    // Create data for down ticks
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
            }
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
function completeContract(won, upTickCount) {
    // Reset contract active flag
    contractActive = false;
    
    // Get payout amount
    const payout = parseFloat(potentialPayoutElement.textContent.replace('$', ''));
    
    // Create result message
    const resultTitle = won ? 'Contract Won!' : 'Contract Lost';
    const resultMessage = won ? 
        `Congratulations! You won $${payout.toFixed(2)}. There were ${upTickCount} up-ticks out of ${contractDuration}.` : 
        `Sorry, you lost. There were ${upTickCount} up-ticks out of ${contractDuration}, but you needed at least ${contractMinUpticks}.`;
    
    // Update notification
    resultTitleElement.textContent = resultTitle;
    resultMessageElement.textContent = resultMessage;
    resultTitleElement.className = won ? 'success-text' : 'danger-text';
    
    // Show notification
    resultNotificationElement.classList.remove('hidden');
    
    // Add final contract visualization
    finalizeContractVisualization(won);
    
    // Hide active contract panel
    setTimeout(() => {
        activeContractElement.classList.add('hidden');
        
        // Re-enable place trade button
        placeTradeButton.disabled = false;
    }, 1000);
    
    console.log(`Contract completed: ${won ? 'Won' : 'Lost'}, ${upTickCount}/${contractDuration} up-ticks`);
}

// Finalize contract visualization
function finalizeContractVisualization(won) {
    // Get current chart layout
    const layout = chart.layout || {};
    const shapes = [...(layout.shapes || [])];
    const annotations = [...(layout.annotations || [])];
    
    // Add result highlight
    shapes.push({
        type: 'rect',
        x0: tickHistory.length - contractTicks.length,
        y0: 0,
        x1: tickHistory.length,
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
        x: tickHistory.length - (contractTicks.length / 2),
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
