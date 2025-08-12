const { ethers } = require('hardhat');

async function main() {
    console.log('🔄 Starting user migration process...');

    // Configuration - UPDATE THESE VALUES
    const OLD_CONTRACT_ADDRESS = '0x54F400Ce798049303594DdA9Df724996b9B6dEAF'; // Your old deployed contract
    const NEW_CONTRACT_ADDRESS = '0x...'; // Your new upgradeable contract proxy address
    const MIGRATOR_ADDRESS = '0x...'; // Your deployed AccountMigrator address
    
    // List of user addresses to migrate (you can add more)
    const USER_ADDRESSES = [
        '0x79Aa14542003b560bA16e5F3665006d5600Ea14D', // The user who couldn't claim for 2 weeks
        // Add more addresses here...
    ];

    console.log('📋 Migration Configuration:');
    console.log('  Old Contract:', OLD_CONTRACT_ADDRESS);
    console.log('  New Contract:', NEW_CONTRACT_ADDRESS);
    console.log('  Migrator Contract:', MIGRATOR_ADDRESS);
    console.log('  Users to migrate:', USER_ADDRESSES.length);

    try {
        // Get contract instances
        const migrator = await ethers.getContractAt('AccountMigrator', MIGRATOR_ADDRESS);
        const oldContract = await ethers.getContractAt('EnbMiniApp', OLD_CONTRACT_ADDRESS);
        const newContract = await ethers.getContractAt('EnbMiniAppUpgradeable', NEW_CONTRACT_ADDRESS);

        console.log('✅ Contract instances loaded successfully');

        // Check if migrator is authorized
        const migratorOwner = await migrator.owner();
        const deployer = (await ethers.getSigners())[0];
        
        if (migratorOwner !== deployer.address) {
            console.log('⚠️  Warning: You are not the migrator owner');
            console.log('  Migrator Owner:', migratorOwner);
            console.log('  Your Address:', deployer.address);
        }

        // Start migration process
        console.log('\n🔄 Starting individual user migration...');

        for (let i = 0; i < USER_ADDRESSES.length; i++) {
            const userAddress = USER_ADDRESSES[i];
            console.log(`\n📝 Migrating user ${i + 1}/${USER_ADDRESSES.length}: ${userAddress}`);

            try {
                // Check if user exists in old contract
                const oldUserAccount = await oldContract.userAccounts(userAddress);
                
                if (!oldUserAccount.exists) {
                    console.log('  ⚠️  User does not exist in old contract, skipping...');
                    continue;
                }

                console.log('  📊 Old contract data:');
                console.log('    - Last Daily Claim Time:', new Date(Number(oldUserAccount.lastDailyClaimTime) * 1000).toISOString());
                console.log('    - Account Created At:', new Date(Number(oldUserAccount.accountCreatedAt) * 1000).toISOString());
                console.log('    - Total Daily Claims:', oldUserAccount.totalDailyClaims.toString());
                console.log('    - Total Yield Claimed:', ethers.formatEther(oldUserAccount.totalYieldClaimed), 'ENB');
                console.log('    - Membership Level:', ['Based', 'SuperBased', 'Legendary'][oldUserAccount.membershipLevel]);

                // Check if user already exists in new contract
                const newUserAccount = await newContract.userAccounts(userAddress);
                
                if (newUserAccount.exists) {
                    console.log('  ⚠️  User already exists in new contract, skipping...');
                    continue;
                }

                // Migrate the user
                console.log('  🔄 Migrating user to new contract...');
                
                const tx = await migrator.migrateUser(
                    OLD_CONTRACT_ADDRESS,
                    NEW_CONTRACT_ADDRESS,
                    userAddress
                );
                
                console.log('  📝 Migration transaction sent:', tx.hash);
                await tx.wait();
                console.log('  ✅ Migration transaction confirmed!');

                // Verify migration
                const migratedUser = await newContract.userAccounts(userAddress);
                console.log('  🔍 Verification:');
                console.log('    - Exists:', migratedUser.exists);
                console.log('    - Last Daily Claim Time:', new Date(Number(migratedUser.lastDailyClaimTime) * 1000).toISOString());
                console.log('    - Membership Level:', ['Based', 'SuperBased', 'Legendary'][migratedUser.membershipLevel]);

            } catch (error) {
                console.error(`  ❌ Failed to migrate user ${userAddress}:`, error.message);
            }
        }

        // Batch migration option (for many users)
        console.log('\n🚀 Batch Migration Option:');
        console.log('If you have many users, you can use batch migration:');
        console.log('await migrator.batchMigrateUsers(oldContract, newContract, userAddresses, batchSize);');

        console.log('\n🎉 Migration process completed!');
        console.log('\n📋 Next Steps:');
        console.log('1. Test daily claim functionality for migrated users');
        console.log('2. Use resetUserCooldown() if users still have cooldown issues');
        console.log('3. Update your backend to use the new contract address');
        console.log('4. Consider deactivating the old contract');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Handle errors
main().catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
