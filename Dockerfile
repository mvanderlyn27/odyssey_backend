# Use the official Node.js image.
# https://hub.docker.com/_/node
FROM node:slim

# Install Bun globally
RUN apt-get update && apt-get install -y curl unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    apt-get remove -y curl unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Add bun to the PATH
ENV PATH="/root/.bun/bin:${PATH}"

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package.json bun.lockb ./

# Install production dependencies using Bun.
# --frozen-lockfile ensures we use dependencies exactly as defined in bun.lockb (Removed for flexibility in CI)
RUN bun install

# Copy local code to the container image.
# This includes the src/ directory and tsconfig.json etc.
COPY . .

# Build the TypeScript code to JavaScript in the build/ directory
RUN bun run build

# Run the web service on container startup using Bun
CMD ["bun", "start"]
