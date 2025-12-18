/**
 * Verification API
 * 
 * POST /api/verify
 * Verifies an inference record against the on-chain anchor.
 */

import { Router, Request, Response } from 'express';
import { VerifyRequest, VerifyResponse } from '../types';
import { verifyInference, explainVerification, formatVerificationReport } from '../verifier';
import { hashInference } from '../hashing';
import { getStorage } from '../storage';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body as VerifyRequest;

        // Must have either record or hash
        if (!body.inference_record && !body.inference_hash) {
            res.status(400).json({
                error: 'Must provide either inference_record or inference_hash',
                code: 'MISSING_INPUT',
            });
            return;
        }

        // Perform verification
        const result = await verifyInference({
            record: body.inference_record,
            hash: body.inference_hash,
        });

        const response: VerifyResponse = {
            verified: result.verified,
            anchored_at: result.anchored_at,
            block_number: result.block_number,
            chain_name: result.chain_name,
            tx_hash: result.tx_hash,
            error: result.error,
        };

        res.json(response);
    } catch (error) {
        console.error('Error verifying:', error);
        res.status(500).json({
            error: 'Failed to verify inference',
            code: 'INTERNAL_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// GET /api/verify/explain - Explain what verification proves
router.get('/explain', async (req: Request, res: Response) => {
    try {
        const inferenceHash = req.query['hash'] as string | undefined;

        if (!inferenceHash) {
            // Return generic explanation
            const genericResult = {
                verified: false,
                inference_hash: '',
            };
            const explanation = explainVerification(genericResult);
            res.json(explanation);
            return;
        }

        // Get specific explanation for an inference
        const result = await verifyInference({ hash: inferenceHash });
        const explanation = explainVerification(result);
        res.json(explanation);
    } catch (error) {
        console.error('Error explaining:', error);
        res.status(500).json({
            error: 'Failed to generate explanation',
            code: 'INTERNAL_ERROR',
        });
    }
});

// GET /api/verify/report - Get human-readable verification report
router.get('/report', async (req: Request, res: Response) => {
    try {
        const inferenceHash = req.query['hash'] as string | undefined;

        if (!inferenceHash) {
            res.status(400).json({
                error: 'Missing hash query parameter',
                code: 'MISSING_HASH',
            });
            return;
        }

        const result = await verifyInference({ hash: inferenceHash });
        const report = formatVerificationReport(result);

        res.type('text/plain').send(report);
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            error: 'Failed to generate report',
            code: 'INTERNAL_ERROR',
        });
    }
});

// POST /api/verify/hash - Compute hash for a record (utility endpoint)
router.post('/hash', (req: Request, res: Response) => {
    try {
        const record = req.body;

        if (!record.model || !record.prompt_hash || !record.output_hash) {
            res.status(400).json({
                error: 'Invalid inference record',
                code: 'INVALID_RECORD',
            });
            return;
        }

        const hash = hashInference(record);
        res.json({ inference_hash: hash });
    } catch (error) {
        console.error('Error computing hash:', error);
        res.status(500).json({
            error: 'Failed to compute hash',
            code: 'INTERNAL_ERROR',
        });
    }
});

// GET /api/verify/proof/:hash - Get Merkle proof for an inference
router.get('/proof/:hash', (req: Request, res: Response) => {
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
        const batch = storage.findBatchContainingHash(hash);

        if (!batch) {
            res.status(404).json({
                error: 'Inference not found in any batch',
                code: 'NOT_BATCHED',
            });
            return;
        }

        const { generateProof } = require('../merkle');
        const proof = generateProof(batch, hash);

        if (!proof) {
            res.status(500).json({
                error: 'Failed to generate proof',
                code: 'PROOF_FAILED',
            });
            return;
        }

        res.json({
            proof: proof.proof,
            root: proof.root,
            leaf: proof.leaf,
            leaf_index: proof.leaf_index,
        });
    } catch (error) {
        console.error('Error getting proof:', error);
        res.status(500).json({
            error: 'Failed to get proof',
            code: 'INTERNAL_ERROR',
        });
    }
});

export default router;
