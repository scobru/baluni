pragma solidity ^0.8.0;

contract BatchContract {
  function multicall(bytes[] calldata data) external {
    for (uint i = 0; i < data.length; i++) {
      (bool success, ) = msg.sender.call(data[i]);
      require(success, "Batch call failed");
    }
  }
}
