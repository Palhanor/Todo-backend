FROM node:18 AS base

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Development stage
FROM base AS development
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
# Remove devDependencies for a smaller image
RUN npm prune --production
EXPOSE 3001
CMD ["npm", "start"]
