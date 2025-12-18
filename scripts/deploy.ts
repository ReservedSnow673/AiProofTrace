import { ethers } from "hardhat";

async function main(): Promise<void> {
    console.log("Deploying ProofTraceRegistry...");

    const ProofTraceRegistry = await ethers.getContractFactory("ProofTraceRegistry");
    const registry = await ProofTraceRegistry.deploy();

    await registry.waitForDeployment();

    const address = await registry.getAddress();
    console.log(`ProofTraceRegistry deployed to: ${address}`);

    // Log deployment info for verification
    console.log("\nDeployment complete.");
    console.log("Update config/chains.json with the contract address for your network.");
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
