# An Automated Decision Support System for Analyzing and Optimizing Intellectual Inequality
### Ampara District, Sri Lanka — Final Research Project

A full-stack decision support system that ingests trilingual (English/Sinhala/Tamil)
Google Form survey data, normalizes it into a PostgreSQL database, analyzes
intellectual-performance inequality across educational qualification groups, trains a
machine-learning model to identify the drivers of high aptitude performance, and
generates evidence-based policy recommendations.

## Architecture

```
Google Form ──> Google Sheet ──> Ingestion service (automation + trilingual normalization)
                                        │  deduplicated upserts
                                        ▼
                                  PostgreSQL (Docker)
                                        │
                    ┌───────────────────┼──────────────────────┐
                    ▼                   ▼                      ▼
             FastAPI REST API    ML model (Random Forest)  Decision engine
                    │            high-performer prediction  gap analysis + Gini +
                    ▼            + feature importances      rule-based recommendations
             React dashboard  <────────────────────────────────┘
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, custom chart components — pie/donut, bar, column (light/dark, CVD-validated palette) |
| Backend | Python 3.13, FastAPI, SQLAlchemy 2 |
| Database | PostgreSQL 16 (Docker, port 5434) |
| ML | scikit-learn Random Forest, cross-validated |

## Features

- **Home page** — six educational-qualification group cards (Below O/L → Postgraduate),
  followed by the overall district-wide analysis: **performance gaps by factor** and
  prioritized **recommendations** across all groups.
- **Group pages** — each qualification group opens on its own page (`/group?level=…`)
  with the full **14-point analysis** in the required order: percentage, gender, English
  proficiency, parents' education, study environment, household income, learning device,
  internet quality, study hours, software literacy, library accessibility, external
  resources, extracurricular engagement, performance score — plus a link to that group's
  decisions.
- **Group decisions page** — group-specific only (`/decisions?level=…`): group average
  vs overall, top barriers, key findings, and recommendations for that group. The full
  overall view (Gini coefficient, key findings, ML feature importances) remains at
  `/decisions`.
- **Needs page** — resource-gap profile for every qualification group.
- **District map** — interactive Sri Lanka choropleth (geoBoundaries ADM2, ODbL) of survey
  coverage with the Ampara focus district highlighted; click any district for its profile.
- **Comments & support requests** — the message icon in the navbar opens a public form
  (name, contact number, address, requirement description, optional proof document —
  image/PDF/any file up to 10 MB). Submissions land in the admin dashboard's "Support
  requests" section for review; once approved they are displayed publicly on the same
  page under **"Support required"**.
- **Admin dashboard** — opened via the gear icon in the navbar and protected by a login
  (credentials in `backend/.env`: `ADMIN_USERNAME` / `ADMIN_PASSWORD`, default
  `admin` / `admin123`). Two tabs: **Analytics** (default — dataset health,
  score/education/district distributions, model metrics, ingestion history, "Sync data
  now" and "Retrain model") and **Support** (review submitted support requests — click a
  request for full details and approve / reject it).
- **Navbar** — Needs, District Map, and the admin gear icon; the tab for the current
  page is highlighted.
- **Live data pipeline** — survey responses are pulled directly from the Google Form's
  response sheet (any Sheets link works, see `backend/.env`); the backend re-syncs every
  15 minutes, deduplicates rows (content hashing), and retrains the model automatically
  when new responses arrive.

## Requirements

| Tool | Version | Used for |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | any recent | Runs PostgreSQL 16 (no local Postgres install needed) |
| [Python](https://www.python.org/downloads/) | 3.11+ | FastAPI backend + ML model |
| [Node.js](https://nodejs.org/) | 18+ | React/Vite frontend |

On first start the backend seeds the database from the live Google Sheet configured in
`backend/.env`. The CSV file in the project root
(`An_Automated_Decision_Support_System_For_Analyzing_And_Optimizing.csv`) is an earlier
pilot sample kept only as a fallback data source when no sheet is configured.

## Setup (first time)

All commands are PowerShell, run from the project root.

**1. Start the database**

```powershell
docker compose up -d
```

This starts PostgreSQL 16 in a container named `ampara_dss_db` on **localhost:5434**
(user `dss_user`, password `dss_password`, database `ampara_dss` — defined in
`docker-compose.yml`). Data persists in a Docker volume across restarts.

**2. Configure the backend**

Create `backend/.env` with the following content (required — without it the backend
looks for the database on the wrong port):

```ini
DATABASE_URL=postgresql+psycopg2://dss_user:dss_password@localhost:5434/ampara_dss
CSV_PATH=../An_Automated_Decision_Support_System_For_Analyzing_And_Optimizing.csv
# Google Sheet for live sync — any Sheets link works (share link, publish-to-web, or direct CSV).
# The sheet must be shared as 'Anyone with the link: Viewer'.
GOOGLE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/1nwq7iL_2LQdfWmzDz_vKMkj2nR0ra2ChAqcoEQcfcYs/edit?usp=sharing
# Minutes between automatic Google Sheet syncs (0 = disabled)
SYNC_INTERVAL_MINUTES=15
# Admin dashboard credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

