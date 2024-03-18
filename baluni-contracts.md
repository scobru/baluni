# baluni-contracts

## <mark style="color:red;background-color:yellow;">Deployments</mark>

### Router.sol

* Polygon: [0x19f330eba98ffd47a01f8f2afb0b9863a24497dd](https://polygonscan.com/address/0x19f330eba98ffd47a01f8f2afb0b9863a24497dd)

### Pool.sol

* Mumbai: [0xFe9B07e81c4BDDAA047bfF31D912f8c2e4E9a4Fc](https://mumbai.polygonscan.com/address/0xFe9B07e81c4BDDAA047bfF31D912f8c2e4E9a4Fc)

### Tournament.sol

* Mumbai: [0xe1743C0358487B46B87669A6695d662237C52F4E](https://mumbai.polygonscan.com/address/0xe1743C0358487B46B87669A6695d662237C52F4E)

## <mark style="color:red;background-color:yellow;">Router and Agent</mark>

This README outlines the interaction between a `Router` contract and an `Agent` contract within a decentralized application.

### Overview

The process begins when a user initiates a transaction through the `Router` contract. The `Router` then checks if the user already has an associated `Agent` contract. If the user does not have an `Agent`, the `Router` creates one and links it to the user. Once the user's `Agent` is determined or created, the `Router` invokes the `execute` function on the `Agent` contract, passing a batch of calls for execution.

### Key Processes

1. **Transaction Initiation**: A user initiates a transaction through the `Router` contract.
2. **Agent Check/Create**: The `Router` checks for an existing `Agent` for the user. If none exists, it creates a new `Agent` and links it to the user.
3. **Execution of Calls**: The `Router` calls the `execute` function on the `Agent` contract with the batch of calls.
4. **Processing Calls**: The `Agent` processes these calls, which include:
   * Executing the specified actions
   * Charging fees
   * Returning any remaining tokens to the user.

### Fee Management and Token Return

The `Agent` contract handles fee deductions from the operations performed and ensures any tokens left after the operation are returned to the user. This process involves the internal management of transaction fees and the secure transfer of assets.

This interaction between the `Router` and `Agent` contracts enables efficient and secure batch processing of transactions within a decentralized application framework, ensuring users can perform multiple operations in a single transaction while managing fees and asset returns effectively.

## <mark style="color:red;background-color:yellow;">Pool and Tournament</mark>

This README provides an overview of the `Pool` and `Tournament` contracts designed for managing predictions on price movements and facilitating prediction tournaments within a decentralized application.

### Pool Contract Overview

The `Pool` contract allows users to submit predictions about the price movements of certain assets. Each prediction includes details such as the predicted price, actual price, and the time when the prediction was made. The contract calculates the outcome of predictions based on actual price movements obtained from an Oracle.

* Users can submit price predictions for specified tokens.
* Predictions are resolved based on actual price data from an Oracle.
* Rewards are distributed based on the accuracy of predictions.

### Tournament Contract Overview

The `Tournament` contract organizes prediction tournaments where participants can submit their price predictions for a chance to win a prize from the pooled entries. The contract manages rounds of predictions, collects entry fees to a prize pool, and distributes winnings based on prediction accuracy.

* Organizes prediction tournaments with multiple rounds.
* Participants submit predictions with an entry fee.
* Winners are determined based on the accuracy of their predictions against actual prices from an Oracle.

### Interaction Logic

While the `Pool` and `Tournament` contracts operate independently, they share a common theme of leveraging predictions for decentralized finance applications. Both contracts utilize price data from Oracles to determine the outcomes of predictions, but they cater to different user experiences - individual predictions in `Pool` and competitive tournaments in `Tournament`. gi

* Use of Oracles for price data.
* Management of predictions and their resolutions.
* Distribution of rewards based on prediction accuracy.

The `Pool` and `Tournament` contracts offer distinct ways for users to engage with prediction markets in a decentralized setting. The `Pool` contract focuses on individual predictions and rewards, while the `Tournament` contract provides a competitive platform for users to test their prediction skills against others.

## <mark style="color:red;background-color:yellow;">Keeper Script Overview</mark>

The `keeper.ts` script automates the resolution of predictions and tournaments. It interacts with the `Pool` and `Tournament` contracts to check for and resolve outcomes based on predefined conditions, such as time constraints and the presence of unresolved predictions.
