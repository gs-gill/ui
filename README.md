# Pulse

Pulse is a responsive real-time chat app with a public room, direct messages, presence, typing indicators, unread counts, in-app toasts, optional sound/browser notifications, and short in-memory room history.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in two browser windows with different names to test messaging.

## Test

```bash
npm test
```

The integration suite covers joining, duplicate names, presence, public messages, room history, DMs, reply routing, typing events, invalid recipients, and disconnects.

## Deploy on Render

Create a **Web Service** from this repository with:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`

Render supplies the `PORT` environment variable automatically. No other environment variables are required.

Messages and profiles live in memory, so they reset whenever the service restarts. Add a database and authentication before using the app for sensitive or persistent conversations.
