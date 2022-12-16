import { ethers } from "hardhat";
import * as dotenv from "dotenv";
const DepositBox = require("../../artifacts/contracts/DepositBox.sol/DepositBox.json");

dotenv.config();

const parseUnits = ethers.utils.parseUnits;

async function main() {
    // Setup variables
    const boxAddress = process.env.BOX_CONTRACT;
    const nativeAmount = parseUnits(process.env.NATIVE_AMOUNT, 18);

    // Connect contracts
    const depositBox = await ethers.getContractAt(DepositBox, boxAddress);
    console.log("Deposit Box set up");

    // Create box with Native locked token
    const txC = await depositBox.createDepositBox(ethers.constants.AddressZero, nativeAmount, 2, lockPeriod, {
        value: nativeAmount
    });
    await txC.wait();
    console.log(`Box created, that includes: ${process.env.NATIVE_AMOUNT} native tokens`);
    console.log(`Box lock period: ${lockPeriod}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
