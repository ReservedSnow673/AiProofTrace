/**
 * API Integration Tests
 */

import request from 'supertest';
import { app } from '../index';
import { initializeStorage, getStorage } from '../storage';

describe('API Endpoints', () => {
    beforeAll(async () => {
        await initializeStorage('./test-data');
    });

    describe('POST /api/inference', () => {
        it('should record a valid inference', async () => {
            const response = await request(app)
                .post('/api/inference')
                .send({
                    model: 'test-model',
                    prompt_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                    output_hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
                    parameters: { temperature: 0.7 },
                    context: { feature: 'test' },
                });

            expect(response.status).toBe(201);
            expect(response.body.inference_hash).toBeDefined();
            expect(response.body.inference_hash).toMatch(/^0x[a-f0-9]{64}$/);
        });

        it('should reject missing model', async () => {
            const response = await request(app)
                .post('/api/inference')
                .send({
                    prompt_hash: '0x1234',
                    output_hash: '0x5678',
                });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_MODEL');
        });

        it('should reject missing prompt_hash', async () => {
            const response = await request(app)
                .post('/api/inference')
                .send({
                    model: 'test-model',
                    output_hash: '0x5678',
                });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_PROMPT_HASH');
        });
    });

    describe('POST /api/batch', () => {
        it('should create batch from unbatched inferences', async () => {
            // First record some inferences
            await request(app)
                .post('/api/inference')
                .send({
                    model: 'batch-test',
                    prompt_hash: '0xaaaa',
                    output_hash: '0xbbbb',
                });

            const response = await request(app)
                .post('/api/batch')
                .send({});

            expect(response.status).toBe(201);
            expect(response.body.batch_id).toBeDefined();
            expect(response.body.merkle_root).toBeDefined();
        });

        it('should return error when no unbatched inferences', async () => {
            // Create a fresh storage scenario
            const storage = getStorage();
            const unbatched = storage.getUnbatchedInferences();

            if (unbatched.length === 0) {
                const response = await request(app)
                    .post('/api/batch')
                    .send({});

                expect(response.status).toBe(400);
            }
        });
    });

    describe('GET /api/stats', () => {
        it('should return storage statistics', async () => {
            const response = await request(app)
                .get('/api/stats');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('inferences');
            expect(response.body).toHaveProperty('batches');
            expect(response.body).toHaveProperty('anchors');
        });
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ok');
        });
    });

    describe('POST /api/verify/hash', () => {
        it('should compute hash for inference record', async () => {
            const response = await request(app)
                .post('/api/verify/hash')
                .send({
                    model: 'hash-test',
                    prompt_hash: '0x1111',
                    output_hash: '0x2222',
                });

            expect(response.status).toBe(200);
            expect(response.body.inference_hash).toBeDefined();
        });
    });

    describe('GET /api/verify/explain', () => {
        it('should return explanation', async () => {
            const response = await request(app)
                .get('/api/verify/explain');

            expect(response.status).toBe(200);
            expect(response.body.what_is_proven).toBeDefined();
            expect(response.body.what_is_not_proven).toBeDefined();
            expect(response.body.trust_assumptions).toBeDefined();
        });
    });
});
