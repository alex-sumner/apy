async function main() {
    const [deployer] = await ethers.getSigners();
    const addrs = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const keeperFactory = await ethers.getContractFactory("Keeper")
    const keeper = await keeperFactory.deploy()


    console.log("Keeper address:", keeper.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
