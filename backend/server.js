const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'db.json');
const seedPath = path.join(__dirname, '..', 'data', 'properties.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(express.static(path.join(__dirname, '..')));

async function readDb() {
  try {
    const raw = await fs.readFile(dbPath, 'utf8');
    const db = JSON.parse(raw);
    if (!Array.isArray(db.properties) || db.properties.length === 0) {
      const seed = JSON.parse(await fs.readFile(seedPath, 'utf8'));
      db.properties = seed;
      await writeDb(db);
    }
    return db;
  } catch (error) {
    const seed = JSON.parse(await fs.readFile(seedPath, 'utf8'));
    const db = { properties: seed, requests: [] };
    await writeDb(db);
    return db;
  }
}

async function writeDb(db) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'EstateHub backend works' });
});

app.get('/api/properties', async (req, res) => {
  const db = await readDb();
  res.json(db.properties);
});

app.post('/api/properties', async (req, res) => {
  const db = await readDb();
  const property = req.body;
  if (!property.title || !property.price || !property.type) {
    return res.status(400).json({ error: 'title, price and type are required' });
  }
  if (property.id) {
    const id = Number(property.id);
    db.properties = db.properties.map((item) => item.id === id ? { ...property, id } : item);
    await writeDb(db);
    return res.json({ ...property, id });
  }
  const nextId = db.properties.length ? Math.max(...db.properties.map((item) => Number(item.id))) + 1 : 1;
  const created = { ...property, id: nextId, createdAt: property.createdAt || new Date().toISOString().slice(0, 10) };
  db.properties.unshift(created);
  await writeDb(db);
  res.status(201).json(created);
});

app.delete('/api/properties/:id', async (req, res) => {
  const db = await readDb();
  const id = Number(req.params.id);
  db.properties = db.properties.filter((item) => item.id !== id);
  await writeDb(db);
  res.status(204).send();
});

app.get('/api/requests', async (req, res) => {
  const db = await readDb();
  res.json(db.requests);
});

app.post('/api/requests', async (req, res) => {
  const db = await readDb();
  const request = req.body;
  if (!request.name || !request.phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }
  const created = { ...request, id: Date.now(), createdAt: new Date().toISOString() };
  db.requests.unshift(created);
  await writeDb(db);
  res.status(201).json(created);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`EstateHub backend: http://localhost:${PORT}`);
});
