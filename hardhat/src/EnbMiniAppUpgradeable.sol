// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract EnbMiniAppUpgradeable is 
    Initializable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable, 
    OwnableUpgradeable, 
    UUPSUpgradeable 
{
    using SafeERC20Upgradeable for IERC20;

    // Constants
    uint256 public constant DAILY_CLAIM_COOLDOWN = 24 hours;
    uint256 public constant RESERVE_FUND_PERCENTAGE = 10;
    uint256 public constant MAX_COOLDOWN_RESET_AGE = 30 days; // Maximum age for cooldown reset

    // Enums
    enum MembershipLevel { Based, SuperBased, Legendary }

    // Structs
    struct LevelConfig {
        uint96 dailyClaimYield;
        uint160 upgradeRequirement;
    }

    struct UserAccount {
        uint40 lastDailyClaimTime;
        uint40 accountCreatedAt;
        uint32 totalDailyClaims;
        uint96 totalYieldClaimed;
        MembershipLevel membershipLevel;
        bool exists;
        bool cooldownReset; // Flag to track if cooldown was manually reset
    }

    // State variables
    IERC20 public enbToken;
    address public trustedRelayer;
    address public upgradeTokenRecipient;
    bool public emergencyMode;
    
    // Mappings
    mapping(address => UserAccount) public userAccounts;
    mapping(MembershipLevel => LevelConfig) public levelConfigs;
    
    // Cooldown management
    mapping(address => uint256) public cooldownResets; // Track cooldown resets per user
    uint256 public totalCooldownResets; // Total resets performed

    // Events
    event AccountCreated(address indexed user, uint256 timestamp);
    event DailyClaimCompleted(address indexed user, uint256 amount, uint256 timestamp);
    event MembershipUpgraded(address indexed user, MembershipLevel from, MembershipLevel to, uint256 amount);
    event YieldDistributed(address indexed user, uint256 amount, string reason);
    event UpgradeTokenRecipientUpdated(address newRecipient);
    event RelayerUpdated(address newRelayer);
    event TokensWithdrawn(address to, uint256 amount);
    event ERC20Recovered(address token, uint256 amount);
    event EmergencyModeActivated(address by);
    event EmergencyModeDeactivated(address by);
    event CooldownReset(address indexed user, uint256 oldTimestamp, uint256 newTimestamp, address by);
    event ContractUpgraded(address indexed implementation, uint256 timestamp);

    // Errors
    error AccountAlreadyExists();
    error AccountDoesNotExist();
    error DailyClaimOnCooldown();
    error InvalidMembershipLevel();
    error CannotSkipLevels();
    error AlreadyAtMaxLevel();
    error InsufficientTokensForUpgrade();
    error InsufficientAllowance();
    error InvalidAmount();
    error InvalidRecipient();
    error InsufficientContractBalance();
    error InsufficientReserveFunds();
    error EmergencyModeActive();
    error NotInEmergencyMode();
    error OnlyRelayerAllowed();
    error CooldownResetNotAllowed();
    error CooldownResetTooRecent();

    // Modifiers
    modifier onlyRelayer() {
        if (msg.sender != trustedRelayer) revert OnlyRelayerAllowed();
        _;
    }

    modifier accountExists(address user) {
        if (!userAccounts[user].exists) revert AccountDoesNotExist();
        _;
    }

    modifier validAmount(uint256 amount) {
        if (amount == 0) revert InvalidAmount();
        _;
    }

    modifier notInEmergencyMode() {
        if (emergencyMode) revert EmergencyModeActive();
        _;
    }

    modifier onlyInEmergencyMode() {
        if (!emergencyMode) revert NotInEmergencyMode();
        _;
    }

    modifier enforceReserve(uint256 amount) {
        uint256 reserve = (enbToken.balanceOf(address(this)) * RESERVE_FUND_PERCENTAGE) / 100;
        if ((enbToken.balanceOf(address(this)) - amount) < reserve) revert InsufficientReserveFunds();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _enbToken,
        address _upgradeRecipient,
        address _trustedRelayer,
        address _owner
    ) public initializer {
        require(_enbToken != address(0), "Invalid token");
        require(_upgradeRecipient != address(0), "Invalid recipient");
        require(_trustedRelayer != address(0), "Invalid relayer");
        require(_owner != address(0), "Invalid owner");

        enbToken = IERC20(_enbToken);
        upgradeTokenRecipient = _upgradeRecipient;
        trustedRelayer = _trustedRelayer;
        
        // Initialize inherited contracts
        __ReentrancyGuard_init();
        __Pausable_init();
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();

        // Set up level configurations
        levelConfigs[MembershipLevel.Based] = LevelConfig(10 ether, 0);
        levelConfigs[MembershipLevel.SuperBased] = LevelConfig(15 ether, 30000 ether);
        levelConfigs[MembershipLevel.Legendary] = LevelConfig(20 ether, 60000 ether);
    }

    // Account functions
    function createAccount() external nonReentrant whenNotPaused notInEmergencyMode {
        if (userAccounts[msg.sender].exists) revert AccountAlreadyExists();
        
        userAccounts[msg.sender] = UserAccount({
            lastDailyClaimTime: 0,
            accountCreatedAt: uint40(block.timestamp),
            totalDailyClaims: 0,
            totalYieldClaimed: 0,
            membershipLevel: MembershipLevel.Based,
            exists: true,
            cooldownReset: false
        });
        
        emit AccountCreated(msg.sender, block.timestamp);
    }

    // Admin function for migration - allows owner to create accounts with existing data
    function createAccountForMigration(
        address user,
        uint40 lastDailyClaimTime,
        uint40 accountCreatedAt,
        uint32 totalDailyClaims,
        uint96 totalYieldClaimed,
        MembershipLevel membershipLevel
    ) external onlyOwner whenNotPaused notInEmergencyMode {
        if (userAccounts[user].exists) revert AccountAlreadyExists();
        
        userAccounts[user] = UserAccount({
            lastDailyClaimTime: lastDailyClaimTime,
            accountCreatedAt: accountCreatedAt,
            totalDailyClaims: totalDailyClaims,
            totalYieldClaimed: totalYieldClaimed,
            membershipLevel: membershipLevel,
            exists: true,
            cooldownReset: false
        });
        
        emit AccountCreated(user, accountCreatedAt);
    }

    function dailyClaim(address user) external onlyRelayer nonReentrant whenNotPaused notInEmergencyMode accountExists(user) {
        UserAccount storage account = userAccounts[user];
        
        // Enhanced cooldown check with safety measures
        uint256 lastClaimTime = account.lastDailyClaimTime;
        uint256 currentTime = block.timestamp;
        
        // Check if cooldown period has passed
        if (lastClaimTime > 0) {
            // Safety check: prevent overflow and ensure reasonable time values
            if (lastClaimTime > currentTime || lastClaimTime > currentTime + DAILY_CLAIM_COOLDOWN) {
                // If timestamp is corrupted or unreasonably high, allow claim
                emit CooldownReset(user, lastClaimTime, 0, msg.sender);
                lastClaimTime = 0;
            } else if (currentTime < lastClaimTime + DAILY_CLAIM_COOLDOWN) {
                revert DailyClaimOnCooldown();
            }
        }

        uint256 yieldAmount = levelConfigs[account.membershipLevel].dailyClaimYield;
        
        if (enbToken.balanceOf(address(this)) < yieldAmount) revert InsufficientContractBalance();
        
        account.lastDailyClaimTime = uint40(currentTime);
        account.totalDailyClaims += 1;
        account.totalYieldClaimed += uint96(yieldAmount);
        
        enbToken.safeTransfer(user, yieldAmount);
        
        emit DailyClaimCompleted(user, yieldAmount, currentTime);
        emit YieldDistributed(user, yieldAmount, "daily_claim");
    }

    function upgradeMembership(address user, MembershipLevel targetLevel) external onlyRelayer nonReentrant whenNotPaused notInEmergencyMode accountExists(user) {
        UserAccount storage account = userAccounts[user];
        MembershipLevel currentLevel = account.membershipLevel;
        
        if (targetLevel <= currentLevel) revert InvalidMembershipLevel();
        if (uint8(targetLevel) > uint8(currentLevel) + 1) revert CannotSkipLevels();
        if (currentLevel == MembershipLevel.Legendary) revert AlreadyAtMaxLevel();
        
        uint256 cost = levelConfigs[targetLevel].upgradeRequirement;
        
        if (enbToken.balanceOf(user) < cost) revert InsufficientTokensForUpgrade();
        if (enbToken.allowance(user, address(this)) < cost) revert InsufficientAllowance();
        
        account.membershipLevel = targetLevel;
        enbToken.safeTransferFrom(user, upgradeTokenRecipient, cost);
        
        emit MembershipUpgraded(user, currentLevel, targetLevel, cost);
    }

    // Admin functions for cooldown management
    function resetUserCooldown(address user) external onlyOwner accountExists(user) {
        UserAccount storage account = userAccounts[user];
        
        // Check if enough time has passed since last reset
        uint256 lastReset = cooldownResets[user];
        if (lastReset > 0 && block.timestamp < lastReset + 7 days) {
            revert CooldownResetTooRecent();
        }
        
        uint256 oldTimestamp = account.lastDailyClaimTime;
        account.lastDailyClaimTime = 0;
        account.cooldownReset = true;
        cooldownResets[user] = block.timestamp;
        totalCooldownResets++;
        
        emit CooldownReset(user, oldTimestamp, 0, msg.sender);
    }

    function forceDailyClaim(address user) external onlyOwner accountExists(user) notInEmergencyMode {
        UserAccount storage account = userAccounts[user];
        
        uint256 yieldAmount = levelConfigs[account.membershipLevel].dailyClaimYield;
        
        if (enbToken.balanceOf(address(this)) < yieldAmount) revert InsufficientContractBalance();
        
        uint256 oldTimestamp = account.lastDailyClaimTime;
        account.lastDailyClaimTime = uint40(block.timestamp);
        account.totalDailyClaims += 1;
        account.totalYieldClaimed += uint96(yieldAmount);
        account.cooldownReset = true;
        
        enbToken.safeTransfer(user, yieldAmount);
        
        emit DailyClaimCompleted(user, yieldAmount, block.timestamp);
        emit YieldDistributed(user, yieldAmount, "forced_daily_claim");
        emit CooldownReset(user, oldTimestamp, block.timestamp, msg.sender);
    }

    function batchResetCooldowns(address[] calldata users) external onlyOwner {
        uint256 length = users.length;
        require(length <= 50, "Too many users in batch"); // Prevent gas limit issues
        
        for (uint256 i = 0; i < length; i++) {
            address user = users[i];
            if (userAccounts[user].exists) {
                UserAccount storage account = userAccounts[user];
                uint256 oldTimestamp = account.lastDailyClaimTime;
                account.lastDailyClaimTime = 0;
                account.cooldownReset = true;
                cooldownResets[user] = block.timestamp;
                totalCooldownResets++;
                
                emit CooldownReset(user, oldTimestamp, 0, msg.sender);
            }
        }
    }

    // Configuration functions
    function updateRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert InvalidRecipient();
        trustedRelayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    function updateUpgradeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidRecipient();
        upgradeTokenRecipient = newRecipient;
        emit UpgradeTokenRecipientUpdated(newRecipient);
    }

    function updateLevelConfig(MembershipLevel level, uint96 dailyYield, uint160 upgradeRequirement) external onlyOwner {
        levelConfigs[level] = LevelConfig(dailyYield, upgradeRequirement);
    }

    // Emergency functions
    function activateEmergencyMode() external onlyOwner {
        emergencyMode = true;
        emit EmergencyModeActivated(msg.sender);
    }

    function deactivateEmergencyMode() external onlyOwner {
        emergencyMode = false;
        emit EmergencyModeDeactivated(msg.sender);
    }

    function withdrawTokens(address to, uint256 amount) external onlyOwner enforceReserve(amount) nonReentrant validAmount(amount) {
        enbToken.safeTransfer(to, amount);
        emit TokensWithdrawn(to, amount);
    }

    function recoverERC20(address token, uint256 amount) external onlyOwner onlyInEmergencyMode {
        require(token != address(enbToken), "Cannot recover primary token");
        IERC20(token).safeTransfer(owner(), amount);
        emit ERC20Recovered(token, amount);
    }

    // View functions for debugging and monitoring
    function getUserCooldownInfo(address user) external view returns (
        uint256 lastClaimTime,
        uint256 timeSinceLastClaim,
        uint256 timeRemaining,
        bool canClaim,
        bool wasReset
    ) {
        UserAccount storage account = userAccounts[user];
        if (!account.exists) return (0, 0, 0, false, false);
        
        lastClaimTime = account.lastDailyClaimTime;
        wasReset = account.cooldownReset;
        
        if (lastClaimTime == 0) {
            canClaim = true;
            timeSinceLastClaim = 0;
            timeRemaining = 0;
        } else {
            uint256 currentTime = block.timestamp;
            
            // Safety check for corrupted timestamps
            if (lastClaimTime > currentTime || lastClaimTime > currentTime + DAILY_CLAIM_COOLDOWN) {
                canClaim = true;
                timeSinceLastClaim = 0;
                timeRemaining = 0;
            } else {
                timeSinceLastClaim = currentTime - lastClaimTime;
                if (timeSinceLastClaim >= DAILY_CLAIM_COOLDOWN) {
                    canClaim = true;
                    timeRemaining = 0;
                } else {
                    canClaim = false;
                    timeRemaining = DAILY_CLAIM_COOLDOWN - timeSinceLastClaim;
                }
            }
        }
    }

    function getContractStats() external view returns (
        uint256 totalUsers,
        uint256 totalClaims,
        uint256 totalYieldDistributed,
        uint256 contractBalance,
        uint256 reserveAmount,
        uint256 totalResets
    ) {
        // Note: This is a simplified version. In production, you might want to track these separately
        totalUsers = 0; // Would need to track this separately
        totalClaims = 0; // Would need to track this separately
        totalYieldDistributed = 0; // Would need to track this separately
        contractBalance = enbToken.balanceOf(address(this));
        reserveAmount = (contractBalance * RESERVE_FUND_PERCENTAGE) / 100;
        totalResets = totalCooldownResets;
    }

    // UUPS upgrade function
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        emit ContractUpgraded(newImplementation, block.timestamp);
    }

    // Pause functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Receive function for emergency ETH transfers
    receive() external payable {
        // Contract can receive ETH but doesn't process it
    }
}
