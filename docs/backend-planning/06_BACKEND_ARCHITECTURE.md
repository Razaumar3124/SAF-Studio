# Phase 6: FastAPI Backend Architecture & Project Structure

**Project:** SAF Studio Backend  
**Architecture Paradigm:** Pragmatic Modular Monolith with Layered Clean Architecture  
**Language & Runtime:** Python 3.12+  
**Framework:** FastAPI 0.115+  
**Database Driver:** Official Asynchronous MongoDB Driver (`PyMongo Async` / `Motor`)  
**Validation:** Pydantic v2 (Strict Schema Engine)  
**Date:** November 7, 2026

---

## 1. Architectural Style & Layered Pattern

The SAF Studio backend is structured as a **Pragmatic Modular Monolith**. It delivers complete separation of concerns without the operational complexity and network latency of microservices:

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        FE[SAF Studio Frontend]
    end

    subgraph Entry ["API Gateway & Middleware"]
        CORS[CORS Middleware]
        RateLimit[Rate Limiting (slowapi)]
        ErrHandle[Standard Error Handler Middleware]
    end

    subgraph Routers ["FastAPI Routers (/api/v1)"]
        R_Auth[auth/router.py]
        R_Cat[catalog/router.py]
        R_Photo[photos/router.py]
        R_Geo[geometry/router.py]
        R_Price[pricing/router.py]
        R_Dsgn[designs/router.py]
        R_Quote[quotes/router.py]
    end

    subgraph Services ["Service Layer (Business Logic)"]
        S_Auth[AuthService]
        S_Photo[PhotoProcessingService]
        S_Geo[GeometrySolverService]
        S_Price[PricingCalculationService]
        S_Dsgn[DesignVersioningService]
        S_Quote[QuotationWorkflowService]
    end

    subgraph Repos ["Repository Layer (Data Access)"]
        Repo_User[UserRepository]
        Repo_Photo[PhotoRepository]
        Repo_Cat[CatalogRepository]
        Repo_Dsgn[DesignRepository]
        Repo_Quote[QuoteRepository]
    end

    subgraph Persistence ["Persistence & Storage Layer"]
        MongoDB[(MongoDB 7.0+)]
        Disk[Local / Object Media Storage]
    end

    FE --> CORS
    CORS --> RateLimit
    RateLimit --> ErrHandle
    ErrHandle --> Routers
    Routers --> Services
    Services --> Repos
    Repos --> MongoDB
    S_Photo --> Disk
```

---

## 2. Directory Layout

The codebase resides in the existing `backend/` folder:

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # Application factory, lifespan, middleware
│   │
│   ├── core/                       # Cross-cutting foundational modules
│   │   ├── __init__.py
│   │   ├── config.py               # Pydantic BaseSettings (env vars, secrets)
│   │   ├── database.py             # Async MongoDB connection lifecycle & client
│   │   ├── security.py             # Argon2id hashing, JWT encoding/decoding, cookies
│   │   ├── exceptions.py           # Custom domain exception classes
│   │   ├── error_handlers.py       # Global exception handlers (standard envelope)
│   │   ├── dependencies.py         # Common FastAPI DI dependencies (db, current_user)
│   │   └── logging.py              # Structured JSON logging configuration
│   │
│   ├── common/                     # Shared models and utility primitives
│   │   ├── __init__.py
│   │   ├── models.py               # PyObjectId, TimestampedModel, MongoBaseModel
│   │   ├── pagination.py           # Pagination parameters & ListResponse envelope
│   │   └── storage.py              # Filesystem / S3 object storage abstraction
│   │
│   └── modules/                    # Self-contained functional domain modules
│       ├── auth/
│       │   ├── __init__.py
│       │   ├── router.py           # POST /register, /login, /refresh, /logout, /me
│       │   ├── schemas.py          # RegisterRequest, LoginRequest, AuthResponse
│       │   ├── service.py          # Credential verification, token rotation
│       │   ├── repository.py       # User & refresh token queries
│       │   └── models.py           # UserInDB, RefreshTokenInDB
│       │
│       ├── catalog/
│       │   ├── __init__.py
│       │   ├── router.py           # GET /frame-materials, GET /frames
│       │   ├── schemas.py          # FrameMaterialOut, FrameMoldingOut
│       │   ├── service.py          # Catalog query service
│       │   └── repository.py       # Frame materials & moldings data access
│       │
│       ├── templates/
│       │   ├── __init__.py
│       │   ├── router.py           # GET /templates, GET /templates/{id}
│       │   ├── schemas.py          # LayoutTemplateOut, TemplateQuery
│       │   ├── service.py          # Template retrieval service
│       │   └── repository.py       # MongoDB templates data access
│       │
│       ├── photos/
│       │   ├── __init__.py
│       │   ├── router.py           # POST /upload, GET /photos, GET /thumbnail, /preview
│       │   ├── schemas.py          # PhotoOut, PhotoUploadResponse
│       │   ├── service.py          # Pillow resize, EXIF rotation, signature verify
│       │   └── repository.py       # Photos collection queries
│       │
│       ├── geometry/
│       │   ├── __init__.py
│       │   ├── router.py           # POST /validate-layout, POST /generate-layout
│       │   ├── schemas.py          # ValidateLayoutRequest/Response, GenerateLayoutRequest
│       │   ├── service.py          # Layout solver, collision detection, bounds check
│       │   └── engine/             # Pure math algorithms (ported from frontend geometry)
│       │       ├── rect.py         # Bounds, translate, overlap detection
│       │       ├── layouts.py      # Grid, salon, centre, row solvers
│       │       └── random.py       # Mulberry32 deterministic PRNG
│       │
│       ├── pricing/
│       │   ├── __init__.py
│       │   ├── router.py           # POST /calculate
│       │   ├── schemas.py          # PriceCalculationRequest/Response
│       │   ├── service.py          # Perimeter, moulding, matting, GST, shipping calc
│       │   └── repository.py       # Pricing config rates & postal pincodes
│       │
│       ├── designs/
│       │   ├── __init__.py
│       │   ├── router.py           # POST/GET /designs, POST /versions, PATCH, DELETE
│       │   ├── schemas.py          # CreateDesignRequest, SaveVersionRequest, DesignOut
│       │   ├── service.py          # Design creation, version snapshotting, ownership
│       │   └── repository.py       # Designs and design_versions data access
│       │
│       ├── quotes/
│       │   ├── __init__.py
│       │   ├── router.py           # POST /quotes, GET /quotes, GET /{id}, PATCH /status
│       │   ├── schemas.py          # CreateQuoteRequest, QuoteOut, QuoteSummaryOut
│       │   ├── service.py          # Atomic quote numbering, freeze price, dispatch email
│       │   └── repository.py       # Quotes collection data access
│       │
│       └── system/
│           ├── __init__.py
│           ├── router.py           # GET /health/live, GET /health/ready
│           └── schemas.py          # HealthResponse
│
├── tests/                          # Automated Pytest suite
│   ├── conftest.py                 # Async test client fixture, mock Mongo, test tokens
│   ├── test_auth.py                # Registration, login, refresh rotation, rate limits
│   ├── test_catalog.py             # Catalog querying & filtering
│   ├── test_photos.py              # Image upload, MIME verification, streaming
│   ├── test_geometry.py            # Overlap collision detection, boundary invariants
│   ├── test_pricing.py             # Linear calculations, GST 18%, pincode lookups
│   ├── test_designs.py             # Design CRUD, version history, BOLA isolation
│   └── test_quotes.py              # Sequence number generation, quote snapshots
│
├── .env.example                    # Template environment variables
├── pyproject.toml                  # Project dependencies & tool configurations
└── README.md                       # Developer setup & execution guide
```

