/**
 * Anchoring Service API
 * 
 * POST /api/anchor
 * Submits Merkle root to the on-chain registry.
 */

import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { AnchorRequest, AnchorResponse, ChainsConfig } from '../types';
import { buildMerkleBatch } from '../merkle';
import { getStorage } from '../storage';

const router = Router();

// Registry ABI - only the functions we need
const REGISTRY_ABI = [
    'function anchorRoot(bytes32 root) external',
    'event RootAnchored(bytes32 indexed root, uint256 timestamp)',
];

/**
 * Load chain configuration
 */
function loadChainConfig(): ChainsConfig {
    const configPath = path.join(process.cwd(), 'config', 'chains.json');

    if (!fs.existsSync(configPath)) {
        // Try parent directory for when running from server folder
        const parentConfigPath = path.join(process.cwd(), '..', 'config', 'chains.json');
        if (fs.existsSync(parentConfigPath)) {
            return JSON.parse(fs.readFileSync(parentConfigPath, 'utf-8')) as ChainsConfig;
        }
        throw new Error('Chain configuration not found');
    }

    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ChainsConfig;
}

router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body as AnchorRequest;
        const storage = getStorage();

        // Load chain config
        const chainsConfig = loadChainConfig();
        const chainName = body.chain ?? chainsConfig.defaultChain;
        const chainConfig = chainsConfig.chains[chainName];

        if (!chainConfig) {
            res.status(400).json({
                error: `Unknown chain: ${chainName}`,
                code: 'INVALID_CHAIN',
                available_chains: Object.keys(chainsConfig.chains),
            });
            return;
        }

        // Get RPC URL from environment
        const rpcUrl = process.env[chainConfig.rpcEnvVar];
        if (!rpcUrl) {
            res.status(500).json({
                error: `RPC URL not configured for ${chainName}. Set ${chainConfig.rpcEnvVar} environment variable.`,
                code: 'RPC_NOT_CONFIGURED',
            });
            return;
        }

        // Get private key
        const privateKey = process.env['PRIVATE_KEY'];
        if (!privateKey) {
            res.status(500).json({
                error: 'PRIVATE_KEY not configured',
                code: 'KEY_NOT_CONFIGURED',
            });
            return;
        }

        // Get contract address
        if (!chainConfig.contractAddress) {
            res.status(500).json({
                error: `Contract not deployed on ${chainName}. Update config/chains.json with contract address.`,
                code: 'CONTRACT_NOT_DEPLOYED',
            });
            return;
        }

        // Determine what to anchor
        let merkleRoot: string;
        let batchId: string;

        if (body.batch_id) {
            // Use existing batch
            const batch = storage.getBatch(body.batch_id);
            if (!batch) {
                res.status(404).json({
                    error: 'Batch not found',
                    code: 'BATCH_NOT_FOUND',
                });
                return;
            }
            merkleRoot = batch.root;
            batchId = batch.batch_id;
        } else if (body.hashes && body.hashes.length > 0) {
            // Create batch from provided hashes
            const batch = buildMerkleBatch(body.hashes);
            await storage.storeBatch(batch);
            merkleRoot = batch.root;
            batchId = batch.batch_id;
        } else {
            // Use oldest unanchored batch
            const unanchored = storage.getUnanchoredBatches();
            if (unanchored.length === 0) {
                res.status(400).json({
                    error: 'No unanchored batches available',
                    code: 'NO_BATCHES',
                });
                return;
            }
            const batch = unanchored[0];
            if (!batch) {
                res.status(400).json({
                    error: 'No unanchored batches available',
                    code: 'NO_BATCHES',
                });
                return;
            }
            merkleRoot = batch.root;
            batchId = batch.batch_id;
        }

        // Connect to blockchain
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        const contract = new ethers.Contract(chainConfig.contractAddress, REGISTRY_ABI, wallet);

        // Submit transaction using getFunction for proper typing
        const anchorRootFn = contract.getFunction('anchorRoot');
        const tx = await anchorRootFn(merkleRoot);
        const receipt = await tx.wait();

        if (!receipt) {
            res.status(500).json({
                error: 'Transaction failed - no receipt',
                code: 'TX_FAILED',
            });
            return;
        }

        // Store anchor record
        await storage.storeAnchor({
            batch_id: batchId,
            merkle_root: merkleRoot,
            tx_hash: receipt.hash,
            block_number: receipt.blockNumber,
            chain_id: chainConfig.chainId,
            chain_name: chainConfig.name,
            anchored_at: Date.now(),
        });

        const response: AnchorResponse = {
            merkle_root: merkleRoot,
            tx_hash: receipt.hash,
            block_number: receipt.blockNumber,
            chain_id: chainConfig.chainId,
            chain_name: chainConfig.name,
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error anchoring:', error);

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('RootAlreadyAnchored')) {
                res.status(409).json({
                    error: 'Root already anchored',
                    code: 'ALREADY_ANCHORED',
                });
                return;
            }
        }

        res.status(500).json({
            error: 'Failed to anchor batch',
            code: 'INTERNAL_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// GET all anchors
router.get('/', (_req: Request, res: Response) => {
    try {
        const storage = getStorage();
        const anchors = storage.getAllAnchors();

        res.json({
            count: anchors.length,
            anchors: anchors.map(anchor => ({
                batch_id: anchor.batch_id,
                merkle_root: anchor.merkle_root,
                tx_hash: anchor.tx_hash,
                block_number: anchor.block_number,
                chain_name: anchor.chain_name,
                anchored_at: anchor.anchored_at,
            })),
        });
    } catch (error) {
        console.error('Error listing anchors:', error);
        res.status(500).json({
            error: 'Failed to list anchors',
            code: 'INTERNAL_ERROR',
        });
    }
});

export default router;
