FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY package.json /app/package.json
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node backend/ ./
COPY --chown=node:node dist/core.js /app/dist/core.js
USER node
EXPOSE 8080
CMD ["node", "server.js"]
