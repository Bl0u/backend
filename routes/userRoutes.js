const express = require('express');
const router = express.Router();
const {
    updateUserProfile,
    getUsers,
    getUserById,
    getUserByUsername,
    topUpStars
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateUserProfile);
router.post('/topup', protect, topUpStars); // V2.0: Top up stars
router.get('/', getUsers);
router.get('/:id', getUserById);
router.get('/u/:username', getUserByUsername);

module.exports = router;
