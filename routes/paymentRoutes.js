const express = require('express');
const router = express.Router();
const {
    initiatePayment,
    handleCallback,
    getPaymentStatus
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Protected: user must be logged in
router.post('/initiate', protect, initiatePayment);
router.get('/status/:intentionId', protect, getPaymentStatus);

// Public: Paymob sends callbacks here (no auth middleware)
router.post('/callback', handleCallback);

// ── TEMPORARY DEBUG: test all base URLs + formats ──
const axios = require('axios');
router.get('/debug', async (req, res) => {
    const secretKey = process.env.PAYMOB_SECRET_KEY;
    const apiKey = process.env.PAYMOB_API_KEY;
    const intId = process.env.PAYMOB_WALLET_INTEGRATION_ID;
    const results = [];

    // Test 1: Intention API with different base URLs
    const baseUrls = [
        'https://accept.paymob.com',
        'https://egypt.paymob.com',
    ];

    const payload = {
        amount: 5000,
        currency: 'EGP',
        payment_methods: [parseInt(intId)],
        items: [{ name: 'Test', amount: 5000, quantity: 1 }],
        billing_data: {
            first_name: 'Test', last_name: 'User',
            email: 'test@test.com', phone_number: '01010101010'
        },
        notification_url: 'http://localhost:5000/api/payments/callback',
        redirection_url: 'http://localhost:5173/top-up'
    };

    for (const base of baseUrls) {
        try {
            const r = await axios.post(`${base}/v1/intention/`, payload, {
                headers: { 'Authorization': `Token ${secretKey}`, 'Content-Type': 'application/json' }
            });
            results.push({ test: `Intention ${base}`, status: 'SUCCESS', id: r.data.id, clientSecret: r.data.client_secret?.substring(0, 20) + '...' });
        } catch (e) {
            results.push({ test: `Intention ${base}`, status: 'FAILED', error: e.response?.data || e.message, code: e.response?.status });
        }
    }

    // Test 2: Legacy flow — Step 1: Auth token using API KEY
    try {
        const authRes = await axios.post('https://accept.paymob.com/api/auth/tokens', {
            api_key: apiKey
        });
        const authToken = authRes.data.token;
        results.push({ test: 'Legacy Auth (api_key)', status: 'SUCCESS', tokenPreview: authToken?.substring(0, 25) + '...', merchantId: authRes.data.profile?.id });

        // Test 3: Legacy flow — Step 2: Register Order
        try {
            const orderRes = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
                auth_token: authToken,
                delivery_needed: false,
                amount_cents: 5000,
                currency: 'EGP',
                items: [{ name: 'Test Stars', amount_cents: 5000, quantity: 1 }]
            });
            results.push({ test: 'Legacy Order', status: 'SUCCESS', orderId: orderRes.data.id });

            // Test 4: Legacy flow — Step 3: Payment Key
            try {
                const keyRes = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
                    auth_token: authToken,
                    amount_cents: 5000,
                    expiration: 3600,
                    order_id: orderRes.data.id,
                    currency: 'EGP',
                    integration_id: parseInt(intId),
                    billing_data: {
                        first_name: 'Test', last_name: 'User',
                        email: 'test@test.com', phone_number: '01010101010',
                        apartment: 'N/A', floor: 'N/A', street: 'N/A',
                        building: 'N/A', shipping_method: 'N/A',
                        postal_code: 'N/A', city: 'N/A', country: 'EG', state: 'N/A'
                    }
                });
                results.push({ test: 'Legacy PaymentKey', status: 'SUCCESS', tokenPreview: keyRes.data.token?.substring(0, 25) + '...' });
            } catch (e) {
                results.push({ test: 'Legacy PaymentKey', status: 'FAILED', error: e.response?.data || e.message, code: e.response?.status });
            }
        } catch (e) {
            results.push({ test: 'Legacy Order', status: 'FAILED', error: e.response?.data || e.message, code: e.response?.status });
        }
    } catch (e) {
        results.push({ test: 'Legacy Auth (api_key)', status: 'FAILED', error: e.response?.data || e.message, code: e.response?.status });
    }

    res.json({ secretKey: secretKey?.substring(0, 25) + '...', integrationId: intId, results });
});

module.exports = router;
