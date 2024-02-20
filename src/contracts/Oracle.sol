import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Oracle {
	AggregatorV3Interface internal priceFeed;

	constructor(address _priceFeedAddress) {
		priceFeed = AggregatorV3Interface(_priceFeedAddress);
	}

	function getLatestPrice() public view returns (uint256) {
		(, int256 price, , , ) = priceFeed.latestRoundData();
		// Assumiamo che il prezzo sia sempre positivo
		return uint256(price); // Adatta questa moltiplicazione in base alla tua necessità
	}
}
