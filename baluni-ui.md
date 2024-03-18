# baluni-ui

Welcome to Baluni GUI, the graphical interface that simplifies your interaction with the decentralized finance (DeFi) world. Built as an open-source layer on top of the Baluni command-line tool, this interface is designed to make the management of ERC-20 tokens and smart contract interactions more accessible to everyone, from beginners to advanced users.

## <mark style="color:red;background-color:yellow;">About Baluni CLI</mark>

The Baluni CLI is the foundation of our project, offering powerful features for those who navigate the DeFi space. It's crafted to manage ERC-20 tokens efficiently and interact with smart contracts seamlessly. For more details on the CLI's capabilities, please visit our [GitHub repository](broken-reference).

## <mark style="color:red;background-color:yellow;">Deployments</mark>

* Polygon : [https://baluni.vercel.app](https://baluni.vercel.app)
* Mumbai : [https://balunibeta.vercel.app](https://balunibeta.vercel.app)

## <mark style="color:red;background-color:yellow;">Features</mark>

### Baluni Pool: Engage and Earn

The Baluni Pool is a fresh take on the prediction market concept, prioritizing user participation over accuracy. This inclusive approach aims to foster a vibrant community where every action contributes to the ecosystem.

#### How It Works:

* **Participation Rewards:** Here, your engagement is valued more than your accuracy. This system encourages continuous interaction with the platform.
* **MATIC Staking:** To join the pool, users stake MATIC tokens. A fixed registration fee is required, adding to the total prize pool and ensuring fairness for all.
* **Fair Reward Distribution:** Rewards are allocated based on each participant's engagement level, ensuring a share for everyone involved.
* **Predictions Welcome:** While the main focus is on participation, submitting price predictions for MATIC adds an exciting layer of strategy.
* **Flexible Exit Options:** Users can exit the pool when they choose, with rewards distributed after a 30-day cooldown to promote longer-term engagement.

### Baluni Tournament: Accuracy Matters

For those who enjoy a challenge, the Baluni Tournament offers a competitive prediction market focused on precision.

#### Highlights:

* **Accuracy-Based Rewards:** The closer your prediction is to the actual price, the better your chances of winning.
* **Prize Pool Formation:** Entry fees contribute to a collective prize pool, which is distributed among the top predictors after each tournament round.
* **Structured Participation:** Pay an entry fee, submit your prediction within a set timeframe, and await the outcome once the verification period concludes.

### Forecasting on Baluni

Step into the future with our forecasting tool, designed to provide valuable insights for informed DeFi decisions.

#### Features:

* **Variety of Algorithms:** Choose from algorithms like REGR, 1CONV, LSTM, RNN, and GRU to fit your prediction strategy.
* **Flexible Prediction Periods:** Tailor your forecasting to match your trading approach, be it for short-term gains or long-term investments.
* **Real-Time Data Utilization:** Access up-to-date market information to refine your forecasts.
* **Community Engagement:** Share your predictions, interact with fellow users, and participate in community pools for a chance to win rewards based on accuracy.

### Rebalance Your Portfolio

Optimize your investment strategy with our rebalance feature, ensuring your portfolio remains aligned with your financial goals.

#### Process:

* **Wide Token Selection:** Customize your portfolio from a diverse range of tokens, setting allocations to fit your strategy.
* **Suggested Adjustments:** The platform recommends rebalance strategies to match your target allocations, improving overall performance.
* **Easy Execution:** Implement the rebalance with just a click, allowing smart contracts to adjust your holdings accordingly.

#### Benefits:

Rebalancing is crucial for managing risk, seizing market opportunities, and maintaining a diversified portfolio aligned with your investment objectives.

## <mark style="color:red;background-color:yellow;">Keeper Script Overview</mark>

The Keeper script is an automation tool for the Baluni platform, designed to ensure efficient and timely operation of the Baluni Tournament and Pool smart contracts.

### Key Functions:

* **Automates Tournament Resolution:** Checks if the current time has passed the `verificationTime` of the tournament. If so, it triggers the resolution process to finalize outcomes and distribute rewards.
* **Automates Pool Resolution:** Identifies pools with unresolved predictions past their end time and triggers their resolution, ensuring participants are rewarded based on engagement.

### Continuous Operation:

* Runs in a loop, executing at regular intervals to monitor and resolve tournaments and pools without manual intervention.

### Error Handling and Logging:

* Logs activities and errors for transparency and troubleshooting, ensuring smooth platform operation.

### Enhances User Experience:

* By automating critical functions, it supports a fair, engaging, and reliable environment for platform participants.

This script exemplifies the integration of automation in DeFi platforms, improving accessibility and reliability for users.
