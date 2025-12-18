/**
 * ProofTraceRegistry Contract Tests
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { ProofTraceRegistry } from "../typechain-types";

describe("ProofTraceRegistry", function () {
    let registry: ProofTraceRegistry;

    const sampleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-merkle-root"));
    const anotherRoot = ethers.keccak256(ethers.toUtf8Bytes("another-root"));

    beforeEach(async function () {
        const ProofTraceRegistry = await ethers.getContractFactory("ProofTraceRegistry");
        registry = await ProofTraceRegistry.deploy();
        await registry.waitForDeployment();
    });

    describe("anchorRoot", function () {
        it("should anchor a new root", async function () {
            await registry.anchorRoot(sampleRoot);

            const anchoredAt = await registry.anchoredAt(sampleRoot);
            expect(anchoredAt).to.be.gt(0);
        });

        it("should emit RootAnchored event", async function () {
            await expect(registry.anchorRoot(sampleRoot))
                .to.emit(registry, "RootAnchored")
                .withArgs(sampleRoot, await (await ethers.provider.getBlock("latest"))!.timestamp + 1);
        });

        it("should reject zero root", async function () {
            const zeroRoot = ethers.ZeroHash;

            await expect(registry.anchorRoot(zeroRoot))
                .to.be.revertedWithCustomError(registry, "InvalidRoot");
        });

        it("should reject duplicate root", async function () {
            await registry.anchorRoot(sampleRoot);

            await expect(registry.anchorRoot(sampleRoot))
                .to.be.revertedWithCustomError(registry, "RootAlreadyAnchored");
        });

        it("should allow different roots", async function () {
            await registry.anchorRoot(sampleRoot);
            await registry.anchorRoot(anotherRoot);

            expect(await registry.isAnchored(sampleRoot)).to.be.true;
            expect(await registry.isAnchored(anotherRoot)).to.be.true;
        });
    });

    describe("isAnchored", function () {
        it("should return false for unanchored root", async function () {
            expect(await registry.isAnchored(sampleRoot)).to.be.false;
        });

        it("should return true for anchored root", async function () {
            await registry.anchorRoot(sampleRoot);
            expect(await registry.isAnchored(sampleRoot)).to.be.true;
        });
    });

    describe("getAnchorTimestamp", function () {
        it("should return 0 for unanchored root", async function () {
            expect(await registry.getAnchorTimestamp(sampleRoot)).to.equal(0);
        });

        it("should return timestamp for anchored root", async function () {
            const tx = await registry.anchorRoot(sampleRoot);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt!.blockNumber);

            expect(await registry.getAnchorTimestamp(sampleRoot)).to.equal(block!.timestamp);
        });
    });

    describe("anchoredAt mapping", function () {
        it("should store correct timestamp", async function () {
            const tx = await registry.anchorRoot(sampleRoot);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt!.blockNumber);

            const storedTimestamp = await registry.anchoredAt(sampleRoot);
            expect(storedTimestamp).to.equal(block!.timestamp);
        });
    });
});

describe("ProofTraceRegistry Gas", function () {
    it("should use reasonable gas for anchoring", async function () {
        const ProofTraceRegistry = await ethers.getContractFactory("ProofTraceRegistry");
        const registry = await ProofTraceRegistry.deploy();
        await registry.waitForDeployment();

        const root = ethers.keccak256(ethers.toUtf8Bytes("gas-test"));
        const tx = await registry.anchorRoot(root);
        const receipt = await tx.wait();

        // Anchoring should use less than 50k gas
        expect(receipt!.gasUsed).to.be.lt(50000);
    });
});
