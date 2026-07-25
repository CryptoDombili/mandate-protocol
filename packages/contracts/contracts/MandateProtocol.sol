// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Mandate Protocol
/// @notice Non-upgradeable, bounded recurring access payments for Startale Mini Apps.
/// @dev The owner can allow tokens and pause new charges, but has no function to move user balances.
contract MandateProtocol is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum SubscriptionStatus {
        None,
        Active,
        Paused,
        Cancelled,
        Completed
    }

    struct Plan {
        address merchant;
        address token;
        uint128 amountPerPeriod;
        uint64 periodSeconds;
        uint32 merchantChargeLimit;
        bool enabled;
        string metadataURI;
    }

    struct Subscription {
        uint256 planId;
        address subscriber;
        uint128 spendCap;
        uint128 totalSpent;
        uint128 totalRefunded;
        uint64 nextChargeAt;
        uint64 paidUntil;
        uint32 chargeLimit;
        uint32 charges;
        SubscriptionStatus status;
    }

    error ZeroAddress();
    error ZeroAmount();
    error UnsupportedToken(address token);
    error FeeOnTransferTokenUnsupported();
    error InvalidPeriod();
    error InvalidChargeLimit();
    error InvalidSpendCap();
    error PlanNotFound(uint256 planId);
    error PlanDisabled(uint256 planId);
    error NotPlanMerchant();
    error SubscriptionNotFound(uint256 subscriptionId);
    error NotSubscriber();
    error InvalidSubscriptionStatus();
    error ChargeNotDue(uint64 nextChargeAt);
    error ChargeLimitReached();
    error SpendCapExceeded();
    error InsufficientVaultBalance(uint256 available, uint256 required);
    error ChargesPaused();
    error RefundExceedsPaidAmount();

    event SupportedTokenSet(address indexed token, bool supported);
    event ChargesPauseSet(bool paused);
    event Deposited(address indexed account, address indexed token, uint256 amount);
    event Withdrawn(address indexed account, address indexed token, uint256 amount);
    event PlanCreated(
        uint256 indexed planId,
        address indexed merchant,
        address indexed token,
        uint256 amountPerPeriod,
        uint256 periodSeconds,
        uint256 merchantChargeLimit,
        string metadataURI
    );
    event PlanEnabledSet(uint256 indexed planId, bool enabled);
    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        uint256 indexed planId,
        address indexed subscriber,
        uint256 chargeLimit,
        uint256 spendCap
    );
    event SubscriptionPaused(uint256 indexed subscriptionId);
    event SubscriptionResumed(uint256 indexed subscriptionId, uint64 nextChargeAt);
    event SubscriptionCancelled(uint256 indexed subscriptionId);
    event Charged(
        uint256 indexed subscriptionId,
        uint256 indexed planId,
        address indexed subscriber,
        address merchant,
        address token,
        uint256 amount,
        uint32 chargeNumber,
        uint64 paidUntil
    );
    event Refunded(
        uint256 indexed subscriptionId,
        address indexed merchant,
        address indexed subscriber,
        address token,
        uint256 amount
    );

    uint64 public constant MIN_PERIOD_SECONDS = 1 hours;

    bool public chargesArePaused;
    uint256 public planCount;
    uint256 public subscriptionCount;

    mapping(address token => bool supported) public supportedTokens;
    mapping(address account => mapping(address token => uint256 amount)) public vaultBalance;
    mapping(address token => uint256 amount) public totalVaultLiability;
    mapping(uint256 planId => Plan plan) public plans;
    mapping(uint256 subscriptionId => Subscription subscription) public subscriptions;

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    /// @notice Adds or removes a token from new deposits and plan creation.
    /// @dev Removing support never blocks withdrawals of existing balances.
    function setSupportedToken(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        supportedTokens[token] = supported;
        emit SupportedTokenSet(token, supported);
    }

    /// @notice Stops new charges during incident response. Withdrawals remain available.
    function setChargesPaused(bool paused) external onlyOwner {
        chargesArePaused = paused;
        emit ChargesPauseSet(paused);
    }

    function deposit(address token, uint256 amount) external nonReentrant {
        if (!supportedTokens[token]) revert UnsupportedToken(token);
        if (amount == 0) revert ZeroAmount();

        IERC20 asset = IERC20(token);
        uint256 balanceBefore = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = asset.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert FeeOnTransferTokenUnsupported();

        vaultBalance[msg.sender][token] += amount;
        totalVaultLiability[token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    /// @notice Withdraws unspent vault funds. Pending subscriptions do not lock the balance.
    function withdraw(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 available = vaultBalance[msg.sender][token];
        if (available < amount) revert InsufficientVaultBalance(available, amount);

        vaultBalance[msg.sender][token] = available - amount;
        totalVaultLiability[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    /// @notice Creates an immutable-price plan. Merchants create a new plan to change terms.
    function createPlan(
        address token,
        uint128 amountPerPeriod,
        uint64 periodSeconds,
        uint32 merchantChargeLimit,
        string calldata metadataURI
    ) external returns (uint256 planId) {
        if (!supportedTokens[token]) revert UnsupportedToken(token);
        if (amountPerPeriod == 0) revert ZeroAmount();
        if (periodSeconds < MIN_PERIOD_SECONDS) revert InvalidPeriod();

        planId = ++planCount;
        plans[planId] = Plan({
            merchant: msg.sender,
            token: token,
            amountPerPeriod: amountPerPeriod,
            periodSeconds: periodSeconds,
            merchantChargeLimit: merchantChargeLimit,
            enabled: true,
            metadataURI: metadataURI
        });

        emit PlanCreated(
            planId,
            msg.sender,
            token,
            amountPerPeriod,
            periodSeconds,
            merchantChargeLimit,
            metadataURI
        );
    }

    function setPlanEnabled(uint256 planId, bool enabled) external {
        Plan storage plan = _getPlan(planId);
        if (plan.merchant != msg.sender) revert NotPlanMerchant();
        plan.enabled = enabled;
        emit PlanEnabledSet(planId, enabled);
    }

    /// @notice Creates a bounded subscription. The first payment is triggered separately.
    /// @param chargeLimit User-approved maximum number of charges.
    /// @param spendCap User-approved lifetime gross spending cap for this subscription.
    function subscribe(
        uint256 planId,
        uint32 chargeLimit,
        uint128 spendCap
    ) external returns (uint256 subscriptionId) {
        Plan storage plan = _getPlan(planId);
        if (!plan.enabled) revert PlanDisabled(planId);
        if (chargeLimit == 0) revert InvalidChargeLimit();
        if (plan.merchantChargeLimit != 0 && chargeLimit > plan.merchantChargeLimit) {
            revert InvalidChargeLimit();
        }
        if (spendCap < uint256(plan.amountPerPeriod) * chargeLimit) revert InvalidSpendCap();

        subscriptionId = ++subscriptionCount;
        subscriptions[subscriptionId] = Subscription({
            planId: planId,
            subscriber: msg.sender,
            spendCap: spendCap,
            totalSpent: 0,
            totalRefunded: 0,
            nextChargeAt: uint64(block.timestamp),
            paidUntil: 0,
            chargeLimit: chargeLimit,
            charges: 0,
            status: SubscriptionStatus.Active
        });

        emit SubscriptionCreated(subscriptionId, planId, msg.sender, chargeLimit, spendCap);
    }

    function pauseSubscription(uint256 subscriptionId) external {
        Subscription storage subscription = _getSubscription(subscriptionId);
        _requireSubscriber(subscription);
        if (subscription.status != SubscriptionStatus.Active) revert InvalidSubscriptionStatus();
        subscription.status = SubscriptionStatus.Paused;
        emit SubscriptionPaused(subscriptionId);
    }

    function resumeSubscription(uint256 subscriptionId) external {
        Subscription storage subscription = _getSubscription(subscriptionId);
        _requireSubscriber(subscription);
        if (subscription.status != SubscriptionStatus.Paused) revert InvalidSubscriptionStatus();

        subscription.status = SubscriptionStatus.Active;
        uint64 earliest = subscription.paidUntil > block.timestamp
            ? subscription.paidUntil
            : uint64(block.timestamp);
        subscription.nextChargeAt = earliest;
        emit SubscriptionResumed(subscriptionId, earliest);
    }

    function cancelSubscription(uint256 subscriptionId) external {
        Subscription storage subscription = _getSubscription(subscriptionId);
        _requireSubscriber(subscription);
        if (
            subscription.status != SubscriptionStatus.Active &&
            subscription.status != SubscriptionStatus.Paused
        ) revert InvalidSubscriptionStatus();

        subscription.status = SubscriptionStatus.Cancelled;
        emit SubscriptionCancelled(subscriptionId);
    }

    /// @notice Triggers one due period. Anyone may call; all authority is enforced onchain.
    function charge(uint256 subscriptionId) external nonReentrant {
        if (chargesArePaused) revert ChargesPaused();

        Subscription storage subscription = _getSubscription(subscriptionId);
        if (subscription.status != SubscriptionStatus.Active) revert InvalidSubscriptionStatus();
        if (block.timestamp < subscription.nextChargeAt) revert ChargeNotDue(subscription.nextChargeAt);
        if (subscription.charges >= subscription.chargeLimit) revert ChargeLimitReached();

        Plan storage plan = _getPlan(subscription.planId);
        if (!plan.enabled) revert PlanDisabled(subscription.planId);

        uint256 amount = plan.amountPerPeriod;
        uint256 newTotalSpent = uint256(subscription.totalSpent) + amount;
        if (newTotalSpent > subscription.spendCap) revert SpendCapExceeded();

        uint256 available = vaultBalance[subscription.subscriber][plan.token];
        if (available < amount) revert InsufficientVaultBalance(available, amount);

        vaultBalance[subscription.subscriber][plan.token] = available - amount;
        totalVaultLiability[plan.token] -= amount;
        subscription.totalSpent = uint128(newTotalSpent);
        subscription.charges += 1;
        subscription.paidUntil = uint64(block.timestamp + plan.periodSeconds);
        subscription.nextChargeAt = subscription.paidUntil;

        if (subscription.charges == subscription.chargeLimit) {
            subscription.status = SubscriptionStatus.Completed;
        }

        IERC20(plan.token).safeTransfer(plan.merchant, amount);

        emit Charged(
            subscriptionId,
            subscription.planId,
            subscription.subscriber,
            plan.merchant,
            plan.token,
            amount,
            subscription.charges,
            subscription.paidUntil
        );
    }

    /// @notice Merchant-funded refund credited back to the user's withdrawable vault balance.
    function refund(uint256 subscriptionId, uint128 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Subscription storage subscription = _getSubscription(subscriptionId);
        Plan storage plan = _getPlan(subscription.planId);
        if (plan.merchant != msg.sender) revert NotPlanMerchant();
        if (uint256(subscription.totalRefunded) + amount > subscription.totalSpent) {
            revert RefundExceedsPaidAmount();
        }

        IERC20 asset = IERC20(plan.token);
        uint256 balanceBefore = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = asset.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert FeeOnTransferTokenUnsupported();

        subscription.totalRefunded += amount;
        vaultBalance[subscription.subscriber][plan.token] += amount;
        totalVaultLiability[plan.token] += amount;

        emit Refunded(subscriptionId, msg.sender, subscription.subscriber, plan.token, amount);
    }

    /// @notice Access remains valid through the paid period after pause, cancel, or completion.
    function hasActiveAccess(uint256 subscriptionId) external view returns (bool) {
        Subscription storage subscription = subscriptions[subscriptionId];
        return subscription.subscriber != address(0) && subscription.paidUntil > block.timestamp;
    }

    function _getPlan(uint256 planId) internal view returns (Plan storage plan) {
        plan = plans[planId];
        if (plan.merchant == address(0)) revert PlanNotFound(planId);
    }

    function _getSubscription(
        uint256 subscriptionId
    ) internal view returns (Subscription storage subscription) {
        subscription = subscriptions[subscriptionId];
        if (subscription.subscriber == address(0)) revert SubscriptionNotFound(subscriptionId);
    }

    function _requireSubscriber(Subscription storage subscription) internal view {
        if (subscription.subscriber != msg.sender) revert NotSubscriber();
    }
}
