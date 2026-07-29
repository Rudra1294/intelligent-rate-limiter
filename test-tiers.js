const http = require('http');

// Test script for tiered rate limiting
const testTieredRateLimiting = () => {
    const makeRequest = (apiKey = null, requestNum) => {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: '/api/data',
                method: 'GET',
                headers: apiKey ? { 'x-api-key': apiKey } : {}
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    const tier = res.headers['x-ratelimit-tier'];
                    const limit = res.headers['x-ratelimit-limit'];
                    const remaining = res.headers['x-ratelimit-remaining'];

                    console.log(`Request ${requestNum} (${apiKey || 'NO KEY'}) - Status: ${res.statusCode}, Tier: ${tier}, Limit: ${limit}, Remaining: ${remaining}`);

                    if (res.statusCode === 429) {
                        console.log(`  Rate limited: ${data}`);
                    }

                    resolve({ status: res.statusCode, tier, limit, remaining });
                });
            });

            req.on('error', (err) => reject(err));
            req.end();
        });
    };

    const testTier = async (tierName, apiKey, maxRequests) => {
        console.log(`\n=== Testing ${tierName} ===`);
        for (let i = 1; i <= maxRequests + 2; i++) {
            try {
                await makeRequest(apiKey, i);
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error on request ${i}:`, error.message);
            }
        }
    };

    const runTests = async () => {
        // Test IP-based (no key)
        await testTier('IP-based (No Key)', null, 5);

        // Test FREE tier
        await testTier('FREE Tier', 'free-key-123', 5);

        // Test PRO tier
        await testTier('PRO Tier', 'pro-key-456', 10); // Test with fewer requests for demo

        console.log('\n=== Test completed ===');
        console.log('Check the server logs and MongoDB for violation logs.');
    };

    runTests().catch(console.error);
};

// Run the test
testTieredRateLimiting();