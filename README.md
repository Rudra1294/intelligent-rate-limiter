# Intelligent API Rate Limiter

A custom Node.js Express middleware implementing intelligent rate limiting using pure data structures and MongoDB for persistent logging.

## Features

- **Trie-based IP Blacklisting**: O(L) time complexity IP lookups
- **Sliding Window Log Rate Limiting**: Pure JavaScript implementation with Hash Map and Queue
- **Tiered Authentication**: API key-based rate limiting with different tiers
- **MongoDB Persistent Logging**: Asynchronous logging of security violations
- **Connection Pooling**: Optimized MongoDB connection management

## API Key Tiers

- **FREE_TIER**: 5 requests per minute
- **PRO_TIER**: 100 requests per minute
- **NO_KEY** (IP-based): 5 requests per minute

### Sample API Keys
- `free-key-123` → FREE_TIER
- `pro-key-456` → PRO_TIER
- `premium-key-789` → PRO_TIER

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start MongoDB (local installation required):
```bash
# On Windows with MongoDB installed
mongod
```

3. Set environment variable (optional):
```bash
export MONGODB_URI=mongodb://localhost:27017/rate-limiter
```

4. Start the server:
```bash
npm start
```

## API Endpoints

- `GET /api/data` - Test endpoint with rate limiting
- `GET /api/admin/stats` - Admin statistics API
- `GET /health` - Health check endpoint
- `GET /admin` - Admin dashboard (HTML)

## Admin Dashboard

Access the real-time admin dashboard at `http://localhost:3000/admin`

The dashboard provides:
- **Real-time Statistics**: Active users, queue sizes, tier limits
- **Active Users Table**: Shows all currently tracked identifiers and their queue sizes
- **Security Violations Table**: Recent blacklist and rate limit violations
- **Auto-refresh**: Updates every 2 seconds using fetch() API

### Dashboard Features
- Clean, responsive design with modern CSS
- Real-time data visualization
- Color-coded violation types
- Mobile-friendly layout

## Usage Examples

### IP-based Rate Limiting (No API Key)
```bash
curl http://localhost:3000/api/data
# Headers: X-RateLimit-Tier: NO_KEY, X-RateLimit-Limit: 5
```

### Free Tier Rate Limiting
```bash
curl -H "x-api-key: free-key-123" http://localhost:3000/api/data
# Headers: X-RateLimit-Tier: FREE_TIER, X-RateLimit-Limit: 5
```

### Pro Tier Rate Limiting
```bash
curl -H "x-api-key: pro-key-456" http://localhost:3000/api/data
# Headers: X-RateLimit-Tier: PRO_TIER, X-RateLimit-Limit: 100
```

## Rate Limiting Rules

- **Window**: 60 seconds
- **FREE_TIER**: 5 requests per minute
- **PRO_TIER**: 100 requests per minute
- **IP-based (no key)**: 5 requests per minute
- **Blacklisted IPs**: 192.168.* and 10.0.0.5

## Security Logging

All violations are logged to MongoDB in the `security_logs` collection:

```javascript
{
  ipAddress: "192.168.1.1", // or "API_KEY:pro-key-456" for API key violations
  timestamp: ISODate("2026-04-14T16:41:49.252Z"),
  violationType: "BLACKLIST" | "RATE_LIMIT",
  endpoint: "/api/data",
  userAgent: "...",
  method: "GET"
}
```

## IP Blacklist Management

The admin dashboard includes interactive IP blacklist management:

- **Add IPs**: Enter an IP address or subnet (e.g., "192.168.1.1" or "192.168") and click "Block IP"
- **View Blocked IPs**: See all currently blocked IP prefixes in a table
- **Remove IPs**: Click "Unblock" next to any blocked IP to remove it from the blacklist

### API Endpoints

- `GET /api/admin/blacklist` - Get all blocked IPs
- `POST /api/admin/blacklist` - Add IP to blacklist (body: `{ "ipAddress": "192.168.1.1" }`)
- `DELETE /api/admin/blacklist` - Remove IP from blacklist (body: `{ "ipAddress": "192.168.1.1" }`)

## Testing

### Rate Limiting Test (IP-based)
```bash
# Make multiple requests to trigger rate limit
for i in {1..7}; do curl http://localhost:3000/api/data; done
```

### API Key Rate Limiting Test
```bash
# Test FREE tier (5 requests limit)
for i in {1..7}; do curl -H "x-api-key: free-key-123" http://localhost:3000/api/data; done

# Test PRO tier (100 requests limit)
for i in {1..102}; do curl -H "x-api-key: pro-key-456" http://localhost:3000/api/data; done
```

### Automated Tier Testing
```bash
npm run test-tiers
```

### Blacklist Test
Add your IP to the blacklist in `dsaRateLimiter.js` and test.

## Architecture

- **Trie.js**: IP blacklist data structure with insert(), search(), getAllBlocked(), and remove() methods
- **dsaRateLimiter.js**: Main middleware with tiered rate limiting logic
- **models/SecurityLog.js**: Mongoose schema for logging
- **db.js**: MongoDB connection with pooling
- **server.js**: Express application setup with admin endpoints
- **public/**: Frontend dashboard with real-time monitoring and management controls