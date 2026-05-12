const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const http = require('http');

function pushActivityToBlockchain(plantId, event, type) {
    const payload = JSON.stringify({
        data: JSON.stringify({
            timestamp: new Date().toISOString(),
            plant_id: plantId,
            event: event,
            type: type
        })
    });

    const options = {
        hostname: 'localhost',
        port: 3005,
        path: '/api/collection/add',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.transactionHash) {
                    console.log(`[Blockchain] Logged activity: ${event} -> TX: ${json.transactionHash}`);
                }
            } catch (e) { }
        });
    });
    req.on('error', (err) => console.log(`[Blockchain Error] ${err.message}`));
    req.write(payload);
    req.end();
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/plants', (req, res) => {
    const plants = db.prepare('SELECT * FROM plants ORDER BY id').all();
    const harvestStats = db.prepare(`
        SELECT plant_id, 
            COALESCE(SUM(weight_g), 0) as total_yield,
            COALESCE(SUM(fruits_count), 0) as total_fruits,
            COUNT(*) as harvest_count
        FROM harvests GROUP BY plant_id
    `).all();
    const statsMap = {};
    harvestStats.forEach(s => statsMap[s.plant_id] = s);

    const result = plants.map(p => ({
        ...p,
        total_yield: statsMap[p.id]?.total_yield || 0,
        total_fruits: statsMap[p.id]?.total_fruits || 0,
        harvest_count: statsMap[p.id]?.harvest_count || 0,
        avg_weight: statsMap[p.id]?.total_fruits > 0
            ? (statsMap[p.id].total_yield / statsMap[p.id].total_fruits).toFixed(1)
            : 0
    }));
    res.json(result);
});

app.get('/api/plants/:id', (req, res) => {
    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(req.params.id);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });

    const harvests = db.prepare('SELECT * FROM harvests WHERE plant_id = ? ORDER BY harvested_at DESC').all(req.params.id);
    const activities = db.prepare('SELECT * FROM activities WHERE plant_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
    const totalYield = harvests.reduce((s, h) => s + h.weight_g, 0);
    const totalFruits = harvests.reduce((s, h) => s + h.fruits_count, 0);

    res.json({
        ...plant,
        harvests, activities,
        total_yield: totalYield,
        total_fruits: totalFruits,
        avg_weight: totalFruits > 0 ? (totalYield / totalFruits).toFixed(1) : 0
    });
});

