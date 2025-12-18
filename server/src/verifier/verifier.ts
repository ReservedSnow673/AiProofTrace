/**
 * Verification Engine
 * 
 * Handles end-to-end verification of inference records:
 * 1. Recompute inference hash
 * 2. Find batch and generate Merkle proof
 * 3. Verify proof against stored root
 * 4. Check on-chain anchor status
 */

import { ethers, Contract } from 'ethers';
import {
    InferenceRecord,
    VerificationResult,
    ExplainResponse,
    ChainConfig
} from '../types';
import { hashInference, verifyInferenceHash } from '../hashing';
import { generateProof, verifyProof } from '../merkle';
import { getStorage } from '../storage';

// Minimal ABI for reading anchor status
const REGISTRY_ABI = [
    'function anchoredAt(bytes32 root) view returns (uint256)',
    'function isAnchored(bytes32 root) view returns (bool)',
];

interface VerifyOptions {
    chainConfig?: ChainConfig;
    rpcUrl?: string;
    contractAddress?: string;
}

/**
 * Verify an inference record or hash
 */
export async function verifyInference(
    input: { record?: InferenceRecord; hash?: string },
    options?: VerifyOptions
): Promise<VerificationResult> {
    const storage = getStorage();

    // Step 1: Get or compute inference hash
    let inferenceHash: string;

    if (input.record) {
        inferenceHash = hashInference(input.record);

        // Verify stored hash matches if we have one
        if (input.hash && !verifyInferenceHash(input.record, input.hash)) {
            return {
                verified: false,
                inference_hash: inferenceHash,
                error: 'Provided hash does not match computed hash from record',
            };
        }
    } else if (input.hash) {
        inferenceHash = input.hash;
    } else {
        return {
            verified: false,
            inference_hash: '',
            error: 'Must provide either record or hash',
        };
    }

    // Step 2: Find batch containing this inference
    const batch = storage.findBatchContainingHash(inferenceHash);

    if (!batch) {
        return {
            verified: false,
            inference_hash: inferenceHash,
            error: 'Inference not found in any batch',
        };
    }

    // Step 3: Generate and verify Merkle proof
    const proof = generateProof(batch, inferenceHash);

    if (!proof) {
        return {
            verified: false,
            inference_hash: inferenceHash,
            merkle_root: batch.root,
            error: 'Failed to generate Merkle proof',
        };
    }

    if (!verifyProof(proof)) {
        return {
            verified: false,
            inference_hash: inferenceHash,
            merkle_root: batch.root,
            proof: proof,
            error: 'Merkle proof verification failed',
        };
    }

    // Step 4: Check anchor status
    const anchor = storage.getAnchorByRoot(batch.root);

    if (!anchor) {
        return {
            verified: false,
            inference_hash: inferenceHash,
            merkle_root: batch.root,
            proof: proof,
            error: 'Batch not anchored on-chain',
        };
    }

    // Step 5: Optionally verify on-chain
    if (options?.rpcUrl && options?.contractAddress) {
        try {
            const onChainResult = await verifyOnChain(
                batch.root,
                options.rpcUrl,
                options.contractAddress
            );

            if (!onChainResult.verified) {
                return {
                    verified: false,
                    inference_hash: inferenceHash,
                    merkle_root: batch.root,
                    proof: proof,
                    tx_hash: anchor.tx_hash,
                    error: 'On-chain verification failed: ' + onChainResult.error,
                };
            }
        } catch (error) {
            return {
                verified: false,
                inference_hash: inferenceHash,
                merkle_root: batch.root,
                proof: proof,
                tx_hash: anchor.tx_hash,
                error: `On-chain check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    return {
        verified: true,
        inference_hash: inferenceHash,
        merkle_root: batch.root,
        anchored_at: anchor.anchored_at,
        block_number: anchor.block_number,
        chain_id: anchor.chain_id,
        chain_name: anchor.chain_name,
        tx_hash: anchor.tx_hash,
        proof: proof,
    };
}

/**
 * Verify anchor status on-chain
 */
async function verifyOnChain(
    merkleRoot: string,
    rpcUrl: string,
    contractAddress: string
): Promise<{ verified: boolean; anchoredAt?: number; error?: string }> {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new Contract(contractAddress, REGISTRY_ABI, provider);

    // Use getFunction for proper ethers v6 typing
    const anchoredAtFn = contract.getFunction('anchoredAt');
    const anchoredAt = await anchoredAtFn(merkleRoot) as bigint;

    if (anchoredAt === 0n) {
        return { verified: false, error: 'Root not found on-chain' };
    }

    return {
        verified: true,
        anchoredAt: Number(anchoredAt),
    };
}

/**
 * Generate explanation of what verification proves
 */
export function explainVerification(result: VerificationResult): ExplainResponse {
    const whatIsProven: string[] = [];
    const whatIsNotProven: string[] = [];
    const trustAssumptions: string[] = [];

    if (result.verified) {
        whatIsProven.push(
            'The inference metadata existed at the time of anchoring',
            'The inference has not been modified since it was batched',
            `The batch was anchored before block ${result.block_number}`,
            'The Merkle proof is mathematically valid'
        );

        if (result.chain_name) {
            whatIsProven.push(`The root is stored on ${result.chain_name}`);
        }
    } else {
        whatIsProven.push('Unable to verify inference');
    }

    // What is NOT proven - always important to communicate
    whatIsNotProven.push(
        'The correctness or accuracy of the AI output',
        'The truthfulness of any claims in the output',
        'That the AI model actually produced this output',
        'That the prompt was not manipulated before hashing',
        'The identity of the party who recorded the inference',
        'That all inferences were recorded (completeness)',
        'That the model parameters were actually used'
    );

    // Trust assumptions
    trustAssumptions.push(
        'The recording party hashed the data correctly',
        'The local storage has not been tampered with',
        'The blockchain has not experienced a reorg past the anchor block',
        'The smart contract code is correct and uncompromised',
        'The RPC endpoint returns accurate blockchain state'
    );

    return {
        what_is_proven: whatIsProven,
        what_is_not_proven: whatIsNotProven,
        trust_assumptions: trustAssumptions,
        verification_details: result.verified ? {
            inference_hash: result.inference_hash,
            merkle_root: result.merkle_root,
            block_number: result.block_number,
            chain_name: result.chain_name,
        } : undefined,
    };
}

/**
 * Format verification result as human-readable report
 */
export function formatVerificationReport(result: VerificationResult): string {
    const lines: string[] = [];

    if (result.verified) {
        lines.push('[VERIFIED] Inference verified successfully');
        lines.push('');
        lines.push('[VERIFIED] Existed before block ' + result.block_number);
        lines.push('[VERIFIED] Not modified since anchoring');
        lines.push('[VERIFIED] Merkle proof valid');

        if (result.chain_name) {
            lines.push(`[VERIFIED] Anchored on ${result.chain_name}`);
        }
    } else {
        lines.push('[FAILED] Verification failed');
        lines.push('');
        lines.push('Reason: ' + (result.error ?? 'Unknown error'));
    }

    lines.push('');
    lines.push('[NOT PROVEN] Does NOT prove correctness or truthfulness');
    lines.push('[NOT PROVEN] Does NOT prove the AI actually produced this');
    lines.push('[NOT PROVEN] Does NOT prove completeness of records');

    return lines.join('\n');
}
