# RoadPulse Command

Install dependencies and start the React development server:

```bash
npm install
npm run dev
```

Sign in through the admin login page. The seeded administrator is:

```text
admin@roadplus.com
password123
```

The app stores the returned access and refresh tokens locally. If the dashboard receives a 401 response, it requests a rotated refresh token once and retries the original dashboard request.

The authenticated dashboard request is:

```text
GET /api/v1/admin/dashboard?windowMinutes=30
Authorization: Bearer <admin access token>
```
