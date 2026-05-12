const express = require('express');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const RPC_URL = "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SUPPLY_CHAIN_ADDRESS = process.env.SUPPLY_CHAIN_ADDRESS || "0xC360ad0e3767A9d05b8a7509b5CFE4113998098D";

if (!PRIVATE_KEY) {
    console.error("PRIVATE_KEY not found. Check .env file.");
    process.exit(1);
}

let provider;
let wallet;
let SUPPLY_CHAIN_ABI;
let supplyChainContract;
let SENDER_ADDRESS;

async function initializeBlockchain() {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        const abiPath = path.join(__dirname, '..', 'blockchain_contracts', 'artifacts', 'contracts', 'TYTAgriSupplyChain.sol', 'TYTAgriSupplyChain.json');

        if (!fs.existsSync(abiPath)) {
            throw new Error(`ABI file not found: ${abiPath}`);
        }

        const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
        SUPPLY_CHAIN_ABI = abiJson.abi;

        const lowerCaseAddress = SUPPLY_CHAIN_ADDRESS.toLowerCase();
        supplyChainContract = new ethers.Contract(lowerCaseAddress, SUPPLY_CHAIN_ABI, wallet);
        SENDER_ADDRESS = wallet.address;

    } catch (error) {
        console.error("Blockchain initialization failed:", error.message);
        process.exit(1);
    }
}

