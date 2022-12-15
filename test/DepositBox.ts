import type { SnapshotRestorer } from "@nomicfoundation/hardhat-network-helpers";
import { takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";

import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import type { DepositBox, MockERC20, MockERC721 } from "../typechain-types";

const parseEther = ethers.utils.parseEther;
const AddressZero = ethers.constants.AddressZero;
const toBN = ethers.BigNumber.from;

describe("DepositBox", function () {
    let snapshotA: SnapshotRestorer;

    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    let depositBox: DepositBox;
    let erc20: MockERC20;
    let erc721: MockERC721;

    before(async () => {
        // Getting of signers.
        [owner, user1, user2] = await ethers.getSigners();

        // Deployment of the Deposit box.
        const DepositBox = await ethers.getContractFactory("DepositBox");
        depositBox = await DepositBox.deploy();
        await depositBox.deployed();

        // Mock erc20
        const ERC20 = await ethers.getContractFactory("MockERC20");
        erc20 = await ERC20.deploy();
        await erc20.deployed();

        // Mock erc721
        const ERC721 = await ethers.getContractFactory("MockERC721");
        erc721 = await ERC721.deploy();
        await erc721.deployed();

        snapshotA = await takeSnapshot();
    });

    afterEach(async () => await snapshotA.restore());

    describe("Main functionality", function () {
        it("Deposit Token/NFT/Native", async () => {
            // mint erc20 token
            await erc20.mint(owner.address, parseEther("100"));
            await erc20.approve(depositBox.address, parseEther("100"));

            const lockPeriod = 1000;
            let lock = (await time.latest()) + lockPeriod + 1;

            // deposit erc20
            await depositBox.createDepositBox(erc20.address, parseEther("50"), 0, lockPeriod);
            expect(await depositBox.depositBoxes(0)).to.deep.equal([
                owner.address,
                erc20.address,
                parseEther("50"),
                lock,
                0
            ]);

            // mint nft
            await erc721.safeMint(owner.address);
            await erc721.approve(depositBox.address, 0);

            // deposit nft
            lock = (await time.latest()) + lockPeriod + 1;
            await depositBox.createDepositBox(erc721.address, 0, 1, lockPeriod);
            expect(await depositBox.depositBoxes(1)).to.deep.equal([owner.address, erc721.address, 0, lock, 1]);

            // deposit native
            lock = (await time.latest()) + lockPeriod + 1;
            await depositBox.createDepositBox(AddressZero, parseEther("1"), 2, lockPeriod, { value: parseEther("1") });
            expect(await depositBox.depositBoxes(2)).to.deep.equal([
                owner.address,
                AddressZero,
                parseEther("1"),
                lock,
                2
            ]);
        });

        it("Sigh and withdraw", async () => {
            await erc20.mint(owner.address, parseEther("100"));
            await erc20.approve(depositBox.address, parseEther("100"));

            await depositBox.createDepositBox(erc20.address, parseEther("50"), 0, 100);

            const sighDeadline = (await time.latest()) + 1000;

            let message = ethers.utils.solidityPack(
                ["address", "uint256", "uint256"],
                [owner.address, "0", sighDeadline]
            );
            const hash = ethers.utils.solidityKeccak256(["bytes"], [message]);
            const signedMessage = await owner.signMessage(hash);
            console.log(owner.address);
            console.log(await depositBox.withdrawView(0, sighDeadline, signedMessage));
            // await depositBox.withdrawFromBox(0, sighDeadline, signedMessage);
        });
    });

    describe("Revert", function () {
        it("When asset address == zero", async () => {
            // deposit erc20
            await expect(depositBox.createDepositBox(AddressZero, 0, 0, 0)).to.be.revertedWithCustomError(
                depositBox,
                "ZeroAddress"
            );

            // deposit erc721
            await expect(depositBox.createDepositBox(AddressZero, 0, 1, 0)).to.be.revertedWithCustomError(
                depositBox,
                "ZeroAddress"
            );
        });

        it("When token amount == 0", async () => {
            await expect(depositBox.createDepositBox(erc20.address, 0, 0, 0)).to.be.revertedWithCustomError(
                depositBox,
                "ZeroAmount"
            );
        });

        it("When amount != msg.value", async () => {
            await expect(
                depositBox.createDepositBox(AddressZero, 0, 2, 0, { value: 100 })
            ).to.be.revertedWithCustomError(depositBox, "WrongValue");
        });

        it("When sigh is expired", async () => {
            const sighDeadline = await time.latest();

            let message = ethers.utils.solidityPack(
                ["address", "uint256", "uint256"],
                [owner.address, "0", sighDeadline]
            );
            const hash = ethers.utils.solidityKeccak256(["bytes"], [message]);
            const signedMessage = await owner.signMessage(hash);

            await expect(depositBox.withdrawFromBox(0, sighDeadline, signedMessage)).to.be.revertedWithCustomError(
                depositBox,
                "SighExpired"
            );
        });

        it("When signed is not box owner", async () => {
            const sighDeadline = (await time.latest()) + 10000;
            await depositBox.createDepositBox(AddressZero, parseEther("1"), 2, 0, { value: parseEther("1") });

            let message = ethers.utils.solidityPack(
                ["address", "uint256", "uint256"],
                [user1.address, "0", sighDeadline]
            );
            const hash = ethers.utils.solidityKeccak256(["bytes"], [message]);
            const signedMessage = await owner.signMessage(hash);

            await expect(depositBox.withdrawFromBox(0, sighDeadline, signedMessage)).to.be.revertedWithCustomError(
                depositBox,
                "SignerNotOwner"
            );
        });

        it("When lock period is not ended", async () => {
            const sighDeadline = (await time.latest()) + 10000;
            await depositBox.createDepositBox(AddressZero, parseEther("1"), 2, 100, { value: parseEther("1") });

            let message = ethers.utils.solidityPack(
                ["address", "uint256", "uint256"],
                [user1.address, "0", sighDeadline]
            );
            const hash = ethers.utils.solidityKeccak256(["bytes"], [message]);
            const signedMessage = await owner.signMessage(hash);

            await expect(depositBox.withdrawFromBox(0, sighDeadline, signedMessage)).to.be.revertedWithCustomError(
                depositBox,
                "LockPeriod"
            );
        });
    });
});
