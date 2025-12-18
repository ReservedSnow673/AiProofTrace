// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ProofTraceRegistry
 * @notice Minimal on-chain registry for anchoring AI inference Merkle roots.
 * @dev Stores timestamp of when each root was anchored. Does not store any AI logic.
 */
contract ProofTraceRegistry {
    // Maps Merkle root to the block timestamp when it was anchored
    mapping(bytes32 => uint256) public anchoredAt;

    // Emitted when a new root is successfully anchored
    event RootAnchored(bytes32 indexed root, uint256 timestamp);

    // Custom errors for gas efficiency
    error RootAlreadyAnchored(bytes32 root, uint256 anchoredTimestamp);
    error InvalidRoot();

    /**
     * @notice Anchor a Merkle root on-chain
     * @param root The Merkle root to anchor
     */
    function anchorRoot(bytes32 root) external {
        if (root == bytes32(0)) {
            revert InvalidRoot();
        }

        uint256 existingTimestamp = anchoredAt[root];
        if (existingTimestamp != 0) {
            revert RootAlreadyAnchored(root, existingTimestamp);
        }

        anchoredAt[root] = block.timestamp;

        emit RootAnchored(root, block.timestamp);
    }

    /**
     * @notice Check if a root has been anchored
     * @param root The Merkle root to check
     * @return True if the root exists in the registry
     */
    function isAnchored(bytes32 root) external view returns (bool) {
        return anchoredAt[root] != 0;
    }

    /**
     * @notice Get the anchor timestamp for a root
     * @param root The Merkle root to query
     * @return The timestamp when the root was anchored, or 0 if not anchored
     */
    function getAnchorTimestamp(bytes32 root) external view returns (uint256) {
        return anchoredAt[root];
    }
}
