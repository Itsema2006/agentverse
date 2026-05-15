require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const cors = require("cors");
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDirectory = __dirname;

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const upiVpa = process.env.UPI_VPA || 'random@razorpay';
const upiMerchantName = process.env.UPI_MERCHANT_NAME || 'AgentVerse';
const upiNote = process.env.UPI_NOTE || 'AgentVerse purchase';
const mockMode = process.env.RAZORPAY_MOCK_MODE === 'true';
const apiKeysStorePath = path.join(publicDirectory, 'data', 'api-keys.json');
const razorpayClient = (razorpayKeyId && razorpayKeySecret)
  ? new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    })
  : null;

async function readApiKeysStore() {
  try {
    const raw = await fs.readFile(apiKeysStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeApiKeysStore(keys) {
  await fs.mkdir(path.dirname(apiKeysStorePath), { recursive: true });
  await fs.writeFile(apiKeysStorePath, JSON.stringify(keys, null, 2), 'utf8');
}

app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/config', (req, res) => {
  res.json({
    razorpayKeyId: razorpayKeyId || null,
    razorpayConfigured: Boolean(razorpayClient),
    upiVpa: upiVpa || null,
    upiMerchantName: upiMerchantName || null,
    upiNote: upiNote || null
  });
});

app.get('/api/public-api-keys', async (req, res) => {
  const keys = await readApiKeysStore();
  res.json({ keys });
});

app.post('/api/public-api-keys', async (req, res) => {
  const body = req.body || {};
  const keyName = typeof body.keyName === 'string' ? body.keyName.trim() : '';
  const keyFunction = typeof body.keyFunction === 'string' ? body.keyFunction.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const agentKind = typeof body.agentKind === 'string' ? body.agentKind.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : '';
  const keyUrl = typeof body.keyUrl === 'string' && body.keyUrl.trim() ? body.keyUrl.trim() : '';
  const key = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : '';
  const price = Number(body.price);

  if (!keyName || !keyFunction || !description || !agentKind || !category || !paymentMethod || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ message: 'Missing or invalid key fields.' });
  }

  if (!keyUrl && !key) {
    return res.status(400).json({ message: 'A key URL or raw key is required.' });
  }

  const keys = await readApiKeysStore();
  const entry = {
    id: typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    keyName,
    keyFunction,
    description,
    agentKind,
    category,
    price: Math.round(price),
    paymentMethod,
    createdAt: typeof body.createdAt === 'string' && body.createdAt.trim() ? body.createdAt.trim() : new Date().toISOString()
  };

  if (keyUrl) {
    entry.keyUrl = keyUrl;
  }

  if (key) {
    entry.key = key;
  }

  const existingIndex = keys.findIndex(function (item) {
    return item.id === entry.id;
  });

  if (existingIndex >= 0) {
    keys[existingIndex] = entry;
  } else {
    keys.unshift(entry);
  }

  await writeApiKeysStore(keys);
  res.json({ success: true, key: entry });
});

app.delete('/api/public-api-keys/:id', async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

  if (!id) {
    return res.status(400).json({ message: 'Missing key id.' });
  }

  const keys = await readApiKeysStore();
  const nextKeys = keys.filter(function (item) {
    return item.id !== id;
  });

  await writeApiKeysStore(nextKeys);
  res.json({ success: true });
});

app.post('/api/create-order', async (req, res) => {
  const amount = Number(req.body?.amount);
  const currency = typeof req.body?.currency === 'string' && req.body.currency.trim()
    ? req.body.currency.trim().toUpperCase()
    : 'INR';
  const receipt = typeof req.body?.receipt === 'string' && req.body.receipt.trim()
    ? req.body.receipt.trim().slice(0, 40)
    : `receipt_${Date.now()}`;

  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 100) {
    return res.status(400).json({ message: 'Amount must be at least 100 paise.' });
  }

  // Mock mode: return fake order for testing without valid Razorpay credentials
  if (mockMode) {
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[MOCK MODE] Created fake order ${mockOrderId} for amount ${amount} ${currency}`);
    return res.json({
      order_id: mockOrderId,
      amount: amount,
      currency: currency,
      mock: true
    });
  }

  if (!razorpayClient) {
    return res.status(401).json({ message: 'Razorpay credentials are not configured.' });
  }

  try {
    const order = await razorpayClient.orders.create({
      amount,
      currency,
      receipt
    });

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    const statusCode = error?.statusCode || error?.status || 500;

    if (statusCode === 401) {
      console.error('Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.', error);
      return res.status(401).json({ message: 'Razorpay authentication failed. Check server credentials.' });
    }

    console.error('Failed to create Razorpay order:', error);
    return res.status(500).json({ message: 'Unable to create Razorpay order.' });
  }
});

app.post('/api/verify-payment', (req, res) => {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature
  } = req.body || {};

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ message: 'Missing payment verification fields.' });
  }

  // Mock mode: accept any payment with a mock order ID
  if (mockMode && orderId.includes('order_mock_')) {
    console.log(`[MOCK MODE] Verified fake payment for order ${orderId}`);
    return res.json({ success: true });
  }

  if (!razorpayKeySecret) {
    return res.status(401).json({ message: 'Razorpay credentials are not configured.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const receivedBuffer = Buffer.from(signature, 'utf8');

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return res.status(400).json({ message: 'Invalid payment signature.' });
  }

  return res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

app.use(express.static(publicDirectory));

app.listen(PORT, () => {
  console.log(`AgentVerse server running on http://localhost:${PORT}`);
});