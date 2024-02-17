// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BaluniPoolV1 {
    enum Coin {
        BTC,
        MATIC,
        OP,
        ETH
    }

    struct Prediction {
        address predictor;
        Coin token; // Modificato da string tokenSymbol a Coin token
        uint256 predictedPrice;
        uint256 timestamp;
        uint256 endTime;
    }

    Prediction[] public predictions;
    uint256 public registrationFee = 0.01 ether;
    uint256 public totalPredictions = 0;
    mapping(address => uint256) public distributionCounter; // Conta le predizioni per ogni utente
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastWithdraw;
    mapping(address => uint256) public userSubmissionFees;

    event PredictionRegistered(
        address indexed predictor,
        Coin token,
        uint256 predictedPrice,
        uint256 endTime
    );
    event RewardWithdrawn(address indexed predictor, uint256 amount);

    function getSubmissionFee() public view returns (uint256) {
        return userSubmissionFees[msg.sender];
    }

    function submit(Coin _token, uint256 _predictedPrice) public payable {
        require(msg.value >= 0.01 ether, "Invalid fee amount");
        require(
            msg.value >= userSubmissionFees[msg.sender],
            "Invalid fee amount"
        );

        userSubmissionFees[msg.sender] = msg.value;
        userSubmissionFees[msg.sender] += 0.001 ether;

        predictions.push(
            Prediction(
                msg.sender,
                _token,
                _predictedPrice,
                block.timestamp,
                block.timestamp + 1 days
            )
        );
        totalPredictions++;
        distributionCounter[msg.sender]++;
        lastSubmissionTime[msg.sender] = block.timestamp;

        emit PredictionRegistered(
            msg.sender,
            _token,
            _predictedPrice,
            block.timestamp + 1 days
        );
    }

    function exit() public {
        require(
            block.timestamp - lastWithdraw[msg.sender] >= 30 days,
            "Wait for 30 days before next withdraw"
        );

        uint256 reward = calculateReward(msg.sender);

        require(reward > 0, "No reward available");

        // Aggiornamento dello stato prima della trasferimento per prevenire reentrancy
        totalPredictions -= distributionCounter[msg.sender];
        distributionCounter[msg.sender] = 0;
        lastSubmissionTime[msg.sender] = 0;
        lastWithdraw[msg.sender] = block.timestamp;

        userSubmissionFees[msg.sender] = registrationFee;

        (bool sent, ) = msg.sender.call{value: reward}("");
        require(sent, "Failed to send Ether");

        emit RewardWithdrawn(msg.sender, reward);
    }

    function calculateReward(address user) public view returns (uint256) {
        uint256 userShare = (distributionCounter[user] * 1e18) /
            totalPredictions;
        return (address(this).balance * userShare) / 1e18 / 2;
    }

    function last10Predictions() public view returns (Prediction[] memory) {
        uint256 length = predictions.length;
        uint256 start = length > 10 ? length - 10 : 0;
        Prediction[] memory result = new Prediction[](length - start);
        for (uint256 i = start; i < length; i++) {
            result[i - start] = predictions[i];
        }
        return result;
    }

    function getPrediction(
        uint256 index
    ) public view returns (Prediction memory) {
        require(index < predictions.length, "Invalid index");
        return predictions[index];
    }

    function getPredictionFromTo(
        uint256 from,
        uint256 to
    ) public view returns (Prediction[] memory) {
        require(from < to, "Invalid range");
        require(to <= predictions.length, "Invalid range");
        Prediction[] memory result = new Prediction[](to - from);
        for (uint256 i = from; i < to; i++) {
            result[i - from] = predictions[i];
        }
        return result;
    }

    function getPredictionCount() public view returns (uint256) {
        return predictions.length;
    }

    function getTotalPredictions() public view returns (uint256) {
        return totalPredictions;
    }

    // Permetti al contratto di ricevere ETH
    receive() external payable {}
}
