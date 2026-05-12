const http = require('http');

const ESP32_IP = process.env.ESP32_IP || "192.168.4.1";
const ESP32_PORT = 80;
const TPL_SERVER = process.env.TPL_SERVER || "http://localhost:3005";
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS) || 30000;

function fetchESP32Sensors() {
    return new Promise((resolve, reject) => {
        const url = `http://${ESP32_IP}:${ESP32_PORT}/api/sensors`;
        http.get(url, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error("Invalid JSON from ESP32"));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function pushToBlockchain(sensorData) {
    const payload = JSON.stringify({
        data: JSON.stringify({
            timestamp: new Date().toISOString(),
            humidity: sensorData.humidity,
            waterLevel: sensorData.waterLevel,
            rain: sensorData.rain,
            ph: sensorData.ph,
            distance: sensorData.distance
        })
    });

    return new Promise((resolve, reject) => {
        const url = new URL(`${TPL_SERVER}/api/iot/add`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 30000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error("Invalid JSON from TPL Server"));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(payload);
        req.end();
    });
}

async function runCycle() {
    const now = new Date().toLocaleString('vi-VN');
    console.log(`\n[${now}] --- Bat dau chu ky ---`);

    try {
        console.log(`  1. Doc sensor tu ESP32 (${ESP32_IP})...`);
        const sensors = await fetchESP32Sensors();
        console.log(`     pH=${sensors.ph} | Humidity=${sensors.humidity}% | Water=${sensors.waterLevel}% | Rain=${sensors.rain} | Distance=${sensors.distance}cm`);

        console.log(`  2. Gui len Blockchain qua TPL Server...`);
        const result = await pushToBlockchain(sensors);

        if (result.transactionHash) {
            console.log(`  ✅ Thanh cong! TX: ${result.transactionHash}`);
        } else if (result.error) {
            console.log(`  ❌ Loi blockchain: ${result.error}`);
        }
    } catch (error) {
        console.log(`  ❌ Loi: ${error.message}`);
    }

    console.log(`  Cho ${INTERVAL_MS / 1000} giay cho chu ky tiep theo...`);
}

console.log("==========================================");
console.log("  AutoGrowChain Automation Scheduler");
console.log("==========================================");
console.log(`  ESP32: ${ESP32_IP}:${ESP32_PORT}`);
console.log(`  TPL Server: ${TPL_SERVER}`);
console.log(`  Interval: ${INTERVAL_MS / 1000}s`);
console.log("==========================================");

runCycle();
setInterval(runCycle, INTERVAL_MS);


