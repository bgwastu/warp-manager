FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    wireguard-tools \
    curl \
    jq \
    xxd \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY warp.sh /app/warp.sh
RUN chmod +x /app/warp.sh

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY tsconfig.json ./
COPY src/ ./src/

VOLUME /data
EXPOSE 8080

CMD ["bun", "run", "src/index.tsx"]
