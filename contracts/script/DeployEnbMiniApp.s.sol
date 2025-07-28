// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/EnbMiniApp.sol";

contract DeployEnbMiniApp is Script {
    function run() external {
        // Load environment variables
        address enbTokenAddress = vm.envAddress("ENB_TOKEN_ADDRESS");
        address upgradeRecipient = vm.envAddress("UPGRADE_RECIPIENT_ADDRESS");
        address trustedRelayer = vm.envAddress("TRUSTED_RELAYER_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Validation checks
        require(enbTokenAddress != address(0), "ENB_TOKEN_ADDRESS not set");
        require(upgradeRecipient != address(0), "UPGRADE_RECIPIENT_ADDRESS not set");
        require(trustedRelayer != address(0), "TRUSTED_RELAYER_ADDRESS not set");
        require(deployerPrivateKey != 0, "PRIVATE_KEY not set");

        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== ENB Mini App Deployment ===");
        console.log("Deployer:", deployer);
        console.log("ENB Token Address:", enbTokenAddress);
        console.log("Upgrade Recipient Address:", upgradeRecipient);
        console.log("Trusted Relayer Address:", trustedRelayer);
        console.log("Network:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        EnbMiniApp enbMiniApp = new EnbMiniApp(
            enbTokenAddress,
            upgradeRecipient,
            trustedRelayer
        );

        vm.stopBroadcast();

        console.log("=== Deployment Successful ===");
        console.log("EnbMiniApp Contract Address:", address(enbMiniApp));
    }
}
