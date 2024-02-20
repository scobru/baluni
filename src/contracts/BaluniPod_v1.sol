// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
	function transfer(
		address recipient,
		uint256 amount
	) external returns (bool);

	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) external returns (bool);

	function balanceOf(address account) external view returns (uint256);

	function approve(address spender, uint256 amount) external returns (bool);
}

contract BaluniPodV1 {
	struct Pod {
		address seller;
		address[] erc20Tokens;
		uint256[] tokenAmounts;
		uint256 priceInUSDC;
	}

	Pod[] public pods;
	mapping(uint256 => bool) public podIsActive; // Aggiunto per tracciare lo stato attivo dei Pod
	mapping(address => uint256[]) public sellerPods;
	IERC20 public USDC; // Interfaccia del contratto USDC

	event PodCreated(uint256 indexed podId, address seller);
	event PodPurchased(uint256 indexed podId, address buyer);
	event PodWithdrawn(uint256 indexed podId, address seller);

	constructor(address _usdcAddress) {
		USDC = IERC20(_usdcAddress);
	}

	function createPod(
		address[] memory _erc20Tokens,
		uint256[] memory _tokenAmounts,
		uint256 _priceInUSDC
	) public {
		require(
			_erc20Tokens.length == _tokenAmounts.length,
			"Tokens and amounts mismatch"
		);
		require(_erc20Tokens.length > 0, "At least one token required");

		pods.push(
			Pod({
				seller: msg.sender,
				erc20Tokens: _erc20Tokens,
				tokenAmounts: _tokenAmounts,
				priceInUSDC: _priceInUSDC
			})
		);

		uint256 podId = pods.length - 1;
		podIsActive[podId] = true; // Imposta il Pod come attivo
		sellerPods[msg.sender].push(podId);

		emit PodCreated(podId, msg.sender);
	}

	function buyPod(uint256 podId) public {
		require(podIsActive[podId], "Pod is not active");
		Pod storage pod = pods[podId];

		require(
			USDC.transferFrom(msg.sender, pod.seller, pod.priceInUSDC),
			"USDC transfer failed"
		);

		for (uint i = 0; i < pod.erc20Tokens.length; i++) {
			require(
				IERC20(pod.erc20Tokens[i]).transfer(
					msg.sender,
					pod.tokenAmounts[i]
				),
				"Token transfer failed"
			);
		}

		podIsActive[podId] = false; // Imposta il Pod come non attivo
		emit PodPurchased(podId, msg.sender);
	}

	function withdrawPod(uint256 podId) public {
		require(podIsActive[podId], "Pod is not active");
		Pod storage pod = pods[podId];
		require(msg.sender == pod.seller, "Only seller can withdraw");

		for (uint i = 0; i < pod.erc20Tokens.length; i++) {
			require(
				IERC20(pod.erc20Tokens[i]).transfer(
					pod.seller,
					pod.tokenAmounts[i]
				),
				"Token return failed"
			);
		}

		podIsActive[podId] = false; // Imposta il Pod come non attivo

		// Nessuna necessità di rimuovere il pod dall'array del venditore per ottimizzazione
		emit PodWithdrawn(podId, msg.sender);
	}

	function getPodsBySeller(
		address seller
	) public view returns (uint256[] memory) {
		return sellerPods[seller];
	}

	function getPodsByUser(
		address user
	) public view returns (uint256[] memory) {
		return sellerPods[user];
	}

	function getActivePods() public view returns (Pod[] memory) {
		uint256 activeCount = 0;
		for (uint256 i = 0; i < pods.length; i++) {
			if (podIsActive[i]) {
				activeCount++;
			}
		}

		Pod[] memory activePods = new Pod[](activeCount);
		uint256 activeIndex = 0;
		for (uint256 i = 0; i < pods.length; i++) {
			if (podIsActive[i]) {
				activePods[activeIndex] = pods[i];
				activeIndex++;
			}
		}
		return activePods;
	}
}
