// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./EnbMiniAppUpgradeable.sol";

/**
 * @title AccountMigrator
 * @dev Contract to migrate user accounts from old EnbMiniApp to new upgradeable version
 */
contract AccountMigrator {
    // Old contract interface - minimal interface to read user data
    interface IOldEnbMiniApp {
        struct UserAccount {
            uint40 lastDailyClaimTime;
            uint40 accountCreatedAt;
            uint32 totalDailyClaims;
            uint96 totalYieldClaimed;
            uint8 membershipLevel; // Assuming this was uint8 in old contract
            bool exists;
        }
        
        function userAccounts(address user) external view returns (UserAccount memory);
        function DAILY_CLAIM_COOLDOWN() external view returns (uint256);
    }
    
    EnbMiniAppUpgradeable public newContract;
    IOldEnbMiniApp public oldContract;
    address public owner;
    
    // Migration tracking
    mapping(address => bool) public migratedUsers;
    uint256 public totalMigratedUsers;
    
    // Events
    event UserMigrated(address indexed user, uint256 timestamp);
    event MigrationCompleted(uint256 totalUsers, uint256 timestamp);
    event MigrationFailed(address indexed user, string reason);
    
    // Errors
    error OnlyOwner();
    error UserAlreadyMigrated();
    error UserDoesNotExistInOldContract();
    error MigrationFailed();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }
    
    constructor(address _newContract, address _oldContract) {
        newContract = EnbMiniAppUpgradeable(_newContract);
        oldContract = IOldEnbMiniApp(_oldContract);
        owner = msg.sender;
    }
    
    /**
     * @dev Migrate a single user account from old contract to new contract
     * @param user Address of the user to migrate
     */
    function migrateUser(address user) external onlyOwner {
        if (migratedUsers[user]) revert UserAlreadyMigrated();
        
        // Read user data from old contract
        IOldEnbMiniApp.UserAccount memory oldUserAccount = oldContract.userAccounts(user);
        
        if (!oldUserAccount.exists) revert UserDoesNotExistInOldContract();
        
        try this._performMigration(user, oldUserAccount) {
            migratedUsers[user] = true;
            totalMigratedUsers++;
            emit UserMigrated(user, block.timestamp);
        } catch {
            emit MigrationFailed(user, "Migration execution failed");
            revert MigrationFailed();
        }
    }
    
    /**
     * @dev Internal function to perform the actual migration
     * @param user Address of the user
     * @param oldUserAccount User account data from old contract
     */
    function _performMigration(address user, IOldEnbMiniApp.UserAccount memory oldUserAccount) external {
        // This function is called by migrateUser to handle the actual migration
        // We need to create the account in the new contract
        
        // Note: The new contract's createAccount function is public, so we need to call it
        // However, since we're not the user, we'll need to use a different approach
        
        // For now, we'll emit the data that needs to be set
        // You'll need to modify the new contract to allow admin creation of accounts
        emit UserMigrated(user, block.timestamp);
    }
    
    /**
     * @dev Batch migrate multiple users
     * @param users Array of user addresses to migrate
     */
    function batchMigrateUsers(address[] calldata users) external onlyOwner {
        uint256 successCount = 0;
        uint256 failCount = 0;
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            
            try this.migrateUser(user) {
                successCount++;
            } catch {
                failCount++;
                emit MigrationFailed(user, "Batch migration failed");
            }
        }
        
        emit MigrationCompleted(successCount, block.timestamp);
    }
    
    /**
     * @dev Get migration status for a user
     * @param user Address of the user
     * @return isMigrated Whether the user has been migrated
     * @return oldAccountData User account data from old contract (if exists)
     */
    function getMigrationStatus(address user) external view returns (
        bool isMigrated,
        IOldEnbMiniApp.UserAccount memory oldAccountData
    ) {
        isMigrated = migratedUsers[user];
        if (!isMigrated) {
            oldAccountData = oldContract.userAccounts(user);
        }
    }
    
    /**
     * @dev Get all users that need migration (this would need to be implemented differently)
     * Note: This is a simplified version. In practice, you'd need to track user addresses
     */
    function getPendingMigrationCount() external view returns (uint256) {
        // This would need to be implemented based on how you track users
        // For now, return 0
        return 0;
    }
    
    /**
     * @dev Update owner
     * @param newOwner New owner address
     */
    function updateOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
    
    /**
     * @dev Emergency function to recover stuck tokens
     * @param token Token address to recover
     * @param amount Amount to recover
     */
    function emergencyRecover(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            // Recover ETH
            payable(owner).transfer(amount);
        } else {
            // Recover ERC20 tokens
            IERC20(token).transfer(owner, amount);
        }
    }
}

// Minimal IERC20 interface for emergency recovery
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}
