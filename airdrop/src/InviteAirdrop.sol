// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract InviteAirdrop {
    IERC20 public immutable enbToken;
    address public owner;
    address public relayer; // Only this address can record invite uses

    uint256 public constant REWARD_AMOUNT = 25 * 1e18; // 25 ENB (assuming 18 decimals)
    uint256 public constant THRESHOLD = 5;

    mapping(address => uint256) public inviteUses;
    mapping(address => bool) public rewarded;

    event InviteUsed(address indexed inviter, uint256 totalUses);
    event RewardSent(address indexed inviter, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not relayer");
        _;
    }

    constructor(address _enbToken, address _relayer) {
        enbToken = IERC20(_enbToken);
        owner = msg.sender;
        relayer = _relayer;
    }

    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }

    function recordInviteUse(address inviter) external onlyRelayer {
        require(inviter != address(0), "Invalid inviter");

        inviteUses[inviter] += 1;
        emit InviteUsed(inviter, inviteUses[inviter]);

        if (inviteUses[inviter] == THRESHOLD && !rewarded[inviter]) {
            rewarded[inviter] = true;
            require(enbToken.transfer(inviter, REWARD_AMOUNT), "Token transfer failed");
            emit RewardSent(inviter, REWARD_AMOUNT);
        }
    }
}
