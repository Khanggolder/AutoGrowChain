const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'autogrowchain.db');
const db = new Database(DB_PATH);


db.pragma('journal_mode = WAL');


db.exec(`
    CREATE TABLE IF NOT EXISTS plants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        species TEXT DEFAULT '',
        stage TEXT DEFAULT 'Seedling',
        health TEXT DEFAULT 'Good',
        location TEXT DEFAULT '',
        planted_date TEXT DEFAULT (date('now')),
        last_watered TEXT DEFAULT '',
        last_fertilized TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sensor_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plant_id INTEGER DEFAULT NULL,
        temperature REAL,
        humidity REAL,
        soil_moisture REAL,
        ph REAL,
        light REAL,
        rain REAL,
        distance REAL,
        water_level REAL,
        recorded_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (plant_id) REFERENCES plants(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plant_id INTEGER,
        event TEXT NOT NULL,
        type TEXT DEFAULT 'care',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (plant_id) REFERENCES plants(id)
    );

    CREATE TABLE IF NOT EXISTS harvests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plant_id INTEGER,
        weight_g REAL NOT NULL,
        fruits_count INTEGER DEFAULT 0,
        batch_id TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        harvested_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (plant_id) REFERENCES plants(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        location TEXT DEFAULT '',
        type TEXT DEFAULT 'regular',
        orders_per_month INTEGER DEFAULT 0,
        expected_price REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS water_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plant_id INTEGER DEFAULT NULL,
        amount_ml REAL NOT NULL,
        recorded_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (plant_id) REFERENCES plants(id)
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sensor TEXT NOT NULL,
        condition TEXT NOT NULL,
        threshold REAL NOT NULL,
        action TEXT NOT NULL,
        action_value TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        last_triggered TEXT DEFAULT '',
        trigger_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pest_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        species TEXT NOT NULL,
        confidence REAL,
        repel_hz INTEGER,
        repel_method TEXT DEFAULT 'ultrasonic',
        blockchain_tx TEXT DEFAULT '',
        detected_at TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'repelled'
    );

    CREATE TABLE IF NOT EXISTS nft_owners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plant_id INTEGER UNIQUE NOT NULL,
        wallet_address TEXT NOT NULL,
        renter_name TEXT DEFAULT 'Anonymous',
        tx_hash TEXT DEFAULT '',
        minted_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (plant_id) REFERENCES plants(id)
    );
`);


const ruleCount = db.prepare('SELECT COUNT(*) as cnt FROM automation_rules').get();
if (ruleCount.cnt === 0) {
    const insertRule = db.prepare('INSERT INTO automation_rules (name, sensor, condition, threshold, action, action_value) VALUES (?, ?, ?, ?, ?, ?)');
    insertRule.run('Auto-Water (Low Moisture)', 'humidity', 'less_than', 35, 'water', '150');
    insertRule.run('Stop Water (Rain)', 'rain', 'less_than', 500, 'stop_pump', '');
    insertRule.run('Auto-Harvest (Close Object)', 'distance', 'less_than', 10, 'harvest', '');
    insertRule.run('Pest Alert (Strange Sound)', 'sound', 'equals', 1, 'speaker', '20000');
}


