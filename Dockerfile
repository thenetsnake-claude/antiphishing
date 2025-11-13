# Multi-stage build for production
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Create logs directory
RUN mkdir -p /var/log/app && chown -R nestjs:nodejs /var/log/app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Set environment variable
ENV NODE_ENV=production

# Start application
CMD ["node", "dist/main"]