app.post('/api/product/add', async (req, res) => {
    const { productID, name, description } = req.body;
    if (!productID || !name || !description) {
        return res.status(400).json({ error: "Missing: productID, name, or description" });
    }
    try {
        const tx = await supplyChainContract.addProduct(productID, name, description, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        if (receipt.status === 0) {
            throw new Error(`Transaction failed. Hash: ${receipt.hash}`);
        }
        res.status(200).json({
            message: "Product added successfully",
            transactionHash: receipt.hash,
            productID: productID
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to add product", details: error.message });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        let validProducts = [];
        try {
            const productIds = await supplyChainContract.getAllProductIds();
            const detailPromises = productIds.map(async (id) => {
                try {
                    const productInfo = await supplyChainContract.getProductInfo(id);
                    const [productId, name, description, isActive] = productInfo;
                    return { productID: productId, name: name, description: description, isActive: isActive };
                } catch (detailError) {
                    return null;
                }
            });
            const results = await Promise.all(detailPromises);
            validProducts = results.filter(p => p !== null);
        } catch (e) {
            console.warn("Blockchain fetch failed, using dummy data");
        }


        if (validProducts.length === 0) {
            validProducts = [
                { productID: "TOMATO-001", name: "Da Lat Cherry Tomato", description: "Premium organic cherry tomatoes from Lam Dong.", isActive: true },
                { productID: "TOMATO-002", name: "Beefsteak Tomato", description: "Large, meaty tomatoes for salads.", isActive: true },
                { productID: "SALAD-003", name: "Organic Romaine", description: "Fresh greenhouse romaine lettuce.", isActive: true }
            ];
        }

        res.status(200).json({
            total: validProducts.length,
            products: validProducts,
            is_mock: validProducts.length > 0 && (await supplyChainContract.getAllProductIds().catch(() => [])).length === 0
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to get products", details: error.message });
    }
});

app.get('/api/product/:product_id', async (req, res) => {
    const { product_id } = req.params;
    try {
        const productInfo = await supplyChainContract.getProductInfo(product_id);
        const [productId, name, description, isActive] = productInfo;

        if (name === "") {
            return res.status(404).json({ error: `Product not found: ${product_id}` });
        }

        res.status(200).json({
            productID: productId,
            name: name,
            description: description,
            isActive: isActive
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to get product detail", details: error.message });
    }
});

app.post('/api/product/deactivate', async (req, res) => {
    const { productID } = req.body;
    if (!productID) {
        return res.status(400).json({ error: "Missing: productID" });
    }
    try {
        const tx = await supplyChainContract.deactivateProduct(productID, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `Product ${productID} deactivated`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to deactivate product", details: error.message });
    }
});

app.post('/api/product/reactivate', async (req, res) => {
    const { productID } = req.body;
    if (!productID) {
        return res.status(400).json({ error: "Missing: productID" });
    }
    try {
        const tx = await supplyChainContract.reactivateProduct(productID, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `Product ${productID} reactivated`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to reactivate product", details: error.message });
    }
});

app.post('/api/product/update/processes', async (req, res) => {
    const { productID, batch, newProcesses } = req.body;
    if (!productID || !batch || !newProcesses) {
        return res.status(400).json({ error: "Missing: productID, batch, or newProcesses" });
    }
    try {
        const tx = await supplyChainContract.updateProductProcesses(productID, batch, newProcesses, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `Processes updated for batch ${batch} of product ${productID}`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to update processes", details: error.message });
    }
});

app.post('/api/product/update/status', async (req, res) => {
    const { productID, batch, newStatus } = req.body;
    if (!productID || !batch || !newStatus) {
        return res.status(400).json({ error: "Missing: productID, batch, or newStatus" });
    }
    try {
        const tx = await supplyChainContract.updateProductStatus(productID, batch, newStatus, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `Status updated for batch ${batch} of product ${productID}`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to update status", details: error.message });
    }
});

app.get('/api/product/batches/:product_id', async (req, res) => {
    const { product_id } = req.params;
    try {
        let batches = [];
        try {
            batches = await supplyChainContract.getProductBatches(product_id);
        } catch (e) {
            console.warn("Blockchain fetch failed for batches");
        }

        if (batches.length === 0) {
            if (product_id === "TOMATO-001") batches = ["BATCH-2026-05-10", "BATCH-2026-05-08"];
            else if (product_id === "TOMATO-002") batches = ["BATCH-2026-05-05"];
            else batches = ["DEMO-BATCH-001"];
        }

        res.status(200).json({
            productID: product_id,
            totalBatches: batches.length,
            batches: batches
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to get batches", details: error.message });
    }
});

app.get('/api/product/:product_id/batch/:batch_id', async (req, res) => {
    const { product_id, batch_id } = req.params;
    try {
        const batchHistory = await supplyChainContract.getProductByBatch(product_id, batch_id);
        res.status(200).json({
            productID: product_id,
            batchID: batch_id,
            history: batchHistory
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to get batch history", details: error.message });
    }
});

app.get('/api/info/companyid', async (req, res) => {
    try {
        const companyIdBytes = await supplyChainContract.companyId();
        res.status(200).json({ companyId: companyIdBytes });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to get company ID", details: error.message });
    }
});

app.get('/api/info/owner', async (req, res) => {
    try {
        const ownerAddress = await supplyChainContract.companyOwner();
        res.status(200).json({ owner: ownerAddress });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to get owner", details: error.message });
    }
});

app.post('/api/access/add-manager', async (req, res) => {
    const { managerAddress } = req.body;
    if (!managerAddress || !ethers.isAddress(managerAddress)) {
        return res.status(400).json({ error: "Invalid manager address" });
    }
    try {
        const tx = await supplyChainContract.addProductManager(managerAddress, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `${managerAddress} granted PRODUCT_MANAGER_ROLE`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to add manager", details: error.message });
    }
});

const PORT = 3000;

async function startServer() {
    await initializeBlockchain();

    try {
        const network = await provider.getNetwork();

        console.log("==============================================");
        console.log(`Connected to PIONE Zero. Chain ID: ${network.chainId}`);
        console.log(`Sender: ${SENDER_ADDRESS}`);
        console.log(`API running at http://localhost:${PORT}`);
        console.log("==============================================");

        app.listen(PORT, () => {
            console.log(`Supply Chain Server ready on port ${PORT}`);
        });
    } catch (e) {
        console.error("Server start failed:", e.message);
        process.exit(1);
    }
}

startServer();


