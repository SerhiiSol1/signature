import { ethers } from "hardhat";
const hre = require("hardhat");

async function main() {
    // Deployment of the DepositBox.
    const DepositBox = await ethers.getContractFactory("DepositBox");
    const depositBox = await DepositBox.deploy();
    await depositBox.deployed();

    console.log(`DepositBox deployed to ${depositBox.address}`);

    console.log("Waiting 30 seconds for Etherscan update before verification requests...");
    await new Promise((resolve) => setTimeout(resolve, 30000)); // pause for Etherscan update

    try {
        await hre.run("verify:verify", {
            address: depositBox.address,
            contract: "contracts/DepositBox.sol:DepositBox"
        });
    } catch (err) {
        console.log(err);
    }

    console.log(`DepositBox contract verified`);
}

// This pattern is recommended to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
