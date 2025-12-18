# QuickStart Guide

This guide will help you get AiProofTrace up and running locally for development and testing.

## Prerequisites
- **Node.js**: >= 18.0.0
- **npm**: Standard installation
- **Blockchain RPC**: Access to Sepolia or Base (e.g., Alchemy, Infura, or public RPCs)
- **Private Key**: A wallet with testnet tokens for anchoring transactions

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ReservedSnow/AiProofTrace.git
   cd AiProofTrace
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and provide your RPC URLs and PRIVATE_KEY.

## Setup & Deployment

1. Compile smart contracts:
   ```bash
   npx hardhat compile
   ```

2. Deploy registry (optional if using already deployed contracts):
   ```bash
   npx hardhat run scripts/deploy.ts --network sepolia
   ```
   After deployment, copy the contract address to `config/chains.json`.

## Running the Server

Start the API server:
```bash
cd server
npm run dev
```
The server runs on `http://localhost:3000` by default.

## Usage with CLI

In a new terminal:

1. **Record an inference**:
   ```bash
   cd cli
   npm run dev -- record -m gpt-4 -p 0x... -o 0x...
   ```

2. **Create a batch**:
   ```bash
   npm run dev -- batch
   ```

3. **Anchor to blockchain**:
   ```bash
   npm run dev -- anchor --chain sepolia
   ```

4. **Verify an inference**:
   ```bash
   npm run dev -- verify --hash 0x...
   ```

## Running Tests

Ensure system integrity by running the test suites:

### Contracts
```bash
npx hardhat test
```

### Server
```bash
cd server
npm test
```
