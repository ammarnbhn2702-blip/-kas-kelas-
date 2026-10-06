const { MongoClient, ObjectId } = require('mongodb');
let clientPromise = null;
const getDb = () => {
  if (!clientPromise) clientPromise = new MongoClient(process.env.MONGODB_URI).connect();
  return clientPromise.then(c => c.db('kaskelas'));
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pin = req.headers['x-pin'];
  if (req.method !== 'GET' && pin !== process.env.KAS_PIN)
    return res.status(401).json({ error: 'PIN salah' });

  try {
    const col = (await getDb()).collection('transaksi');

    if (req.method === 'GET') {
      const items = await col.find({ status: { $ne: 'void' } }).sort({ createdAt: -1 }).limit(500).toArray();
      return res.status(200).json(items);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.check) return res.status(200).json({ ok: true });
      const amount = Number(b.amount);
      if (!['masuk','keluar'].includes(b.type) || !Number.isInteger(amount) || amount <= 0)
        return res.status(400).json({ error: 'Data tidak valid' });
      const doc = {
        type: b.type, amount,
        category: String(b.category || 'Lain-lain').slice(0, 40),
        note: String(b.note || '').slice(0, 200),
        date: new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10),
        createdAt: new Date(), status: 'posted'
      };
      const r = await col.insertOne(doc);
      return res.status(200).json({ ...doc, _id: r.insertedId });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID tidak valid' });
      await col.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'void' } });
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method tidak diizinkan' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
