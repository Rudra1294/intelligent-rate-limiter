const mongoose = require('mongoose');
const SecurityLog = require('./models/SecurityLog');

async function checkLogs() {
    try {
        await mongoose.connect('mongodb://localhost:27017/rate-limiter');
        console.log('Connected to MongoDB');

        const logs = await SecurityLog.find({}).sort({ timestamp: -1 }).limit(10);
        console.log('Recent security logs:');
        logs.forEach(log => {
            console.log(`${log.timestamp} - ${log.violationType} - ${log.ipAddress} - ${log.endpoint}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkLogs();