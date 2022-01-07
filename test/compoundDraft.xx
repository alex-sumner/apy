import { expect } from "chai";
import { ethers } from "hardhat";
//import { runInThisContext } from "vm";
import { Contracts } from "../networks/compoundMainnet.json";

const compAbi = require("../external/compound.json");
const aaveAbi = require("../external/aave.json");
const ERC20 = require("../external/erc20.json");
const aaveLendingPoolAbi = require('../external/aaveLendingPool.json');

const COMP_API = "https://api.compound.finance/api/v2/ctoken";
const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

//THE biggest hodler of USDC - Maker
const MAKER_ADDRESS = "0x0a59649758aa4d66e25f08dd01271e891fe52199";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
const CUSDC_DECIMALS = 8;

describe("Compound APY", function() {
    const USDC_AMOUNT = 100;
    const ONE_USDC = ethers.utils.parseUnits("1.0", 6);
    const SUPPLY_AMOUNT = ONE_USDC.mul(USDC_AMOUNT);

    // impersonate Maker to give us $100
    before(async function() {
        this.signers = await ethers.getSigners();
        this.deployer = this.signers[0];

        this.USDC = new ethers.Contract(USDC_MAINNET, ERC20, this.deployer);

        //unblock USDC contract
        await ethers.provider.send("hardhat_impersonateAccount", [MAKER_ADDRESS]);

        this.makerSigner = await ethers.getSigner(MAKER_ADDRESS);

        //transfer SUPPLY_AMOUNT USDC to deployer
        let tx = await this.USDC.connect(this.makerSigner).transfer(this.deployer.address, SUPPLY_AMOUNT);
        await tx.wait();

        //INTEGRITY CHECK
        this.startBalance = await this.USDC.balanceOf(this.deployer.address);
        console.log(`startBalance type ${typeof (this.startBalance)}`);
        expect(this.startBalance).to.be.not.eq(ethers.constants.Zero);
        console.log("DEPLOYER USDC balance=", ethers.utils.formatUnits(this.startBalance, 6));
    });

    it("estimate USDC supply APY, Compound", async function() {
        this.cUSDC = new ethers.Contract(Contracts.cUSDC, compAbi["cErc20Delegate"], this.deployer);
        let tx = await this.USDC.connect(this.deployer).approve(this.cUSDC.address, SUPPLY_AMOUNT);
        await tx.wait();

        tx = await this.cUSDC.connect(this.deployer).mint(SUPPLY_AMOUNT);
        await tx.wait();

        let block = await ethers.provider.getBlock(tx.blockNumber);
        let startTimestamp = block.timestamp;

        let ctokenBalance = await this.cUSDC.balanceOf(this.deployer.address);
        expect(ctokenBalance).to.be.not.eq(ethers.constants.Zero);

        console.log("cTOKEN balance=", ethers.utils.formatUnits(ctokenBalance, CUSDC_DECIMALS));

        console.log("...waiting for 30 seconds");
        await delay(30000);
        console.log("...redeem start");

        tx = await this.cUSDC.redeem(ctokenBalance);
        await tx.wait();

        block = await ethers.provider.getBlock(tx.blockNumber);
        let endTimestamp = block.timestamp;


        let diff = endTimestamp - startTimestamp;
        let periods = (365 * 24 * 60 * 60) / diff;

        let endBalance = await this.USDC.balanceOf(this.deployer.address);
        console.log("DEPLOYER USDC after redeem balance=", ethers.utils.formatUnits(endBalance, 6));

        let profit = endBalance - this.startBalance;
        console.log("COMP PROFIT earned=" + profit.toString() + " passed periods=" + periods);

    });

    it("estimate USDC supply APY, Aave", async function() {
        const addressProvider = new ethers.Contract(Contracts.AaveLendingPoolAddressesProvider, aaveAbi["AaveLendingPoolAddressesProvider"], this.deployer);
        const lendingPoolAddress = await addressProvider.getLendingPool();
        const aaveLendingPool = new ethers.Contract(lendingPoolAddress, aaveLendingPoolAbi["abi"], this.deployer);

        // Aave oracle always gives a price of zero?
        // const priceOracleAddress = await addressProvider.getPriceOracle();
        // const priceOracle = new ethers.Contract(priceOracleAddress, aaveAbi["PriceOracle"], this.deployer);

        const chainLinkAaveUSD = new ethers.Contract(Contracts.ChainLinkAaveUSD, aaveAbi["ChainLinkAaveUSD"], this.deployer);

        const aaveIncentivesController = new ethers.Contract(Contracts.AaveIncentivesController, aaveAbi["IncentivesController"], this.deployer);

        const startRewards = await aaveIncentivesController.getRewardsBalance([Contracts.aaveAToken], this.deployer.address);

        let tx = await this.USDC.connect(this.deployer).approve(aaveLendingPool.address, SUPPLY_AMOUNT);
        await tx.wait();

        tx = await aaveLendingPool.deposit(this.USDC.address, SUPPLY_AMOUNT, this.deployer.address, 0);
        await tx.wait();

        let block = await ethers.provider.getBlock(tx.blockNumber);
        const startTimestamp = block.timestamp;

        console.log("...waiting for 30 seconds");
        await delay(30000);
        console.log("...redeem start");

        tx = await aaveLendingPool.withdraw(this.USDC.address, ethers.constants.MaxUint256, this.deployer.address);
        await tx.wait();

        block = await ethers.provider.getBlock(tx.blockNumber);
        const endTimestamp = block.timestamp;


        const diff = endTimestamp - startTimestamp;
        const periods = (365 * 24 * 60 * 60) / diff;

        const endBalance = await this.USDC.balanceOf(this.deployer.address);
        const profitWithoutAaveReward = endBalance.sub(this.startBalance).mul(ethers.BigNumber.from(10).pow(12));

        const endRewards = await aaveIncentivesController.getRewardsBalance([Contracts.aaveAToken], this.deployer.address);

        // Aave oracle always gives a price of zero?
        // const aaveOraclePrice = await priceOracle.getAssetPrice(Contracts.aaveAToken);
        // console.log("Aave oracle price: ", aaveOraclePrice);
        const aavePriceData = await chainLinkAaveUSD.latestRoundData();
        const aavePrice = aavePriceData.answer;

        const reward = endRewards.sub(startRewards);
        const aaveReward = reward.mul(aavePrice).div(ethers.BigNumber.from(10).pow(8));

        const profit = profitWithoutAaveReward.add(aaveReward);
        console.log(`profitWithoutAaveReward * 10^6: ${ethers.utils.formatUnits(profitWithoutAaveReward, 12)}, aaveReward * 10^6: ${ethers.utils.formatUnits(aaveReward, 12)}`);
        console.log("AAVE PROFIT earned=" + ethers.utils.formatUnits(profit, 18) + ", passed periods=" + periods);

    });
});
