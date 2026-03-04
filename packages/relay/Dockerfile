FROM node:20-slim
WORKDIR /app
COPY packages/relay/dist ./dist
COPY packages/relay/package.json ./
COPY packages/shared/dist ./node_modules/@quorum/shared/dist
COPY packages/shared/package.json ./node_modules/@quorum/shared/
RUN npm install --omit=dev
EXPOSE 7777
CMD ["node", "dist/index.js"]