const plantCount = db.prepare('SELECT COUNT(*) as cnt FROM plants').get();
if (plantCount.cnt === 0) {
    console.log('[DB] Seeding initial data...');

    const insertPlant = db.prepare(`INSERT INTO plants (name, species, stage, health, location, planted_date, last_watered, last_fertilized) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertPlant.run('Plant A — Cherry Tomato', 'Solanum lycopersicum var. cerasiforme', 'Fruiting', 'Good', 'Zone A — Row 1', '2026-01-15', '08:00 AM', '3 days ago');
    insertPlant.run('Plant B — Cherry Tomato', 'Solanum lycopersicum var. cerasiforme', 'Fruiting', 'Good', 'Zone A — Row 2', '2026-01-15', '08:00 AM', '3 days ago');
    insertPlant.run('Plant C — Cherry Tomato', 'Solanum lycopersicum var. cerasiforme', 'Flowering', 'Needs Attention', 'Zone B — Row 1', '2026-02-01', '08:15 AM', '5 days ago');


    const insertHarvest = db.prepare(`INSERT INTO harvests (plant_id, weight_g, fruits_count, batch_id, harvested_at) VALUES (?, ?, ?, ?, ?)`);
    insertHarvest.run(1, 35, 6, 'BATCH-007', '2026-04-28 08:00:00');
    insertHarvest.run(1, 40, 7, 'BATCH-006', '2026-04-20 08:00:00');
    insertHarvest.run(1, 45, 8, 'BATCH-005', '2026-04-12 08:00:00');
    insertHarvest.run(1, 50, 9, 'BATCH-004', '2026-04-04 08:00:00');
    insertHarvest.run(1, 80, 15, 'BATCH-003', '2026-03-25 08:00:00');
    insertHarvest.run(2, 30, 5, 'BATCH-006', '2026-04-28 08:00:00');
    insertHarvest.run(2, 38, 7, 'BATCH-005', '2026-04-18 08:00:00');
    insertHarvest.run(2, 42, 8, 'BATCH-004', '2026-04-08 08:00:00');
    insertHarvest.run(2, 55, 10, 'BATCH-003', '2026-03-28 08:00:00');
    insertHarvest.run(2, 65, 10, 'BATCH-002', '2026-03-15 08:00:00');
    insertHarvest.run(3, 15, 3, 'BATCH-003', '2026-04-25 08:00:00');
    insertHarvest.run(3, 20, 4, 'BATCH-002', '2026-04-15 08:00:00');
    insertHarvest.run(3, 28, 5, 'BATCH-001', '2026-04-05 08:00:00');


    const insertActivity = db.prepare(`INSERT INTO activities (plant_id, event, type, created_at) VALUES (?, ?, ?, ?)`);
    insertActivity.run(1, 'Harvested 35g (Batch #7)', 'harvest', '2026-04-28 08:00:00');
    insertActivity.run(1, 'Fertilizer applied: NPK 15-15-15', 'care', '2026-04-25 10:00:00');
    insertActivity.run(1, 'Pest inspection — Clear', 'inspect', '2026-04-22 09:00:00');
    insertActivity.run(1, 'Harvested 40g (Batch #6)', 'harvest', '2026-04-20 08:00:00');
    insertActivity.run(1, 'Pruned lower branches', 'care', '2026-04-15 14:00:00');
    insertActivity.run(2, 'Harvested 30g (Batch #6)', 'harvest', '2026-04-28 08:30:00');
    insertActivity.run(2, 'Watering adjusted — drip rate +10%', 'care', '2026-04-26 07:00:00');
    insertActivity.run(2, 'Health check — All metrics normal', 'inspect', '2026-04-23 09:00:00');
    insertActivity.run(3, 'Low soil moisture detected (35%)', 'alert', '2026-04-29 11:00:00');
    insertActivity.run(3, 'Low Nitrogen — Urea supplement recommended', 'alert', '2026-04-27 10:00:00');
    insertActivity.run(3, 'Harvested 15g (Batch #3)', 'harvest', '2026-04-25 08:00:00');
    insertActivity.run(3, 'Boron foliar spray applied', 'care', '2026-04-22 15:00:00');


    const insertCustomer = db.prepare(`INSERT INTO customers (name, phone, location, type, orders_per_month, expected_price) VALUES (?, ?, ?, ?, ?, ?)`);
    insertCustomer.run('Ba Fruit Wholesale', '090xxxx123', 'Thu Duc Market', 'regular', 12, 51500);
    insertCustomer.run('Xanh Farm Co.', '098xxxx456', 'Tan Binh Industrial', 'regular', 8, 49000);
    insertCustomer.run('Mr. Minh (Individual)', '093xxxx555', 'District 7', 'regular', 5, 50000);
    insertCustomer.run('Golden Spoon Restaurant', '091xxxx789', 'District 1', 'regular', 4, 55000);
    insertCustomer.run('Fresh Food Co.', '088xxxx111', 'Binh Thanh', 'potential', 0, 50000);
    insertCustomer.run('ABC Restaurant Chain', '097xxxx222', 'District 1, 3', 'potential', 0, 52000);


    const insertExpense = db.prepare(`INSERT INTO expenses (category, amount, description, created_at) VALUES (?, ?, ?, ?)`);
    insertExpense.run('fertilizer', 150000, 'NPK 15-15-15 (2kg)', '2026-04-01 08:00:00');
    insertExpense.run('pesticide', 80000, 'Neem Oil (500ml)', '2026-04-05 08:00:00');
    insertExpense.run('water', 50000, 'Water bill April', '2026-04-30 08:00:00');
    insertExpense.run('equipment', 200000, 'Drip irrigation tubes', '2026-04-10 08:00:00');
    insertExpense.run('seed', 120000, 'Cherry tomato seeds (50pc)', '2026-03-01 08:00:00');


    const insertWater = db.prepare(`INSERT INTO water_usage (plant_id, amount_ml, recorded_at) VALUES (?, ?, ?)`);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const baseDate = new Date('2026-04-28');
    for (let d = 0; d < 7; d++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - (6 - d));
        const dateStr = date.toISOString().split('T')[0];
        insertWater.run(1, 40 + Math.floor(Math.random() * 30), `${dateStr} 08:00:00`);
        insertWater.run(2, 35 + Math.floor(Math.random() * 30), `${dateStr} 08:00:00`);
        insertWater.run(3, 30 + Math.floor(Math.random() * 25), `${dateStr} 08:00:00`);
    }

    console.log('[DB] Seed data inserted successfully!');
}

console.log(`[DB] SQLite ready: ${DB_PATH}`);

module.exports = db;


