import { ethers } from "hardhat";
import { writeFile } from "fs";
import { execWithRetries } from "../test/resubmit";
import { Contracts } from "../networks/compoundMainnet.json";
import compoundResults from "../compoundResults.json";
import { address as compoundKeeperAddress, abi as compoundKeeperAbi } from '../external/AssetOracle-compound-usdc-lending.json';

const compAbi = require("../external/compound.json");
const ERC20 = require("../external/erc20.json");
const comptrollerAbi = require('../external/comptroller.json');

const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

const STRIPS_COMPOUND_WALLET = "0xD7CFA9A98e0BDFDAcB5D7e07FBe9E528F057984D";

const COMPOUND_BACKUP = "0x80C150F2714b5bb7035f0C5428Ee06c0b5C70C88";

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

    it("estimate USDC supply APY, Compound", async function() {
        // let deployer;
        // [deployer] = await ethers.getSigners();
        // const USDC = new ethers.Contract(USDC_MAINNET, ERC20, deployer);
        // await ethers.provider.send("hardhat_impersonateAccount", [STRIPS_COMPOUND_WALLET]);
        // const stripsCompoundSigner = await ethers.getSigner(STRIPS_COMPOUND_WALLET);
        // const cUSDC = new ethers.Contract(Contracts.cUSDC, compAbi["cErc20Delegate"], deployer);
        // const compContract = new ethers.Contract(Contracts.COMP, compAbi["COMP"], deployer);
        // const ComptrollerContract = new ethers.Contract(Contracts.Comptroller, comptrollerAbi, deployer);

        // const lastResult = compoundResults.at(-1);
        // const prevBalance_d18 = lastResult ? ethers.utils.parseUnits(lastResult.balance, 18) : ZERO;
        // const prevCompReward = lastResult ? ethers.utils.parseUnits(lastResult.compRewardBalance, 18) : ZERO;

        // const prevTime = lastResult ? lastResult.time : 0;

        // const usdcBeforeWithdrawal = await USDC.balanceOf(STRIPS_COMPOUND_WALLET);

        // let tx = await ComptrollerContract
        //     .connect(stripsCompoundSigner)
        //     .claimComp(STRIPS_COMPOUND_WALLET, [cUSDC.address]);
        // const ctokenBalance = await cUSDC.balanceOf(STRIPS_COMPOUND_WALLET);
        // tx = await cUSDC.connect(stripsCompoundSigner).redeem(ctokenBalance);
        // const currentTime = Date.now();
        // await tx.wait();

        // const usdcAfterWithdrawal = await USDC.balanceOf(STRIPS_COMPOUND_WALLET);
        // const currentBalance = usdcAfterWithdrawal.sub(usdcBeforeWithdrawal);
        // const currentBalance_d18 = currentBalance.mul(ethers.BigNumber.from(10).pow(12));

        // const currentCompReward = await compContract.balanceOf(STRIPS_COMPOUND_WALLET);
        // const chainLinkCompUSD = new ethers.Contract(Contracts.ChainLinkCompUSD, compAbi["ChainLinkCompUSD"], deployer);

        // const compPriceData = await chainLinkCompUSD.latestRoundData();
        // const currentCompPrice = compPriceData.answer;
        // const compRewardProfit_d18 = currentCompReward
        //     .sub(prevCompReward)
        //     .mul(currentCompPrice)
        //     .div(ethers.BigNumber.from(10).pow(8));

        // const currentProfit = currentBalance_d18.sub(prevBalance_d18).add(compRewardProfit_d18);
        // const profitStr = ethers.utils.formatUnits(currentProfit, 18);
        // const balanceStr = ethers.utils.formatUnits(currentBalance_d18, 18);
        // const rewardStr = ethers.utils.formatUnits(currentCompReward, 18);
        // const priceStr = ethers.utils.formatUnits(currentCompPrice, 8);
        // const interval = currentTime - prevTime;
        // const apy = interval > 0 && prevBalance_d18.gt(ZERO) ?
        //     currentProfit.mul(YEAR_MILLIS).mul(ONE_d18).div(interval).div(prevBalance_d18) :
        //     ZERO;
        // const apyStr = ethers.utils.formatUnits(apy, 16);

        // compoundResults.push({
        //     balance: balanceStr,
        //     compRewardBalance: rewardStr,
        //     compPrice: priceStr,
        //     time: currentTime,
        //     interval,
        //     profit: profitStr,
        //     apy: apyStr
        // });
        // writeFile("compoundResults.json",
        //     JSON.stringify(compoundResults),
        //     err => { if (err) { console.log(err) } });
        let apy = 1;
        try {
            const retries = [120000, 120000, 120000, 120000]
            // const retries = [1200, 1200, 1200, 1200]
            const encodedApy = abiCoder.encode(["int256"], [apy]);
            const compoundKeeper = new ethers.Contract(
                compoundKeeperAddress, compoundKeeperAbi, infuraSigner);
            let updateDone = false;
            const updateKeeper = async () => {
                if (!updateDone) {
                    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
                    await delay(100);
                    // let tx = await compoundKeeper.performUpkeep(encodedApy);
                    // await tx.wait();
                    updateDone = true;
                    console.log("updated Compound keeper");
                }
                return true;
            }
            await execWithRetries(updateKeeper, retries);
            const compoundKeeper2 = new ethers.Contract(
                COMPOUND_BACKUP, compoundKeeperAbi, infuraSigner);
            let update2Done = false;
            const updateKeeper2 = async () => {
                if (!update2Done) {
                    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
                    await delay(10000);
                    // tx = await compoundKeeper2.performUpkeep(encodedApy);
                    // await tx.wait();
                    update2Done = true;
                    console.log("updated Compound keeper2");
                }
                return true;
            }
            await execWithRetries(updateKeeper2, retries);
        } catch (error) {
            console.log(error);
        }
    });

});

