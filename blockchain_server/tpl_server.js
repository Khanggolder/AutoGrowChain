const express = require('express');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const RPC_URL = "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TPL_CONTRACT_ADDRESS = process.env.TPL_CONTRACT_ADDRESS || "0xC5d39765e4DfdDe40dbe3B785D27548567F1e2b2";
const CONTRACT_NAME = "TPLContract";
const CONTRACT_FILE_NAME = "TPLContract.sol";

if (!PRIVATE_KEY) {
    console.error("PRIVATE_KEY not found. Check .env file.");
    process.exit(1);
}

let provider;
let wallet;
let tplContract;
let SENDER_ADDRESS;

async function initializeBlockchain() {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        const abiPath = path.join(__dirname, '..', 'blockchain_contracts', 'artifacts', 'contracts', CONTRACT_FILE_NAME, `${CONTRACT_NAME}.json`);

        if (!fs.existsSync(abiPath)) {
            throw new Error(`ABI file not found: ${abiPath}. Run 'npx hardhat compile' first.`);
        }

        const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
        tplContract = new ethers.Contract(TPL_CONTRACT_ADDRESS, abiJson.abi, wallet);
        SENDER_ADDRESS = wallet.address;

    } catch (error) {
        console.error("Blockchain initialization failed:", error.message);
        process.exit(1);
    }
}

async function handleTransaction(res, contractFunction, dataArg, successMessage) {
    try {
        const tx = await contractFunction(dataArg, { gasLimit: 2000000 });
        const receipt = await tx.wait();

        res.status(200).json({
            message: successMessage,
            transactionHash: receipt.hash,
            sender: SENDER_ADDRESS,
            inputDataLen: dataArg.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`Transaction error: ${error.message}`);
        res.status(500).json({
            error: "Blockchain transaction failed",
            details: error.message
        });
    }
}

async function handleGetData(res, contractFunction, index) {
    try {
        const result = await contractFunction(index);

        res.status(200).json({
            data: result[0],
            timestamp: Number(result[1]),
            sender: result[2]
        });
    } catch (error) {
        console.error(`Get data error (Index: ${index}): ${error.message}`);
        res.status(500).json({
            error: "Failed to get data (check if index exists)",
            details: error.message
        });
    }
}

app.post('/api/contributions/add', (req, res) => {
    const { cid } = req.body;
    if (!cid) return res.status(400).json({ error: "Missing: cid" });
    handleTransaction(res, tplContract.submitContribution, cid, "Contribution added");
});

app.get('/api/contributions/:index', (req, res) => {
    handleGetData(res, tplContract.getContribution, req.params.index);
});

app.post('/api/iot/add', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Missing: data" });
    handleTransaction(res, tplContract.addIoTData, data, "IoT data added");
});

app.get('/api/iot/:index', (req, res) => {
    handleGetData(res, tplContract.getIoTData, req.params.index);
});

app.post('/api/collection/add', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Missing: data" });
    handleTransaction(res, tplContract.addCollectionData, data, "Collection data added");
});

app.get('/api/collection/:index', (req, res) => {
    handleGetData(res, tplContract.getCollectionData, req.params.index);
});

app.post('/api/backup/add', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Missing: data" });
    handleTransaction(res, tplContract.addBackupData, data, "Backup data added");
});

app.get('/api/backup/:index', (req, res) => {
    handleGetData(res, tplContract.getBackupData, req.params.index);
});

app.post('/api/primary/add', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Missing: data" });
    handleTransaction(res, tplContract.addPrimaryData, data, "Primary data added");
});

app.get('/api/primary/:index', (req, res) => {
    handleGetData(res, tplContract.getPrimaryData, req.params.index);
});

