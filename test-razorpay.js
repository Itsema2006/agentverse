// test-razorpay.js
// Verifies Razorpay API credentials by attempting to create a tiny test order.
// Usage:
// 1) Ensure .env contains RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET or export them in your shell.
// 2) Run: node test-razorpay.js

require('dotenv').config();
const Razorpay = require('razorpay');

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_id || !key_secret) {
  console.error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment.');
  process.exit(1);
}

const rzp = new Razorpay({ key_id, key_secret });

rzp.orders.create({ amount: 100, currency: 'INR', receipt: 'test_receipt' })
  .then(o => {
    console.log('Order created:', o.id);
    process.exit(0);
  })
  .catch(err => {
    console.error('Razorpay error:', err.message || err);
    if (err.statusCode) console.error('Status code:', err.statusCode);
    if (err.error) console.error('Error body:', err.error);
    process.exit(1);
  });
