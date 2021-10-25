import { expect } from "chai";
import { ethers } from "hardhat";
import { runInThisContext } from "vm";
import { Contracts } from "../networks/compoundMainnet.json";

const compAbi = require("../external/compound.json");
const ERC20 = require("../external/erc20.json");


const COMP_API = "https://api.compound.finance/api/v2/ctoken";
const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

//THE biggest hodler of USDC - Maker
const MAKER_ADDRESS = "0x0a59649758aa4d66e25f08dd01271e891fe52199";

const delay = (ms:number) => new Promise(res => setTimeout(res, ms));
const CUSDC_DECIMALS = 8;

describe("Compound APY", function () {
    const USDC_AMOUNT = 100;
    const ONE_USDC = ethers.utils.parseUnits("1.0", 6);
    const SUPPLY_AMOUNT = ONE_USDC.mul(USDC_AMOUNT);
  
    before(async function () {
      this.signers = await ethers.getSigners();
      this.deployer = this.signers[0];
    
      this.cUSDC = new ethers.Contract(Contracts.cUSDC, compAbi["cErc20Delegate"], this.deployer);
      this.USDC = new ethers.Contract(USDC_MAINNET, ERC20, this.deployer);

      //unblock USDC contract
      await ethers.provider.send("hardhat_impersonateAccount", [MAKER_ADDRESS]);
        
      this.makerSigner = await ethers.getSigner(MAKER_ADDRESS);

      //transfer SUPPLY_AMOUNT USDC to deployer
      let tx = await this.USDC.connect(this.makerSigner).transfer(this.deployer.address, SUPPLY_AMOUNT);
      await tx.wait();

      //INTEGRITY CHECK
      let balance = await this.USDC.balanceOf(this.deployer.address);
      expect(balance).to.be.not.eq(ethers.constants.Zero);
      console.log("DEPLOYER USDC balance=", ethers.utils.formatUnits(balance, 6));
    });

    it("supply/redeem calc APY", async function () {
        let tx = await this.USDC.connect(this.deployer).approve(this.cUSDC.address, SUPPLY_AMOUNT);
        await tx.wait();

        tx = await this.cUSDC.connect(this.deployer).mint(SUPPLY_AMOUNT);
        await tx.wait();

        let ctokenBalance = await this.cUSDC.balanceOf(this.deployer.address);
        expect(ctokenBalance).to.be.not.eq(ethers.constants.Zero);

        console.log("cTOKEN balance=", ethers.utils.formatUnits(ctokenBalance, CUSDC_DECIMALS));

        tx = await this.cUSDC.redeem(ctokenBalance);
        await tx.wait();

        let balance = await this.USDC.balanceOf(this.deployer.address);
        console.log("DEPLOYER USDC after redeem balance=", ethers.utils.formatUnits(balance, 6));


    });
});
