const express = require('express');
const router = express.Router();
const {
    updateUserProfile,
    getUsers,
    getUserById,
    getUserByUsername
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateUserProfile);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.get('/u/:username', getUserByUsername);

module.exports = router;
