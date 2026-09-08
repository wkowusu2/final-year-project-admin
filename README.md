# RoadPulse Command — Administrator Console

RoadPulse Command is the React and Vite web console for authorised RoadPulse Ghana administrators. It provides an aggregate operational view of road conditions and supports incident and advisory management.

## Features

- Administrator sign-in and refresh-token handling
- Aggregate traffic dashboard and map
- Recent incident review and status updates
- Road-advisory creation and maintenance
- Route and simulation presentation views

## Prerequisites

- Node.js and npm
- A running RoadPulse backend, normally available at `http://localhost:3000`
- A valid administrator account provisioned through the backend/database

## Setup and run

```bash
npm install
npm run dev
```

Vite prints the local development URL after startup. To create and preview a production bundle:

```bash
npm run build
npm run preview
```

## Configuration

The application currently calls the backend at `http://localhost:3000/api/v1`. This value is defined in `src/main.jsx`, `src/TrafficMap.jsx` and `src/AdvisoryRoadPicker.jsx`; update all three locations when deploying to another environment.

The optional `VITE_CARTO_BASEMAP_KEY` value in `.env` is used by the map presentation. Do not commit real API keys or administrator credentials to a public repository.

## Security note

The console stores authenticated session data locally to support token refresh. Production deployment should use HTTPS, restricted API origins, strong administrator credentials, secure token-storage review and appropriate session-expiry controls.

## Related projects

- [`../backend`](../backend): API, dashboard data, incident and advisory endpoints
- [`../driverApp/move_with_vim`](../driverApp/move_with_vim): driver-facing mobile application
