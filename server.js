require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
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
const razorpayClient = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    })
  : null;

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

  if (!razorpayClient) {
    return res.status(500).json({ message: 'Razorpay credentials are not configured.' });
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
      return res.status(500).json({ message: 'Razorpay authentication failed. Check server credentials.' });
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

  if (!razorpayKeySecret) {
    return res.status(500).json({ message: 'Razorpay credentials are not configured.' });
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