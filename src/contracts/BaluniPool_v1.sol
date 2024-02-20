// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Oracle.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BaluniPoolV1 is ReentrancyGuard {
    Oracle public oracle;

    enum Coin {
        MATIC
    }

    struct Prediction {
        address predictor;
        Coin token;
        uint256 predictedPrice;
        uint256 actualPrice;
        uint256 resolvedPrice;
        uint256 difference;
        uint256 timestamp;
        uint256 endTime;
        bool resolved;
    }

    Prediction[] public predictions;

    IWETH public wnative;
    IVault public yearnVault;

    uint256 public submissionBaseFee = 0.01 ether;
    uint256 public submissionStepFee = 0.001 ether;
    uint256 public predictionDuration = 1 days;
    uint256 public resolutionLimit = 10 minutes;
    uint256 public exitLimit = 7 days;
    uint256 public totalPredictions = 0;
    uint256 public totalDistribution = 0;

    mapping(address => uint256) public distributionCounter;
    mapping(address => uint256) public lastWithdraw;
    mapping(address => uint256) public userSubmissionFees;

    event PredictionRegistered(
        address indexed predictor,
        Coin token,
        uint256 predictedPrice,
        uint256 actualPrice,
        uint256 timestamp,
        uint256 endTime
    );
    event RewardWithdrawn(address indexed predictor, uint256 amount);

    constructor(
        address _oracleAddress,
        address _wnative,
        address _yearnVault
    ) ReentrancyGuard() {
        oracle = Oracle(_oracleAddress);
        wnative = IWETH(_wnative);
        yearnVault = IVault(_yearnVault);
    }

    function getSubmissionFee() public view returns (uint256) {
        return userSubmissionFees[msg.sender];
    }

    function submit(Coin _token, uint256 _predictedPrice) public payable {
        require(msg.value >= submissionBaseFee, "Invalid fee amount");
        require(
            msg.value >= userSubmissionFees[msg.sender],
            "Invalid fee amount"
        );

        userSubmissionFees[msg.sender] = msg.value;
        userSubmissionFees[msg.sender] += submissionStepFee;

        uint256 price = oracle.getLatestPrice() * 1e10;

        predictions.push(
            Prediction(
                msg.sender,
                _token,
                _predictedPrice,
                price,
                0,
                0,
                block.timestamp,
                block.timestamp + predictionDuration,
                false
            )
        );

        totalPredictions++;
        wnative.deposit{value: msg.value}();
        IERC20(address(wnative)).approve(address(yearnVault), msg.value);
        yearnVault.deposit(msg.value, address(this));

        emit PredictionRegistered(
            msg.sender,
            _token,
            _predictedPrice,
            price,
            block.timestamp,
            block.timestamp + predictionDuration
        );
    }

    function exit() public {
        require(
            block.timestamp - lastWithdraw[msg.sender] >= exitLimit,
            "Wait for exitLimit before next withdraw"
        );

        uint256 reward = calculateReward(msg.sender);

        require(reward > 0, "No reward available");

        IERC20(address(yearnVault)).approve(address(yearnVault), reward);

        uint256 ctxBalanceB4 = address(this).balance;
        yearnVault.withdraw(reward, address(this), address(this), 200);
        uint256 ctxBalanceAfter = address(this).balance;
        uint256 rewardToTransfer = ctxBalanceAfter - ctxBalanceB4;

        wnative.withdraw(rewardToTransfer);

        // Aggiornamento dello stato prima della trasferimento per prevenire reentrancy
        totalPredictions -= distributionCounter[msg.sender];
        distributionCounter[msg.sender] = 0;
        lastWithdraw[msg.sender] = block.timestamp;

        userSubmissionFees[msg.sender] = submissionBaseFee;

        Address.sendValue(payable(msg.sender), rewardToTransfer);

        emit RewardWithdrawn(msg.sender, rewardToTransfer);
    }

    function calculateReward(address user) public view returns (uint256) {
        require(distributionCounter[user] > 0, "No predictions made");
        require(totalDistribution > 0, "No rewards available");
        uint256 userShare = (distributionCounter[user] * 1e18) /
            totalDistribution;
        uint256 yeanBalance = IERC20(address(yearnVault)).balanceOf(
            address(this)
        );
        uint256 userBalance = (yeanBalance * userShare) / 1e18;
        uint256 userReward = userBalance - userBalance / 2;
        return userReward;
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

    function hasAnyUnresolvedPastEndTime() public view returns (bool) {
        for (uint256 i = 0; i < predictions.length; i++) {
            if (
                !predictions[i].resolved &&
                block.timestamp > predictions[i].endTime
            ) {
                return true; // Restituisce true alla prima occorrenza di una previsione non risolta superata da endTime
            }
        }
        return false; // Se nessuna previsione non risolta ha superato endTime, restituisce false
    }

    function resolve() public {
        uint256 latestPrice = oracle.getLatestPrice() * 1e10;

        for (uint256 i = 0; i < predictions.length; i++) {
            if (
                !predictions[i].resolved &&
                block.timestamp >= predictions[i].endTime
            ) {
                require(
                    block.timestamp <= predictions[i].endTime + resolutionLimit,
                    "La risoluzione puo avvenire al massimo 1 ora dopo la scadenza"
                );

                uint256 predictedPrice = predictions[i].predictedPrice;
                uint256 priceDifference = predictedPrice > latestPrice
                    ? predictedPrice - latestPrice
                    : latestPrice - predictedPrice;
                uint256 score = calculateScore(predictedPrice, latestPrice);

                predictions[i].difference = priceDifference;
                predictions[i].resolved = true;
                predictions[i].resolvedPrice = latestPrice;

                distributionCounter[predictions[i].predictor] += score; // Assumi che esista questo campo
                totalDistribution += score;
            }
        }

        distributionCounter[msg.sender]++;
        totalDistribution++;
    }

    function calculateScore(
        uint256 predictedPrice,
        uint256 resolvedPrice
    ) private pure returns (uint256) {
        if (resolvedPrice == 0) return 1; // Evita divisione per zero
        uint256 priceDifference = predictedPrice > resolvedPrice
            ? predictedPrice - resolvedPrice
            : resolvedPrice - predictedPrice;
        uint256 differencePercentage = (priceDifference * 100) / resolvedPrice;

        // Il punteggio diminuisce all'aumentare della differenza percentuale
        if (differencePercentage == 0) {
            return 10; // Puntaeggio massimo per previsione perfetta
        } else if (differencePercentage <= 5) {
            return 9;
        } else if (differencePercentage <= 10) {
            return 8;
        } else if (differencePercentage <= 15) {
            return 7;
        } else if (differencePercentage <= 20) {
            return 6;
        } else if (differencePercentage <= 25) {
            return 5;
        } else if (differencePercentage <= 30) {
            return 4;
        } else if (differencePercentage <= 35) {
            return 3;
        } else if (differencePercentage <= 40) {
            return 2;
        } else {
            return 1; // Punteggio minimo per grande differenza
        }
    }

    function hasUnresolvedPredictions() public view returns (bool) {
        for (uint256 i = 0; i < predictions.length; i++) {
            if (!predictions[i].resolved) {
                return true;
            }
        }
        return false;
    }

    // Permetti al contratto di ricevere ETH
    receive() external payable {}
}
