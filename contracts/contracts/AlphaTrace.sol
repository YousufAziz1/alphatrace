// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AlphaTrace
 * @notice Autonomous DeFi Trading Agent — Verifiable On-Chain Decision History
 * @dev Every AI trading decision is permanently anchored on 0G Chain with
 *      a cross-reference to the full decision JSON stored on 0G Storage.
 */
contract AlphaTrace {
    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    address public owner;
    uint256 public decisionCount;
    string public constant VERSION = "1.0.0";

    struct Decision {
        uint256 id;
        string  market;       // e.g. "ETH/USDC"
        string  action;       // "BUY" | "SELL" | "HOLD"
        int256  confidence;   // 0-100
        uint256 timestamp;
        string  reasoning;    // ≤100 char summary
        string  storageHash;  // 0G Storage content identifier
        uint256 entryPrice;   // USD × 1e8
    }

    mapping(uint256 => Decision)  public decisions;
    mapping(address => bool)      public authorizedAgents;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event DecisionRecorded(
        uint256 indexed id,
        string  market,
        string  action,
        uint256 timestamp,
        string  storageHash
    );

    event TradeSignalEmitted(
        uint256 indexed decisionId,
        string  market,
        string  action,
        int256  confidence
    );

    event AgentAuthorized(address indexed agent);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AlphaTrace: caller is not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedAgents[msg.sender], "AlphaTrace: caller is not an authorized agent");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Authorize an agent wallet to record decisions.
     * @param agent The address of the agent to authorize.
     */
    function authorizeAgent(address agent) external onlyOwner {
        require(agent != address(0), "AlphaTrace: zero address");
        authorizedAgents[agent] = true;
        emit AgentAuthorized(agent);
    }

    /**
     * @notice Revoke agent authorization.
     * @param agent The address of the agent to revoke.
     */
    function revokeAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record a new AI trading decision on-chain.
     * @param market      Trading pair, e.g. "ETH/USDC"
     * @param action      "BUY" | "SELL" | "HOLD"
     * @param confidence  0-100
     * @param reasoning   Short reasoning string (≤100 chars)
     * @param storageHash 0G Storage content identifier of the full decision JSON
     * @param entryPrice  Entry price in USD × 1e8
     * @return id         The new decision ID
     */
    function recordDecision(
        string memory market,
        string memory action,
        int256        confidence,
        string memory reasoning,
        string memory storageHash,
        uint256       entryPrice
    ) external onlyAuthorized returns (uint256 id) {
        require(confidence >= 0 && confidence <= 100, "AlphaTrace: confidence out of range");
        require(bytes(market).length > 0,  "AlphaTrace: empty market");
        require(bytes(action).length > 0,  "AlphaTrace: empty action");

        decisionCount++;
        id = decisionCount;

        decisions[id] = Decision({
            id:          id,
            market:      market,
            action:      action,
            confidence:  confidence,
            timestamp:   block.timestamp,
            reasoning:   reasoning,
            storageHash: storageHash,
            entryPrice:  entryPrice
        });

        emit DecisionRecorded(id, market, action, block.timestamp, storageHash);
        emit TradeSignalEmitted(id, market, action, confidence);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Retrieve a single decision by ID.
     */
    function getDecision(uint256 id) public view returns (Decision memory) {
        require(id > 0 && id <= decisionCount, "AlphaTrace: decision not found");
        return decisions[id];
    }

    /**
     * @notice Retrieve the last `count` decisions in reverse chronological order.
     * @param count Number of decisions to return (capped at decisionCount).
     */
    function getLatestDecisions(uint256 count)
        public
        view
        returns (Decision[] memory result)
    {
        if (decisionCount == 0) return result;
        uint256 n = count < decisionCount ? count : decisionCount;
        result = new Decision[](n);
        for (uint256 i = 0; i < n; i++) {
            result[i] = decisions[decisionCount - i];
        }
    }

    /**
     * @notice Retrieve all decisions for a specific market.
     * @param market Trading pair string to filter by.
     */
    function getDecisionsByMarket(string memory market)
        public
        view
        returns (Decision[] memory result)
    {
        // First pass — count matches
        uint256 matchCount;
        for (uint256 i = 1; i <= decisionCount; i++) {
            if (_strEq(decisions[i].market, market)) matchCount++;
        }

        result = new Decision[](matchCount);
        uint256 idx;
        for (uint256 i = 1; i <= decisionCount; i++) {
            if (_strEq(decisions[i].market, market)) {
                result[idx++] = decisions[i];
            }
        }
    }

    /**
     * @notice Mock aggregate PnL — returns 0 until a real PnL oracle is wired.
     */
    function getTotalPnL() public pure returns (int256) {
        return 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _strEq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