app.put('/api/plants/:id', (req, res) => {
    const { stage, health, last_watered, last_fertilized } = req.body;
    const updates = [];
    const params = [];
    if (stage) { updates.push('stage = ?'); params.push(stage); }
    if (health) { updates.push('health = ?'); params.push(health); }
    if (last_watered) { updates.push('last_watered = ?'); params.push(last_watered); }
    if (last_fertilized) { updates.push('last_fertilized = ?'); params.push(last_fertilized); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE plants SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
});

app.post('/api/sensors/log', (req, res) => {
    const { plant_id, temperature, humidity, soil_moisture, ph, light, rain, distance, water_level } = req.body;
    db.prepare(`INSERT INTO sensor_history (plant_id, temperature, humidity, soil_moisture, ph, light, rain, distance, water_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(plant_id || null, temperature, humidity, soil_moisture, ph, light, rain, distance, water_level);
    res.json({ success: true });
});

app.get('/api/sensors/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const plant_id = req.query.plant_id;
    let query = 'SELECT * FROM sensor_history';
    const params = [];
    if (plant_id) { query += ' WHERE plant_id = ?'; params.push(plant_id); }
    query += ' ORDER BY recorded_at DESC LIMIT ?';
    params.push(limit);
    res.json(db.prepare(query).all(...params));
});

app.post('/api/activities', (req, res) => {
    const { plant_id, event, type } = req.body;
    if (!event) return res.status(400).json({ error: 'Event is required' });
    db.prepare('INSERT INTO activities (plant_id, event, type) VALUES (?, ?, ?)')
        .run(plant_id, event, type || 'care');
    pushActivityToBlockchain(plant_id, event, type || 'care');
    res.json({ success: true });
});

app.get('/api/activities', (req, res) => {
    const plant_id = req.query.plant_id;
    const limit = parseInt(req.query.limit) || 50;
    let query = 'SELECT a.*, p.name as plant_name FROM activities a LEFT JOIN plants p ON a.plant_id = p.id';
    const params = [];
    if (plant_id) { query += ' WHERE a.plant_id = ?'; params.push(plant_id); }
    query += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(limit);
    res.json(db.prepare(query).all(...params));
});

app.post('/api/harvests', (req, res) => {
    const { plant_id, weight_g, fruits_count, batch_id, notes } = req.body;
    if (!plant_id || !weight_g) return res.status(400).json({ error: 'plant_id and weight_g required' });
    db.prepare('INSERT INTO harvests (plant_id, weight_g, fruits_count, batch_id, notes) VALUES (?, ?, ?, ?, ?)')
        .run(plant_id, weight_g, fruits_count || 0, batch_id || '', notes || '');
    const eventMsg = `Harvested ${weight_g}g (${batch_id || 'manual'})`;
    db.prepare('INSERT INTO activities (plant_id, event, type) VALUES (?, ?, ?)')
        .run(plant_id, eventMsg, 'harvest');
    pushActivityToBlockchain(plant_id, eventMsg, 'harvest');
    res.json({ success: true });
});

app.get('/api/harvests', (req, res) => {
    const plant_id = req.query.plant_id;
    let query = 'SELECT h.*, p.name as plant_name FROM harvests h LEFT JOIN plants p ON h.plant_id = p.id';
    const params = [];
    if (plant_id) { query += ' WHERE h.plant_id = ?'; params.push(plant_id); }
    query += ' ORDER BY h.harvested_at DESC';
    res.json(db.prepare(query).all(...params));
});

app.post('/api/water', (req, res) => {
    const { plant_id, amount_ml } = req.body;
    if (!amount_ml) return res.status(400).json({ error: 'amount_ml required' });
    db.prepare('INSERT INTO water_usage (plant_id, amount_ml) VALUES (?, ?)').run(plant_id || null, amount_ml);
    res.json({ success: true });
});

app.get('/api/water/weekly', (req, res) => {
    const rows = db.prepare(`
        SELECT strftime('%w', recorded_at) as day_num,
            CASE strftime('%w', recorded_at)
                WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue'
                WHEN '3' THEN 'Wed' WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri' WHEN '6' THEN 'Sat'
            END as day_name,
            COALESCE(SUM(amount_ml), 0) as total_ml
        FROM water_usage
        WHERE recorded_at >= date('now', '-7 days')
        GROUP BY day_num ORDER BY day_num
    `).all();
    res.json(rows);
});

app.post('/api/actions/quick', (req, res) => {
    const { plant_id, action, amount } = req.body;
    if (!plant_id || !action) return res.status(400).json({ error: 'plant_id and action required' });

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let event = '';
    let type = 'care';

    switch (action) {
        case 'water':
            event = `Watered ${amount || 100}ml`;
            db.prepare('INSERT INTO water_usage (plant_id, amount_ml) VALUES (?, ?)').run(plant_id, amount || 100);
            db.prepare('UPDATE plants SET last_watered = ? WHERE id = ?').run(now, plant_id);
            break;
        case 'fertilize':
            event = `Fertilizer applied: ${amount || 10}g NPK`;
            db.prepare('UPDATE plants SET last_fertilized = ? WHERE id = ?').run(now, plant_id);
            break;
        case 'refill':
            event = `Water tank refilled to 100%`;
            break;
        case 'inspect':
            event = `Manual inspection completed`;
            type = 'inspect';
            break;
        case 'prune':
            event = `Pruned dead/damaged branches`;
            break;
        case 'harvest':
            event = `Automated Robot Harvest: 5 ripe fruits (~150g)`;
            type = 'harvest';
            db.prepare('UPDATE plants SET total_yield = total_yield + 150, total_fruits = total_fruits + 5 WHERE id = ?').run(plant_id);
            break;
        case 'pesticide':
            event = `Pesticide applied: ${amount || 'standard dose'}`;
            break;
        default:
            event = `Action: ${action}`;
    }

    db.prepare('INSERT INTO activities (plant_id, event, type) VALUES (?, ?, ?)')
        .run(plant_id, event, type);
    pushActivityToBlockchain(plant_id, event, type);
    res.json({ success: true, event, timestamp: now });
});

app.get('/api/notifications', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const rows = db.prepare(`
        SELECT a.*, p.name as plant_name
        FROM activities a
        LEFT JOIN plants p ON a.plant_id = p.id
        ORDER BY a.created_at DESC
        LIMIT ?
    `).all(limit);
    res.json(rows);
});

app.post('/api/expenses', (req, res) => {
    const { category, amount, description } = req.body;
    if (!category || !amount) return res.status(400).json({ error: 'category and amount required' });
    db.prepare('INSERT INTO expenses (category, amount, description) VALUES (?, ?, ?)').run(category, amount, description || '');
    res.json({ success: true });
});

app.get('/api/expenses', (req, res) => {
    res.json(db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all());
});

app.post('/api/customers', (req, res) => {
    const { name, phone, location, type, orders_per_month, expected_price } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    db.prepare('INSERT INTO customers (name, phone, location, type, orders_per_month, expected_price) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, phone || '', location || '', type || 'regular', orders_per_month || 0, expected_price || 0);
    res.json({ success: true });
});

app.get('/api/customers', (req, res) => {
    const type = req.query.type;
    let query = 'SELECT * FROM customers';
    const params = [];
    if (type) { query += ' WHERE type = ?'; params.push(type); }
    query += ' ORDER BY orders_per_month DESC';
    res.json(db.prepare(query).all(...params));
});

app.get('/api/analytics/summary', (req, res) => {
    const totalYield = db.prepare('SELECT COALESCE(SUM(weight_g), 0) as total FROM harvests').get();
    const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get();
    const avgPrice = db.prepare('SELECT COALESCE(AVG(expected_price), 50000) as avg FROM customers WHERE type = ?').get('regular');
    const activePlants = db.prepare('SELECT COUNT(*) as cnt FROM plants WHERE is_active = 1').get();
    const regularCustomers = db.prepare('SELECT COUNT(*) as cnt FROM customers WHERE type = ?').get('regular');
    const totalRevenue = (totalYield.total / 1000) * avgPrice.avg;

    const monthlyHarvests = db.prepare(`
        SELECT strftime('%Y-%m', harvested_at) as month,
            SUM(weight_g) as total_g, SUM(fruits_count) as fruits
        FROM harvests GROUP BY month ORDER BY month DESC LIMIT 6
    `).all();

    const weeklyHarvests = db.prepare(`
        SELECT strftime('%W', harvested_at) as week,
            SUM(weight_g) as total_g
        FROM harvests GROUP BY week ORDER BY week DESC LIMIT 8
    `).all();

    const healthSummary = db.prepare(`
        SELECT health, COUNT(*) as cnt FROM plants WHERE is_active = 1 GROUP BY health
    `).all();

    res.json({
        total_yield_g: totalYield.total,
        total_yield_kg: (totalYield.total / 1000).toFixed(2),
        total_expenses: totalExpenses.total,
        avg_market_price: avgPrice.avg,
        estimated_revenue: Math.round(totalRevenue),
        active_plants: activePlants.cnt,
        regular_customers: regularCustomers.cnt,
        monthly_harvests: monthlyHarvests,
        weekly_harvests: weeklyHarvests,
        health_summary: healthSummary
    });
});

app.get('/api/farm-zones', (req, res) => {
    const plants = db.prepare('SELECT * FROM plants WHERE is_active = 1').all();
    const latestSensor = db.prepare('SELECT * FROM sensor_history ORDER BY recorded_at DESC LIMIT 1').get();
    const recentAlerts = db.prepare(`SELECT * FROM activities WHERE type = 'alert' ORDER BY created_at DESC LIMIT 10`).all();

    const zones = [
        { id: 'A', name: 'Zone A — Main Growing', x: 10, y: 10, w: 35, h: 40, plants: [], status: 'healthy', alerts: [] },
        { id: 'B', name: 'Zone B — Seedling Nursery', x: 55, y: 10, w: 35, h: 25, plants: [], status: 'healthy', alerts: [] },
        { id: 'C', name: 'Zone C — Harvest Ready', x: 55, y: 45, w: 35, h: 25, plants: [], status: 'healthy', alerts: [] },
        { id: 'D', name: 'Zone D — Expansion Area', x: 10, y: 60, w: 35, h: 30, plants: [], status: 'inactive', alerts: [] },
        { id: 'E', name: 'Zone E — Equipment / Storage', x: 55, y: 80, w: 35, h: 12, plants: [], status: 'healthy', alerts: [] },
    ];

    const zoneLetters = ['A', 'B', 'C', 'D', 'E'];
    plants.forEach((p, i) => {
        const zIdx = i % zoneLetters.length;
        zones[zIdx].plants.push({ id: p.id, name: p.name, health: p.health, stage: p.stage });
        if (p.health === 'Critical') zones[zIdx].status = 'critical';
        else if (p.health === 'Needs Attention' && zones[zIdx].status !== 'critical') zones[zIdx].status = 'attention';
    });

    if (latestSensor) {
        if (latestSensor.humidity !== null && latestSensor.humidity < 25) {
            zones[0].status = 'attention';
            zones[0].alerts.push('Low soil moisture detected');
        }
        if (latestSensor.ph !== null && (latestSensor.ph < 5.5 || latestSensor.ph > 7.5)) {
            zones[0].alerts.push('pH level outside optimal range');
        }
    }

    recentAlerts.forEach(a => {
        if (a.event.includes('Zone A') || a.event.includes('humidity')) zones[0].alerts.push(a.event);
        else if (a.event.includes('Zone B')) zones[1].alerts.push(a.event);
    });

    const thermalStatus = {
        mode: new Date().getHours() >= 18 || new Date().getHours() < 6 ? 'night_active' : 'day_standby',
        last_scan: new Date().toISOString(),
        rodent_detections_24h: recentAlerts.filter(a => a.event.toLowerCase().includes('rodent') || a.event.toLowerCase().includes('animal')).length,
        equipment_alerts: recentAlerts.filter(a => a.event.toLowerCase().includes('overheat') || a.event.toLowerCase().includes('malfunction')).length
    };

    res.json({ zones, thermal_camera: thermalStatus, sensor_snapshot: latestSensor || null });
});

app.get('/api/rules', (req, res) => {
    res.json(db.prepare('SELECT * FROM automation_rules ORDER BY id').all());
});

app.post('/api/rules', (req, res) => {
    const { name, sensor, condition, threshold, action, action_value } = req.body;
    if (!name || !sensor || !condition || threshold === undefined || !action)
        return res.status(400).json({ error: 'Missing fields' });
    db.prepare('INSERT INTO automation_rules (name, sensor, condition, threshold, action, action_value) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, sensor, condition, threshold, action, action_value || '');
    res.json({ success: true });
});

app.put('/api/rules/:id', (req, res) => {
    const { is_active } = req.body;
    if (is_active !== undefined) {
        db.prepare('UPDATE automation_rules SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
    }
    res.json({ success: true });
});

app.delete('/api/rules/:id', (req, res) => {
    db.prepare('DELETE FROM automation_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/rules/evaluate', (req, res) => {
    const { sensors } = req.body;
    if (!sensors) return res.status(400).json({ error: 'sensors data required' });

    const rules = db.prepare('SELECT * FROM automation_rules WHERE is_active = 1').all();
    const triggered = [];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const rule of rules) {
        const sensorVal = sensors[rule.sensor];
        if (sensorVal === undefined) continue;

        let match = false;
        if (rule.condition === 'less_than' && sensorVal < rule.threshold) match = true;
        if (rule.condition === 'greater_than' && sensorVal > rule.threshold) match = true;
        if (rule.condition === 'equals' && sensorVal == rule.threshold) match = true;

        if (match) {
            db.prepare('UPDATE automation_rules SET last_triggered = ?, trigger_count = trigger_count + 1 WHERE id = ?')
                .run(now, rule.id);

            const event = `[AUTO] ${rule.name} triggered (${rule.sensor}=${sensorVal}, threshold=${rule.threshold})`;
            db.prepare('INSERT INTO activities (plant_id, event, type) VALUES (?, ?, ?)')
                .run(1, event, 'alert');
            pushActivityToBlockchain(1, event, 'alert');

            triggered.push({ rule: rule.name, action: rule.action, value: rule.action_value, sensor_value: sensorVal });
        }
    }

    res.json({ triggered, count: triggered.length });
});

app.post('/api/chat', async (req, res) => {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const plants = db.prepare('SELECT * FROM plants WHERE is_active = 1').all();
    const recentActivities = db.prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT 10').all();
    const sensorData = db.prepare('SELECT * FROM sensor_history ORDER BY recorded_at DESC LIMIT 1').get();

    const systemPrompt = `You are AutoGrowChain AI Assistant — a professional agricultural expert for a smart farming system growing Cherry Tomatoes.

CRITICAL INSTRUCTIONS:
- ALWAYS answer in ENGLISH.
- Be context-aware: Your advice should change based on which page the user is currently viewing.
- Be concise, professional, and data-driven.

Current System State:
- Active Plants: ${JSON.stringify(plants.map(p => ({ name: p.name, health: p.health, stage: p.stage })))}
- Latest Sensors: ${sensorData ? JSON.stringify(sensorData) : 'No sensor data yet'}
- Recent Activities: ${JSON.stringify(recentActivities.slice(0, 5).map(a => a.event))}
- CURRENT PAGE: ${context?.page || 'Dashboard'}
- SELECTED PLANT: ${context?.plant || 'None'}

PAGE-SPECIFIC GUIDANCE:
1. Dashboard: Focus on overall system health, sensor trends, and high-level alerts.
2. AI Vision: Focus on disease detection, leaf health analysis, and image processing results.
3. IoT Control: Focus on hardware status (pump, servo, fan), manual overrides, and automation rules.
4. Supply Chain / Traceability: Focus on blockchain logs, product history, and transparency.
5. Market: Focus on tomato pricing trends and harvest timing optimization.

If the user asks about something not on their current page, briefly answer then guide them to the correct page for more details.`;

    const GROQ_KEY = process.env.GROQ_API_KEY;
    console.log('[Chat] Using Groq API:', GROQ_KEY ? 'FOUND' : 'MISSING');

    if (GROQ_KEY) {
        try {
            const groqRes = await fetch(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GROQ_KEY}`
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: message }
                        ],
                        temperature: 0.7,
                        max_tokens: 1024
                    })
                }
            );
            const data = await groqRes.json();
            const reply = data?.choices?.[0]?.message?.content;
            if (reply) return res.json({ reply, source: 'groq' });
            console.log('[Chat] Groq API error:', JSON.stringify(data));
        } catch (e) {
            console.log('[Chat] Groq API exception:', e.message);
        }
    }

    const q = message.toLowerCase();
    const KB = [
        { keys: ['water', 'moisture'], answer: 'Watering Guide:\n- Ideal soil moisture: 55-70%\n- Water early morning (6-8h) for best absorption\n- If moisture < 30%, activate pump immediately via IoT Control\n- Automation Rules can auto-water when moisture drops' },
        { keys: ['ph', 'acid', 'alkaline'], answer: 'pH Management:\n- Ideal soil pH: 6.0 - 7.0\n- pH < 5.5: Add lime (CaCO3)\n- pH > 7.5: Add sulfur or organic compost\n- Monitor via Dashboard sensor cards' },
        { keys: ['disease', 'sick', 'yellow', 'curl'], answer: 'Disease Detection:\n- Upload leaf/fruit images on the AI Vision page\n- Common issues: Leaf curl (TLCV virus), Yellowing (nitrogen deficiency)\n- Treatment: Neem oil for pests, Nano Ca-B for nutrition' },
        { keys: ['robot', 'arm', 'harvest'], answer: 'Robot Arm System:\n- 4 DOF: Base, Shoulder, Elbow, Gripper\n- Auto mode: IK solver calculates coordinates from ultrasonic sensor\n- When fruit detected nearby (< 10cm), auto-harvest triggers' },
        { keys: ['blockchain', 'supply', 'chain', 'qr'], answer: 'Blockchain & Traceability:\n- All actions logged to PIONE Zero blockchain\n- Scan QR code to view immutable care history\n- Smart Contract: TYTAgriSupplyChain + TPLContract' },
        { keys: ['help', 'guide'], answer: 'Quick Guide:\n1. Dashboard: Real-time sensor monitoring\n2. Plant Details: Quick actions + history\n3. IoT Control: Servo, pump, speaker control\n4. AI Vision: Disease analysis via images\n5. Automation: Set up auto-trigger rules\n6. Supply Chain: Blockchain management' }
    ];

    for (const kb of KB) {
        if (kb.keys.some(k => q.includes(k))) {
            return res.json({ reply: kb.answer, source: 'knowledge_base' });
        }
    }

    res.json({
        reply: 'I did not fully understand your question. Try asking about:\n- Watering & moisture\n- pH management\n- Disease detection\n- Robot arm\n- Blockchain & traceability\n\nType "help" to see the full guide!\n\n(Note: The AI server is currently operating in offline fallback mode. Please check GROQ_API_KEY.)',
        source: 'fallback'
    });
});

