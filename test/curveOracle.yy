import { ethers } from "hardhat";
import { writeFile } from "fs";
import { Contracts } from "../networks/compoundMainnet.json";
import curveResults from "../curveResults.json";
//import { address as aaveKeeperAddress, abi as aaveKeeperAbi } from '../external/AssetOracle-aave-usdc-lending.json';

const ERC20 = require("../external/erc20.json");

const curve3PoolAbi = require("../external/curve3Pool.json");
const curve3CrvAbi = require("../external/curve3Crv.json");
const curveZapAbi = require("../external/curveZap.json");

const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

const STRIPS_CURVE_WALLET = "0x91f249b52caeb6e751f3a2f68f42ab369980279c";

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

        // try {
        //     const encodedApy = abiCoder.encode(["int256"], [apy]);
        //     const curveKeeper = new ethers.Contract(
        //         curveKeeperAddress, curveKeeperAbi, infuraSigner);
        //     let tx = await curveKeeper.performUpkeep(encodedApy);
        //     await tx.wait();
        //     const curveKeeper2 = new ethers.Contract(
        //         CURVE_BACKUP, curveKeeperAbi, infuraSigner);
        //     tx = await curveKeeper2.performUpkeep(encodedApy);
        //     await tx.wait();
        //     console.log("updated Curve keeper");
        // } catch (error) {
        //     console.log(error);
        // }
    });

});

