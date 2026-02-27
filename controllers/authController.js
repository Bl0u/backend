const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    console.log('Register Payload Received:', req.body);
    let { name, email, password, role, username, ...rest } = req.body;

    if (!email || !password || !username) {
        res.status(400).json({ message: 'Please add all required fields (email, password, username)' });
        return;
    }

    // Fallback name to username if empty
    if (!name || name.trim() === '') {
        name = username;
    }

    // Filter out empty strings and empty arrays from the rest of the payload so Mongoose enum validation doesn't fail
    const cleanedRest = Object.keys(rest).reduce((acc, key) => {
        const val = rest[key];
        // Handle nested objects like 'availability'
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            const cleanedNested = Object.keys(val).reduce((nestedAcc, nestedKey) => {
                const nestedVal = val[nestedKey];
                if (nestedVal !== '' && !(Array.isArray(nestedVal) && nestedVal.length === 0)) {
                    nestedAcc[nestedKey] = nestedVal;
                }
                return nestedAcc;
            }, {});
            if (Object.keys(cleanedNested).length > 0) {
                acc[key] = cleanedNested;
            }
        } else if (val !== '' && !(Array.isArray(val) && val.length === 0)) {
            acc[key] = val;
        }
        return acc;
    }, {});

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });

    if (userExists) {
        res.status(400).json({ message: 'User (Email or Username) already exists' });
        return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userPayload = {
        name,
        username,
        email,
        password: hashedPassword,
        role: role || 'student',
        ...cleanedRest
    };

    const user = await User.create(userPayload);

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            stars: user.stars || 0,
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
            stars: user.stars || 0,
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
