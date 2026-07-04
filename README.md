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

- **Home page** — six educational-qualification tabs (Below O/L → Postgraduate); clicking
  a tab loads the full **14-point analysis** for that group in the required order:
  percentage, gender, English proficiency, parents' education, study environment,
  household income, learning device, internet quality, study hours, software literacy,
  library accessibility, external resources, extracurricular engagement, performance score.
- **Decisions page** — Gini coefficient of scores, performance-gap analysis per
  socio-economic factor, ML feature importances, and prioritized recommendations.
- **Needs page** — resource-gap profile for every qualification group.
- **District map** — interactive Sri Lanka choropleth (geoBoundaries ADM2, ODbL) of survey
  coverage with the Ampara focus district highlighted; click any district for its profile.
- **Try Questions** — take the same 5 aptitude questions as respondents; scored live
  against the dataset with a percentile.
- **Admin dashboard** — dataset health, score/education/district distributions, model
  metrics, ingestion history, "Sync data now" and "Retrain model" actions.
- **Automated pipeline** — re-ingestion is deduplicated (content hashing); an optional
  published-Google-Sheet URL enables scheduled automatic syncs (see `backend/.env`).

## Requirements

| Tool | Version | Used for |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | any recent | Runs PostgreSQL 16 (no local Postgres install needed) |
| [Python](https://www.python.org/downloads/) | 3.11+ | FastAPI backend + ML model |
| [Node.js](https://nodejs.org/) | 18+ | React/Vite frontend |

The survey dataset `An_Automated_Decision_Support_System_For_Analyzing_And_Optimizing.csv`
must be present in the project root (it is included in this repository) — the backend
seeds the database from it on first start.

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
# Optional: published Google Sheet CSV URL for live sync (File > Share > Publish to web > CSV)
GOOGLE_SHEET_CSV_URL=
# Minutes between automatic Google Sheet syncs (0 = disabled)
SYNC_INTERVAL_MINUTES=0
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
survey CSV, and trains the Random Forest model — no manual migration or import step.
API docs (Swagger): **http://localhost:8000/docs** · Health check: `GET /api/health`

### Live Google Sheet sync (optional)

In Google Sheets: File → Share → Publish to web → select the responses sheet → CSV.
Put that URL in `backend/.env` as `GOOGLE_SHEET_CSV_URL` and set
`SYNC_INTERVAL_MINUTES=15`. The backend then pulls new form responses automatically,
deduplicates them (content hashing), and retrains the model when new data arrives.
You can also trigger a sync manually from the Admin dashboard ("Sync data now").

### Troubleshooting

- **`error during connect ... dockerDesktopLinuxEngine`** — Docker Desktop is not
  running. Start it and wait until the whale icon settles, then rerun `docker compose up -d`.
- **Backend can't reach the database** — confirm the container is healthy
  (`docker compose ps`) and that `backend/.env` exists with the port **5434** URL above.
- **Port already in use** — 5434 (Postgres), 8000 (API), and 5173 (frontend) must be
  free; stop whatever holds them or change the port in `docker-compose.yml` / the
  uvicorn command / `frontend/vite.config.js`.
- **Not enough labeled data to train** — the model needs 20+ scored responses; make
  sure the CSV seeded correctly (check the Admin dashboard's dataset health panel).

### Stopping

```powershell
# stop backend/frontend: Ctrl+C in their terminals (or close the start.ps1 windows)
docker compose down          # stop the database (data is kept)
docker compose down -v       # stop AND delete all database data (re-seeds on next start)
```

## Key results on the current dataset (n = 102)

- Average aptitude score rises monotonically with education level: 2.38/5 (O/L) →
  3.43/5 (Bachelor's).
- Largest inequality gaps: extracurricular participation (1.05 pts), study hours,
  parents' education, and household income.
- Random Forest cross-validated accuracy 76% vs a 70% majority baseline; top
  predictors: software literacy, age, household income.
- Score Gini coefficient: 0.241.
