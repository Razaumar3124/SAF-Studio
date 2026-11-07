import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_live_endpoint(client: AsyncClient):
    """Test that GET /api/v1/health/live returns 200 with service metadata."""
    response = await client.get("/api/v1/health/live")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "saf-studio-api"
    assert "version" in data
    assert isinstance(data["uptime_seconds"], (int, float))
    assert data["uptime_seconds"] >= 0


@pytest.mark.asyncio
async def test_health_live_independent_of_db(client: AsyncClient, mock_mongo_disconnected):
    """Test that GET /api/v1/health/live succeeds even when MongoDB is completely unreachable."""
    response = await client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_health_ready_success(client: AsyncClient, mock_mongo_connected):
    """Test that GET /api/v1/health/ready returns 200 when MongoDB is connected."""
    response = await client.get("/api/v1/health/ready")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ready"
    assert data["service"] == "saf-studio-api"
    assert data["database"]["connected"] is True
    assert data["database"]["status"] == "connected"
    assert data["database"]["latency_ms"] == 1.45
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_ready_failure_returns_503(client: AsyncClient, mock_mongo_disconnected):
    """Test that GET /api/v1/health/ready returns 503 and standard error envelope
    when MongoDB fails.
    """
    response = await client.get("/api/v1/health/ready")
    assert response.status_code == 503

    data = response.json()
    assert "error" in data
    error = data["error"]
    assert error["code"] == "DATABASE_UNAVAILABLE"
    assert "unreachable" in error["message"].lower() or "failed" in error["message"].lower()
    assert len(error["details"]) > 0
    assert error["details"][0]["field"] == "database"
    assert "timestamp" in error


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    """Test root informational endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "SAF Studio Test API"
    assert data["health"] == "/api/v1/health/live"
