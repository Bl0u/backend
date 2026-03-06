const express = require('express');
const router = express.Router();
const {
    updateUserProfile,
    getUsers,
    getUserById,
    getUserByUsername,
    topUpStars,
    blockUser,
    unblockUser,
    getUniquePartnerFilters
} = require('../controllers/userController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateUserProfile);
router.post('/topup', protect, topUpStars); // V2.0: Top up stars
router.get('/', optionalAuth, getUsers);
router.get('/filters', getUniquePartnerFilters);
router.get('/:id', getUserById);
router.get('/u/:username', getUserByUsername);
// Block/Unblock
router.post('/block/:id', protect, blockUser);
router.delete('/block/:id', protect, unblockUser);

module.exports = router;
