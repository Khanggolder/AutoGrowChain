const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    console.log("\n--- Deploying TYTAgriSupplyChain ---");
    const companyId = ethers.encodeBytes32String("AutoGrowChain_Co");
    const SupplyChain = await ethers.getContractFactory("TYTAgriSupplyChain");
    const supplyChain = await SupplyChain.deploy(companyId, deployer.address);
    await supplyChain.waitForDeployment();
    const supplyAddr = await supplyChain.getAddress();
    console.log("TYTAgriSupplyChain deployed to:", supplyAddr);

    console.log("\n--- Deploying TPLContract ---");
    const TPL = await ethers.getContractFactory("TPLContract");
    const tpl = await TPL.deploy();
    await tpl.waitForDeployment();
    const tplAddr = await tpl.getAddress();
    console.log("TPLContract deployed to:", tplAddr);

    console.log("\n--- Deploying FarmNFT ---");
    const FarmNFT = await ethers.getContractFactory("FarmNFT");
    const farmNFT = await FarmNFT.deploy();
    await farmNFT.waitForDeployment();
    const nftAddr = await farmNFT.getAddress();
    console.log("FarmNFT deployed to:", nftAddr);

    console.log("\n==========================================");
    console.log("DEPLOYMENT COMPLETE");
    console.log("==========================================");
    console.log("SUPPLY_CHAIN_ADDRESS=" + supplyAddr);
    console.log("TPL_CONTRACT_ADDRESS=" + tplAddr);
    console.log("FARM_NFT_ADDRESS=" + nftAddr);
    console.log("==========================================");
    console.log("Copy 3 dong tren vao file blockchain_server/.env");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });


