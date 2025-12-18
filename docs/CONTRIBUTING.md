# Contributing to AiProofTrace

First off, thank you for considering contributing to AiProofTrace! It's people like you that make AiProofTrace a great tool.

## Development Environment Setup

### Prerequisites
- Node.js (>= 18.x)
- npm
- A code editor (VS Code recommended)

### Setup Steps
1. Clone the repository: `git clone https://github.com/ReservedSnow/AiProofTrace.git`
2. Install dependencies: `npm install`
3. Copy the environment template: `cp .env.example .env`
4. Fill in the `.env` file with your RPC URLs and a testing private key.
5. Compile the smart contracts: `npx hardhat compile`

## Project Structure
- `contracts/`: Solidity smart contracts.
- `server/`: Express backend for recording and verification.
- `cli/`: Command-line tool for interaction.
- `config/`: Configuration for different blockchains.
- `test/`: Smart contract tests.

## Running Tests
Before submitting a PR, ensure all tests pass:

### Contract Tests
```bash
npx hardhat test
```

### Server Tests
```bash
cd server
npm test
```

## Pull Request Process
1. Create a new branch for your feature or fix.
2. Ensure your code follows the project's style (run `npm run lint`).
3. Add or update tests as necessary.
4. Submit a Pull Request with a clear description of the changes.

## Code of Conduct
Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
