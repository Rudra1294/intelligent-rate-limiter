const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema({
    ipAddress: {
        type: String,
        required: true,
        index: true // Index for faster queries on IP
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true // Index for time-based queries
    },
    violationType: {
        type: String,
        enum: ['BLACKLIST', 'RATE_LIMIT'],
        required: true
    },
    endpoint: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        default: ''
    },
    method: {
        type: String,
        default: 'GET'
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt fields
    collection: 'security_logs'
});

// Compound index for efficient querying
securityLogSchema.index({ ipAddress: 1, timestamp: -1 });

const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);

module.exports = SecurityLog;