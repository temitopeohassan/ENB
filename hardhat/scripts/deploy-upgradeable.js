const { ethers } = require('hardhat');
const { upgrades } = require('@openzeppelin/hardhat-upgrades');

async function main() {
    console.log('🚀 Starting deployment of EnbMiniAppUpgradeable and AccountMigrator...');

    // Get the contract factories
    const EnbMiniAppUpgradeable = await ethers.getContractFactory('EnbMiniAppUpgradeable');
    const AccountMigrator = await ethers.getContractFactory('AccountMigrator');
    
    // Configuration - UPDATE THESE VALUES
    const ENB_TOKEN_ADDRESS = '0xf73978b3a7d1d4974abae11f696c1b4408c027a0'; // Your ENB token contract address
    const UPGRADE_RECIPIENT = '0x63526F05d9237DA102bce72960e13Ac4F2A3c3A9'; // Address to receive upgrade fees
    const TRUSTED_RELAYER = '0xaF108Dd1aC530F1c4BdED13f43E336A9cec92B44'; // Your backend wallet address
    const OWNER_ADDRESS = '0xaF108Dd1aC530F1c4BdED13f43E336A9cec92B44'; // Contract owner address
    
    console.log('📋 Configuration:');
    console.log('  ENB Token:', ENB_TOKEN_ADDRESS);
    console.log('  Upgrade Recipient:', UPGRADE_RECIPIENT);
    console.log('  Trusted Relayer:', TRUSTED_RELAYER);
    console.log('  Owner:', OWNER_ADDRESS);
    
    // Deploy the main proxy contract
    console.log('🔧 Deploying EnbMiniAppUpgradeable proxy contract...');
    const proxy = await upgrades.deployProxy(EnbMiniAppUpgradeable, [
        ENB_TOKEN_ADDRESS,
        UPGRADE_RECIPIENT,
        TRUSTED_RELAYER,
        OWNER_ADDRESS
    ], {
        kind: 'uups',
        initializer: 'initialize'
    });
    
    await proxy.waitForDeployment();
    
    const proxyAddress = await proxy.getAddress();
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    
    console.log('✅ EnbMiniAppUpgradeable deployment successful!');
    console.log('  Proxy Address:', proxyAddress);
    console.log('  Implementation Address:', implementationAddress);
    
    // Deploy the AccountMigrator contract
    console.log('🔧 Deploying AccountMigrator contract...');
    const migrator = await AccountMigrator.deploy();
    await migrator.waitForDeployment();
    
    const migratorAddress = await migrator.getAddress();
    
    console.log('✅ AccountMigrator deployment successful!');
    console.log('  Migrator Address:', migratorAddress);
    
    // Verify the main contract deployment
    console.log('🔍 Verifying main contract deployment...');
    
    try {
        const enbToken = await proxy.enbToken();
        const trustedRelayer = await proxy.trustedRelayer();
        const upgradeRecipient = await proxy.upgradeTokenRecipient();
        const owner = await proxy.owner();
        const dailyClaimCooldown = await proxy.DAILY_CLAIM_COOLDOWN();
        
        console.log('✅ Main contract verification successful:');
        console.log('  ENB Token:', enbToken);
        console.log('  Trusted Relayer:', trustedRelayer);
        console.log('  Upgrade Recipient:', upgradeRecipient);
        console.log('  Owner:', owner);
        console.log('  Daily Claim Cooldown:', dailyClaimCooldown.toString(), 'seconds');
        
        // Test basic functionality
        console.log('🧪 Testing basic functionality...');
        
        // Test pause/unpause
        if (owner === (await ethers.getSigners())[0].address) {
            console.log('  Testing pause functionality...');
            await proxy.pause();
            console.log('    ✅ Contract paused');
            await proxy.unpause();
            console.log('    ✅ Contract unpaused');
        }
        
        console.log('🎉 All main contract tests passed!');
        
    } catch (error) {
        console.error('❌ Main contract verification failed:', error.message);
    }
    
    // Verify the migrator contract
    console.log('🔍 Verifying AccountMigrator deployment...');
    
    try {
        // Test basic migrator functionality
        const migratorOwner = await migrator.owner();
        console.log('✅ AccountMigrator verification successful:');
        console.log('  Migrator Owner:', migratorOwner);
        console.log('  Migrator is ready for user migration');
        
    } catch (error) {
        console.error('❌ AccountMigrator verification failed:', error.message);
    }
    
    // Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        mainContract: {
            proxyAddress: proxyAddress,
            implementationAddress: implementationAddress,
            enbToken: ENB_TOKEN_ADDRESS,
            trustedRelayer: TRUSTED_RELAYER,
            upgradeRecipient: UPGRADE_RECIPIENT,
            owner: OWNER_ADDRESS
        },
        migratorContract: {
            address: migratorAddress,
            owner: (await ethers.getSigners())[0].address
        },
        deploymentTime: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber()
    };
    
    console.log('\n📄 Deployment Summary:');
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // Instructions for next steps
    console.log('\n📋 Next Steps:');
    console.log('1. Update your backend with the new proxy address:', proxyAddress);
    console.log('2. Use AccountMigrator at:', migratorAddress, 'to migrate existing users');
    console.log('3. Test the daily claim functionality');
    console.log('4. If needed, use resetUserCooldown() to fix existing users');
    console.log('5. Consider upgrading existing users from the old contract using the migrator');
    
    console.log('\n🔗 Contract Addresses Summary:');
    console.log('  Main Contract (Proxy):', proxyAddress);
    console.log('  Account Migrator:', migratorAddress);
    console.log('  Implementation:', implementationAddress);
}

// Handle errors
main().catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
});
