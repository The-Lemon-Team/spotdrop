FROM node:22-alpine

# Install yt-dlp and ffmpeg for YouTube audio extraction
RUN apk add --no-cache yt-dlp ffmpeg curl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV YT_DLP_PATH=yt-dlp

# Install production node dependencies
WORKDIR /app/web
COPY web/package.json ./
RUN npm install --omit=dev

# Copy server scripts and frontend distribution
COPY web/server ./server
COPY web/dist ./dist

# Copy default profile directory
WORKDIR /app
COPY defaults ./defaults

WORKDIR /app/web

EXPOSE 3001

CMD ["node", "server/standaloneServer.mjs"]
