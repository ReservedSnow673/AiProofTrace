/**
 * Merkle Tree Unit Tests
 * 
 * Tests for Merkle tree construction, proof generation, and verification.
 */

import {
    buildMerkleBatch,
    generateProof,
    verifyProof,
    computeRoot
} from './merkle';

describe('Merkle Tree', () => {
    const sampleHashes = [
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444444444444444444444444444',
    ];

    describe('buildMerkleBatch', () => {
        it('should build batch with single hash', () => {
            const batch = buildMerkleBatch([sampleHashes[0]!]);
            expect(batch.root).toBeDefined();
            expect(batch.leaves).toHaveLength(1);
            expect(batch.tree).toHaveLength(1);
        });

        it('should build batch with multiple hashes', () => {
            const batch = buildMerkleBatch(sampleHashes);
            expect(batch.root).toBeDefined();
            expect(batch.leaves).toHaveLength(4);
            expect(batch.leaf_count).toBe(4);
        });

        it('should generate unique batch IDs', () => {
            const batch1 = buildMerkleBatch(sampleHashes);
            const batch2 = buildMerkleBatch(sampleHashes);
            expect(batch1.batch_id).not.toBe(batch2.batch_id);
        });

        it('should throw for empty hash array', () => {
            expect(() => buildMerkleBatch([])).toThrow();
        });

        it('should produce deterministic root', () => {
            const batch1 = buildMerkleBatch(sampleHashes);
            const batch2 = buildMerkleBatch(sampleHashes);
            expect(batch1.root).toBe(batch2.root);
        });

        it('should sort leaves for determinism', () => {
            const shuffled = [sampleHashes[2]!, sampleHashes[0]!, sampleHashes[3]!, sampleHashes[1]!];
            const batch1 = buildMerkleBatch(sampleHashes);
            const batch2 = buildMerkleBatch(shuffled);
            expect(batch1.root).toBe(batch2.root);
        });

        it('should normalize hash case', () => {
            const upper = ['0xAAAA111111111111111111111111111111111111111111111111111111111111'];
            const lower = ['0xaaaa111111111111111111111111111111111111111111111111111111111111'];
            const batch1 = buildMerkleBatch(upper);
            const batch2 = buildMerkleBatch(lower);
            expect(batch1.root).toBe(batch2.root);
        });

        it('should handle odd number of hashes', () => {
            const oddHashes = sampleHashes.slice(0, 3);
            const batch = buildMerkleBatch(oddHashes);
            expect(batch.root).toBeDefined();
            expect(batch.leaves).toHaveLength(3);
        });

        it('should handle large batches', () => {
            const largeHashes = Array.from({ length: 100 }, (_, i) =>
                `0x${i.toString(16).padStart(64, '0')}`
            );
            const batch = buildMerkleBatch(largeHashes);
            expect(batch.root).toBeDefined();
            expect(batch.leaves).toHaveLength(100);
        });
    });

    describe('generateProof', () => {
        it('should generate proof for existing leaf', () => {
            const batch = buildMerkleBatch(sampleHashes);
            const proof = generateProof(batch, sampleHashes[0]!);
            expect(proof).not.toBeNull();
            expect(proof?.leaf).toBeDefined();
            expect(proof?.proof).toBeInstanceOf(Array);
            expect(proof?.root).toBe(batch.root);
        });

        it('should return null for non-existent leaf', () => {
            const batch = buildMerkleBatch(sampleHashes);
            const proof = generateProof(batch, '0xdead');
            expect(proof).toBeNull();
        });

        it('should generate valid proof for all leaves', () => {
            const batch = buildMerkleBatch(sampleHashes);

            for (const hash of sampleHashes) {
                const proof = generateProof(batch, hash);
                expect(proof).not.toBeNull();
                expect(verifyProof(proof!)).toBe(true);
            }
        });
    });

    describe('verifyProof', () => {
        it('should verify valid proof', () => {
            const batch = buildMerkleBatch(sampleHashes);
            const proof = generateProof(batch, sampleHashes[0]!);
            expect(proof).not.toBeNull();
            expect(verifyProof(proof!)).toBe(true);
        });

        it('should reject tampered leaf', () => {
            const batch = buildMerkleBatch(sampleHashes);
            const proof = generateProof(batch, sampleHashes[0]!);

            if (proof) {
                const tamperedProof = {
                    ...proof,
                    leaf: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00',
                };
                expect(verifyProof(tamperedProof)).toBe(false);
            }
        });

        it('should reject tampered root', () => {
            const batch = buildMerkleBatch(sampleHashes);
            const proof = generateProof(batch, sampleHashes[0]!);

            if (proof) {
                const tamperedProof = {
                    ...proof,
                    root: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00',
                };
                expect(verifyProof(tamperedProof)).toBe(false);
            }
        });
    });

    describe('computeRoot', () => {
        it('should compute root directly', () => {
            const root = computeRoot(sampleHashes);
            const batch = buildMerkleBatch(sampleHashes);
            expect(root).toBe(batch.root);
        });
    });
});

describe('Merkle Tree Properties', () => {
    it('should be collision resistant', () => {
        const hashes1 = [
            '0x1111111111111111111111111111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222222222222222222222222222',
        ];
        const hashes2 = [
            '0x1111111111111111111111111111111111111111111111111111111111111111',
            '0x3333333333333333333333333333333333333333333333333333333333333333',
        ];

        const root1 = computeRoot(hashes1);
        const root2 = computeRoot(hashes2);
        expect(root1).not.toBe(root2);
    });

    it('should produce unique root for unique leaf sets', () => {
        const roots = new Set<string>();

        for (let i = 0; i < 50; i++) {
            const hashes = [
                `0x${i.toString(16).padStart(64, '0')}`,
                `0x${(i + 100).toString(16).padStart(64, '0')}`,
            ];
            roots.add(computeRoot(hashes));
        }

        expect(roots.size).toBe(50);
    });
});
