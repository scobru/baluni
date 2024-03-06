pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract Agent {
  using SafeERC20 for IERC20;
  using Address for address payable;
  address public owner;
  address private router;
  address internal constant _NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  uint256 internal constant _DUST = 10;
  uint256 internal constant _BPS_BASE = 10_000;
  uint256 internal constant _BPS_FEE = 10;

  struct Call {
    address to;
    uint256 value;
    bytes data;
  }

  constructor(address _owner, address _router) {
    owner = _owner;
    router = _router;
  }

  modifier onlyRouter() {
    require(msg.sender == router, "Callable only by the router");
    _;
  }

  function execute(Call[] calldata calls, address[] calldata tokensReturn) external onlyRouter {
    for (uint i = 0; i < calls.length; i++) {
      (bool success, ) = calls[i].to.call{value: calls[i].value}(calls[i].data);
      require(success, "Batch call failed");
    }
    _chargeFees(tokensReturn);
    _returnTokens(tokensReturn);
  }

  // Getter per il controllo dell'indirizzo del router (opzionale)
  function getRouter() public view returns (address) {
    return router;
  }

  function _chargeFees(address[] calldata tokensReturn) internal returns (uint256) {
    uint256 amount;
    for (uint256 i = 0; i < tokensReturn.length; i++) {
      address token = tokensReturn[i];
      if (token == _NATIVE) {
        // Use the native balance for amount calculation as wrap will be executed later
        amount = (address(this).balance * _BPS_FEE) / _BPS_BASE;
        // send to router
        payable(router).sendValue(amount);
      } else {
        uint256 balance = IERC20(token).balanceOf(address(this));
        amount = (balance * _BPS_FEE) / _BPS_BASE;
        IERC20(token).safeTransfer(router, amount);
      }
    }
  }

  function _returnTokens(address[] calldata tokensReturn) internal {
    // Return tokens to the current user if any balance
    uint256 tokensReturnLength = tokensReturn.length;
    if (tokensReturnLength > 0) {
      address user = owner;
      for (uint256 i; i < tokensReturnLength; ) {
        address token = tokensReturn[i];
        if (token == _NATIVE) {
          if (address(this).balance > 0) {
            payable(user).sendValue(address(this).balance);
          }
        } else {
          uint256 balance = IERC20(token).balanceOf(address(this));
          if (balance > _DUST) {
            IERC20(token).safeTransfer(user, balance);
          }
        }

        unchecked {
          ++i;
        }
      }
    }
  }
}
