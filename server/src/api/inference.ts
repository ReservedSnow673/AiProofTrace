/**
 * Inference Recording API
 * 
 * POST /api/inference
 * Records inference metadata, canonicalizes, hashes, and stores.
 */

import { Router, Request, Response } from 'express';
import { RecordInferenceRequest, RecordInferenceResponse, InferenceRecord } from '../types';
import { hashInference } from '../hashing';
import { getStorage } from '../storage';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body as RecordInferenceRequest;

        // Validate required fields
        if (!body.model || typeof body.model !== 'string') {
            res.status(400).json({
                error: 'Missing or invalid model field',
                code: 'INVALID_MODEL',
            });
            return;
        }

        if (!body.prompt_hash || typeof body.prompt_hash !== 'string') {
            res.status(400).json({
                error: 'Missing or invalid prompt_hash field',
                code: 'INVALID_PROMPT_HASH',
            });
            return;
        }

        if (!body.output_hash || typeof body.output_hash !== 'string') {
            res.status(400).json({
                error: 'Missing or invalid output_hash field',
                code: 'INVALID_OUTPUT_HASH',
            });
            return;
        }

        // Build inference record with timestamp for uniqueness
        const record: InferenceRecord = {
            model: body.model,
            prompt_hash: body.prompt_hash,
            output_hash: body.output_hash,
            parameters: body.parameters,
            context: body.context,
            timestamp: Date.now(),
        };

        // Compute hash
        const inferenceHash = hashInference(record);

        // Store
        const storage = getStorage();
        await storage.storeInference({
            record,
            inference_hash: inferenceHash,
            stored_at: Date.now(),
        });

        const response: RecordInferenceResponse = {
            inference_hash: inferenceHash,
            stored_at: Date.now(),
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error recording inference:', error);
        res.status(500).json({
            error: 'Failed to record inference',
            code: 'INTERNAL_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// GET endpoint to retrieve inference by hash
router.get('/:hash', (req: Request, res: Response) => {
    try {
        const { hash } = req.params;

        if (!hash) {
            res.status(400).json({
                error: 'Missing hash parameter',
                code: 'MISSING_HASH',
            });
            return;
        }

        const storage = getStorage();
        const inference = storage.getInference(hash);

        if (!inference) {
            res.status(404).json({
                error: 'Inference not found',
                code: 'NOT_FOUND',
            });
            return;
        }

        res.json(inference);
    } catch (error) {
        console.error('Error retrieving inference:', error);
        res.status(500).json({
            error: 'Failed to retrieve inference',
            code: 'INTERNAL_ERROR',
        });
    }
});

// GET all inferences
router.get('/', (_req: Request, res: Response) => {
    try {
        const storage = getStorage();
        const inferences = storage.getAllInferences();

        res.json({
            count: inferences.length,
            inferences: inferences.map(inf => ({
                inference_hash: inf.inference_hash,
                model: inf.record.model,
                stored_at: inf.stored_at,
            })),
        });
    } catch (error) {
        console.error('Error listing inferences:', error);
        res.status(500).json({
            error: 'Failed to list inferences',
            code: 'INTERNAL_ERROR',
        });
    }
});

export default router;
