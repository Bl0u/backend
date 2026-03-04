const crypto = require('crypto');
const axios = require('axios');
const Payment = require('../models/Payment');
const User = require('../models/User');

// Star packages — single source of truth
const PACKAGES = [
    { stars: 100, price: 50 },
    { stars: 250, price: 100 },
    { stars: 600, price: 200 },
    { stars: 1500, price: 500 },
    { stars: 3500, price: 1000 },
];

const PAYMOB_BASE = 'https://accept.paymob.com';

// ─── Step 1: Initiate Payment (Legacy 3-step + Wallet Pay) ──
const initiatePayment = async (req, res) => {
    try {
        const { stars, walletPhone } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Validate package
        const pkg = PACKAGES.find(p => p.stars === stars);
        if (!pkg) return res.status(400).json({ message: 'Invalid package' });

        // Validate phone (Egyptian mobile: 01XXXXXXXXX)
        const phoneRegex = /^01[0-9]{9}$/;
        if (!walletPhone || !phoneRegex.test(walletPhone)) {
            return res.status(400).json({ message: 'Invalid wallet phone number' });
        }

        const amountCents = pkg.price * 100; // EGP → piasters

        // ── Legacy Step 1: Authenticate ──
        console.log('🔐 Step 1: Authenticating with Paymob...');
        const authRes = await axios.post(`${PAYMOB_BASE}/api/auth/tokens`, {
            api_key: process.env.PAYMOB_API_KEY
        });
        const authToken = authRes.data.token;
        console.log('✅ Auth token received');

        // ── Legacy Step 2: Register Order ──
        console.log('📦 Step 2: Registering order...');
        const orderRes = await axios.post(`${PAYMOB_BASE}/api/ecommerce/orders`, {
            auth_token: authToken,
            delivery_needed: false,
            amount_cents: amountCents,
            currency: 'EGP',
            merchant_order_id: `stars_${user._id}_${Date.now()}`,
            items: [{
                name: `${pkg.stars} Stars Top-Up`,
                amount_cents: amountCents,
                description: `LearnCrew ${pkg.stars} stars package`,
                quantity: 1
            }]
        });
        const orderId = orderRes.data.id;
        console.log('✅ Order registered:', orderId);

        // ── Legacy Step 3: Generate Payment Key ──
        console.log('🔑 Step 3: Generating payment key...');
        const keyRes = await axios.post(`${PAYMOB_BASE}/api/acceptance/payment_keys`, {
            auth_token: authToken,
            amount_cents: amountCents,
            expiration: 3600,
            order_id: orderId,
            currency: 'EGP',
            integration_id: parseInt(process.env.PAYMOB_WALLET_INTEGRATION_ID),
            billing_data: {
                first_name: user.username,
                last_name: user.name || user.username,
                email: user.email,
                phone_number: walletPhone,
                apartment: 'N/A',
                floor: 'N/A',
                street: 'N/A',
                building: 'N/A',
                shipping_method: 'N/A',
                postal_code: 'N/A',
                city: 'N/A',
                country: 'EG',
                state: 'N/A'
            }
        });
        const paymentToken = keyRes.data.token;
        console.log('✅ Payment key generated');

        // ── Legacy Step 4: Wallet Pay Request ──
        console.log('📱 Step 4: Sending wallet pay request...');
        const walletRes = await axios.post(`${PAYMOB_BASE}/api/acceptance/payments/pay`, {
            source: {
                identifier: walletPhone,
                subtype: 'WALLET'
            },
            payment_token: paymentToken
        });
        console.log('✅ Wallet pay response:', walletRes.data.redirect_url ? 'redirect URL received' : 'no redirect URL');

        // Save payment record
        await Payment.create({
            user: user._id,
            paymobIntentionId: orderId.toString(), // Using orderId as reference
            paymobOrderId: orderId.toString(),
            amount: pkg.price,
            amountCents,
            stars: pkg.stars,
            walletPhone,
            status: 'pending'
        });

        // Return redirect URL or iframe URL
        const redirectUrl = walletRes.data.redirect_url || walletRes.data.iframe_redirection_url;

        res.json({
            redirectUrl,
            orderId,
            iframeUrl: walletRes.data.iframe_redirection_url
        });

    } catch (error) {
        console.error('Payment initiation error:', JSON.stringify(error.response?.data, null, 2) || error.message);
        res.status(500).json({
            message: 'Failed to initiate payment',
            error: error.response?.data?.detail || error.response?.data?.message || error.message
        });
    }
};