app.get('/api/trace/:plant_id', (req, res) => {
    const pid = req.params.plant_id;
    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(pid);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });

    const activities = db.prepare('SELECT * FROM activities WHERE plant_id = ? ORDER BY created_at DESC').all(pid);
    const harvests = db.prepare('SELECT * FROM harvests WHERE plant_id = ? ORDER BY harvested_at DESC').all(pid);
    const waterUsage = db.prepare('SELECT SUM(amount_ml) as total FROM water_usage WHERE plant_id = ?').get(pid);

    res.json({
        plant,
        activities,
        harvests,
        total_water_ml: waterUsage?.total || 0,
        blockchain_note: 'Activities are logged to PIONE Zero blockchain (TPL Collection Data). Verify on-chain for immutable proof.',
        generated_at: new Date().toISOString()
    });
});

app.post('/api/pest-events', (req, res) => {
    const { species, confidence, repel_hz } = req.body;
    if (!species) return res.status(400).json({ error: 'species required' });

    db.prepare('INSERT INTO pest_events (species, confidence, repel_hz) VALUES (?, ?, ?)').run(species, confidence || 0, repel_hz || 20000);

    const payload = JSON.stringify({
        data: JSON.stringify({
            timestamp: new Date().toISOString(),
            event: `Pest detected: ${species} (${confidence}%) - Repelled at ${repel_hz} Hz`,
            type: 'pest_repel',
            method: 'ultrasonic'
        })
    });

    const options = {
        hostname: 'localhost', port: 3005, path: '/api/collection/add', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    const bReq = http.request(options, (bRes) => {
        let data = '';
        bRes.on('data', (chunk) => data += chunk);
        bRes.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.transactionHash) {
                    db.prepare('UPDATE pest_events SET blockchain_tx = ? WHERE id = (SELECT MAX(id) FROM pest_events)').run(json.transactionHash);
                }
            } catch (e) {}
        });
    });
    bReq.on('error', () => {});
    bReq.write(payload);
    bReq.end();

    res.json({ success: true });
});

