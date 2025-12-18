/**
 * Hashing Engine Unit Tests
 * 
 * Tests for deterministic canonicalization and keccak256 hashing.
 */

import {
    canonicalize,
    parseAndCanonicalize,
    isCanonical
} from './canonicalizer';
import {
    hashInference,
    verifyInferenceHash,
    hashData,
    combineHashes
} from './hasher';
import { InferenceRecord } from '../types';

describe('Canonicalizer', () => {
    describe('canonicalize', () => {
        it('should sort object keys alphabetically', () => {
            const input = { z: 1, a: 2, m: 3 };
            const result = canonicalize(input);
            expect(result).toBe('{"a":2,"m":3,"z":1}');
        });

        it('should handle nested objects', () => {
            const input = { b: { d: 1, c: 2 }, a: 3 };
            const result = canonicalize(input);
            expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}');
        });

        it('should exclude undefined values', () => {
            const input = { a: 1, b: undefined, c: 3 };
            const result = canonicalize(input);
            expect(result).toBe('{"a":1,"c":3}');
        });

        it('should handle arrays', () => {
            const input = { items: [3, 1, 2] };
            const result = canonicalize(input);
            expect(result).toBe('{"items":[3,1,2]}');
        });

        it('should handle null values', () => {
            const input = { a: null, b: 1 };
            const result = canonicalize(input);
            expect(result).toBe('{"a":null,"b":1}');
        });

        it('should produce no whitespace', () => {
            const input = { a: 1, b: { c: 2 } };
            const result = canonicalize(input);
            expect(result).not.toContain(' ');
            expect(result).not.toContain('\n');
        });

        it('should throw on null input', () => {
            expect(() => canonicalize(null)).toThrow();
        });

        it('should throw on undefined input', () => {
            expect(() => canonicalize(undefined)).toThrow();
        });
    });

    describe('isCanonical', () => {
        it('should return true for canonical JSON', () => {
            expect(isCanonical('{"a":1,"b":2}')).toBe(true);
        });

        it('should return false for non-sorted keys', () => {
            expect(isCanonical('{"b":2,"a":1}')).toBe(false);
        });

        it('should return false for JSON with whitespace', () => {
            expect(isCanonical('{"a": 1, "b": 2}')).toBe(false);
        });
    });

    describe('parseAndCanonicalize', () => {
        it('should re-canonicalize a JSON string', () => {
            const input = '{"b": 2, "a": 1}';
            const result = parseAndCanonicalize(input);
            expect(result).toBe('{"a":1,"b":2}');
        });
    });
});

describe('Hasher', () => {
    const sampleRecord: InferenceRecord = {
        model: 'gpt-4.1',
        prompt_hash: '0xabc123',
        output_hash: '0xdef456',
        parameters: {
            temperature: 0.2,
            max_tokens: 512,
        },
        context: {
            feature: 'test',
        },
    };

    describe('hashInference', () => {
        it('should produce consistent hash for same input', () => {
            const hash1 = hashInference(sampleRecord);
            const hash2 = hashInference(sampleRecord);
            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different input', () => {
            const modified = { ...sampleRecord, model: 'gpt-3.5' };
            const hash1 = hashInference(sampleRecord);
            const hash2 = hashInference(modified);
            expect(hash1).not.toBe(hash2);
        });

        it('should normalize hash case', () => {
            const record1: InferenceRecord = {
                ...sampleRecord,
                prompt_hash: '0xABC123',
            };
            const record2: InferenceRecord = {
                ...sampleRecord,
                prompt_hash: '0xabc123',
            };
            expect(hashInference(record1)).toBe(hashInference(record2));
        });

        it('should handle records without optional fields', () => {
            const minimal: InferenceRecord = {
                model: 'test-model',
                prompt_hash: '0x123',
                output_hash: '0x456',
            };
            const hash = hashInference(minimal);
            expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
        });

        it('should produce 32-byte hash', () => {
            const hash = hashInference(sampleRecord);
            expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
        });
    });

    describe('verifyInferenceHash', () => {
        it('should return true for matching hash', () => {
            const hash = hashInference(sampleRecord);
            expect(verifyInferenceHash(sampleRecord, hash)).toBe(true);
        });

        it('should return false for non-matching hash', () => {
            expect(verifyInferenceHash(sampleRecord, '0x000')).toBe(false);
        });

        it('should handle hash with/without 0x prefix', () => {
            const hash = hashInference(sampleRecord);
            const hashWithout0x = hash.slice(2);
            expect(verifyInferenceHash(sampleRecord, hashWithout0x)).toBe(true);
        });
    });

    describe('hashData', () => {
        it('should hash arbitrary string', () => {
            const hash = hashData('test data');
            expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
        });

        it('should produce consistent hash', () => {
            const hash1 = hashData('same data');
            const hash2 = hashData('same data');
            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different input', () => {
            const hash1 = hashData('data1');
            const hash2 = hashData('data2');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('combineHashes', () => {
        it('should combine two hashes', () => {
            const combined = combineHashes('0x111', '0x222');
            expect(combined).toMatch(/^0x[a-f0-9]{64}$/);
        });

        it('should be order-independent (sorted)', () => {
            const combined1 = combineHashes('0xaaa', '0xbbb');
            const combined2 = combineHashes('0xbbb', '0xaaa');
            expect(combined1).toBe(combined2);
        });
    });
});

describe('Determinism', () => {
    it('should produce same hash across multiple calls', () => {
        const record: InferenceRecord = {
            model: 'test-model',
            prompt_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            output_hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            parameters: { temperature: 0.7 },
            context: { feature: 'determinism_test' },
        };

        const hashes: string[] = [];
        for (let i = 0; i < 100; i++) {
            hashes.push(hashInference(record));
        }

        // All hashes should be identical
        const allSame = hashes.every(h => h === hashes[0]);
        expect(allSame).toBe(true);
    });
});
