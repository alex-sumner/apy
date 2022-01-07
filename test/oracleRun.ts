import { ethers } from "hardhat";
import { writeFile } from "fs";
import { Contracts } from "../networks/compoundMainnet.json";
import compoundResults from "../compoundResults.json";
import aaveResults from "../aaveResults.json";
import curveResults from "../curveResults.json";
import { address as aaveKeeperAddress, abi as aaveKeeperAbi } from '../external/AssetOracle-aave-usdc-lending.json';
import { address as compoundKeeperAddress, abi as compoundKeeperAbi } from '../external/AssetOracle-compound-usdc-lending.json';

const compAbi = require("../external/compound.json");
const aaveAbi = require("../external/aave.json");
const ERC20 = require("../external/erc20.json");
const aaveLendingPoolAbi = require('../external/aaveLendingPool.json');
const comptrollerAbi = require('../external/comptroller.json');
const curve3PoolAbi = require("../external/curve3Pool.json");
const curve3CrvAbi = require("../external/curve3Crv.json");
const curveZapAbi = require("../external/curveZap.json");

const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

const STRIPS_AAVE_WALLET = "0x21d0fd7c54e4c1A453906A3BcB7598aeE827b292";
const STRIPS_COMPOUND_WALLET = "0xD7CFA9A98e0BDFDAcB5D7e07FBe9E528F057984D";
const STRIPS_CURVE_WALLET = "0x91f249b52caeb6e751f3a2f68f42ab369980279c";

const COMPOUND_BACKUP = "0x80C150F2714b5bb7035f0C5428Ee06c0b5C70C88";
const AAVE_BACKUP = "0xF6F7f470df48f737808278d80c24b88752809220";

const CURVE_3POOL = "0x91f249b52caeb6e751f3a2f68f42ab369980279c";
const CURVE_3CRV = "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490";
const CURVE_ZAP = "0xa79828df1850e8a3a3064576f380d90aecdd3359";

const abiCoder = ethers.utils.defaultAbiCoder;
const chainId = 421611;
const infuraProvider = new ethers.providers.InfuraProvider(
    {
        chainId,
        name: "arbitrum-rinkeby"
    },
    {
        projectId: process.env.INFURA_PROJECT_ID,
        projectSecret: process.env.INFURA_PROJECT_SECRET
    }
);
const infuraSigner = new ethers.Wallet(
    process.env.ARBITRUM_TESTNET_PRIVATE_KEY as string, infuraProvider);

