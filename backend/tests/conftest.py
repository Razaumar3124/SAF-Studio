from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings
from app.db.mongodb import mongo_manager
from app.main import create_application


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Test environment settings fixture."""
    return Settings(
        APP_NAME="SAF Studio Test API",
        ENVIRONMENT="test",
        DEBUG=True,
        MONGODB_URL="mongodb://localhost:27017",
        DATABASE_NAME="saf_studio_test",
        MONGODB_TIMEOUT_MS=1000,
        CORS_ORIGINS=["http://localhost:5173"],
        LOG_LEVEL="DEBUG",
    )


@pytest.fixture
def app(test_settings: Settings):
    """FastAPI test app instance with overridden settings."""
    application = create_application()
    application.dependency_overrides[get_settings] = lambda: test_settings
    return application


@pytest.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """Asynchronous HTTP test client bound to ASGI transport."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as async_client:
        yield async_client


@pytest.fixture
def mock_mongo_connected():
    """Mock mongo_manager ping to simulate a healthy, connected MongoDB instance."""
    with patch.object(mongo_manager, "ping", new_callable=AsyncMock) as mock_ping:
        mock_ping.return_value = 1.45
        yield mock_ping


@pytest.fixture
def mock_mongo_disconnected():
    """Mock mongo_manager ping to simulate an unreachable database."""
    from app.core.exceptions import DatabaseUnavailableException

    with patch.object(mongo_manager, "ping", new_callable=AsyncMock) as mock_ping:
        mock_ping.side_effect = DatabaseUnavailableException(
            message="Database service is currently unreachable",
            issue="ServerSelectionTimeoutError: connection refused",
        )
        yield mock_ping
