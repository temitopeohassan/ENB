const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🔍 Fetching existing users from old contract...');

    // Configuration - UPDATE THIS VALUE
    const OLD_CONTRACT_ADDRESS = '0x54F400Ce798049303594DdA9Df724996b9B6dEAF'; // Your old deployed contract
    
    try {
        // Read addresses from account-addresses.txt file
        const addressesFilePath = path.join(__dirname, '..', 'account-addresses.txt');
        
        if (!fs.existsSync(addressesFilePath)) {
            console.error('❌ account-addresses.txt file not found in root directory');
            console.log('Please create this file with one address per line');
            process.exit(1);
        }
        
        const addressesContent = fs.readFileSync(addressesFilePath, 'utf8');
        const addresses = addressesContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.startsWith('0x'))
            .filter((address, index, arr) => arr.indexOf(address) === index); // Remove duplicates
        
        if (addresses.length === 0) {
            console.error('❌ No valid addresses found in account-addresses.txt');
            console.log('Please ensure the file contains valid Ethereum addresses (one per line)');
            process.exit(1);
        }
        
        console.log(`📋 Loaded ${addresses.length} addresses from account-addresses.txt`);
        
        // Get contract instance
        const oldContract = await ethers.getContractAt('EnbMiniApp', OLD_CONTRACT_ADDRESS);
        
        console.log('✅ Old contract instance loaded');
        console.log('📊 Fetching user data...');

        // Note: This is a simplified approach. In a real scenario, you might need to:
        // 1. Use events to track all AccountCreated events
        // 2. Or maintain a separate list of users
        // 3. Or use a different indexing method
        
        console.log('\n📝 Checking addresses from account-addresses.txt:');
        
        let existingUsers = 0;
        let nonExistingUsers = 0;
        
        for (const address of addresses) {
            try {
                const userAccount = await oldContract.userAccounts(address);
                
                if (userAccount.exists) {
                    existingUsers++;
                    console.log(`\n✅ User: ${address}`);
                    console.log(`  - Last Daily Claim: ${new Date(Number(userAccount.lastDailyClaimTime) * 1000).toISOString()}`);
                    console.log(`  - Account Created: ${new Date(Number(userAccount.accountCreatedAt) * 1000).toISOString()}`);
                    console.log(`  - Total Claims: ${userAccount.totalDailyClaims.toString()}`);
                    console.log(`  - Total Yield: ${ethers.formatEther(userAccount.totalYieldClaimed)} ENB`);
                    console.log(`  - Level: ${['Based', 'SuperBased', 'Legendary'][userAccount.membershipLevel]}`);
                    
                    // Check if they can claim now
                    const currentTime = Math.floor(Date.now() / 1000);
                    const cooldownPeriod = await oldContract.DAILY_CLAIM_COOLDOWN();
                    const timeSinceLastClaim = currentTime - Number(userAccount.lastDailyClaimTime);
                    const canClaim = timeSinceLastClaim >= Number(cooldownPeriod);
                    
                    console.log(`  - Can Claim Now: ${canClaim ? '✅ YES' : '❌ NO'}`);
                    if (!canClaim) {
                        const hoursRemaining = Math.ceil((Number(cooldownPeriod) - timeSinceLastClaim) / 3600);
                        console.log(`  - Hours Remaining: ${hoursRemaining}`);
                    }
                } else {
                    nonExistingUsers++;
                    console.log(`❌ User ${address} does not exist in old contract`);
                }
            } catch (error) {
                console.error(`⚠️  Error checking user ${address}:`, error.message);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`- Total addresses checked: ${addresses.length}`);
        console.log(`- Existing users: ${existingUsers}`);
        console.log(`- Non-existing users: ${nonExistingUsers}`);

        console.log('\n📋 Migration Preparation:');
        console.log('1. The addresses from account-addresses.txt are ready for migration');
        console.log('2. Deploy your new upgradeable contract');
        console.log('3. Deploy the AccountMigrator contract');
        console.log('4. Run the migration script');
        
        console.log('\n💡 Tips for finding all users:');
        console.log('- Check your backend database for user addresses');
        console.log('- Look for AccountCreated events in your old contract');
        console.log('- Use blockchain explorers to find contract interactions');
        console.log('- Consider using The Graph or similar indexing services');

    } catch (error) {
        console.error('❌ Failed to fetch users:', error);
        process.exit(1);
    }
}

// Handle errors
main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
