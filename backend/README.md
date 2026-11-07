# SAF Studio — Backend Service

Asynchronous Python/FastAPI backend for **SAF Studio**, supporting custom gallery wall curation, geometry layout solving, framing pricing, and quotation workflows.

## Technology Stack

- **Language:** Python 3.12+
- **Web Framework:** [FastAPI](https://fastapi.tiangolo.com/) (0.115+)
- **ASGI Server:** [Uvicorn](https://www.uvicorn.org/) (with standard uvloop & httptools)
- **Database Driver:** [PyMongo Async](https://pymongo.readthedocs.io/) (Official asynchronous MongoDB driver)
- **Data Validation & Settings:** [Pydantic v2](https://docs.pydantic.dev/latest/) & [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- **Testing:** [Pytest](https://docs.pytest.org/) & [HTTPX](https://www.python-httpx.org/)
- **Linter & Formatter:** [Ruff](https://docs.astral.sh/ruff/)

---

## Directory Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entry & lifespan
│   ├── api/
│   │   ├── __init__.py
│   │   ├── dependencies.py      # Shared API dependencies (settings, db)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py        # Central API v1 router
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           └── health.py    # Liveness & readiness health probes
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Typed environment settings via pydantic-settings
│   │   ├── exceptions.py        # Custom domain exception classes
│   │   ├── handlers.py          # Global exception handlers (RFC error envelope)
│   │   └── logging.py           # Structured JSON/Text logging with credential masking
│   ├── db/
│   │   ├── __init__.py
│   │   ├── mongodb.py           # PyMongo Async connection manager & lifecycle
│   │   └── dependencies.py      # Database injection dependencies (get_db)
│   ├── models/                  # Internal database entity models (Phase 2+)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py            # Standard API error envelope schemas
│   │   └── health.py            # Health check response schemas
│   ├── repositories/            # Data access repositories (Phase 2+)
│   ├── services/                # Business services & calculation engines (Phase 2+)
│   └── utils/                   # Shared utility functions
├── tests/
│   ├── __init__.py
│   ├── conftest.py              # Pytest fixtures & async test client
│   ├── test_config.py           # Configuration & CORS validation tests
│   ├── test_errors.py           # Exception normalization & sanitization tests
│   └── test_health.py           # Liveness & readiness endpoint tests
├── .env.example                 # Documented template environment configuration
├── .gitignore                   # Git exclusion rules
├── pyproject.toml               # Project dependencies, Ruff & Pytest config
└── README.md                    # Developer documentation
```

---

## Getting Started

### 1. Prerequisites
- Python 3.12 or higher.
- [uv](https://github.com/astral-sh/uv) (recommended) or standard `python -m venv`.
- MongoDB 7.0+ (running locally at `mongodb://localhost:27017` or via Docker).

### 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Review and adjust settings in `.env` if necessary:

| Variable | Default Value | Description |
|---|---|---|
| `APP_NAME` | `SAF Studio API` | Application title |
| `ENVIRONMENT` | `development` | Environment (`development`, `staging`, `production`, `test`) |
| `DEBUG` | `true` | Enables Swagger UI and debug logs |
| `HOST` | `0.0.0.0` | Bind host |
| `PORT` | `8000` | Bind port |
| `API_V1_STR` | `/api/v1` | Prefix for version 1 API routes |
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection URI |
| `DATABASE_NAME` | `saf_studio` | Database name |
| `MONGODB_TIMEOUT_MS` | `5000` | Server selection and connection timeout |
| `CORS_ORIGINS` | `["http://localhost:5173", "http://127.0.0.1:5173"]` | Allowed frontend origins |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

### 3. Install Dependencies

Using `uv`:

```bash
uv pip install -e ".[dev]"
```

Or using standard `pip`:

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -e ".[dev]"
```

---

## Running the Application

### Development Server (with Auto-Reload)

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The service will start at `http://localhost:8000`.

### Interactive API Documentation
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI JSON:** [http://localhost:8000/api/v1/openapi.json](http://localhost:8000/api/v1/openapi.json)

*(Note: API docs are automatically disabled when `ENVIRONMENT=production` and `DEBUG=false`)*.

---

## Health Check APIs

### 1. Liveness Probe
- **Endpoint:** `GET /api/v1/health/live`
- **Purpose:** Verifies the FastAPI application worker is responsive (Kubernetes/container liveness).
- **Behavior:** Operates independently of database connectivity.
- **Success Response (200 OK):**
  ```json
  {
    "status": "ok",
    "service": "saf-studio-api",
    "version": "0.1.0",
    "uptime_seconds": 45.2
  }
  ```

### 2. Readiness Probe
- **Endpoint:** `GET /api/v1/health/ready`
- **Purpose:** Verifies that the service can communicate with MongoDB.
- **Behavior:** Executes a lightweight `ping` command against MongoDB.
- **Success Response (200 OK):**
  ```json
  {
    "status": "ready",
    "service": "saf-studio-api",
    "database": {
      "connected": true,
      "status": "connected",
      "latency_ms": 1.45
    },
    "timestamp": "2026-11-07T12:00:00.000Z"
  }
  ```
- **Failure Response (503 Service Unavailable):**
  ```json
  {
    "error": {
      "code": "DATABASE_UNAVAILABLE",
      "message": "Database service is currently unreachable",
      "details": [
        {
          "field": "database",
          "issue": "MongoDB ping timed out or refused connection"
        }
      ],
      "timestamp": "2026-11-07T12:00:00.000Z"
    }
  }
  ```

---

## Testing & Quality Assurance

### Run the Pytest Suite
```bash
pytest -v
```

### Run Ruff Linter
```bash
ruff check .
```

### Run Ruff Formatter Check
```bash
ruff format --check .
```

---

## Phase 1 Scope & Phase 2 Readiness

Phase 1 provides the foundational infrastructure:
- Modular-monolith folder structure.
- Asynchronous connection pool management via official PyMongo Async.
- Typed Pydantic v2 settings.
- Standard error envelope normalization conforming to `docs/API_CONTRACT.md`.
- Liveness and readiness endpoints.
- 100% automated test coverage of foundational components.

Phase 2 will introduce **Authentication, Users & Session Refresh Rotation** (`/api/v1/auth/*`).

