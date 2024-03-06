pragma solidity ^0.8.0;

import "./Agent.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Router is Ownable {
  using SafeERC20 for IERC20;

  struct Call {
    address to;
    uint256 value;
    bytes data;
  }

  mapping(address => Agent) public userAgents;

  constructor() Ownable(msg.sender) {}

  event AgentCreated(address user, address agent);

  function getOrCreateAgent(address user) private returns (Agent) {
    bytes32 salt = keccak256(abi.encodePacked(user));
    if (address(userAgents[user]) == address(0)) {
      Agent agent = new Agent{salt: salt}(user, address(this));
      userAgents[user] = agent;
      emit AgentCreated(user, address(agent));
    }
    return userAgents[user];
  }

  function execute(Agent.Call[] calldata calls, address[] calldata tokensReturn) external {
    Agent agent = getOrCreateAgent(msg.sender);
    agent.execute(calls, tokensReturn);
  }

  function getAgentAddress(address _user) public view returns (address) {
    bytes32 salt = keccak256(abi.encodePacked(user));
    bytes memory bytecode = getBytecode(_user);
    bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode)));
    return address(uint160(uint(hash)));
  }

  // get the ByteCode of the contract DeployWithCreate2
  function getBytecode(address _owner) public pure returns (bytes memory) {
    bytes memory bytecode = type(Agent).creationCode;
    return abi.encodePacked(bytecode, abi.encode(_owner, address(this)));
  }

  function withdraw() external onlyOwner {
    payable(owner()).transfer(address(this).balance);
  }

  function withdrawToken(address token) external onlyOwner {
    IERC20(token).transfer(owner(), IERC20(token).balanceOf(address(this)));
  }
}
