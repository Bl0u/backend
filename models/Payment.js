const mongoose = require('mongoose');

const paymentSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paymobIntentionId: { type: String, required: true, unique: true },
    paymobTransactionId: { type: String, sparse: true },
    paymobOrderId: { type: String },
    amount: { type: Number, required: true },          // EGP (human-readable)
    amountCents: { type: Number, required: true },      // Piasters (Paymob format)
    stars: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: { type: String, default: 'wallet' },
    walletPhone: { type: String },
    callbackData: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
