import { expect } from "chai";
import { ethers } from "hardhat";
import { Contracts } from "../networks/compoundMainnet.json";
import ERC20 from "../external/erc20.json";
import compAbi from "../external/compound.json";
import { it } from "mocha";

const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDC_contract = "0x0a59649758aa4d66e25f08dd01271e891fe52199";

const SUPPLY_AMOUNT = ethers.utils.parseUnits("100.0", 6);
let startblock: number;

async function generate_Account() {
  const [signers] = await ethers.getSigners();
  return signers
}

describe("Test", function () {
  it("Transfer", async () => {
    
    const owner = await generate_Account();

    // By connecting to a Signer, allows:
    // - Everything from Read-Only (except as Signer, not anonymous)
    // - Sending transactions for non-constant functions
    const USDC = new ethers.Contract(USDC_MAINNET, ERC20, owner);

    //before transfer
    expect(await USDC.balanceOf(owner.address)).to.equal(0);
    await ethers.provider.send("hardhat_impersonateAccount", [USDC_contract]);
    const makerSigner = await ethers.getSigner(USDC_contract);

    //transfer
    await USDC.connect(makerSigner).transfer(owner.address, SUPPLY_AMOUNT);

    //after transfer. Check for completed transfer
    console.log("after:", ethers.utils.formatUnits(await USDC.balanceOf(owner.getAddress()), 6));
    expect(await USDC.balanceOf(owner.address)).to.equal(SUPPLY_AMOUNT);
  });

  it("Mint", async () => {
    
    const owner = await generate_Account();

    const cUSDC = new ethers.Contract(Contracts.cUSDC, compAbi["cErc20Delegate"], owner);
    const USDC = new ethers.Contract(USDC_MAINNET, ERC20, owner);

    await USDC.connect(owner).approve(cUSDC.address, SUPPLY_AMOUNT);
    
    expect(await cUSDC.balanceOf(owner.address)).to.eq(0);

    let tx = await cUSDC.connect(owner).mint(SUPPLY_AMOUNT);
    await tx.wait();

    //store the block to calculate rewards
    let block = await ethers.provider.getBlock(tx.blockNumber);
    startblock = block.number;
    
    expect(await cUSDC.balanceOf(owner.address)).to.be.within(50000000, 500000000000);
    console.log("New cUSDC balance:",ethers.utils.formatUnits(await cUSDC.balanceOf(owner.address), 8));

    //tx = await cUSDC.redeem(await cUSDC.balanceOf(owner.address));
    //await tx.wait();

  });

  it("APY", async () => {
    
    const owner = await generate_Account();

    const cUSDC = new ethers.Contract(Contracts.cUSDC, compAbi["cErc20Delegate"], owner);
    //const USDC = new ethers.Contract(USDC_MAINNET, ERC20, owner);

    const ethMantissa = 1e18;
    const blocksPerDay = 6570; // 13.15 seconds per block
    const daysPerYear = 365;
    const supplyRatePerBlock = await cUSDC.supplyRatePerBlock();
    
    const supplyApy = (((Math.pow((supplyRatePerBlock / ethMantissa * blocksPerDay) + 1, daysPerYear))) - 1) * 100;
    //console.log("Supply per block:", ethers.utils.formatUnits(await cUSDC.supplyRatePerBlock(), 8));
    console.log(supplyApy);
    let tx = await cUSDC.redeem(await cUSDC.balanceOf(owner.address));
    await tx.wait();

    console.log(await owner.getTransactionCount("pending"));

  });
});