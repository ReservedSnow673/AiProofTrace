# Security Model

This document describes the threat model for AiProofTrace and the mitigations in place.

---

## Trust Boundaries

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|   AI System      |---->|   AiProofTrace   |---->|   Blockchain     |
|   (Untrusted)    |     |   (Trusted)      |     |   (Trusted)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

### Trusted Components
- AiProofTrace server and storage
- Blockchain network (Ethereum, Base)
- Smart contract code

### Untrusted Components
- AI system providing inference data
- External RPC endpoints (partially trusted)
- End users requesting verification

---

## Threat Analysis

### 1. Log Tampering

**Threat**: Attacker modifies stored inference records after anchoring.

**Mitigations**:
- Records are hashed before storage
- Merkle root anchored on-chain is immutable
- Verification recomputes hash from original data
- Tampering detectable via hash mismatch

**Residual Risk**: Pre-anchoring tampering by system operator remains possible.

---

### 2. Replay Attacks

**Threat**: Attacker replays old inference records claiming they are new.

**Mitigations**:
- Each record includes timestamp at recording time
- Nonce field available for additional uniqueness
- On-chain anchor provides temporal ordering
- Verification shows oldest possible existence time

**Residual Risk**: Records without timestamps could theoretically be claimed at different times.

---

### 3. Partial Disclosure

**Threat**: Operator selectively discloses favorable inferences, hiding unfavorable ones.

**Mitigations**:
- None inherent in design
- System proves existence, not completeness

**Residual Risk**: This is explicit non-goal. AiProofTrace does not prove completeness.

**Recommendation**: External auditors should verify inference recording policies.

---

### 4. Chain Reorganization

**Threat**: Blockchain reorg removes or alters anchor transaction.

**Mitigations**:
- Use networks with strong finality (Base, Ethereum mainnet)
- Wait for sufficient confirmations before considering anchored
- Store block number for reorg detection

**Residual Risk**: Deep reorgs on testnets or low-security chains.

**Recommendations**:
- For production, use established L1/L2 with finality guarantees
- Consider anchor as "soft" until sufficient confirmations (12+ on Ethereum)

---

### 5. RPC Endpoint Manipulation

**Threat**: Malicious RPC returns false on-chain state.

**Mitigations**:
- Use trusted RPC providers
- Verify against multiple endpoints
- On-chain data is publicly verifiable

**Residual Risk**: Single RPC dependency in default configuration.

**Recommendations**:
- Use multiple RPC endpoints for verification
- Run own node for high-security applications

---

### 6. Smart Contract Bugs

**Threat**: Bug in registry contract allows manipulation.

**Mitigations**:
- Minimal contract surface (<60 LOC)
- No upgradability (reduces attack surface)
- No admin functions
- Standard Solidity patterns

**Residual Risk**: Undiscovered bugs in minimal code.

**Recommendations**:
- Audit before mainnet deployment
- Use well-tested networks

---

### 7. Hash Collision

**Threat**: Attacker finds two different records with same hash.

**Mitigations**:
- keccak256 is collision-resistant
- 256-bit output space makes collisions computationally infeasible

**Residual Risk**: Theoretical breakthrough in hash algorithms.

---

### 8. Timestamp Manipulation

**Threat**: Miner manipulates block timestamp to alter anchor time.

**Mitigations**:
- Block timestamps have protocol-enforced bounds
- Typical tolerance is ~15 seconds
- Long-term verification is not affected by seconds-level variance

**Residual Risk**: Minor timestamp drift within protocol bounds.

---

## Security Assumptions

The security of AiProofTrace relies on:

1. **keccak256 collision resistance** - Standard cryptographic assumption
2. **Blockchain immutability** - Chain has not experienced deep reorg
3. **Smart contract correctness** - No bugs in registry logic
4. **Honest recording** - System operator correctly hashed input data
5. **Storage integrity** - Local storage not tampered between record and verification

---

## What Is NOT Protected

Explicitly, AiProofTrace does NOT protect against:

1. **Lying about input** - Recorder can hash arbitrary data
2. **Selective recording** - Operator can choose what to record
3. **AI output correctness** - Hash does not validate content truth
4. **Pre-hash manipulation** - Prompt/output could be altered before hashing
5. **Identity claims** - No authentication of who recorded

---

## Recommended Practices

### For Operators

1. Record all inferences, not just selected ones
2. Use consistent recording policies
3. Store complete inference records locally
4. Document recording procedures for auditors
5. Use mainnet for production anchoring

### For Verifiers

1. Verify against multiple RPC endpoints
2. Wait for sufficient confirmations
3. Understand what verification proves and doesn't prove
4. Request complete audit trails from operators
5. Verify recorder's policies, not just individual records

### For Auditors

1. Check recording completeness policies
2. Verify anchor transaction on-chain directly
3. Review operator's recording infrastructure
4. Test deterministic replay capability
5. Confirm threat model understanding

---

## Incident Response

If a security issue is discovered:

1. Do not anchor new batches
2. Preserve all local storage
3. Document the issue with timestamps
4. Contact the repository maintainers
5. Do not disclose publicly until mitigated

---

## Contact

For security issues, contact: sandhu.tanvirsingh@yahoo.com

For general questions, open a GitHub issue.
