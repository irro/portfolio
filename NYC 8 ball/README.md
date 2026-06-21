# 🎱 NYC 8 Ball

Ask the magic 8 ball **"what should I do in New York today?"** and it shakes up a
random **free or cheap** thing to do in NYC — capped at **$50 per person**
(transit excluded). Comes with an admin panel to add, edit, delete, reorder, and
activate/deactivate the responses.

The interface is fully responsive and scales cleanly from **phone → tablet →
HD → 4K**.

## Quick start

No dependencies to install — it runs on the Node.js standard library.

```bash
cd "NYC 8 ball"
node server.js
```

Then open:

- **Site:** http://localhost:3000
- **Admin:** http://localhost:3000/admin.html

The default admin password is `nyc8ball`. Change it by setting an environment
variable:

```bash
ADMIN_PASSWORD="your-secret" PORT=8080 node server.js
```

(You can also `npm start` if you prefer.)

## How it works

| Piece | What it does |
| --- | --- |
| `server.js` | Zero-dependency Node HTTP server: serves the front-end + a small JSON REST API and the password-protected admin API. |
| `public/` | The responsive front-end (the 8 ball) and the admin dashboard. |
| `data/seed.json` | The starter set of NYC activities (the source of truth, committed to git). |
| `data/db.json` | The live data store, created automatically from the seed on first run. Git-ignored so it can be edited freely. |

### Responsiveness

The ball and typography are sized with a single fluid unit (`clamp()` against
`vmin`), so the layout stays proportional at any resolution. Dedicated
breakpoints handle the big jumps:

- **Phones** (incl. short landscape) — single-screen layout, larger tap target.
- **Tablets** — comfortable spacing.
- **HD (≈1080p)** — default fluid sizing.
- **4K (≥2000px wide)** — the ball and admin grid scale up so the screen
  doesn't feel empty.

### Admin panel features

- **Sign in** with the admin password (session cookie, in-memory).
- **Add / Edit / Delete** responses via a modal form.
- **Activate / deactivate** each response with a toggle — only active ones can
  be returned by the 8 ball.
- **Reorder** with ↑ / ↓ (the "custom order" the API uses by default).
- **Sort** the table by title, cost, category, or borough.
- **Search** across title, category, borough, description, and cost notes.
- Cost is validated to stay between **$0 and $50** per person.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/random` | A random **active** response (this is what the ball calls). |
| `GET` | `/api/activities` | All active responses. |
| `GET` | `/api/meta` | Counts, max cost, categories, boroughs. |
| `POST` | `/api/admin/login` | `{ password }` → sets session cookie. |
| `POST` | `/api/admin/logout` | Clears the session. |
| `GET` | `/api/admin/session` | `{ authed: bool }`. |
| `GET` | `/api/admin/activities` | All responses (active + inactive). |
| `POST` | `/api/admin/activities` | Create a response. |
| `PUT` / `PATCH` | `/api/admin/activities/:id` | Update / partial-update (incl. toggling `active`). |
| `DELETE` | `/api/admin/activities/:id` | Delete a response. |
| `POST` | `/api/admin/reorder` | `{ order: [id, …] }` → persist custom order. |

All `/api/admin/*` endpoints (except `login` / `logout` / `session`) require the
session cookie.

## Notes

- Costs are **per person** and **exclude transit**. Many entries are free or
  pay-what-you-wish; a few have a small ticket price. Prices and free hours
  change — verify before you go.
- Data is stored in a plain JSON file, which is perfect for a single-admin app.
  For a multi-user / production deployment you'd swap the store for a database
  and add stronger auth.
