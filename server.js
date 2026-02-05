const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const mentorshipRoutes = require('./routes/mentorshipRoutes');
const path = require('path');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/mentorship', mentorshipRoutes);
const requestRoutes = require('./routes/requestRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const chatRoutes = require('./routes/chatRoutes');
const planRoutes = require('./routes/planRoutes');

app.use('/api/requests', requestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/plans', planRoutes);

// make uploads folder static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// app.use('/api/mentorship', mentorshipRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
