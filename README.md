## Tick-Majority - Product Idea

### **Product Description**
*A New Way to Trade Market Direction*

**What is it?**
Predict whether the majority of upcoming price ticks will move in your chosen direction. Unlike traditional binary options that depend on final price levels, Tick-Majority rewards you for correctly forecasting market momentum.

**How it works:**
- Choose your contract duration (5-15 ticks)
- Set your minimum target (e.g., "at least 6 up-ticks out of 8 move up")
- Place your stake
- Win if the market moves your way for the majority of ticks
- Perfect for traders to capitalize on short-term market momentum


---

### **Commission Application**

- **Contract Price (Fair Probability):** \( P \)
- **Commission (as absolute flat value):** \( H \)
- **Client Stake:** \( S \)
- **Client chooses:**
  - Number of ticks (\( n \)), e.g. 5–15
  - Minimum up-ticks (\( k \)), e.g. 1–n

**Calculation of Number of Contracts Purchased:**
\[
\text{Contracts} = \frac{S}{P + H}
\]

Payoff: If the event happens (≥k up in n), the client's payout is number of contracts × \$1 per contract (minus any fees).

---

### **Example Calculation**

**Suppose:**
- \( n = 8 \), \( k = 6 \)
- Calculated fair price (binomial probability): \( P = 0.15 \)
- Commission: add 0.05 (flat value)
- Stake: \$10

**Contracts:**
\[
\text{Contracts} = \frac{10}{0.15 + 0.05} = \frac{10}{0.20} = 50
\]

If event occurs, client receives: \( 50 \times \$1 = \$50 \) (on a \$10 stake; effective payout 5:1).

---

### **Proof-of-Concept UI (Updated)**

**Tick-Majority**

- **Duration:** [Slider: 5–15 ticks]
- **Minimum up-ticks:** [Slider: 1–chosen duration]
- **Stake:** [Input \$]
- **Commission:** [Input flat value]

Button: **[Place Trade]**

Below, show:
- **Contract price (fair):** 0.15
- **Commission:** 0.05
- **Total price per contract:** 0.20
- **Contracts purchased:** 50.0 contracts
- **Potential payout:** \$50.00

**Summary Statement** (dynamic):  
*"For a \$10 stake, if there are at least 6 up-ticks in the next 8 ticks, you win \$50.00."*

---

### **Implementation Notes**

- **Up-tick Definition:** An up-tick is counted when a tick's price is higher than the *previous* tick's price (not compared to the contract start price).
- **Random Price Generator:** The application uses a random price generator starting at 10,000 with ±0.1 fluctuations.
- **Visual Indicators:** The chart shows clear visual indicators for up and down ticks during an active contract.
- **Real-time Updates:** Contract progress, up-tick count, and potential payout are updated in real-time.

---

### **Backend/Formula**

```python
def tick_majority_contracts(stake, n, k, commission, p=0.5):
    from math import comb
    # Calculate fair price (binomial probability)
    fair_price = sum(comb(n, i) * (p**i) * ((1-p)**(n-i)) for i in range(k, n+1))
    # Total price per contract (additive commission)
    total_price = fair_price + commission
    # Number of contracts
    contracts = stake / total_price
    return contracts, fair_price, commission, total_price
```

---

### **Running the Application**

1. Make sure Flask is installed: `pip install flask`
2. Run the application: `python app.py --port 5001` (or any available port)
3. Open a browser and navigate to `http://127.0.0.1:5001`

---

### **Conclusion**

- **Clear, transparent:** Client sees how much each contract "costs" including commission.
- **Payouts scale with contracts:** Just like classic "unit" binary option models.
- **Commission is simple to reason about**, works for backend and live UI.
- **Immediate trading:** Users can place trades immediately without waiting.
