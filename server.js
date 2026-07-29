const express = require('express');
const connectDB = require('./db');
const dsaRateLimiter = require('./dsaRateLimiter');
const SecurityLog = require('./models/SecurityLog');

const app = express();

// Connect to MongoDB first
connectDB().then((connected) => {
    if (connected) {
        console.log('Database models loaded');
    }
});

app.set('trust proxy', 1);

// Middleware to parse JSON
app.use(express.json());

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Test route works' });
});

// Admin stats endpoint (before rate limiter)
app.get('/api/admin/stats', async (req, res) => {
    console.log('Admin stats endpoint called');
    try {
        // Get active users and queue sizes from the request cache map
        const activeUsers = Array.from(dsaRateLimiter.requestCache.entries(), ([identifier, queue]) => ({
            identifier,
            queueSize: queue.length,
            lastRequest: queue.length > 0 ? new Date(queue[queue.length - 1]).toISOString() : null
        }));

        // Get recent security logs
        const recentLogs = await SecurityLog.find({})
            .sort({ timestamp: -1 })
            .limit(10)
            .select('ipAddress violationType endpoint timestamp')
            .lean();

        // System stats
        const stats = {
            totalActiveUsers: activeUsers.length,
            totalRequestsInQueues: activeUsers.reduce((sum, user) => sum + user.queueSize, 0),
            tierLimits: dsaRateLimiter.TIER_LIMITS,
            activeUsers,
            recentLogs: recentLogs.map(log => ({
                identifier: log.ipAddress,
                violationType: log.violationType,
                endpoint: log.endpoint,
                timestamp: log.timestamp.toISOString()
            })),
            blockedIPs: dsaRateLimiter.blacklistTree.getAllBlocked()
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

// Admin settings endpoint to update PRO tier limit dynamically
app.put('/api/admin/settings', (req, res) => {
    const { proTierLimit } = req.body;

    if (typeof proTierLimit !== 'number' || !Number.isInteger(proTierLimit) || proTierLimit <= 0) {
        return res.status(400).json({ error: 'proTierLimit must be a positive integer' });
    }

    dsaRateLimiter.TIER_LIMITS.PRO_TIER = proTierLimit;
    console.log(`Updated PRO_TIER limit to ${proTierLimit}`);

    res.json({
        success: true,
        tierLimits: dsaRateLimiter.TIER_LIMITS,
        message: `PRO tier limit updated to ${proTierLimit}`
    });
});

// Admin blacklist management endpoints
app.get('/api/admin/blacklist', (req, res) => {
    const blockedIPs = dsaRateLimiter.blacklistTree.getAllBlocked();
    res.json({ blockedIPs });
});

app.post('/api/admin/blacklist', (req, res) => {
    const { ipAddress } = req.body;

    if (!ipAddress || typeof ipAddress !== 'string') {
        return res.status(400).json({ error: 'ipAddress is required and must be a string' });
    }
    // IP validation for both IPv4 and IPv6 (supports partial addresses)
    // IPv4: digits and dots (e.g., "192.168" or "192.168.1.1")
    // IPv6: hex digits and colons (e.g., "2001:db8" or "2001:0db8:85a3::1")
    const ipv4Pattern = /^(\d{1,3}\.){0,3}\d{1,3}$/;
    const ipv6Pattern = /^[0-9a-fA-F:]+$/; // Any combination of hex digits and colons
    
    if (!ipv4Pattern.test(ipAddress) && !ipv6Pattern.test(ipAddress)) {
        return res.status(400).json({ error: 'Invalid IP address format (IPv4 or IPv6)' });
    }

    dsaRateLimiter.blacklistTree.insert(ipAddress);
    console.log(`Added IP ${ipAddress} to blacklist`);

    res.json({
        success: true,
        message: `IP ${ipAddress} added to blacklist`,
        blockedIPs: dsaRateLimiter.blacklistTree.getAllBlocked()
    });
});

app.delete('/api/admin/blacklist', (req, res) => {
    const { ipAddress } = req.body;

    if (!ipAddress || typeof ipAddress !== 'string') {
        return res.status(400).json({ error: 'ipAddress is required and must be a string' });
    }

    const removed = dsaRateLimiter.blacklistTree.remove(ipAddress);
    if (!removed) {
        return res.status(404).json({ error: `IP ${ipAddress} not found in blacklist` });
    }

    console.log(`Removed IP ${ipAddress} from blacklist`);

    res.json({
        success: true,
        message: `IP ${ipAddress} removed from blacklist`,
        blockedIPs: dsaRateLimiter.blacklistTree.getAllBlocked()
    });
});

// Serve static files from public directory
app.use(express.static('public'));

// Admin dashboard route
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Apply the custom DSA Rate Limiter to API routes
app.use(dsaRateLimiter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`DSA Rate Limiter Server running on port ${PORT}`);
});
// Apply the custom DSA Rate Limiter to API routes
app.use(dsaRateLimiter);

// ---> ADD THIS ROUTE HERE <---
app.get('/api/data', (req, res) => {
    res.json({ message: "Success! The Intelligent Rate Limiter allowed this request." });
});
