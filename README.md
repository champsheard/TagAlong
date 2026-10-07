# Safe Walk

Safe Walk is a cross-platform walking companion. It is being built in milestones;
this first milestone provides the Expo app shell and the Express/SQLite API health
check. Route planning, maps, location sharing, and live tracking are not connected
yet.

## Requirements

- Node.js 22.13 or newer
- npm

## Run in Replit

The project uses two workflows:

- **Safe Walk Web** runs Expo web on port 5000.
- **Safe Walk API** runs the Express API on port 3001.

The API health endpoint is `GET /api/health`.

## Run locally

```sh
npm install
npm run dev:web
```

In a second terminal:

```sh
PORT=3001 npm run dev:server
```

Copy `.env.example` to `.env` when setting local environment values. Keep
server-only secrets out of `EXPO_PUBLIC_*` variables.
