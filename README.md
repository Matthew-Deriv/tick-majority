## Tick-Majority – Updated House Edge Mechanism

### **House Edge Application**

- **Contract Price (Fair Probability):** \( P \)
- **House Edge (as absolute, not percent of price):** \( H \)
  - If house edge is 10% and \( P = 0.2 \), then \( H = 0.02 \) (10% of 0.2)
  - If house edge is set as a flat 0.1, it’s simply 0.1
- **Client Stake:** \( S \)
- **Client chooses:**
  - Number of ticks (\( n \)), e.g. 5–10
  - Minimum up-ticks (\( k \)), e.g. 3–n

**Calculation of Number of Contracts Purchased:**
\[
\text{Contracts} = \frac{S}{P + H}
\]

Payoff: If the event happens (≥k up in n), the client’s payout is number of contracts × \$1 per contract (minus any fees).

---

### **Example Calculation**

**Suppose:**
- \( n = 8 \), \( k = 6 \)
- Calculated fair price (binomial probability): \( P = 0.15 \)
- House edge: add 0.05 (flat, for clarity in this example; you may set as % of \( P \))
- Stake: \$10

**Contracts:**
\[
\text{Contracts} = \frac{10}{0.15 + 0.05} = \frac{10}{0.20} = 50
\]

If event occurs, client receives: \( 50 \times \$1 = \$50 \) (on a \$10 stake; effective payout 5:1).

---

### **Proof-of-Concept UI (Updated)**

**Tick-Majority**

- **Duration:** [Slider: 5–10 ticks]
- **Minimum up-ticks:** [Slider: 3–chosen duration]
- **Stake:** [Input \$]

Below, show:
- **Contract price (fair):** 0.15
- **House edge:** 0.05
- **Total price per contract:** 0.20
- **Contracts purchased:** 50.0 contracts
- **Potential payout:** \$50.00

**Summary Statement** (dynamic):  
*"For a \$10 stake, if there are at least 6 up-ticks in the next 8 ticks, you win \$50.00."*

Button: **[Place Trade]**

---

### **Backend/Formula**

```python
def tick_majority_contracts(stake, n, k, house_edge, p=0.5):
    from math import comb
    # Calculate fair price (binomial probability)
    fair_price = sum(comb(n, i) * (p**i) * ((1-p)**(n-i)) for i in range(k, n+1))
    # Total price per contract (additive house edge)
    total_price = fair_price + house_edge
    # Number of contracts
    contracts = stake / total_price
    return contracts, fair_price, house_edge, total_price
```

---

### **Conclusion**

- **Clear, transparent:** Client sees how much each contract "costs" including edge.
- **Payouts scale with contracts:** Just like classic "unit" binary option models.
- **House edge is simple to reason about**, works for backend and live UI.