app.get('/api/pest-events', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json(db.prepare('SELECT * FROM pest_events ORDER BY detected_at DESC LIMIT ?').all(limit));
});

app.get('/api/robot/position', (req, res) => {
    const t = Date.now() / 1000;
    const x = Math.round(50 + 40 * Math.sin(t * 0.1));
    const zones = ['A', 'B', 'C', 'A', 'B'];
    const zone = zones[Math.floor(t * 0.05) % zones.length];
    const states = ['moving', 'idle', 'harvesting', 'moving', 'moving'];
    const status = states[Math.floor(t * 0.03) % states.length];
    res.json({ x, zone, status });
});


let aiFinancialCache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 15 * 60 * 1000;

app.get('/api/ai/financial-report', async (req, res) => {
    if (aiFinancialCache.data && (Date.now() - aiFinancialCache.timestamp < CACHE_TTL_MS)) {
        return res.json({ ...aiFinancialCache.data, is_cached: true });
    }

    const harvests = db.prepare('SELECT h.*, p.name as plant_name FROM harvests h LEFT JOIN plants p ON h.plant_id = p.id ORDER BY h.harvested_at DESC LIMIT 15').all();
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all();
    const customers = db.prepare('SELECT * FROM customers ORDER BY orders_per_month DESC').all();
    const analytics = db.prepare('SELECT COALESCE(SUM(weight_g),0) as total_yield FROM harvests').get();
    const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expenses').get();
    const avgPrice = db.prepare("SELECT COALESCE(AVG(expected_price),50000) as avg FROM customers WHERE type = 'regular'").get();

    const totalRevenue = (analytics.total_yield / 1000) * avgPrice.avg;
    const profit = totalRevenue - totalExpenses.total;

    const context = `REAL FINANCIAL DATA FROM AUTOGROWCHAIN DATABASE:

Harvest History (recent):
${harvests.slice(0,8).map(h => `- ${h.plant_name}: ${h.weight_g}g, ${h.fruits_count} fruits, date: ${h.harvested_at}`).join('\n')}

Total Yield: ${(analytics.total_yield/1000).toFixed(2)} kg
Average Market Price: ${avgPrice.avg.toLocaleString()} VND/kg
Estimated Revenue: ${Math.round(totalRevenue).toLocaleString()} VND

Expenses Breakdown:
${expenses.map(e => `- ${e.category}: ${e.amount.toLocaleString()} VND (${e.description})`).join('\n')}
Total Expenses: ${totalExpenses.total.toLocaleString()} VND

Net Profit: ${Math.round(profit).toLocaleString()} VND
Profit Margin: ${totalRevenue > 0 ? ((profit/totalRevenue)*100).toFixed(1) : 0}%

Customer Portfolio:
${customers.map(c => `- ${c.name} (${c.type}): ${c.orders_per_month} orders/month, willing to pay ${c.expected_price.toLocaleString()} VND/kg, location: ${c.location}`).join('\n')}

Current Date: ${new Date().toISOString().split('T')[0]}`;

    const prompt = `${context}

Based on the REAL financial data above, write a professional financial analysis report. Include:
1. Revenue & Profit Summary (use actual numbers)
2. Expense Analysis (identify highest cost categories)
3. Customer Strategy (which customers should be prioritized and why)
4. Risk Assessment (potential issues based on the data)
5. Top 3 Actionable Recommendations

Write in English, be specific with numbers. Keep it under 400 words.`;

    const GROQ_KEY = process.env.GROQ_API_KEY;

    if (GROQ_KEY) {
        try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: 'You are a professional agricultural financial analyst. Analyze real farm data and provide actionable business insights. Be data-driven and specific.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 1024
                })
            });
            const data = await groqRes.json();
            const reply = data?.choices?.[0]?.message?.content;
            if (reply) {
                const responseData = {
                    report: reply,
                    source: 'groq_llama3',
                    summary: {
                        total_yield_kg: (analytics.total_yield / 1000).toFixed(2),
                        total_revenue: Math.round(totalRevenue),
                        total_expenses: totalExpenses.total,
                        net_profit: Math.round(profit),
                        profit_margin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0',
                        customer_count: customers.length,
                        top_customer: customers[0]?.name || 'N/A'
                    },
                    generated_at: new Date().toISOString()
                };
                
                aiFinancialCache.data = responseData;
                aiFinancialCache.timestamp = Date.now();
                return res.json(responseData);
            }
        } catch (e) {
            console.log('[AI Financial] Groq error:', e.message);
        }
    }

    res.json({
        report: `Financial Summary:\n- Total Yield: ${(analytics.total_yield/1000).toFixed(2)} kg\n- Revenue: ${Math.round(totalRevenue).toLocaleString()} VND\n- Expenses: ${totalExpenses.total.toLocaleString()} VND\n- Net Profit: ${Math.round(profit).toLocaleString()} VND\n\nConfigure GROQ_API_KEY for AI-powered detailed analysis.`,
        source: 'fallback',
        summary: {
            total_yield_kg: (analytics.total_yield / 1000).toFixed(2),
            total_revenue: Math.round(totalRevenue),
            total_expenses: totalExpenses.total,
            net_profit: Math.round(profit),
            profit_margin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0',
            customer_count: customers.length,
            top_customer: customers[0]?.name || 'N/A'
        },
        generated_at: new Date().toISOString()
    });
});



