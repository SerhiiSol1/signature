import { ethers } from "hardhat";
import * as dotenv from "dotenv";
const DepositBox = require("../../artifacts/contracts/DepositBox.sol/DepositBox.json");

dotenv.config();

async function main() {
    // Setup variables
    const provider = new ethers.providers.JsonRpcProvider(process.env.GOERLI_URL);
    const owner = new ethers.Wallet(process.env.BOX_OWNER_PRIVATE, provider);
    const signDeadline = Date.now() + process.env.SIGN_DEADLINE;
    const boxId = process.env.BOX_ID;
    const withdrawalAddress = process.env.WITHDRAWER_ADDRESS;
    const boxAddress = process.env.BOX_CONTRACT;

    // create message
    const message = ethers.utils.solidityPack(
        ["address", "uint256", "uint256"],
        [withdrawalAddress, boxId, signDeadline]
    );

    // hash message
    const hash = ethers.utils.solidityKeccak256(["bytes"], [message]);

    // sign message
    const signedMessage = await owner.signMessage(ethers.utils.arrayify(hash));
    console.log(`Signed message for ${boxId} box for ${withdrawalAddress}:\n${signedMessage}`);
    console.log(`Message expires at: ${signDeadline}`);

    // Connect contracts
    const depositBox = await ethers.getContractAt(DepositBox.abi, boxAddress);
    console.log("Deposit Box set up");

    // Withdraw from box
    const txI = await depositBox.withdrawFromBox(boxId, signDeadline, signedMessage);
    await txI.wait();
    console.log(`Withdraw from ${boxId} id box complete`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
