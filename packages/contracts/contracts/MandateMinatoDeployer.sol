// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MandateProtocol} from "./MandateProtocol.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @title Mandate Minato Deployer
/// @notice One-transaction testnet bootstrap for Mandate's token, protocol, and three demo plans.
/// @dev Intended for Soneium Minato testing only. The controller retains ownership of MockUSDC
///      and becomes the pending owner of MandateProtocol after deployment.
contract MandateMinatoDeployer {
    using SafeERC20 for IERC20;

    error NotController();
    error ZeroAmount();

    event MandateStackDeployed(
        address indexed controller,
        address indexed token,
        address indexed protocol,
        uint256 arcadePlanId,
        uint256 creatorPlanId,
        uint256 builderPlanId
    );
    event RevenueWithdrawn(address indexed controller, uint256 amount);

    address public immutable controller;
    MockUSDC public immutable token;
    MandateProtocol public immutable protocol;

    uint256 public immutable arcadePlanId;
    uint256 public immutable creatorPlanId;
    uint256 public immutable builderPlanId;

    modifier onlyController() {
        if (msg.sender != controller) revert NotController();
        _;
    }

    constructor() {
        controller = msg.sender;

        // The deployer temporarily owns both contracts so the full demo stack can be configured
        // atomically. Ownership is then handed to the wallet that deployed this helper.
        token = new MockUSDC(address(this));
        protocol = new MandateProtocol(address(this));

        protocol.setSupportedToken(address(token), true);
        token.mint(msg.sender, 1_000_000e6);
        token.transferOwnership(msg.sender);

        arcadePlanId = protocol.createPlan(
            address(token),
            5e6,
            30 days,
            12,
            "ipfs://mandate-demo/arcade-pro-pass"
        );
        creatorPlanId = protocol.createPlan(
            address(token),
            2e6,
            30 days,
            12,
            "ipfs://mandate-demo/creator-inner-circle"
        );
        builderPlanId = protocol.createPlan(
            address(token),
            3e6,
            30 days,
            12,
            "ipfs://mandate-demo/builder-toolkit"
        );

        // MandateProtocol uses Ownable2Step. The controller must call acceptOwnership()
        // once after deployment. Until then, this helper cannot move user vault balances.
        protocol.transferOwnership(msg.sender);

        emit MandateStackDeployed(
            msg.sender,
            address(token),
            address(protocol),
            arcadePlanId,
            creatorPlanId,
            builderPlanId
        );
    }

    /// @notice Creates an additional demo plan whose merchant is this controller contract.
    function createPlan(
        uint128 amountPerPeriod,
        uint64 periodSeconds,
        uint32 merchantChargeLimit,
        string calldata metadataURI
    ) external onlyController returns (uint256 planId) {
        planId = protocol.createPlan(
            address(token),
            amountPerPeriod,
            periodSeconds,
            merchantChargeLimit,
            metadataURI
        );
    }

    function setPlanEnabled(uint256 planId, bool enabled) external onlyController {
        protocol.setPlanEnabled(planId, enabled);
    }

    /// @notice Withdraws membership revenue received by this demo merchant contract.
    function withdrawRevenue(uint256 amount) external onlyController {
        if (amount == 0) revert ZeroAmount();
        IERC20(address(token)).safeTransfer(controller, amount);
        emit RevenueWithdrawn(controller, amount);
    }

    /// @notice Issues a merchant-funded refund from revenue held by this helper.
    function refund(uint256 subscriptionId, uint128 amount) external onlyController {
        if (amount == 0) revert ZeroAmount();
        IERC20(address(token)).forceApprove(address(protocol), amount);
        protocol.refund(subscriptionId, amount);
    }
}
