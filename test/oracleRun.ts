import { expect } from "chai";
import { ethers } from "hardhat";
import { writeFile } from "fs";
import { Contracts } from "../networks/compoundMainnet.json";
import compoundResults from "../compoundResults.json";
import aaveResults from "../aaveResults.json";

const compAbi = require("../external/compound.json");
const aaveAbi = require("../external/aave.json");
const ERC20 = require("../external/erc20.json");
const aaveLendingPoolAbi = require('../external/aaveLendingPool.json');

const COMP_API = "https://api.compound.finance/api/v2/ctoken";
const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const STRIPS_TEST = "0x21d0fd7c54e4c1A453906A3BcB7598aeE827b292";

const CUSDC_DECIMALS = 8;

describe("Compound APY", function() {

    const YEAR_MILLIS = ethers.BigNumber.from(1000).mul(3600).mul(24).mul(365);
    const ONE_HUNDRED_d18 = ethers.utils.parseUnits("100", "ether");
    const ZERO = ethers.BigNumber.from("0");

    before(async function() {
        [this.deployer] = await ethers.getSigners();
        this.USDC = new ethers.Contract(USDC_MAINNET, ERC20, this.deployer);
        await ethers.provider.send("hardhat_impersonateAccount", [STRIPS_TEST]);
        this.stripsSigner = await ethers.getSigner(STRIPS_TEST);
    });

    it("estimate USDC supply APY, Compound", async function() {
        const cUSDC = new ethers.Contract(Contracts.cUSDC, compAbi["cErc20Delegate"], this.deployer);
        const compContract = new ethers.Contract(Contracts.COMP, compAbi["COMP"], this.deployer);

        const lastResult = compoundResults.at(-1);
        const prevBalance_d18 = lastResult ? ethers.utils.parseUnits(lastResult.balance, 18) : ZERO;
        const prevCompReward_d18 = lastResult ? ethers.utils.parseUnits(lastResult.compRewardBalance, 18) : ZERO;
        const prevTime = lastResult ? lastResult.time : 0;

        const usdcBeforeWithdrawal = await this.USDC.balanceOf(STRIPS_TEST);

        const ctokenBalance = await cUSDC.balanceOf(STRIPS_TEST);
        const tx = await cUSDC.redeem(ctokenBalance);
        const currentTime = Date.now();
        await tx.wait();

        const usdcAfterWithdrawal = await this.USDC.balanceOf(STRIPS_TEST);
        const currentBalance = usdcAfterWithdrawal.sub(usdcBeforeWithdrawal);
        const currentBalance_d18 = currentBalance.mul(ethers.BigNumber.from(10).pow(12));

        const currentCompReward = await compContract.balanceOf(STRIPS_TEST);
        const chainLinkCompUSD = new ethers.Contract(Contracts.ChainLinkCompUSD, compAbi["ChainLinkCompUSD"], this.deployer);

        const compPriceData = await chainLinkCompUSD.latestRoundData();
        const currentCompPrice = compPriceData.answer;
        const currentCompReward_d18 = currentCompReward.mul(currentCompPrice).div(ethers.BigNumber.from(10).pow(8));

        const currentProfit = currentBalance_d18.sub(prevBalance_d18).add(currentCompReward_d18.sub(prevCompReward_d18));
        const profitStr = ethers.utils.formatUnits(currentProfit, 18);
        const balanceStr = ethers.utils.formatUnits(currentBalance_d18, 18);
        const rewardStr = ethers.utils.formatUnits(currentCompReward_d18, 18);
        const priceStr = ethers.utils.formatUnits(currentCompPrice, 8);
        const interval = currentTime - prevTime;
        const apy = interval > 0 && prevBalance_d18.gt(ZERO) ?
            currentProfit.mul(YEAR_MILLIS).mul(ONE_HUNDRED_d18).div(interval).div(prevBalance_d18) :
            ZERO;
        const apyStr = ethers.utils.formatUnits(apy, 18);

        compoundResults.push({ balance: balanceStr, compRewardBalance: rewardStr, compPrice: priceStr, time: currentTime, interval, profit: profitStr, apy: apyStr });
        writeFile("compoundResults.json", JSON.stringify(compoundResults), err => { if (err) { console.log(err) } });



    });

    it("estimate USDC supply APY, Aave", async function() {
        const addressProvider = new ethers.Contract(Contracts.AaveLendingPoolAddressesProvider, aaveAbi["AaveLendingPoolAddressesProvider"], this.deployer);
        const lendingPoolAddress = await addressProvider.getLendingPool();
        const aaveLendingPool = new ethers.Contract(lendingPoolAddress, aaveLendingPoolAbi["abi"], this.deployer);


        const chainLinkAaveUSD = new ethers.Contract(Contracts.ChainLinkAaveUSD, aaveAbi["ChainLinkAaveUSD"], this.deployer);

        const aaveIncentivesController = new ethers.Contract(Contracts.AaveIncentivesController, aaveAbi["IncentivesController"], this.deployer);

        const lastResult = aaveResults.at(-1);
        const prevBalance_d18 = lastResult ? ethers.utils.parseUnits(lastResult.balance, 18) : ZERO;
        const prevAaveReward_d18 = lastResult ? ethers.utils.parseUnits(lastResult.aaveRewardBalance, 18) : ZERO;
        const prevTime = lastResult ? lastResult.time : 0;

        const usdcBeforeWithdrawal = await this.USDC.balanceOf(STRIPS_TEST);

        const tx = await aaveLendingPool.connect(this.stripsSigner).withdraw(this.USDC.address, ethers.constants.MaxUint256, STRIPS_TEST);
        const currentTime = Date.now();
        await tx.wait();

        const usdcAfterWithdrawal = await this.USDC.balanceOf(STRIPS_TEST);
        const currentBalance = usdcAfterWithdrawal.sub(usdcBeforeWithdrawal);
        const currentBalance_d18 = currentBalance.mul(ethers.BigNumber.from(10).pow(12));

        const currentAaveReward = await aaveIncentivesController.getRewardsBalance([Contracts.aaveAToken], STRIPS_TEST);
        const aavePriceData = await chainLinkAaveUSD.latestRoundData();
        const currentAavePrice = aavePriceData.answer;
        const currentAaveReward_d18 = currentAaveReward.mul(currentAavePrice).div(ethers.BigNumber.from(10).pow(8));

        const currentProfit = currentBalance_d18.sub(prevBalance_d18).add(currentAaveReward_d18.sub(prevAaveReward_d18));
        const profitStr = ethers.utils.formatUnits(currentProfit, 18);
        const balanceStr = ethers.utils.formatUnits(currentBalance_d18, 18);
        const rewardStr = ethers.utils.formatUnits(currentAaveReward_d18, 18);
        const priceStr = ethers.utils.formatUnits(currentAavePrice, 8);
        const interval = currentTime - prevTime;
        const apy = interval > 0 && prevBalance_d18.gt(ZERO) ?
            currentProfit.mul(YEAR_MILLIS).mul(ONE_HUNDRED_d18).div(interval).div(prevBalance_d18) :
            ZERO;
        const apyStr = ethers.utils.formatUnits(apy, 18);

        aaveResults.push({ balance: balanceStr, aaveRewardBalance: rewardStr, aavePrice: priceStr, time: currentTime, interval, profit: profitStr, apy: apyStr });
        writeFile("aaveResults.json", JSON.stringify(aaveResults), err => { if (err) { console.log(err) } });
    });
});

