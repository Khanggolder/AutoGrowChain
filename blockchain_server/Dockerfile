# Base image: node-slim for smallest footprint
FROM node:20-slim

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (only production)
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Expose ports (although Docker Compose handles internal networking)
EXPOSE 3000 3005 3010

# The command will be overridden in docker-compose.yml for each service
CMD ["node", "supply_server.js"]
