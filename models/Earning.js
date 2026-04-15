const mongoose = require('mongoose');

const earningSchema = mongoose.Schema({
    thread: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalPaid: { type: Number, required: true },         // stars the buyer spent
    authorEarning: { type: Number, required: true },     // 90% - earnerSharePct (goes to author)
    earnerPoolTotal: { type: Number, default: 0 },       // total given to all earners combined
    platformEarning: { type: Number, required: true },   // always ~10% + rounding leftover
    distributedTo: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        amount: { type: Number },
        role: { type: String, enum: ['author', 'earner'] }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Earning', earningSchema);
