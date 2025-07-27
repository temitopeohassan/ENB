// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract EnbMiniApp is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    uint256 public constant DAILY_CLAIM_COOLDOWN = 24 hours;
    uint256 public constant RESERVE_FUND_PERCENTAGE = 10;

    enum MembershipLevel { Based, SuperBased, Legendary }

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
    }

    IERC20 public immutable enbToken;
    address public trustedRelayer;
    address public upgradeTokenRecipient;
    bool public emergencyMode;

    mapping(address => UserAccount) public userAccounts;
    mapping(MembershipLevel => LevelConfig) public levelConfigs;

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

    constructor(address _enbToken, address _upgradeRecipient, address _trustedRelayer)
        Ownable2Step()
        Ownable(msg.sender)
    {
        require(_enbToken != address(0), "Invalid token");
        require(_upgradeRecipient != address(0), "Invalid recipient");
        require(_trustedRelayer != address(0), "Invalid relayer");

        enbToken = IERC20(_enbToken);
        upgradeTokenRecipient = _upgradeRecipient;
        trustedRelayer = _trustedRelayer;

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
            exists: true
        });

        emit AccountCreated(msg.sender, block.timestamp);
    }

    function dailyClaim(address user)
        external
        onlyRelayer
        nonReentrant
        whenNotPaused
        notInEmergencyMode
        accountExists(user)
    {
        UserAccount storage account = userAccounts[user];
        if (block.timestamp < account.lastDailyClaimTime + DAILY_CLAIM_COOLDOWN) revert DailyClaimOnCooldown();

        uint256 yieldAmount = levelConfigs[account.membershipLevel].dailyClaimYield;
        if (enbToken.balanceOf(address(this)) < yieldAmount) revert InsufficientContractBalance();

        account.lastDailyClaimTime = uint40(block.timestamp);
        account.totalDailyClaims += 1;
        account.totalYieldClaimed += uint96(yieldAmount);

        enbToken.safeTransfer(user, yieldAmount);

        emit DailyClaimCompleted(user, yieldAmount, block.timestamp);
        emit YieldDistributed(user, yieldAmount, "daily_claim");
    }

    function upgradeMembership(address user, MembershipLevel targetLevel)
        external
        onlyRelayer
        nonReentrant
        whenNotPaused
        notInEmergencyMode
        accountExists(user)
    {
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

    // Admin
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

    function withdrawTokens(address to, uint256 amount)
        external
        onlyOwner
        enforceReserve(amount)
        nonReentrant
        validAmount(amount)
    {
        enbToken.safeTransfer(to, amount);
        emit TokensWithdrawn(to, amount);
    }

    function recoverERC20(address token, uint256 amount) external onlyOwner onlyInEmergencyMode {
        require(token != address(enbToken), "Cannot recover primary token");
        IERC20(token).safeTransfer(owner(), amount);
        emit ERC20Recovered(token, amount);
    }

    function activateEmergencyMode() external onlyOwner {
        emergencyMode = true;
        emit EmergencyModeActivated(msg.sender);
    }

    function deactivateEmergencyMode() external onlyOwner {
        emergencyMode = false;
        emit EmergencyModeDeactivated(msg.sender);
    }
}
