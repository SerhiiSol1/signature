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
            await depositBox.createDepositBox();
            expect((await depositBox.depositBoxes(0)).owner).to.equal(owner.address);

            // mint erc20 token
            await erc20.mint(owner.address, parseEther("100"));
            await erc20.approve(depositBox.address, parseEther("100"));

            // deposit erc20 and native tokens
            await depositBox.depositToBox(0, erc20.address, 0, parseEther("50"), { value: parseEther("1") });
            expect(await depositBox.boxInfo(0)).to.deep.equal([[parseEther("50")], ["0"], [erc20.address]]);

            // mint nft
            await erc721.safeMint(owner.address);
            await erc721.approve(depositBox.address, 0);

            // deposit nft
            await depositBox.depositToBox(0, erc721.address, 1, "0");
            expect(await depositBox.boxInfo(0)).to.deep.equal([
                [parseEther("50"), "0"],
                ["0", "1"],
                [erc20.address, erc721.address]
            ]);
        });

        it("Sigh and withdraw", async () => {
            await depositBox.createDepositBox();
            await erc20.mint(owner.address, parseEther("100"));
            await erc20.approve(depositBox.address, parseEther("100"));

            await depositBox.depositToBox(0, erc20.address, 0, parseEther("50"), { value: parseEther("1") });

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
        it("When user tries to deposit to wrong box", async () => {
            await depositBox.connect(user1).createDepositBox();

            await expect(
                depositBox.depositToBox(0, AddressZero, 2, parseEther("1"), { value: parseEther("1") })
            ).to.be.revertedWithCustomError(depositBox, "NotBoxOwner");
        });

        it("When asset address == zero", async () => {
            await depositBox.createDepositBox();

            // deposit erc20
            await expect(depositBox.depositToBox(0, AddressZero, 0, parseEther("1"))).to.be.revertedWithCustomError(
                depositBox,
                "ZeroAddress"
            );

            // deposit erc721
            await expect(depositBox.depositToBox(0, AddressZero, 1, 0)).to.be.revertedWithCustomError(
                depositBox,
                "ZeroAddress"
            );
        });

        it("When token amount == 0", async () => {
            await depositBox.createDepositBox();

            // deposit erc20
            await expect(depositBox.depositToBox(0, erc20.address, 0, 0)).to.be.revertedWithCustomError(
                depositBox,
                "ZeroAmount"
            );
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
            await depositBox.createDepositBox();

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
    });
});
