// Core type definitions for AiProofTrace

export interface InferenceParameters {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    [key: string]: unknown;
}

export interface InferenceContext {
    feature?: string;
    user_id?: string;
    session_id?: string;
    [key: string]: unknown;
}

export interface InferenceRecord {
    model: string;
    prompt_hash: string;
    output_hash: string;
    parameters?: InferenceParameters;
    context?: InferenceContext;
    timestamp?: number;
    nonce?: string;
}

export interface StoredInference {
    record: InferenceRecord;
    inference_hash: string;
    stored_at: number;
}

export interface MerkleBatch {
    batch_id: string;
    root: string;
    leaves: string[];
    tree: string[][];
    created_at: number;
    leaf_count: number;
}

export interface AnchorRecord {
    batch_id: string;
    merkle_root: string;
    tx_hash: string;
    block_number: number;
    chain_id: number;
    chain_name: string;
    anchored_at: number;
}

export interface MerkleProof {
    leaf: string;
    proof: string[];
    root: string;
    leaf_index: number;
}

export interface VerificationResult {
    verified: boolean;
    inference_hash: string;
    merkle_root?: string;
    anchored_at?: number;
    block_number?: number;
    chain_id?: number;
    chain_name?: string;
    tx_hash?: string;
    proof?: MerkleProof;
    error?: string;
}

export interface ChainConfig {
    chainId: number;
    name: string;
    rpcEnvVar: string;
    explorerUrl: string;
    contractAddress: string;
}

export interface ChainsConfig {
    chains: Record<string, ChainConfig>;
    defaultChain: string;
}

// API request/response types

export interface RecordInferenceRequest {
    model: string;
    prompt_hash: string;
    output_hash: string;
    parameters?: InferenceParameters;
    context?: InferenceContext;
}

export interface RecordInferenceResponse {
    inference_hash: string;
    stored_at: number;
}

export interface CreateBatchRequest {
    inference_hashes?: string[];
    batch_size?: number;
}

export interface CreateBatchResponse {
    batch_id: string;
    merkle_root: string;
    leaf_count: number;
    created_at: number;
}

export interface AnchorRequest {
    batch_id?: string;
    hashes?: string[];
    chain?: string;
}

export interface AnchorResponse {
    merkle_root: string;
    tx_hash: string;
    block_number: number;
    chain_id: number;
    chain_name: string;
}

export interface VerifyRequest {
    inference_record?: InferenceRecord;
    inference_hash?: string;
    anchor_tx_hash?: string;
    batch_id?: string;
    chain?: string;
}

export interface VerifyResponse {
    verified: boolean;
    anchored_at?: number;
    block_number?: number;
    chain_name?: string;
    tx_hash?: string;
    error?: string;
}

export interface ExplainResponse {
    what_is_proven: string[];
    what_is_not_proven: string[];
    trust_assumptions: string[];
    verification_details?: {
        inference_hash?: string;
        merkle_root?: string;
        block_number?: number;
        chain_name?: string;
    };
}

export interface ApiError {
    error: string;
    code: string;
    details?: unknown;
}
