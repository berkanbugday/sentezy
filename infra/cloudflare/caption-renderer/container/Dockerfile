# Cloudflare Container image: Node + Chromium + FFmpeg + the Remotion caption bundle.
# BUILD FROM THE REPO ROOT so the monorepo's packages/remotion is in the build context:
#   docker build -f infra/cloudflare/caption-renderer/container/Dockerfile .
# (wrangler does this automatically when it builds the container image.)
FROM node:22-bookworm-slim

# Chromium + FFmpeg + fonts. Remotion drives headless Chromium; we point it at the apt
# chromium binary and skip Remotion's own download (REMOTION_-specific env — the generic
# PUPPETEER_EXECUTABLE_PATH does NOT work with Remotion).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ffmpeg \
      fonts-liberation \
      fonts-noto-color-emoji \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV REMOTION_CHROME_EXECUTABLE_PATH=/usr/bin/chromium
ENV REMOTION_SKIP_DOWNLOAD_BROWSER=1
ENV NODE_ENV=production

WORKDIR /app

# The Remotion project (source + fonts). Its own deps are installed so the bundler can build it.
# Strip the workspace-only devDeps (@sentezy/*, type-only) first — a standalone `npm install`
# can't resolve the `workspace:*` protocol outside the pnpm workspace.
COPY packages/remotion ./remotion
RUN cd remotion \
    && node -e "const fs=require('fs');const p=require('./package.json');for(const s of ['dependencies','devDependencies'])for(const k of Object.keys(p[s]||{}))if(k.startsWith('@sentezy/'))delete p[s][k];fs.writeFileSync('./package.json',JSON.stringify(p,null,2));" \
    && npm install --omit=dev --no-audit --no-fund

# The container HTTP server + its deps.
COPY infra/cloudflare/caption-renderer/container/package.json ./package.json
COPY infra/cloudflare/caption-renderer/container/server.mjs ./server.mjs
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 8080
CMD ["node", "server.mjs"]
