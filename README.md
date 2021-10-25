# Mainnet fork 

The aim of the project is to emulate APY calculation for the next protocols/assets.

To launch the repo be sure to create .env file with the next variables:

```shell
export MNEMONIC='mnemonic keywords here'
export MAINNET_PROVIDER_URL='https://eth-mainnet.alchemyapi.io/v2/<KEY>'
```

To build/test the repo launch

```shell
yarn
. .env
npx hardhat test
```