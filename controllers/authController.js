const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, role, username } = req.body;

    if (!name || !email || !password || !username) {
        res.status(400).json({ message: 'Please add all fields' });
        return;
    }

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });

    if (userExists) {
        res.status(400).json({ message: 'User (Email or Username) already exists' });
        return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
        name,
        username,
        email,
        password: hashedPassword,
        role: role || 'student',
    });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Check for user (by email or username)
    const user = await User.findOne({
        $or: [
            { email: email },
            { username: email } // 'email' field in req.body might contain username
        ]
    });

    if (user && (await bcrypt.compare(password, user.password))) {
        res.json({
            _id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid credentials' });
    }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    res.status(200).json(req.user);
};

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
};
