import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """Test successful user registration returns 201 with User and Tokens."""
    payload = {
        "full_name": "Aarav Sharma",
        "email": "aarav.sharma@example.com",
        "phone": "+919876543210",
        "password": "SecurePassword123!",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "user" in data
    assert "tokens" in data

    # Check user attributes
    user = data["user"]
    assert user["email"] == "aarav.sharma@example.com"
    assert user["full_name"] == "Aarav Sharma"
    assert user["phone"] == "+919876543210"
    assert user["role"] == "customer"
    assert user["is_active"] is True
    assert "id" in user
    assert "created_at" in user

    # Check tokens
    tokens = data["tokens"]
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"
    assert tokens["expires_in"] == 1800

    # Verify httpOnly refresh cookie was set
    cookies = response.cookies
    assert "refresh_token" in cookies
    assert cookies["refresh_token"] == tokens["refresh_token"]


@pytest.mark.asyncio
async def test_register_duplicate_email_conflict(client: AsyncClient):
    """Test registering with an existing email returns 409 with field error."""
    payload1 = {
        "full_name": "First User",
        "email": "duplicate@example.com",
        "phone": "+919876543210",
        "password": "Password123!",
    }
    res1 = await client.post("/api/v1/auth/register", json=payload1)
    assert res1.status_code == 201

    # Attempt second registration with same email but different phone
    payload2 = {
        "full_name": "Second User",
        "email": "duplicate@example.com",
        "phone": "+919876543211",
        "password": "Password123!",
    }
    res2 = await client.post("/api/v1/auth/register", json=payload2)
    assert res2.status_code == 409

    data = res2.json()
    assert data["error"]["code"] == "ACCOUNT_ALREADY_EXISTS"
    assert data["error"]["details"][0]["field"] == "email"


@pytest.mark.asyncio
async def test_register_duplicate_phone_conflict(client: AsyncClient):
    """Test registering with an existing phone returns 409 with field error."""
    payload1 = {
        "full_name": "First User",
        "email": "user1@example.com",
        "phone": "+919876543210",
        "password": "Password123!",
    }
    res1 = await client.post("/api/v1/auth/register", json=payload1)
    assert res1.status_code == 201

    payload2 = {
        "full_name": "Second User",
        "email": "user2@example.com",
        "phone": "+919876543210",
        "password": "Password123!",
    }
    res2 = await client.post("/api/v1/auth/register", json=payload2)
    assert res2.status_code == 409

    data = res2.json()
    assert data["error"]["code"] == "ACCOUNT_ALREADY_EXISTS"
    assert data["error"]["details"][0]["field"] == "phone"


@pytest.mark.asyncio
async def test_register_invalid_phone_format(client: AsyncClient):
    """Test registration with invalid mobile number returns 422 validation error."""
    payload = {
        "full_name": "Valid Name",
        "email": "valid@example.com",
        "phone": "12345",  # Invalid non-Indian short number
        "password": "Password123!",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_register_weak_password_validation(client: AsyncClient):
    """Test registration with weak password (missing digits) returns 422."""
    payload = {
        "full_name": "Valid Name",
        "email": "valid@example.com",
        "phone": "+919876543210",
        "password": "onlyletters",  # Missing numbers
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_register_password_too_short(client: AsyncClient):
    """Test registration with password under 8 characters returns 422."""
    payload = {
        "full_name": "Valid Name",
        "email": "valid@example.com",
        "phone": "+919876543210",
        "password": "P1!",  # Too short
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
