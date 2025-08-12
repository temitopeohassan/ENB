// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/InviteAirdrop.sol";

contract DeployInviteAirdrop is Script {
    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load constructor args from environment
        address enbToken = vm.envAddress("ENB_TOKEN_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        InviteAirdrop inviteAirdrop = new InviteAirdrop(enbToken, relayer);

        console.log("InviteAirdrop deployed at:", address(inviteAirdrop));

        vm.stopBroadcast();
    }
}
