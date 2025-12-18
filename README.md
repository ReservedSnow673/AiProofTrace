# AiProofTrace

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

**Verifiable AI Inference Logs using Blockchain Anchoring**

An infrastructure tool for cryptographically anchoring AI inference metadata on-chain. This enables third parties to independently verify that specific AI inferences existed at a particular point in time without modification.

---

## What This Is

AiProofTrace is a pragmatic solution for AI auditability. It provides:

- **Deterministic hashing** of inference metadata using keccak256.
- **Merkle tree batching** for gas-efficient on-chain anchoring.
- **Independent verification** of inference records years later.
- **Multi-chain support** targets Base and Sepolia networks.

This project is about **verifiability, auditability, and trust primitives**. It is not about decentralized AI, agents, memory, or governance.

---

## Documentation

- **[Quick Start](docs/QUICKSTART.md)**: Get up and running in minutes.
- **[Architecture](docs/ARCHITECTURE.md)**: Deep dive into the system design and walkthrough data.
- **[Security Model](docs/SECURITY.md)**: Threat model and trust assumptions.
- **[Contributing](docs/CONTRIBUTING.md)**: Guidelines for contributing to the project.
- **[Changelog](docs/CHANGELOG.md)**: Version history and notable changes.

---

## Core Principles

1. **Never store raw prompts or outputs on-chain**: Only hashes are anchored for privacy and efficiency.
2. **Deterministic operations**: Same input always produces the same hash across all environments.
3. **Independent verification**: Anyone with the record can verify it against the blockchain without the original recorder's help.
4. **Transparency**: Explicit documentation of what is and is NOT proven by the system.

---

## What Verification Proves

- The inference metadata existed at the time of anchoring.
- The metadata has not been modified since batching.
- The batch was anchored before a specific block number.
- The Merkle proof is mathematically valid.

*Note: This does NOT prove the truthfulness or quality of the AI output. See [Security Model](docs/SECURITY.md) for details.*

---

## Repository Structure

```
aiprooftrace/
├── contracts/     # Solidity smart contracts (Hardhat)
├── server/        # Express API (TypeScript)
├── cli/           # Node.js CLI tool
├── docs/          # Detailed documentation
├── config/        # Chain configurations
├── scripts/       # Deployment and utility scripts
└── test/          # Smart contract tests
```

---

## Author

**Tanvir Singh Sandhu** (ReservedSnow)  
Wallet for coffee: `ReservedSnow.eth`

---

## License

This project is licensed under the [MIT License](docs/LICENSE).
