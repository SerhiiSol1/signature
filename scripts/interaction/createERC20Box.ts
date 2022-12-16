import { ethers } from "hardhat";
import * as dotenv from "dotenv";
const IERC20 = require("@openzeppelin/contracts/build/contracts/IERC20.json");
const DepositBox = require("../../artifacts/contracts/DepositBox.sol/DepositBox.json");

dotenv.config();

const parseUnits = ethers.utils.parseUnits;

async function main() {
    // Setup variables
    const amount = parseUnits(process.env.ERC20_AMOUNT, process.env.ERC20_DECIMALS);
    const boxAddress = process.env.BOX_CONTRACT;
    const token = process.env.ERC20_CONTRACT;
    const lockPeriod = process.env.LOCK;

    // Connect contracts
    const depositBox = await ethers.getContractAt(DepositBox.abi, boxAddress);
    console.log("Deposit Box set up");
    const erc20 = await ethers.getContractAt(IERC20.abi, token);
    console.log("Token set up");

    // Approve ERC20
    const txI = await erc20.approve(depositBox.address, amount);
    await txI.wait();
    console.log("Token approved to box");

    // Create box with ERC20 locked tokens
    const txC = await depositBox.createDepositBox(erc20.address, amount, 0, lockPeriod);
    await txC.wait();
    console.log(`Box created, that includes: ${process.env.ERC20_AMOUNT} tokens`);
    console.log(`Box lock period: ${lockPeriod}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
