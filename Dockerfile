# Multi-stage build for AGI Prompt Engineering Framework
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agi -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create necessary directories
RUN mkdir -p logs && \
    chown -R agi:nodejs /app

# Switch to non-root user
USER agi

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
        if (res.statusCode === 200) { process.exit(0); } \
        else { process.exit(1); } \
    }).on('error', () => { process.exit(1); })"

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=3000

# Start the application
CMD ["node", "dist/index.js"]