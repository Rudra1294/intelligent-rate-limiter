# Use a lightweight Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the remaining application files (including db.js, Trie.js, etc.)
COPY . .

# Expose the port your server.js listens on (assuming 3000)
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]