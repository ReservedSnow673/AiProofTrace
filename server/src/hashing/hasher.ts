/**
 * Inference Hasher
 * 
 * Computes keccak256 hash of canonicalized inference records.
 * Deterministic: same input always produces same hash.
 */

import { keccak256, toUtf8Bytes } from 'ethers';
import { canonicalize } from './canonicalizer';
import { InferenceRecord } from '../types';

/**
 * Prepare an inference record for hashing by ensuring consistent structure
 */
function prepareForHashing(record: InferenceRecord): InferenceRecord {
    const prepared: InferenceRecord = {
        model: record.model,
        prompt_hash: normalizeHash(record.prompt_hash),
        output_hash: normalizeHash(record.output_hash),
    };

    if (record.parameters && Object.keys(record.parameters).length > 0) {
        prepared.parameters = record.parameters;
    }

    if (record.context && Object.keys(record.context).length > 0) {
        prepared.context = record.context;
    }

    if (record.timestamp !== undefined) {
        prepared.timestamp = record.timestamp;
    }

    if (record.nonce !== undefined) {
        prepared.nonce = record.nonce;
    }

    return prepared;
}

/**
 * Normalize a hash string to lowercase with 0x prefix
 */
function normalizeHash(hash: string): string {
    const cleaned = hash.toLowerCase().replace(/^0x/, '');
    return `0x${cleaned}`;
}

/**
 * Hash an inference record using keccak256
 * 
 * Process:
 * 1. Prepare record (normalize hashes, remove empty fields)
 * 2. Canonicalize to deterministic JSON
 * 3. Hash with keccak256
 * 
 * @param record - The inference record to hash
 * @returns The keccak256 hash as a hex string with 0x prefix
 */
export function hashInference(record: InferenceRecord): string {
    const prepared = prepareForHashing(record);
    const canonical = canonicalize(prepared);
    const bytes = toUtf8Bytes(canonical);
    return keccak256(bytes);
}

/**
 * Verify that a hash matches a record
 * 
 * @param record - The inference record
 * @param expectedHash - The expected hash
 * @returns True if the computed hash matches the expected hash
 */
export function verifyInferenceHash(record: InferenceRecord, expectedHash: string): boolean {
    const computed = hashInference(record);
    return computed.toLowerCase() === normalizeHash(expectedHash).toLowerCase();
}

/**
 * Hash arbitrary data using keccak256
 * Useful for hashing prompts or outputs before sending to the API
 */
export function hashData(data: string): string {
    const bytes = toUtf8Bytes(data);
    return keccak256(bytes);
}

/**
 * Combine two hashes using keccak256
 * Used internally by Merkle tree construction
 */
export function combineHashes(left: string, right: string): string {
    const sortedPair = [left.toLowerCase(), right.toLowerCase()].sort();
    const first = sortedPair[0] ?? '';
    const second = sortedPair[1] ?? '';
    const combined = first + second.replace('0x', '');
    return keccak256(combined as `0x${string}`);
}
