const mongoose = require('mongoose');

// MongoDB connection with connection pooling best practices
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rate-limiter', {
            // Connection pooling options
            maxPoolSize: 10, // Maximum number of connections in the connection pool
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        console.log('Continuing without database logging...');
        return false;
    }
};

module.exports = connectDB;