from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import Settings, get_settings
from app.core.exceptions import (
    AccountDisabledException,
    InvalidTokenException,
    TokenExpiredException,
)
from app.core.security import decode_access_token
from app.db.dependencies import get_db
from app.models.user import UserInDB
from app.repositories.catalog_repository import CatalogRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.template_repository import TemplateRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.catalog_service import CatalogService
from app.services.google_auth_service import GoogleAuthService
from app.services.template_service import TemplateService
from app.services.token_service import TokenService

# Bearer token extractor
_bearer_security = HTTPBearer(auto_error=False)


async def get_user_repository(db: Annotated[AsyncDatabase, Depends(get_db)]) -> UserRepository:
    """Dependency for UserRepository."""
    return UserRepository(db)


async def get_session_repository(
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> SessionRepository:
    """Dependency for SessionRepository."""
    return SessionRepository(db)


async def get_token_service(
    session_repo: Annotated[SessionRepository, Depends(get_session_repository)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> TokenService:
    """Dependency for TokenService."""
    return TokenService(session_repo=session_repo, user_repo=user_repo)


async def get_auth_service(
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    session_repo: Annotated[SessionRepository, Depends(get_session_repository)],
    token_service: Annotated[TokenService, Depends(get_token_service)],
) -> AuthService:
    """Dependency for AuthService."""
    return AuthService(
        user_repo=user_repo,
        session_repo=session_repo,
        token_service=token_service,
    )


async def get_google_auth_service(
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    token_service: Annotated[TokenService, Depends(get_token_service)],
) -> GoogleAuthService:
    """Dependency for GoogleAuthService."""
    return GoogleAuthService(user_repo=user_repo, token_service=token_service)


async def get_current_user(
    auth: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_security)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> UserInDB:
    """Verify Bearer token and return active authenticated user."""
    if not auth or not auth.credentials:
        raise InvalidTokenException("Missing Bearer authorization header.")

    try:
        payload = decode_access_token(auth.credentials)
    except Exception as exc:
        err_msg = str(exc).lower()
        if "expired" in err_msg:
            raise TokenExpiredException() from exc
        raise InvalidTokenException() from exc

    user_id = payload.get("sub")
    if not user_id:
        raise InvalidTokenException("Token payload missing subject.")

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise InvalidTokenException("User associated with token no longer exists.")

    if not user.is_active:
        raise AccountDisabledException()

    return user


async def get_current_active_user(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> UserInDB:
    """Assert authenticated user is active."""
    return current_user


async def get_catalog_repository(
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> CatalogRepository:
    """Dependency for CatalogRepository."""
    return CatalogRepository(db)


async def get_template_repository(
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> TemplateRepository:
    """Dependency for TemplateRepository."""
    return TemplateRepository(db)


async def get_catalog_service(
    catalog_repo: Annotated[CatalogRepository, Depends(get_catalog_repository)],
) -> CatalogService:
    """Dependency for CatalogService."""
    return CatalogService(catalog_repo=catalog_repo)


async def get_template_service(
    template_repo: Annotated[TemplateRepository, Depends(get_template_repository)],
) -> TemplateService:
    """Dependency for TemplateService."""
    return TemplateService(template_repo=template_repo)


# Type aliases for clean endpoint injections
SettingsDep = Annotated[Settings, Depends(get_settings)]
DatabaseDep = Annotated[AsyncDatabase, Depends(get_db)]
UserRepoDep = Annotated[UserRepository, Depends(get_user_repository)]
SessionRepoDep = Annotated[SessionRepository, Depends(get_session_repository)]
CatalogRepoDep = Annotated[CatalogRepository, Depends(get_catalog_repository)]
TemplateRepoDep = Annotated[TemplateRepository, Depends(get_template_repository)]
TokenServiceDep = Annotated[TokenService, Depends(get_token_service)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
GoogleAuthServiceDep = Annotated[GoogleAuthService, Depends(get_google_auth_service)]
CatalogServiceDep = Annotated[CatalogService, Depends(get_catalog_service)]
TemplateServiceDep = Annotated[TemplateService, Depends(get_template_service)]
CurrentUserDep = Annotated[UserInDB, Depends(get_current_user)]
