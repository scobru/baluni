// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Oracle.sol";

contract BaluniTournamentV1 is ReentrancyGuard {
    Oracle public oracle;

    uint256 public keeperPercentageFee = 100;
    uint256 public submissionEndTime = 8 hours;
    uint256 public verificationEndTime = 1 days;
    uint256 public resolutionEndTime = 1 hours;

    struct Prediction {
        uint256 round;
        address predictor;
        uint256 predictedPrice;
        uint256 amount;
    }

    uint256 public maxParticipants;

    uint256 public lastRoundPrice;

    Prediction[] public predictions;

    uint256 public verificationTime;
    address public priceFeedAddress;
    uint256 public prizePool;
    uint256 public currentRound = 0;

    mapping(uint256 => uint256) scores;
    mapping(uint256 => uint256) prizePerScore;

    address[] public roundWinners;

    struct WinnerInfo {
        uint256 index;
        uint256 difference;
        bool exists;
    }

    event PredictionSubmitted(
        uint256 round,
        address indexed predictor,
        uint256 predictedPrice,
        uint256 amount
    );

    event TournamentResolved(
        uint256 round,
        address[] winners,
        uint256[] prizeAmounts
    );

    constructor(
        address _oracleAddress,
        uint256 _maxParticipants
    ) ReentrancyGuard() {
        oracle = Oracle(_oracleAddress);
        maxParticipants = _maxParticipants;
        verificationTime = block.timestamp + verificationEndTime;
    }

    function isRoundOpen() public view returns (bool) {
        return block.timestamp <= verificationTime - 4 hours;
    }

    function submitPrediction(uint256 _predictedPrice) external payable {
        require(msg.value >= 0.01 ether, "Entry fee is 0.01 ether");
        require(
            predictions.length < maxParticipants,
            "Participant limit reached"
        );
        require(
            block.timestamp <= verificationTime - submissionEndTime,
            "Submissions closed 4 hours before round ends"
        );

        predictions.push(
            Prediction(currentRound, msg.sender, _predictedPrice, msg.value)
        );
        prizePool += msg.value;
        emit PredictionSubmitted(
            currentRound,
            msg.sender,
            _predictedPrice,
            msg.value
        );
    }

    function _resetTournament() private {
        delete predictions;
        prizePool = 0;
        verificationTime = block.timestamp + verificationEndTime;
        currentRound += 1;
    }

    function resolveTournament() external nonReentrant {
        require(
            block.timestamp >= verificationTime,
            "Tournament cannot be resolved yet"
        );

        if (block.timestamp >= verificationTime + resolutionEndTime) {
            for (uint256 i = 0; i < predictions.length; i++) {
                Address.sendValue(
                    payable(predictions[i].predictor),
                    predictions[i].amount
                );
            }
            emit TournamentResolved(
                currentRound,
                new address[](0),
                new uint256[](0)
            );
            _resetTournament();
            return;
        }

        uint256 actualPrice = oracle.getLatestPrice();
        uint256 actualPriceUint = actualPrice * 1e10;
        lastRoundPrice = actualPriceUint;

        if (predictions.length == 0) {
            emit TournamentResolved(
                currentRound,
                new address[](0),
                new uint256[](0)
            );
            roundWinners = new address[](0);
            _resetTournament();
            return;
        }

        if (predictions.length == 1) {
            // Restituisce il premio all'unico partecipante
            address[] memory winnerAddress = new address[](1);
            uint256[] memory winnerPrize = new uint256[](1);
            winnerAddress[0] = predictions[0].predictor;
            winnerPrize[0] = prizePool;
            Address.sendValue(payable(winnerAddress[0]), winnerPrize[0]);
            emit TournamentResolved(currentRound, winnerAddress, winnerPrize);
            roundWinners = winnerAddress;
            _resetTournament();
            return;
        }

        if (predictions.length == 2) {
            // Distribuisci il premio tra i due partecipanti
            address[] memory winnersAddresses = new address[](2);
            uint256[] memory prizes = new uint256[](2);
            uint256 halfPrize = prizePool / 2;
            for (uint256 i = 0; i < 2; i++) {
                winnersAddresses[i] = predictions[i].predictor;
                prizes[i] = halfPrize;
                Address.sendValue(payable(winnersAddresses[i]), prizes[i]);
            }
            emit TournamentResolved(currentRound, winnersAddresses, prizes);
            roundWinners = winnersAddresses;
            _resetTournament();
            return;
        }

        WinnerInfo[3] memory winners;
        uint256 winnersCount = 0;

        // Identifica i potenziali vincitori e calcola la differenza di prezzo
        for (uint256 i = 0; i < predictions.length; i++) {
            uint256 difference = predictions[i].predictedPrice > actualPriceUint
                ? predictions[i].predictedPrice - actualPriceUint
                : actualPriceUint - predictions[i].predictedPrice;

            if (winnersCount < 3) {
                winners[winnersCount] = WinnerInfo(i, difference, true);
                winnersCount++;
            } else {
                // Trova e sostituisci il vincitore con la differenza maggiore se ce n'è uno con una differenza minore
                uint256 maxDiffIndex = 0;
                uint256 maxDiff = winners[0].difference;
                for (uint256 j = 1; j < 3; j++) {
                    if (winners[j].difference > maxDiff) {
                        maxDiff = winners[j].difference;
                        maxDiffIndex = j;
                    }
                }

                if (difference < maxDiff) {
                    winners[maxDiffIndex] = WinnerInfo(i, difference, true);
                }
            }
        }

        uint256 keeperFee = (prizePool * keeperPercentageFee) / 10000;
        prizePool -= keeperFee;
        Address.sendValue(payable(msg.sender), keeperFee);

        uint256 totalPrize = prizePool;

        // Preparazione degli array per i vincitori e i premi
        address[] memory finalWinnersAddresses = new address[](winnersCount);
        uint256[] memory finalPrizeAmounts = new uint256[](winnersCount);

        for (uint256 i = 0; i < winnersCount; i++) {
            finalWinnersAddresses[i] = predictions[winners[i].index].predictor;
            // Distribuzione equa del premio
            finalPrizeAmounts[i] = totalPrize / winnersCount;
            Address.sendValue(
                payable(finalWinnersAddresses[i]),
                finalPrizeAmounts[i]
            );
        }

        roundWinners = finalWinnersAddresses;

        emit TournamentResolved(
            currentRound,
            finalWinnersAddresses,
            finalPrizeAmounts
        );
        _resetTournament();
    }

    function getLastWinners() external view returns (address[] memory) {
        return roundWinners;
    }

    function getPrice() public view returns (uint256) {
        return oracle.getLatestPrice() * 1e10;
    }

    function getLatestRoundPrice() external view returns (uint256) {
        return lastRoundPrice;
    }

    function getCurrentRound() external view returns (uint256) {
        return currentRound;
    }

    function getMaxPartecipants() external view returns (uint256) {
        return maxParticipants;
    }

    function getCurrentRoundPartecipants() external view returns (uint256) {
        return predictions.length;
    }

    function getCurrentPricePool() external view returns (uint256) {
        return prizePool;
    }

    function getNextVerificationTime() external view returns (uint256) {
        return verificationTime;
    }

    function getPredictions() external view returns (Prediction[] memory) {
        return predictions;
    }

    function getPartecipants() external view returns (address[] memory) {
        address[] memory partecipants = new address[](predictions.length);
        for (uint256 i = 0; i < predictions.length; i++) {
            partecipants[i] = predictions[i].predictor;
        }
        return partecipants;
    }

    receive() external payable {
        prizePool += msg.value;
    }
}