---

## 3. Core Architecture Components

### 3.1 Pydantic Configuration (`core/config.py`)
```python
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "SAF Studio API"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = Field(..., description="JWT signing key (min 32 bytes)")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "saf_studio"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Storage
    MEDIA_ROOT: str = "./data/media"
    MAX_UPLOAD_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
```

### 3.2 Asynchronous MongoDB Lifecycle (`core/database.py`)
```python
from pymongo import AsyncMongoClient
from app.core.config import settings

class DatabaseManager:
    client: AsyncMongoClient = None
    db = None

    @classmethod
    async def connect(cls):
        cls.client = AsyncMongoClient(
            settings.MONGODB_URL,
            maxPoolSize=50,
            minPoolSize=10,
            serverSelectionTimeoutMS=5000
        )
        cls.db = cls.client[settings.DATABASE_NAME]

    @classmethod
    async def disconnect(cls):
        if cls.client:
            await cls.client.close()

db_manager = DatabaseManager()
```

### 3.3 Custom ObjectId Pydantic Serialization (`common/models.py`)
```python
from typing import Annotated, Any
from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

def validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str) and ObjectId.is_valid(v):
        return v
    raise ValueError("Invalid ObjectId string")

PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]

class MongoBaseModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
```

### 3.4 Standard Error Envelope Middleware (`core/error_handlers.py`)
Normalizes all exceptions into the client contract:
```python
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from datetime import datetime, timezone

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = [
        {"field": str(e["loc"][-1]), "issue": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters",
                "details": details,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    )
```

---

## 4. Layered Separation of Responsibilities

| Layer | Primary Duty | Rules & Guardrails |
|---|---|---|
| **Router (`router.py`)** | HTTP mapping, path parsing, status codes, dependency injection. | **Zero business logic.** Never interacts with the database directly. Only calls Service methods. |
| **Schema (`schemas.py`)** | Request validation, type coercion, response serialization. | Pydantic v2 strict models. Validates string lengths, regex patterns, enum values. |
| **Service (`service.py`)** | Core business rules, calculation engines, transaction orchestration. | Reusable across CLI or worker tasks. Independent of HTTP request objects. |
| **Repository (`repository.py`)** | Data access, MongoDB queries, aggregation pipelines, projections. | Only layer executing PyMongo operations. Enforces tenancy (`user_id`). |
| **Model (`models.py`)** | Internal database representations (BSON shapes). | Represents documents stored in MongoDB collections. |

---

## 5. Dependency Injection Architecture

FastAPI dependencies (`core/dependencies.py`) enforce access control and tenancy cleanly:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_token
from app.modules.auth.repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token"
        )
    user = await UserRepository.find_by_id(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    return user

async def require_admin(current_user = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return current_user
```

---

## 6. Observability, Logging & Health

1. **Structured JSON Logs:** Uses `structlog` or standard library JSON formatting to emit machine-readable log lines including `request_id`, `user_id`, `path`, `method`, `duration_ms`, and `status_code`.
2. **Health Endpoints:**
   - `/api/v1/health/live`: Returns 200 immediately.
   - `/api/v1/health/ready`: Performs `await db.command("ping")`, confirming MongoDB connectivity.

