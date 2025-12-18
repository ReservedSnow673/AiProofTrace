/**
 * Merkle Tree Builder
 * 
 * Builds Merkle trees from inference hashes with:
 * - Sorted pair hashing for deterministic construction
 * - Proof generation for individual leaf verification
 * - Proof verification utilities
 */

import { keccak256 } from 'ethers';
import { MerkleBatch, MerkleProof } from '../types';
import { randomBytes } from 'crypto';

/**
 * Normalize hash to lowercase with 0x prefix
 */
function normalizeHash(hash: string): string {
    const cleaned = hash.toLowerCase().replace(/^0x/, '');
    return `0x${cleaned}`;
}

/**
 * Combine two hashes using sorted pair hashing
 * This ensures (A, B) and (B, A) produce the same result
 */
function hashPair(left: string, right: string): string {
    const normalizedLeft = normalizeHash(left);
    const normalizedRight = normalizeHash(right);

    // Sort to ensure deterministic ordering
    const [first, second] = [normalizedLeft, normalizedRight].sort();

    // Concatenate as raw bytes (remove 0x from second)
    const combined = first + (second?.slice(2) ?? '');
    return keccak256(combined as `0x${string}`);
}

/**
 * Build the next level of the Merkle tree
 */
function buildNextLevel(currentLevel: string[]): string[] {
    const nextLevel: string[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];

        if (left === undefined) {
            throw new Error('Unexpected undefined value in Merkle tree construction');
        }

        // Duplicate last element if odd number of leaves
        const rightHash = right ?? left;
        nextLevel.push(hashPair(left, rightHash));
    }

    return nextLevel;
}

/**
 * Build a Merkle tree from a list of leaf hashes
 * 
 * @param leaves - Array of leaf hashes (inference hashes)
 * @returns Complete tree structure with all levels
 */
function buildTree(leaves: string[]): string[][] {
    if (leaves.length === 0) {
        throw new Error('Cannot build Merkle tree with empty leaves');
    }

    // Normalize all leaves
    const normalizedLeaves = leaves.map(normalizeHash);

    // Sort leaves for deterministic tree construction
    const sortedLeaves = [...normalizedLeaves].sort();

    const levels: string[][] = [sortedLeaves];
    let currentLevel = sortedLeaves;

    while (currentLevel.length > 1) {
        currentLevel = buildNextLevel(currentLevel);
        levels.push(currentLevel);
    }

    return levels;
}

/**
 * Generate a unique batch ID
 */
function generateBatchId(): string {
    const timestamp = Date.now().toString(16);
    const random = randomBytes(8).toString('hex');
    return `batch_${timestamp}_${random}`;
}

/**
 * Build a Merkle batch from inference hashes
 * 
 * @param hashes - Array of inference hashes to batch
 * @returns MerkleBatch containing root, leaves, and tree structure
 */
export function buildMerkleBatch(hashes: string[]): MerkleBatch {
    if (hashes.length === 0) {
        throw new Error('Cannot create batch with no hashes');
    }

    const tree = buildTree(hashes);
    const rootLevel = tree[tree.length - 1];

    if (!rootLevel || rootLevel.length !== 1) {
        throw new Error('Invalid tree structure');
    }

    const root = rootLevel[0];
    if (!root) {
        throw new Error('Failed to compute Merkle root');
    }

    return {
        batch_id: generateBatchId(),
        root: root,
        leaves: tree[0] ?? [],
        tree: tree,
        created_at: Date.now(),
        leaf_count: hashes.length,
    };
}

/**
 * Find the index of a leaf in the sorted leaves array
 */
function findLeafIndex(sortedLeaves: string[], targetLeaf: string): number {
    const normalized = normalizeHash(targetLeaf);
    return sortedLeaves.findIndex(leaf => leaf.toLowerCase() === normalized.toLowerCase());
}

/**
 * Generate a Merkle proof for a specific leaf
 * 
 * @param batch - The Merkle batch
 * @param leafHash - The hash to generate proof for
 * @returns MerkleProof if leaf exists, null otherwise
 */
export function generateProof(batch: MerkleBatch, leafHash: string): MerkleProof | null {
    const leafIndex = findLeafIndex(batch.leaves, leafHash);

    if (leafIndex === -1) {
        return null;
    }

    const proof: string[] = [];
    let currentIndex = leafIndex;

    for (let level = 0; level < batch.tree.length - 1; level++) {
        const currentLevel = batch.tree[level];
        if (!currentLevel) continue;

        const isRight = currentIndex % 2 === 1;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

        // If sibling exists, add to proof
        const sibling = currentLevel[siblingIndex] ?? currentLevel[currentIndex];
        if (sibling) {
            proof.push(sibling);
        }

        currentIndex = Math.floor(currentIndex / 2);
    }

    return {
        leaf: normalizeHash(leafHash),
        proof: proof,
        root: batch.root,
        leaf_index: leafIndex,
    };
}

/**
 * Verify a Merkle proof
 * 
 * @param proof - The Merkle proof to verify
 * @returns True if the proof is valid
 */
export function verifyProof(proof: MerkleProof): boolean {
    let current = normalizeHash(proof.leaf);

    for (const sibling of proof.proof) {
        current = hashPair(current, sibling);
    }

    return current.toLowerCase() === normalizeHash(proof.root).toLowerCase();
}

/**
 * Compute Merkle root from a list of hashes
 * Convenience function when you just need the root
 */
export function computeRoot(hashes: string[]): string {
    const batch = buildMerkleBatch(hashes);
    return batch.root;
}
