import { ethers as hhethers } from "hardhat";
import { ethers } from "ethers";
import { execWithRetries } from "../test/resubmit";

// const abiCoder = ethers.utils.defaultAbiCoder;

describe("Compound APY", function() {

  // const KEEPER = "0x2dB1B9ffD13420ABdcA68e0270D02339B746eFf0";
  const KEEPER = "0x3D433889a8d06E2330EedeE847612e878423eAE7";
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  it("estimate USDC supply APY, Compound", async function() {
    const iface = new ethers.utils.Interface(["function performUpkeep(int256)"])
    console.log("xxxxxxxx");
    let deployer: ethers.Signer;
    [deployer] = await hhethers.getSigners();
    console.log("yyyyyyyy");
    // const keeperFactory = await hhethers.getContractFactory("Keeper");
    // const keeper = await keeperFactory.deploy();
    // await keeper.deployed();
    // let apy = 1;
    let keeper = new ethers.Contract(KEEPER, iface, deployer);
    // handleUpkeepEventSubscription(keeper);
    try {
      const retries = [120000, 120000, 120000, 120000]
      // const encodedApy = abiCoder.encode(["int256"], [apy]);
      let updateDone = false;
      const updateKeeper = async () => {
        if (!updateDone) {
          let tx: ethers.providers.TransactionResponse[] = [];
          let pr: Promise<ethers.providers.TransactionResponse>[] = [];
          const numTxs = 4;
          for (let i = 0; i < numTxs; i++) {
            const txData = iface.encodeFunctionData("performUpkeep", [i])
            pr[i] = deployer.sendTransaction({
              to: keeper.address,
              data: txData,
            })
          }
          for (let i = 0; i < numTxs; i++) {
            tx[i] = await pr[i];
            console.log("nonce, block hash ", i, " before: ", tx[i].nonce, tx[i].blockHash, tx[i].confirmations);
          }
          await tx[numTxs - 1].wait();
          for (let i = 0; i < numTxs; i++) {
            console.log("nonce, block hash ", i, "after: ", tx[i].nonce, tx[i].blockHash, tx[i].confirmations);
          }
          await delay(300000);
          for (let i = 0; i < numTxs; i++) {
            console.log("nonce, block hash ", i, "delay: ", tx[i].nonce, tx[i].blockHash, tx[i].confirmations);
          }
          updateDone = true;
          console.log("updated Compound keeper");
        }
        return true;
      }
      await execWithRetries(updateKeeper, retries);
    } catch (error) {
      console.log(error);
    }
  });

  async function upkeepEventListener(value: any) {
    console.log(`upkeep event ${value}`);
  }

  function handleUpkeepEventSubscription(contract: ethers.Contract) {
    contract.on("Upkept", upkeepEventListener);
  }

});
