import { ethers } from "hardhat";
import * as dotenv from "dotenv";
const IERC721 = require("@openzeppelin/contracts/build/contracts/IERC721.json");
const DepositBox = require("../../artifacts/contracts/DepositBox.sol/DepositBox.json");

dotenv.config();

async function main() {
    // Setup variables
    const tokenId = process.env.ERC721_TOKEN;
    const boxAddress = process.env.BOX_CONTRACT;
    const nft = process.env.ERC721_CONTRACT;
    const lockPeriod = process.env.LOCK;

    // Connect contracts
    const depositBox = await ethers.getContractAt(DepositBox.abi, boxAddress);
    console.log("Deposit Box set up");
    const erc721 = await ethers.getContractAt(IERC721.abi, nft);
    console.log("NFT set up");

    // Approve ERC721
    const txI = await erc721.approve(depositBox.address, tokenId);
    await txI.wait();
    console.log("Token approved to box");

    // Create box with ERC721 locked token
    const txC = await depositBox.createDepositBox(erc721.address, tokenId, 1, lockPeriod);
    await txC.wait();
    console.log(`Box created, that includes: ${tokenId} id token`);
    console.log(`Box lock period: ${lockPeriod}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
