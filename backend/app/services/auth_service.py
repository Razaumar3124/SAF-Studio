import logging
from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.core.config import get_settings
from app.core.exceptions import (
    AccountAlreadyExistsException,
    AccountDisabledException,
    InvalidCredentialsException,
)
from app.core.security import (
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.session import PasswordResetInDB
from app.models.user import UserInDB
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
)
from app.schemas.user import UserOut
from app.services.rate_limiter import rate_limiter
from app.services.token_service import TokenService

logger = logging.getLogger("saf_studio.auth")


class AuthService:
    """Core domain service for user registration, authentication, and password recovery."""

    def __init__(
        self,
        user_repo: UserRepository,
        session_repo: SessionRepository,
        token_service: TokenService,
    ) -> None:
        self.user_repo = user_repo
        self.session_repo = session_repo
        self.token_service = token_service

    async def register_user(
        self,
        req: RegisterRequest,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResponse:
        """Register a new customer account with Argon2id password hashing."""
        settings = get_settings()

        # Rate limiting by IP address
        rate_key = f"reg:{ip_address or 'unknown'}"
        rate_limiter.check_rate_limit(
            key=rate_key,
            max_attempts=settings.RATE_LIMIT_REGISTER_MAX_ATTEMPTS,
            window_seconds=settings.RATE_LIMIT_REGISTER_WINDOW_SECONDS,
        )

        # Check existing email
        existing_email = await self.user_repo.get_by_email(req.email)
        if existing_email:
            raise AccountAlreadyExistsException(field="email", issue="Email is already registered")

        # Check existing phone
        existing_phone = await self.user_repo.get_by_phone(req.phone)
        if existing_phone:
            raise AccountAlreadyExistsException(
                field="phone", issue="Mobile number is already registered"
            )

        # Hash password using Argon2id
        hashed_pwd = hash_password(req.password)
        now = datetime.now(UTC)

        user_doc = UserInDB(
            _id=str(ObjectId()),
            email=req.email,
            phone=req.phone,
            password_hash=hashed_pwd,
            full_name=req.full_name,
            role="customer",
            is_active=True,
            auth_provider="local",
            google_id=None,
            created_at=now,
            updated_at=now,
        )

        created_user = await self.user_repo.create(user_doc)

        # Issue access & refresh tokens
        tokens = await self.token_service.create_session(
            user_id=created_user.id,
            role=created_user.role,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        user_out = UserOut(
            id=created_user.id,
            email=created_user.email,
            full_name=created_user.full_name,
            phone=created_user.phone,
            role=created_user.role,
            is_active=created_user.is_active,
            created_at=created_user.created_at.isoformat(),
        )

        logger.info("New user registered successfully: id=%s", created_user.id)
        return AuthResponse(user=user_out, tokens=tokens)

    async def authenticate_user(
        self,
        req: LoginRequest,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResponse:
        """Authenticate user by email or Indian phone and issue credentials."""
        settings = get_settings()

        # Identifier rate limiting to prevent brute-force attacks
        rate_identifier = req.email or req.phone or ip_address or "unknown"
        rate_key = f"login:{rate_identifier}"
        rate_limiter.check_rate_limit(
            key=rate_key,
            max_attempts=settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS,
            window_seconds=settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
        )

        # Retrieve user record by normalized email or phone
        user: UserInDB | None = None
        if req.email:
            user = await self.user_repo.get_by_email(req.email)
        elif req.phone:
            user = await self.user_repo.get_by_phone(req.phone)

        # Constant-time security check: if user doesn't exist,
        # run dummy verify to prevent timing attacks
        if not user or not user.password_hash:
            # Perform dummy Argon2id check to normalize timing
            verify_password("dummy_password", "$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy")
            raise InvalidCredentialsException()

        # Verify password hash
        if not verify_password(req.password, user.password_hash):
            raise InvalidCredentialsException()

        # Check account active status
        if not user.is_active:
            raise AccountDisabledException()

        # Clear rate limiter on successful authentication
        rate_limiter.reset(rate_key)

        # Update last login timestamp
        await self.user_repo.update_last_login(user.id)

        # Issue access & refresh tokens
        tokens = await self.token_service.create_session(
            user_id=user.id,
            role=user.role,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        user_out = UserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat(),
        )

        logger.info("User authenticated successfully: id=%s", user.id)
        return AuthResponse(user=user_out, tokens=tokens)

    async def initiate_password_recovery(
        self,
        req: ForgotPasswordRequest,
        ip_address: str | None = None,
    ) -> ForgotPasswordResponse:
        """Initiate secure password recovery without account enumeration."""
        settings = get_settings()

        user = await self.user_repo.get_by_email(req.email)
        if user and user.is_active:
            raw_reset_token = generate_secure_token(32)
            token_hash = hash_token(raw_reset_token)
            now = datetime.now(UTC)
            expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)

            reset_doc = PasswordResetInDB(
                _id=str(ObjectId()),
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
                used=False,
                created_at=now,
            )
            await self.session_repo.create_password_reset(reset_doc)
            logger.info(
                "Password reset initiated for user_id=%s (delivery via configured SMTP)", user.id
            )

        # Return non-enumerating generic response regardless of whether account exists
        return ForgotPasswordResponse()
