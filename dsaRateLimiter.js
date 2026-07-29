const IPTrie = require('./Trie');
const mongoose = require('mongoose');
const SecurityLog = require('./models/SecurityLog');

// 1. Initialize the Hash Map for IP-based rate limiting
const requestCache = new Map();

// 2. Initialize API key to tier mapping
const apiKeyTiers = new Map([
    ['free-key-123', 'FREE_TIER'],
    ['pro-key-456', 'PRO_TIER'],
    ['premium-key-789', 'PRO_TIER'], // Additional keys for testing
]);

// 3. Tier-based rate limits
const TIER_LIMITS = {
    FREE_TIER: 5,
    PRO_TIER: 100,
    NO_KEY: 5 // Fallback to IP-based limit
};

// 4. Initialize and populate the Trie (Tree) with blocked IPs
const blacklistTree = new IPTrie();
blacklistTree.insert('192.168'); // Blocks any IP starting with 192.168
blacklistTree.insert('10.0.0.5'); // Blocks a specific IP

const WINDOW_SIZE_IN_MS = 60000; // 1 minute

// Helper function to log security violations asynchronously
const logViolation = async (identifier, violationType, req, tier = 'NO_KEY') => {
    try {
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            console.log(`Security violation (${violationType}) for ${identifier} (tier: ${tier}) - MongoDB not connected (state: ${mongoose.connection.readyState})`);
            return;
        }

        const log = await SecurityLog.create({
            ipAddress: identifier,
            violationType,
            endpoint: req.originalUrl,
            userAgent: req.get('User-Agent') || '',
            method: req.method
        });
        console.log(`Logged ${violationType} violation for ${identifier} (tier: ${tier}): ${log._id}`);
    } catch (error) {
        console.error('Failed to log security violation:', error.message);
        // Don't throw error to avoid disrupting the middleware flow
    }
};

// Helper function to get tier and limit for a request
const getTierAndLimit = (req) => {
    const apiKey = req.get('x-api-key');
    if (apiKey && apiKeyTiers.has(apiKey)) {
        const tier = apiKeyTiers.get(apiKey);
        return { tier, limit: TIER_LIMITS[tier], identifier: `API_KEY:${apiKey}` };
    }
    // Fallback to IP-based limiting
    const userIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    return { tier: 'NO_KEY', limit: TIER_LIMITS.NO_KEY, identifier: userIp };
};

const dsaRateLimiter = (req, res, next) => {
    const currentTime = Date.now();

    // Get tier and limit information
    const { tier, limit, identifier } = getTierAndLimit(req);

    // Algorithm Step 1: Check the Tree for IP blacklisting (only for IP-based requests)
    if (tier === 'NO_KEY') {
        const userIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
        if (blacklistTree.search(userIp)) {
            // Log blacklist violation asynchronously
            logViolation(userIp, 'BLACKLIST', req, tier);
            return res.status(403).json({ error: "Your IP is blacklisted." });
        }
    }

    // Algorithm Step 2: Lookup in Hash Map (O(1) time complexity)
    if (!requestCache.has(identifier)) {
        // First time seeing this identifier, create a new Queue (Array used as Queue)
        requestCache.set(identifier, []);
    }

    // Get the Queue for this specific identifier
    const userQueue = requestCache.get(identifier);

    // Algorithm Step 3: Sliding Window Log (Dequeue old timestamps)
    // While the queue is not empty AND the oldest request is out of the window
    while (userQueue.length > 0 && currentTime - userQueue[0] > WINDOW_SIZE_IN_MS) {
        userQueue.shift(); // Dequeue the oldest timestamp from the front
    }

    // Algorithm Step 4: Check Queue size against the tier-based limit
    if (userQueue.length >= limit) {
        // Log rate limit violation asynchronously
        logViolation(identifier, 'RATE_LIMIT', req, tier);
        return res.status(429).json({
            error: "Too many requests. Please wait.",
            requests_in_queue: userQueue.length,
            tier: tier,
            limit: limit
        });
    }

    // Algorithm Step 5: Enqueue current request and allow
    userQueue.push(currentTime); // Enqueue at the back

    // Attach headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', limit - userQueue.length);
    res.setHeader('X-RateLimit-Tier', tier);

    next();
};

module.exports = dsaRateLimiter;
module.exports.requestCache = requestCache;
module.exports.apiKeyTiers = apiKeyTiers;
module.exports.TIER_LIMITS = TIER_LIMITS;
module.exports.blacklistTree = blacklistTree;
module.exports.TIER_LIMITS = TIER_LIMITS;