app.get('/api/nft/trees', (req, res) => {
    const plants = db.prepare(`
        SELECT p.*, n.wallet_address, n.renter_name, n.tx_hash, n.minted_at as nft_minted_at
        FROM plants p
        LEFT JOIN nft_owners n ON p.id = n.plant_id
    `).all();
    res.json(plants);
});

app.post('/api/nft/mint', (req, res) => {
    const { plant_id, wallet_address, renter_name } = req.body;
    if (!plant_id || !wallet_address) return res.status(400).json({ error: 'plant_id and wallet_address required' });

    const existing = db.prepare('SELECT * FROM nft_owners WHERE plant_id = ?').get(plant_id);
    if (existing) return res.status(409).json({ error: 'Tree already rented', owner: existing.wallet_address });

    const tx_hash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    db.prepare('INSERT INTO nft_owners (plant_id, wallet_address, renter_name, tx_hash) VALUES (?, ?, ?, ?)')
        .run(plant_id, wallet_address, renter_name || 'Anonymous', tx_hash);

    pushActivityToBlockchain(plant_id, `NFT Minted: Tree #${plant_id} rented by ${renter_name || wallet_address.slice(0,10)}`, 'care');

    db.prepare('INSERT INTO activities (plant_id, event, type) VALUES (?, ?, ?)')
        .run(plant_id, `Tree rented via NFT by ${renter_name || 'Anonymous'} (${wallet_address.slice(0,10)}...)`, 'care');

    res.json({ success: true, tx_hash, message: `Tree #${plant_id} successfully rented!` });
});

app.get('/api/nft/owner/:plantId', (req, res) => {
    const owner = db.prepare('SELECT * FROM nft_owners WHERE plant_id = ?').get(req.params.plantId);
    if (!owner) return res.json({ owned: false });
    res.json({ owned: true, ...owner });
});

app.delete('/api/nft/release/:plantId', (req, res) => {
    db.prepare('DELETE FROM nft_owners WHERE plant_id = ?').run(req.params.plantId);
    res.json({ success: true, message: 'NFT released' });
});

const PORT = 3010;
app.listen(PORT, () => {
    console.log('==============================================');
    console.log(`Data API Server ready on port ${PORT}`);
    console.log('==============================================');
});


