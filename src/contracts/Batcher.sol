pragma solidity ^0.8.0;

contract Batcher {
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    function multicall(Call[] calldata calls) external {
        for (uint i = 0; i < calls.length; i++) {
            (bool success,) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            require(success, "Batch call failed");
        }
    }
}