**3. Install backend dependencies**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
cd ..
```

**4. Install frontend dependencies**

```powershell
cd frontend
npm install
cd ..
```

## Running the system

**Option A — one-click launcher:**

```powershell
.\start.ps1
```

Starts the database, backend, and frontend, then opens the app in your browser.
Close the two PowerShell windows it spawns to stop.

**Option B — manual (two terminals):**

```powershell
docker compose up -d                                                     # database
cd backend; .\venv\Scripts\python -m uvicorn app.main:app --port 8000    # terminal 1
cd frontend; npm run dev                                                 # terminal 2
```

Then open **http://localhost:5173**.

On first start the backend automatically creates the database schema, seeds it from the
live Google Sheet (falling back to the bundled CSV if no sheet is configured), and
trains the Random Forest model — no manual migration or import step.
API docs (Swagger): **http://localhost:8000/docs** · Health check: `GET /api/health`

### Live Google Sheet sync

The system is configured (in `backend/.env`) to pull survey responses live from the
Google Form's response sheet. Any Google Sheets link works as `GOOGLE_SHEET_CSV_URL` —
a regular share link, a publish-to-web link, or a direct CSV export link — as long as
the sheet is shared as **"Anyone with the link: Viewer"**. With
`SYNC_INTERVAL_MINUTES=15`, the backend re-pulls the sheet every 15 minutes,
deduplicates rows (content hashing), and retrains the model when new responses arrive.
You can also trigger a sync manually from the Admin dashboard ("Sync data now").

On first start (empty database) the backend seeds directly from the Google Sheet;
the bundled CSV in the project root is only a fallback when no sheet is configured.

### Troubleshooting

- **`error during connect ... dockerDesktopLinuxEngine`** — Docker Desktop is not
  running. Start it and wait until the whale icon settles, then rerun `docker compose up -d`.
- **Backend can't reach the database** — confirm the container is healthy
  (`docker compose ps`) and that `backend/.env` exists with the port **5434** URL above.
- **Port already in use** — 5434 (Postgres), 8000 (API), and 5173 (frontend) must be
  free; stop whatever holds them or change the port in `docker-compose.yml` / the
  uvicorn command / `frontend/vite.config.js`.
- **Not enough labeled data to train** — the model needs 20+ scored responses; make
  sure the Google Sheet seeded correctly (check the Admin dashboard's Analytics tab).
- **Google Sheet sync fails** — confirm the sheet is shared as "Anyone with the link:
  Viewer"; the backend logs a clear error if the sheet returns a login page instead
  of CSV.

### Stopping

```powershell
# stop backend/frontend: Ctrl+C in their terminals (or close the start.ps1 windows)
docker compose down          # stop the database (data is kept)
docker compose down -v       # stop AND delete all database data (re-seeds on next start)
```

## Key results

The dataset is live — the numbers below are a snapshot (2026-07-04, n = 563) and
update automatically as new form responses arrive.

- Average aptitude score rises with education level: 0.90/5 (Below O/L) →
  2.40/5 (A/L and above).
- Largest inequality gaps: daily online study hours (3.0 pts), household income
  (1.9 pts), library distance (1.7 pts), and extracurricular participation (1.5 pts).
- Random Forest cross-validated accuracy 86%; top predictors: education level,
  software literacy, English proficiency. (High performers are rare in the live
  data — ~13% — so the majority baseline is also high; treat feature importances,
  not raw accuracy, as the model's main output.)
- Score Gini coefficient: 0.471 — substantially higher inequality than in the
  earlier pilot sample.