// ─── Webhook Callback (from Paymob) ─────────────────────────
const handleCallback = async (req, res) => {
    try {
        const callback = req.body;
        const hmacHeader = req.query.hmac;

        console.log('📨 Paymob callback received:', JSON.stringify(callback, null, 2));
        console.log('🔐 HMAC from query:', hmacHeader);

        // ── HMAC Verification ──
        const obj = callback.obj;
        const hmacFields = [
            obj.amount_cents,
            obj.created_at,
            obj.currency,
            obj.error_occured,
            obj.has_parent_transaction,
            obj.id,
            obj.integration_id,
            obj.is_3d_secure,
            obj.is_auth,
            obj.is_capture,
            obj.is_refunded,
            obj.is_standalone_payment,
            obj.is_voided,
            obj.order?.id,
            obj.owner,
            obj.pending,
            obj.source_data?.pan,
            obj.source_data?.sub_type,
            obj.source_data?.type,
            obj.success
        ];

        const concatenated = hmacFields.join('');
        const calculatedHmac = crypto
            .createHmac('sha512', process.env.PAYMOB_HMAC_SECRET)
            .update(concatenated)
            .digest('hex');

        if (calculatedHmac !== hmacHeader) {
            console.error('HMAC verification failed');
            return res.status(403).json({ message: 'Invalid HMAC' });
        }

        // ── Process Transaction ──
        const transactionId = obj.id?.toString();
        const orderId = obj.order?.id?.toString();
        const success = obj.success === true || obj.success === 'true';
        const pending = obj.pending === true || obj.pending === 'true';

        // Find payment by order ID
        let payment = await Payment.findOne({ paymobOrderId: orderId });

        if (!payment) {
            // Fallback: find by amount
            payment = await Payment.findOne({
                amountCents: parseInt(obj.amount_cents),
                status: 'pending'
            }).sort({ createdAt: -1 });
        }

        if (!payment) {
            console.error('No matching payment found for callback:', { transactionId, orderId });
            return res.status(200).json({ message: 'No matching payment' });
        }

        // Prevent duplicate processing
        if (payment.status === 'success') {
            return res.status(200).json({ message: 'Already processed' });
        }

        // Update payment record
        payment.paymobTransactionId = transactionId;
        payment.paymobOrderId = orderId;
        payment.callbackData = obj;

        if (success && !pending) {
            payment.status = 'success';
            await payment.save();

            // Credit stars to user
            const user = await User.findById(payment.user);
            if (user) {
                user.stars = (user.stars || 0) + payment.stars;
                await user.save();
                console.log(`✅ Credited ${payment.stars} stars to user ${user._id}`);
            }
        } else {
            payment.status = 'failed';
            await payment.save();
            console.log(`❌ Payment failed: txn ${transactionId}`);
        }

        // Always respond 200 to Paymob
        res.status(200).json({ message: 'Callback processed' });

    } catch (error) {
        console.error('Callback processing error:', error);
        res.status(200).json({ message: 'Error processing callback' });
    }
};

// ─── Check Payment Status (for frontend polling) ───────────
const getPaymentStatus = async (req, res) => {
    try {
        const { intentionId } = req.params;
        const payment = await Payment.findOne({
            paymobIntentionId: intentionId,
            user: req.user._id
        });

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        res.json({
            status: payment.status,
            stars: payment.stars,
            amount: payment.amount
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { initiatePayment, handleCallback, getPaymentStatus };
