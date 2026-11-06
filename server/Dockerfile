# Build from the repository root: docker build -f server/Dockerfile .
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w server --omit=dev --ignore-scripts && npm cache clean --force
COPY shared shared
COPY server/src server/src
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "server/src/index.js"]