app.get('/api/counts', async (req, res) => {
    try {
        const counts = await tplContract.getDataCounts();
        res.status(200).json({
            contributions: Number(counts.contrib),
            iotData: Number(counts.iot),
            collectionData: Number(counts.col),
            backupData: Number(counts.back),
            primaryData: Number(counts.pri)
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).json({ error: "Failed to get counts", details: error.message });
    }
});

const PORT = 3005;

async function seedDemoData() {
    try {
        const counts = await tplContract.getDataCounts();
        
        if (Number(counts.iot) === 0) {
            console.log("[Seeding] Adding demo IoT records...");
            await tplContract.addIoTData("System Check: All sensors operational - Status OK", { gasLimit: 500000 });
            await tplContract.addIoTData("Environmental Log: Temp 28.5C, Hum 65% - Optimal", { gasLimit: 500000 });
            await tplContract.addIoTData("Sensors Sync: ESP32-CAM (0x8F) handshake successful", { gasLimit: 500000 });
        }
        
        if (Number(counts.contrib) === 0) {
            console.log("[Seeding] Adding demo Contribution records...");
            await tplContract.submitContribution("QmXoypizjW3Wkn2Zpux2nZCyf3nN6H7c6F6A6X6H7c6F6A", { gasLimit: 500000 });
            await tplContract.submitContribution("QmUNLLsP6n3u5UD2sdE7EYLxUPbbGcyrzXyzduuY8mS4C2", { gasLimit: 500000 });
        }

        if (Number(counts.col) === 0) {
            console.log("[Seeding] Adding demo Collection records...");
            await tplContract.addCollectionData("Harvest Batch #102: 15kg Cherry Tomatoes - Grade A", { gasLimit: 500000 });
            await tplContract.addCollectionData("Pest Alert: Rodent detected in Zone A (Thermal Vision)", { gasLimit: 500000 });
            await tplContract.addCollectionData("Audio Logic: Repellent frequency 22kHz triggered (Achetadomesticus)", { gasLimit: 500000 });
        }

        if (Number(counts.back) === 0) {
            console.log("[Seeding] Adding demo Backup records...");
            await tplContract.addBackupData("Daily DB Snapshot: b7a9e1d2c3f4e5a6b7c8d9e0f1a2b3c4", { gasLimit: 500000 });
            await tplContract.addBackupData("System State Backup: 550e8400-e29b-41d4-a716-446655440000", { gasLimit: 500000 });
        }

        if (Number(counts.pri) === 0) {
            console.log("[Seeding] Adding demo Primary records...");
            await tplContract.addPrimaryData("CORE_INIT: AutoGrowChain System v2.0.0 Online", { gasLimit: 500000 });
            await tplContract.addPrimaryData("SECURITY_POLICY: Immutable logs enabled via TPLContract", { gasLimit: 500000 });
        }
    } catch (e) {
        console.warn("[Seeding] Failed or already seeded:", e.message);
    }
}

async function startServer() {
    await initializeBlockchain();
    await seedDemoData();

    try {
        const network = await provider.getNetwork();

        console.log("==============================================");
        console.log(`TPL Server ready on port ${PORT}`);
        console.log(`Chain: PIONE Zero (ID: ${network.chainId})`);
        console.log(`Sender: ${SENDER_ADDRESS}`);
        console.log("==============================================");
        console.log("API Endpoints:");
        console.log(" 1. Contribution: POST /api/contributions/add | GET /api/contributions/:index");
        console.log(" 2. IoT Data:     POST /api/iot/add           | GET /api/iot/:index");
        console.log(" 3. Collection:   POST /api/collection/add    | GET /api/collection/:index");
        console.log(" 4. Backup Data:  POST /api/backup/add        | GET /api/backup/:index");
        console.log(" 5. Primary Data: POST /api/primary/add       | GET /api/primary/:index");
        console.log(" 6. Counts:       GET  /api/counts");
        console.log("==============================================");

        app.listen(PORT, () => {
            console.log(`Listening at http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error("Server start failed:", e.message);
        process.exit(1);
    }
}

startServer();


