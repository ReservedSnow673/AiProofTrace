/**
 * Batch Building API
 * 
 * POST /api/batch
 * Creates a Merkle batch from inference hashes.
 */

import { Router, Request, Response } from 'express';
import { CreateBatchRequest, CreateBatchResponse } from '../types';
import { buildMerkleBatch } from '../merkle';
import { getStorage } from '../storage';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body as CreateBatchRequest;
        const storage = getStorage();

        let hashes: string[];

        if (body.inference_hashes && body.inference_hashes.length > 0) {
            // Use provided hashes
            hashes = body.inference_hashes;
        } else {
            // Get unbatched inferences
            const unbatched = storage.getUnbatchedInferences();

            if (unbatched.length === 0) {
                res.status(400).json({
                    error: 'No unbatched inferences available',
                    code: 'NO_INFERENCES',
                });
                return;
            }

            // Optionally limit batch size
            const batchSize = body.batch_size ?? unbatched.length;
            hashes = unbatched.slice(0, batchSize).map(inf => inf.inference_hash);
        }

        if (hashes.length === 0) {
            res.status(400).json({
                error: 'No hashes provided for batching',
                code: 'EMPTY_BATCH',
            });
            return;
        }

        // Build Merkle tree
        const batch = buildMerkleBatch(hashes);

        // Store batch
        await storage.storeBatch(batch);

        const response: CreateBatchResponse = {
            batch_id: batch.batch_id,
            merkle_root: batch.root,
            leaf_count: batch.leaf_count,
            created_at: batch.created_at,
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({
            error: 'Failed to create batch',
            code: 'INTERNAL_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// GET batch by ID
router.get('/:batchId', (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;

        if (!batchId) {
            res.status(400).json({
                error: 'Missing batch ID',
                code: 'MISSING_BATCH_ID',
            });
            return;
        }

        const storage = getStorage();
        const batch = storage.getBatch(batchId);

        if (!batch) {
            res.status(404).json({
                error: 'Batch not found',
                code: 'NOT_FOUND',
            });
            return;
        }

        res.json({
            batch_id: batch.batch_id,
            merkle_root: batch.root,
            leaf_count: batch.leaf_count,
            created_at: batch.created_at,
            leaves: batch.leaves,
        });
    } catch (error) {
        console.error('Error retrieving batch:', error);
        res.status(500).json({
            error: 'Failed to retrieve batch',
            code: 'INTERNAL_ERROR',
        });
    }
});

// GET all batches
router.get('/', (_req: Request, res: Response) => {
    try {
        const storage = getStorage();
        const batches = storage.getAllBatches();

        res.json({
            count: batches.length,
            batches: batches.map(batch => ({
                batch_id: batch.batch_id,
                merkle_root: batch.root,
                leaf_count: batch.leaf_count,
                created_at: batch.created_at,
            })),
        });
    } catch (error) {
        console.error('Error listing batches:', error);
        res.status(500).json({
            error: 'Failed to list batches',
            code: 'INTERNAL_ERROR',
        });
    }
});

export default router;
