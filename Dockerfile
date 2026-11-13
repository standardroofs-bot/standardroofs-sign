FROM node:22-slim AS base
WORKDIR /app

# Install system dependencies including LibreOffice for robust headless .docx/.xlsx conversions
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests & install npm dependencies
COPY package*.json ./
RUN npm ci

# Copy entire source code
COPY . .

# Generate Prisma Client & Build Next.js Application
RUN npx prisma generate && npm run build

# Expose internal port
EXPOSE 3030
ENV PORT=3030
ENV NODE_ENV=production

# On boot: sync database schema and launch Next.js production server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run start"]
