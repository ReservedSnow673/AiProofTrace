/**
 * Local File Storage
 * 
 * Persists inference records, batches, and anchors to local filesystem.
 * Uses JSON files for simplicity and auditability.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    StoredInference,
    MerkleBatch,
    AnchorRecord
} from '../types';

interface StorageConfig {
    dataDir: string;
}

interface StorageState {
    inferences: Map<string, StoredInference>;
    batches: Map<string, MerkleBatch>;
    anchors: Map<string, AnchorRecord>;
}

const DEFAULT_DATA_DIR = './data';

export class Storage {
    private config: StorageConfig;
    private state: StorageState;
    private initialized: boolean = false;

    constructor(dataDir?: string) {
        this.config = {
            dataDir: dataDir ?? process.env['DATA_DIR'] ?? DEFAULT_DATA_DIR,
        };
        this.state = {
            inferences: new Map(),
            batches: new Map(),
            anchors: new Map(),
        };
    }

    /**
     * Initialize storage - create directories and load existing data
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        const dirs = [
            this.config.dataDir,
            path.join(this.config.dataDir, 'inferences'),
            path.join(this.config.dataDir, 'batches'),
            path.join(this.config.dataDir, 'anchors'),
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        await this.loadData();
        this.initialized = true;
    }

    /**
     * Load existing data from disk
     */
    private async loadData(): Promise<void> {
        await this.loadInferences();
        await this.loadBatches();
        await this.loadAnchors();
    }

    private async loadInferences(): Promise<void> {
        const dir = path.join(this.config.dataDir, 'inferences');
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(dir, file), 'utf-8');
                const inference = JSON.parse(content) as StoredInference;
                this.state.inferences.set(inference.inference_hash, inference);
            } catch (error) {
                console.error(`Failed to load inference from ${file}:`, error);
            }
        }
    }

    private async loadBatches(): Promise<void> {
        const dir = path.join(this.config.dataDir, 'batches');
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(dir, file), 'utf-8');
                const batch = JSON.parse(content) as MerkleBatch;
                this.state.batches.set(batch.batch_id, batch);
            } catch (error) {
                console.error(`Failed to load batch from ${file}:`, error);
            }
        }
    }

    private async loadAnchors(): Promise<void> {
        const dir = path.join(this.config.dataDir, 'anchors');
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(dir, file), 'utf-8');
                const anchor = JSON.parse(content) as AnchorRecord;
                this.state.anchors.set(anchor.tx_hash, anchor);
            } catch (error) {
                console.error(`Failed to load anchor from ${file}:`, error);
            }
        }
    }

    // Inference operations

    async storeInference(inference: StoredInference): Promise<void> {
        this.state.inferences.set(inference.inference_hash, inference);

        const filePath = path.join(
            this.config.dataDir,
            'inferences',
            `${inference.inference_hash.slice(2, 18)}.json`
        );
        fs.writeFileSync(filePath, JSON.stringify(inference, null, 2));
    }

    getInference(hash: string): StoredInference | undefined {
        return this.state.inferences.get(hash.toLowerCase());
    }

    getAllInferences(): StoredInference[] {
        return Array.from(this.state.inferences.values());
    }

    getUnbatchedInferences(): StoredInference[] {
        const batchedHashes = new Set<string>();

        for (const batch of this.state.batches.values()) {
            for (const leaf of batch.leaves) {
                batchedHashes.add(leaf.toLowerCase());
            }
        }

        return this.getAllInferences().filter(
            inf => !batchedHashes.has(inf.inference_hash.toLowerCase())
        );
    }

    // Batch operations

    async storeBatch(batch: MerkleBatch): Promise<void> {
        this.state.batches.set(batch.batch_id, batch);

        const filePath = path.join(
            this.config.dataDir,
            'batches',
            `${batch.batch_id}.json`
        );
        fs.writeFileSync(filePath, JSON.stringify(batch, null, 2));
    }

    getBatch(batchId: string): MerkleBatch | undefined {
        return this.state.batches.get(batchId);
    }

    getBatchByRoot(root: string): MerkleBatch | undefined {
        const normalizedRoot = root.toLowerCase();
        for (const batch of this.state.batches.values()) {
            if (batch.root.toLowerCase() === normalizedRoot) {
                return batch;
            }
        }
        return undefined;
    }

    findBatchContainingHash(inferenceHash: string): MerkleBatch | undefined {
        const normalized = inferenceHash.toLowerCase();
        for (const batch of this.state.batches.values()) {
            if (batch.leaves.some(leaf => leaf.toLowerCase() === normalized)) {
                return batch;
            }
        }
        return undefined;
    }

    getAllBatches(): MerkleBatch[] {
        return Array.from(this.state.batches.values());
    }

    getUnanchoredBatches(): MerkleBatch[] {
        const anchoredRoots = new Set<string>();

        for (const anchor of this.state.anchors.values()) {
            anchoredRoots.add(anchor.merkle_root.toLowerCase());
        }

        return this.getAllBatches().filter(
            batch => !anchoredRoots.has(batch.root.toLowerCase())
        );
    }

    // Anchor operations

    async storeAnchor(anchor: AnchorRecord): Promise<void> {
        this.state.anchors.set(anchor.tx_hash, anchor);

        const filePath = path.join(
            this.config.dataDir,
            'anchors',
            `${anchor.tx_hash.slice(2, 18)}.json`
        );
        fs.writeFileSync(filePath, JSON.stringify(anchor, null, 2));
    }

    getAnchor(txHash: string): AnchorRecord | undefined {
        return this.state.anchors.get(txHash.toLowerCase());
    }

    getAnchorByRoot(root: string): AnchorRecord | undefined {
        const normalizedRoot = root.toLowerCase();
        for (const anchor of this.state.anchors.values()) {
            if (anchor.merkle_root.toLowerCase() === normalizedRoot) {
                return anchor;
            }
        }
        return undefined;
    }

    getAnchorByBatchId(batchId: string): AnchorRecord | undefined {
        for (const anchor of this.state.anchors.values()) {
            if (anchor.batch_id === batchId) {
                return anchor;
            }
        }
        return undefined;
    }

    getAllAnchors(): AnchorRecord[] {
        return Array.from(this.state.anchors.values());
    }

    // Utility

    getStats(): {
        inferences: number;
        batches: number;
        anchors: number;
        unbatchedInferences: number;
        unanchoredBatches: number;
    } {
        return {
            inferences: this.state.inferences.size,
            batches: this.state.batches.size,
            anchors: this.state.anchors.size,
            unbatchedInferences: this.getUnbatchedInferences().length,
            unanchoredBatches: this.getUnanchoredBatches().length,
        };
    }
}

// Singleton instance for convenience
let storageInstance: Storage | null = null;

export function getStorage(dataDir?: string): Storage {
    if (!storageInstance) {
        storageInstance = new Storage(dataDir);
    }
    return storageInstance;
}

export async function initializeStorage(dataDir?: string): Promise<Storage> {
    const storage = getStorage(dataDir);
    await storage.initialize();
    return storage;
}
