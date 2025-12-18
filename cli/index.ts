#!/usr/bin/env node
/**
 * AiProofTrace CLI
 * 
 * Command-line interface for recording, batching, anchoring, and verifying
 * AI inference metadata.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { keccak256, toUtf8Bytes, ethers } from 'ethers';

dotenv.config();

const program = new Command();

// Configuration
const DEFAULT_SERVER_URL = 'http://localhost:3000';
const SERVER_URL = process.env['PROOFTRACE_SERVER_URL'] ?? DEFAULT_SERVER_URL;

interface InferenceRecord {
    model: string;
    prompt_hash: string;
    output_hash: string;
    parameters?: Record<string, unknown>;
    context?: Record<string, unknown>;
    timestamp?: number;
}

interface ApiResponse {
    inference_hash?: string;
    batch_id?: string;
    merkle_root?: string;
    tx_hash?: string;
    block_number?: number;
    verified?: boolean;
    error?: string;
}

// Utility: Canonicalize JSON
function canonicalize(obj: Record<string, unknown>): string {
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};

    for (const key of sortedKeys) {
        const value = obj[key];
        if (value !== undefined) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                result[key] = JSON.parse(canonicalize(value as Record<string, unknown>));
            } else {
                result[key] = value;
            }
        }
    }

    return JSON.stringify(result);
}

// Utility: Hash inference record locally
function hashInference(record: InferenceRecord): string {
    const normalized: InferenceRecord = {
        model: record.model,
        prompt_hash: record.prompt_hash.toLowerCase(),
        output_hash: record.output_hash.toLowerCase(),
    };

    if (record.parameters && Object.keys(record.parameters).length > 0) {
        normalized.parameters = record.parameters;
    }
    if (record.context && Object.keys(record.context).length > 0) {
        normalized.context = record.context;
    }
    if (record.timestamp !== undefined) {
        normalized.timestamp = record.timestamp;
    }

    const canonical = canonicalize(normalized as unknown as Record<string, unknown>);
    return keccak256(toUtf8Bytes(canonical));
}

// Utility: Hash arbitrary data
function hashData(data: string): string {
    return keccak256(toUtf8Bytes(data));
}

// Utility: Make API request
async function apiRequest(
    method: string,
    endpoint: string,
    body?: unknown
): Promise<ApiResponse> {
    const url = `${SERVER_URL}${endpoint}`;

    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    return response.json() as Promise<ApiResponse>;
}

program
    .name('prooftrace')
    .description('CLI for verifiable AI inference logging')
    .version('1.0.0');

// Record command
program
    .command('record')
    .description('Record an inference to the server')
    .requiredOption('-m, --model <model>', 'Model identifier (e.g., gpt-4.1)')
    .requiredOption('-p, --prompt-hash <hash>', 'Hash of the prompt (or use --prompt to hash)')
    .requiredOption('-o, --output-hash <hash>', 'Hash of the output (or use --output to hash)')
    .option('-P, --prompt <text>', 'Prompt text (will be hashed)')
    .option('-O, --output <text>', 'Output text (will be hashed)')
    .option('--temperature <temp>', 'Temperature parameter')
    .option('--max-tokens <tokens>', 'Max tokens parameter')
    .option('--feature <feature>', 'Feature context')
    .option('--user-id <userId>', 'User ID context')
    .option('--local', 'Only compute hash locally, do not send to server')
    .action(async (options) => {
        try {
            // Compute hashes if text provided
            const promptHash = options.prompt
                ? hashData(options.prompt)
                : options.promptHash;
            const outputHash = options.output
                ? hashData(options.output)
                : options.outputHash;

            const record: InferenceRecord = {
                model: options.model,
                prompt_hash: promptHash,
                output_hash: outputHash,
            };

            if (options.temperature || options.maxTokens) {
                record.parameters = {};
                if (options.temperature) {
                    record.parameters['temperature'] = parseFloat(options.temperature);
                }
                if (options.maxTokens) {
                    record.parameters['max_tokens'] = parseInt(options.maxTokens, 10);
                }
            }

            if (options.feature || options.userId) {
                record.context = {};
                if (options.feature) record.context['feature'] = options.feature;
                if (options.userId) record.context['user_id'] = options.userId;
            }

            if (options.local) {
                // Local hash only
                const hash = hashInference(record);
                console.log('Inference Hash (local):', hash);
                return;
            }

            const result = await apiRequest('POST', '/api/inference', record);

            if (result.error) {
                console.error('Error:', result.error);
                process.exit(1);
            }

            console.log('Inference recorded successfully');
            console.log('Hash:', result.inference_hash);
        } catch (error) {
            console.error('Failed to record inference:', error);
            process.exit(1);
        }
    });

// Batch command
program
    .command('batch')
    .description('Create a Merkle batch from unbatched inferences')
    .option('-s, --size <size>', 'Maximum batch size')
    .option('-h, --hashes <hashes...>', 'Specific hashes to batch')
    .action(async (options) => {
        try {
            const body: Record<string, unknown> = {};

            if (options.size) {
                body['batch_size'] = parseInt(options.size, 10);
            }
            if (options.hashes) {
                body['inference_hashes'] = options.hashes;
            }

            const result = await apiRequest('POST', '/api/batch', body);

            if (result.error) {
                console.error('Error:', result.error);
                process.exit(1);
            }

            console.log('Batch created successfully');
            console.log('Batch ID:', result.batch_id);
            console.log('Merkle Root:', result.merkle_root);
        } catch (error) {
            console.error('Failed to create batch:', error);
            process.exit(1);
        }
    });

// Anchor command
program
    .command('anchor')
    .description('Anchor a batch on-chain')
    .option('-b, --batch-id <batchId>', 'Batch ID to anchor')
    .option('-c, --chain <chain>', 'Chain to anchor on (default: from config)')
    .action(async (options) => {
        try {
            const body: Record<string, unknown> = {};

            if (options.batchId) {
                body['batch_id'] = options.batchId;
            }
            if (options.chain) {
                body['chain'] = options.chain;
            }

            const result = await apiRequest('POST', '/api/anchor', body);

            if (result.error) {
                console.error('Error:', result.error);
                process.exit(1);
            }

            console.log('Batch anchored successfully');
            console.log('Merkle Root:', result.merkle_root);
            console.log('Transaction:', result.tx_hash);
            console.log('Block Number:', result.block_number);
        } catch (error) {
            console.error('Failed to anchor batch:', error);
            process.exit(1);
        }
    });

// Verify command
program
    .command('verify')
    .description('Verify an inference was anchored')
    .option('-h, --hash <hash>', 'Inference hash to verify')
    .option('-f, --file <file>', 'JSON file containing inference record')
    .action(async (options) => {
        try {
            const body: Record<string, unknown> = {};

            if (options.hash) {
                body['inference_hash'] = options.hash;
            } else if (options.file) {
                const content = fs.readFileSync(options.file, 'utf-8');
                body['inference_record'] = JSON.parse(content);
            } else {
                console.error('Must provide --hash or --file');
                process.exit(1);
            }

            const result = await apiRequest('POST', '/api/verify', body);

            if (result.error) {
                console.error('Verification failed:', result.error);
                process.exit(1);
            }

            if (result.verified) {
                console.log('[VERIFIED] Inference verified successfully');
                console.log('');
                console.log('[VERIFIED] Existed before block', result.block_number);
                console.log('[VERIFIED] Not modified since anchoring');
                console.log('[VERIFIED] Merkle proof valid');
                console.log('');
                console.log('[NOT PROVEN] Does NOT prove correctness or truthfulness');
                console.log('[NOT PROVEN] Does NOT prove the AI actually produced this');
            } else {
                console.log('[FAILED] Verification failed');
                console.log('Reason:', result.error);
            }
        } catch (error) {
            console.error('Failed to verify:', error);
            process.exit(1);
        }
    });

// Explain command
program
    .command('explain')
    .description('Explain what verification proves and what it does not')
    .option('-h, --hash <hash>', 'Inference hash for specific explanation')
    .action(async (options) => {
        try {
            let url = '/api/verify/explain';
            if (options.hash) {
                url += `?hash=${options.hash}`;
            }

            const result = await apiRequest('GET', url) as {
                what_is_proven: string[];
                what_is_not_proven: string[];
                trust_assumptions: string[];
            };

            console.log('=== What Verification PROVES ===');
            console.log('');
            for (const item of result.what_is_proven) {
                console.log('[PROVEN]', item);
            }

            console.log('');
            console.log('=== What Verification Does NOT Prove ===');
            console.log('');
            for (const item of result.what_is_not_proven) {
                console.log('[NOT PROVEN]', item);
            }

            console.log('');
            console.log('=== Trust Assumptions ===');
            console.log('');
            for (const item of result.trust_assumptions) {
                console.log('[ASSUMES]', item);
            }
        } catch (error) {
            // If server is not available, show static explanation
            console.log('=== What Verification PROVES ===');
            console.log('');
            console.log('[PROVEN] The inference metadata existed at the time of anchoring');
            console.log('[PROVEN] The inference has not been modified since it was batched');
            console.log('[PROVEN] The Merkle proof is mathematically valid');
            console.log('[PROVEN] The root was stored on-chain before a specific block');

            console.log('');
            console.log('=== What Verification Does NOT Prove ===');
            console.log('');
            console.log('[NOT PROVEN] The correctness or accuracy of the AI output');
            console.log('[NOT PROVEN] The truthfulness of any claims in the output');
            console.log('[NOT PROVEN] That the AI model actually produced this output');
            console.log('[NOT PROVEN] That the prompt was not manipulated before hashing');
            console.log('[NOT PROVEN] The identity of the party who recorded the inference');
            console.log('[NOT PROVEN] That all inferences were recorded (completeness)');
            console.log('[NOT PROVEN] That the model parameters were actually used');

            console.log('');
            console.log('=== Trust Assumptions ===');
            console.log('');
            console.log('[ASSUMES] The recording party hashed the data correctly');
            console.log('[ASSUMES] The local storage has not been tampered with');
            console.log('[ASSUMES] The blockchain has not experienced a reorg past the anchor block');
            console.log('[ASSUMES] The smart contract code is correct and uncompromised');
            console.log('[ASSUMES] The RPC endpoint returns accurate blockchain state');
        }
    });

// Hash utility command
program
    .command('hash')
    .description('Compute hashes for data')
    .option('-t, --text <text>', 'Text to hash')
    .option('-f, --file <file>', 'File to hash')
    .action((options) => {
        try {
            let data: string;

            if (options.text) {
                data = options.text;
            } else if (options.file) {
                data = fs.readFileSync(options.file, 'utf-8');
            } else {
                console.error('Must provide --text or --file');
                process.exit(1);
            }

            const hash = hashData(data);
            console.log('Hash:', hash);
        } catch (error) {
            console.error('Failed to compute hash:', error);
            process.exit(1);
        }
    });

// Stats command
program
    .command('stats')
    .description('Show storage statistics')
    .action(async () => {
        try {
            const result = await apiRequest('GET', '/api/stats') as {
                inferences: number;
                batches: number;
                anchors: number;
                unbatchedInferences: number;
                unanchoredBatches: number;
            };

            console.log('=== Storage Statistics ===');
            console.log('');
            console.log('Total Inferences:', result.inferences);
            console.log('Total Batches:', result.batches);
            console.log('Total Anchors:', result.anchors);
            console.log('Unbatched Inferences:', result.unbatchedInferences);
            console.log('Unanchored Batches:', result.unanchoredBatches);
        } catch (error) {
            console.error('Failed to get stats (is server running?):', error);
            process.exit(1);
        }
    });

program.parse();