describe("Compound APY", function() {

    const YEAR_MILLIS = ethers.BigNumber.from(1000).mul(3600).mul(24).mul(365);
    const ONE_d18 = ethers.utils.parseUnits("1", "ether");
    const ZERO = ethers.BigNumber.from("0");
    before(async function() {
        [this.deployer] = await ethers.getSigners();
        this.USDC = new ethers.Contract(USDC_MAINNET, ERC20, this.deployer);
    });

    it("estimate USDC supply APY, Compound", async function() {
        await ethers.provider.send("hardhat_impersonateAccount", [STRIPS_COMPOUND_WALLET]);
        const stripsCompoundSigner = await ethers.getSigner(STRIPS_COMPOUND_WALLET);
        const cUSDC = new ethers.Contract(Contracts.cUSDC, compAbi["cErc20Delegate"], this.deployer);
        const compContract = new ethers.Contract(Contracts.COMP, compAbi["COMP"], this.deployer);
        const ComptrollerContract = new ethers.Contract(Contracts.Comptroller, comptrollerAbi, this.deployer);

        const lastResult = compoundResults.at(-1);
        const prevBalance_d18 = lastResult ? ethers.utils.parseUnits(lastResult.balance, 18) : ZERO;
        const prevCompReward = lastResult ? ethers.utils.parseUnits(lastResult.compRewardBalance, 18) : ZERO;

        const prevTime = lastResult ? lastResult.time : 0;

        const usdcBeforeWithdrawal = await this.USDC.balanceOf(STRIPS_COMPOUND_WALLET);

        let tx = await ComptrollerContract
            .connect(stripsCompoundSigner)
            .claimComp(STRIPS_COMPOUND_WALLET, [cUSDC.address]);
        const ctokenBalance = await cUSDC.balanceOf(STRIPS_COMPOUND_WALLET);
        tx = await cUSDC.connect(stripsCompoundSigner).redeem(ctokenBalance);
        const currentTime = Date.now();
        await tx.wait();

        const usdcAfterWithdrawal = await this.USDC.balanceOf(STRIPS_COMPOUND_WALLET);
        const currentBalance = usdcAfterWithdrawal.sub(usdcBeforeWithdrawal);
        const currentBalance_d18 = currentBalance.mul(ethers.BigNumber.from(10).pow(12));

        const currentCompReward = await compContract.balanceOf(STRIPS_COMPOUND_WALLET);
        const chainLinkCompUSD = new ethers.Contract(Contracts.ChainLinkCompUSD, compAbi["ChainLinkCompUSD"], this.deployer);

        const compPriceData = await chainLinkCompUSD.latestRoundData();
        const currentCompPrice = compPriceData.answer;
        const compRewardProfit_d18 = currentCompReward
            .sub(prevCompReward)
            .mul(currentCompPrice)
            .div(ethers.BigNumber.from(10).pow(8));

        const currentProfit = currentBalance_d18.sub(prevBalance_d18).add(compRewardProfit_d18);
        const profitStr = ethers.utils.formatUnits(currentProfit, 18);
        const balanceStr = ethers.utils.formatUnits(currentBalance_d18, 18);
        const rewardStr = ethers.utils.formatUnits(currentCompReward, 18);
        const priceStr = ethers.utils.formatUnits(currentCompPrice, 8);
        const interval = currentTime - prevTime;
        const apy = interval > 0 && prevBalance_d18.gt(ZERO) ?
            currentProfit.mul(YEAR_MILLIS).mul(ONE_d18).div(interval).div(prevBalance_d18) :
            ZERO;
        const apyStr = ethers.utils.formatUnits(apy, 16);

        compoundResults.push({
            balance: balanceStr,
            compRewardBalance: rewardStr,
            compPrice: priceStr,
            time: currentTime,
            interval,
            profit: profitStr,
            apy: apyStr
        });
        writeFile("compoundResults.json",
            JSON.stringify(compoundResults),
            err => { if (err) { console.log(err) } });

        try {
            const encodedApy = abiCoder.encode(["int256"], [apy]);
            const compoundKeeper = new ethers.Contract(
                compoundKeeperAddress, compoundKeeperAbi, infuraSigner);
            let tx = await compoundKeeper.performUpkeep(encodedApy);
            await tx.wait();
            const compoundKeeper2 = new ethers.Contract(
                COMPOUND_BACKUP, compoundKeeperAbi, infuraSigner);
            tx = await compoundKeeper2.performUpkeep(encodedApy);
            await tx.wait();
            console.log("updated Compound keeper");
        } catch (error) {
            console.log(error);
        }
    });

    it("estimate USDC supply APY, Aave", async function() {
        await ethers.provider.send("hardhat_impersonateAccount", [STRIPS_AAVE_WALLET]);
        const stripsAaveSigner = await ethers.getSigner(STRIPS_AAVE_WALLET);
        const addressProvider = new ethers.Contract(Contracts.AaveLendingPoolAddressesProvider,
            aaveAbi["AaveLendingPoolAddressesProvider"],
            this.deployer);
        const lendingPoolAddress = await addressProvider.getLendingPool();
        const aaveLendingPool = new ethers.Contract(lendingPoolAddress,
            aaveLendingPoolAbi["abi"],
            this.deployer);


        const chainLinkAaveUSD = new ethers.Contract(Contracts.ChainLinkAaveUSD,
            aaveAbi["ChainLinkAaveUSD"],
            this.deployer);

        const aaveIncentivesController = new ethers.Contract(Contracts.AaveIncentivesController,
            aaveAbi["IncentivesController"],
            this.deployer);

        const lastResult = aaveResults.at(-1);
        const prevBalance_d18 = lastResult ? ethers.utils.parseUnits(lastResult.balance, 18) : ZERO;
        const prevAaveRewardBalance_d18 = lastResult ? ethers.utils.parseUnits(lastResult.aaveRewardBalance, 18) : ZERO;
        const prevTime = lastResult ? lastResult.time : 0;

        const usdcBeforeWithdrawal = await this.USDC.balanceOf(STRIPS_AAVE_WALLET);

        const tx = await aaveLendingPool
            .connect(stripsAaveSigner)
            .withdraw(this.USDC.address, ethers.constants.MaxUint256, STRIPS_AAVE_WALLET);
        const currentTime = Date.now();
        await tx.wait();

        const usdcAfterWithdrawal = await this.USDC.balanceOf(STRIPS_AAVE_WALLET);
        const currentBalance = usdcAfterWithdrawal.sub(usdcBeforeWithdrawal);
        const currentBalance_d18 = currentBalance.mul(ethers.BigNumber.from(10).pow(12));

        const currentAaveRewardBalance = await aaveIncentivesController.getRewardsBalance([Contracts.aaveAToken],
            STRIPS_AAVE_WALLET);
        const aavePriceData = await chainLinkAaveUSD.latestRoundData();
        const currentAavePrice = aavePriceData.answer;
        const currentAaveRewardProfit_d18 = (currentAaveRewardBalance.sub(prevAaveRewardBalance_d18))
            .mul(currentAavePrice)
            .div(ethers.BigNumber.from(10).pow(8));
        const currentProfit = (currentBalance_d18.sub(prevBalance_d18)).add(currentAaveRewardProfit_d18);
        const profitStr = ethers.utils.formatUnits(currentProfit, 18);
        const balanceStr = ethers.utils.formatUnits(currentBalance_d18, 18);
        const aaveRewardBalanceStr = ethers.utils.formatUnits(currentAaveRewardBalance, 18);
        const priceStr = ethers.utils.formatUnits(currentAavePrice, 8);
        const interval = currentTime - prevTime;
        const apy = interval > 0 && prevBalance_d18.gt(ZERO) ?
            currentProfit.mul(YEAR_MILLIS).mul(ONE_d18).div(interval).div(prevBalance_d18) :
            ZERO;
        const apyStr = ethers.utils.formatUnits(apy, 16);

        aaveResults.push({
            balance: balanceStr,
            aaveRewardBalance: aaveRewardBalanceStr,
            aavePrice: priceStr,
            time: currentTime,
            interval,
            profit: profitStr,
            apy: apyStr
        });
        writeFile("aaveResults.json",
            JSON.stringify(aaveResults),
            err => { if (err) { console.log(err) } });
        try {
            const encodedApy = abiCoder.encode(["int256"], [apy]);
            const aaveKeeper = new ethers.Contract(
                aaveKeeperAddress, aaveKeeperAbi, infuraSigner);
            let tx = await aaveKeeper.performUpkeep(encodedApy);
            await tx.wait();
            const aaveKeeper2 = new ethers.Contract(
                AAVE_BACKUP, aaveKeeperAbi, infuraSigner);
            tx = await aaveKeeper2.performUpkeep(encodedApy);
            await tx.wait();
            console.log("updated Aave keeper");
        } catch (error) {
            console.log(error);
        }
    });
    it("estimate USDC supply APY, Curve", async function() {
        await ethers.provider.send("hardhat_impersonateAccount", [STRIPS_CURVE_WALLET]);
        const stripsCurveSigner = await ethers.getSigner(STRIPS_CURVE_WALLET);
        const curve3Pool = new ethers.Contract(CURVE_3POOL, curve3PoolAbi, this.deployer);
        const curve3Crv = new ethers.Contract(CURVE_3CRV, curve3CrvAbi, this.deployer);
        const curveZap = new ethers.Contract(CURVE_ZAP, curveZapAbi, this.deployer);

        const lastResult = curveResults.at(-1);
        const prevBalance_d18 = lastResult ? ethers.utils.parseUnits(lastResult.balance, 18) : ZERO;
        const prevCurveReward = lastResult ? ethers.utils.parseUnits(lastResult.curveRewardBalance, 18) : ZERO;

        const prevTime = lastResult ? lastResult.time : 0;

        const usdcBeforeWithdrawal = await this.USDC.balanceOf(STRIPS_CURVE_WALLET);

        const ctokenBalance = await curve3Pool.balanceOf(STRIPS_CURVE_WALLET);
        const withdrawn = await curveZap.callStatic.remove_liquidity(CURVE_3POOL, ctokenBalance, [ZERO, ZERO, ZERO, ZERO]);
        const currentTime = Date.now();

        const usdcAfterWithdrawal = await this.USDC.balanceOf(STRIPS_CURVE_WALLET);
        const currentBalance = usdcAfterWithdrawal.sub(usdcBeforeWithdrawal);
        const currentBalance_d18 = currentBalance.mul(ethers.BigNumber.from(10).pow(12));

        const currentCurveReward = await curve3Crv.balanceOf(STRIPS_CURVE_WALLET);
        const chainLinkCompUSD = new ethers.Contract(Contracts.ChainLinkCompUSD, compAbi["ChainLinkCompUSD"], this.deployer);

        const compPriceData = await chainLinkCompUSD.latestRoundData();
        const currentCompPrice = compPriceData.answer;
        const curveRewardProfit_d18 = currentCurveReward
            .sub(prevCurveReward)
            .mul(currentCompPrice)
            .div(ethers.BigNumber.from(10).pow(8));

        const currentProfit = currentBalance_d18.sub(prevBalance_d18).add(curveRewardProfit_d18);
        const profitStr = ethers.utils.formatUnits(currentProfit, 18);
        const balanceStr = ethers.utils.formatUnits(currentBalance_d18, 18);
        const rewardStr = ethers.utils.formatUnits(currentCurveReward, 18);
        const priceStr = ethers.utils.formatUnits(currentCompPrice, 8);
        const interval = currentTime - prevTime;
        const apy = interval > 0 && prevBalance_d18.gt(ZERO) ?
            currentProfit.mul(YEAR_MILLIS).mul(ONE_d18).div(interval).div(prevBalance_d18) :
            ZERO;
        const apyStr = ethers.utils.formatUnits(apy, 16);

        curveResults.push({
            balance: balanceStr,
            curveRewardBalance: rewardStr,
            compPrice: priceStr,
            time: currentTime,
            interval,
            profit: profitStr,
            apy: apyStr
        });
        writeFile("curveResults.json",
            JSON.stringify(curveResults),
            err => { if (err) { console.log(err) } });

        try {
            const encodedApy = abiCoder.encode(["int256"], [apy]);
            const curveKeeper = new ethers.Contract(
                curveKeeperAddress, curveKeeperAbi, infuraSigner);
            let tx = await curveKeeper.performUpkeep(encodedApy);
            await tx.wait();
            const curveKeeper2 = new ethers.Contract(
                CURVE_BACKUP, curveKeeperAbi, infuraSigner);
            tx = await curveKeeper2.performUpkeep(encodedApy);
            await tx.wait();
            console.log("updated Curve keeper");
        } catch (error) {
            console.log(error);
        }
    });

});

