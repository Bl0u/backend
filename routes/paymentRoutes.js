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

// Public: Paymob sends webhook here (POST, server-to-server)
router.post('/callback', handleCallback);

// Browser redirect after payment (GET, user's browser)
router.get('/callback', (req, res) => {
    const { success, pending, id, amount_cents } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/top-up?success=${success}&pending=${pending}&id=${id}&amount_cents=${amount_cents}`);
});

module.exports = router;
