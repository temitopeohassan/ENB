// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/InviteAirdrop.sol";

contract MockENB is IERC20 {
    string public name = "ENB Token";
    string public symbol = "ENB";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Allowance exceeded");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract InviteAirdropTest is Test {
    InviteAirdrop public inviteAirdrop;
    MockENB public enbToken;

    address owner = address(0xA1);
    address relayer = address(0xB1);
    address inviter = address(0xC1);

    function setUp() public {
        vm.startPrank(owner);
        enbToken = new MockENB();
        enbToken.mint(owner, 1000 ether);

        inviteAirdrop = new InviteAirdrop(address(enbToken), relayer);

        // Fund the InviteAirdrop contract with ENB tokens
        enbToken.transfer(address(inviteAirdrop), 100 ether);
        vm.stopPrank();
    }

    function testRewardAfterFiveInvites() public {
        // Before invites: inviter has 0 ENB
        assertEq(enbToken.balanceOf(inviter), 0);

        // Simulate 5 invite uses from relayer
        vm.startPrank(relayer);
        for (uint256 i = 0; i < 5; i++) {
            inviteAirdrop.recordInviteUse(inviter);
        }
        vm.stopPrank();

        // After 5 invites: inviter should have 25 ENB
        assertEq(enbToken.balanceOf(inviter), 25 ether);

        // Ensure reward can't be claimed twice
        vm.startPrank(relayer);
        inviteAirdrop.recordInviteUse(inviter); // 6th invite
        vm.stopPrank();
        assertEq(enbToken.balanceOf(inviter), 25 ether, "Should not increase after threshold reached");
    }
}
