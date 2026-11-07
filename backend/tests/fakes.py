from datetime import UTC, datetime

from app.core.exceptions import AccountAlreadyExistsException
from app.models.session import PasswordResetInDB, RefreshTokenInDB
from app.models.user import UserInDB


class FakeUserRepository:
    """In-memory user repository simulating MongoDB users collection."""

    def __init__(self) -> None:
        self.users: dict[str, dict] = {}

    async def create_indexes(self) -> None:
        pass

    async def create(self, user: UserInDB) -> UserInDB:
        # Check duplicate email
        for u in self.users.values():
            if u["email"].lower() == user.email.lower():
                raise AccountAlreadyExistsException(
                    field="email", issue="Email is already registered"
                )
            if user.phone and u.get("phone") and u["phone"] == user.phone:
                raise AccountAlreadyExistsException(
                    field="phone", issue="Mobile number is already registered"
                )

        doc = user.model_dump(by_alias=True)
        doc["_id"] = str(user.id)
        self.users[str(user.id)] = doc
        return user

    async def get_by_id(self, user_id: str) -> UserInDB | None:
        doc = self.users.get(str(user_id))
        return UserInDB(**doc) if doc else None

    async def get_by_email(self, email: str) -> UserInDB | None:
        norm = email.strip().lower()
        for u in self.users.values():
            if u["email"].lower() == norm:
                return UserInDB(**u)
        return None

    async def get_by_phone(self, phone: str) -> UserInDB | None:
        p = phone.strip()
        for u in self.users.values():
            if u.get("phone") == p:
                return UserInDB(**u)
        return None

    async def get_by_google_id(self, google_id: str) -> UserInDB | None:
        for u in self.users.values():
            if u.get("google_id") == google_id:
                return UserInDB(**u)
        return None

    async def update_last_login(self, user_id: str) -> None:
        if str(user_id) in self.users:
            self.users[str(user_id)]["last_login_at"] = datetime.now(UTC)

    async def link_google_id(self, user_id: str, google_id: str) -> None:
        if str(user_id) in self.users:
            self.users[str(user_id)]["google_id"] = google_id


class FakeSessionRepository:
    """In-memory session repository simulating refresh_tokens and password_resets."""

    def __init__(self) -> None:
        self.refresh_tokens: dict[str, dict] = {}
        self.password_resets: dict[str, dict] = {}

    async def create_indexes(self) -> None:
        pass

    async def create_refresh_token(self, token: RefreshTokenInDB) -> RefreshTokenInDB:
        doc = token.model_dump(by_alias=True)
        doc["_id"] = str(token.id)
        self.refresh_tokens[token.token_hash] = doc
        return token

    async def get_refresh_token_by_hash(self, token_hash: str) -> RefreshTokenInDB | None:
        doc = self.refresh_tokens.get(token_hash)
        if not doc:
            return None
        return RefreshTokenInDB(**doc)

    async def revoke_refresh_token(self, token_id: str, replaced_by: str | None = None) -> None:
        for doc in self.refresh_tokens.values():
            if str(doc["_id"]) == str(token_id):
                doc["is_revoked"] = True
                if replaced_by:
                    doc["replaced_by"] = str(replaced_by)

    async def revoke_family(self, family_id: str) -> None:
        for doc in self.refresh_tokens.values():
            if doc.get("family_id") == family_id:
                doc["is_revoked"] = True

    async def revoke_all_user_tokens(self, user_id: str) -> None:
        for doc in self.refresh_tokens.values():
            if str(doc.get("user_id")) == str(user_id):
                doc["is_revoked"] = True

    async def create_password_reset(self, reset: PasswordResetInDB) -> PasswordResetInDB:
        doc = reset.model_dump(by_alias=True)
        doc["_id"] = str(reset.id)
        self.password_resets[reset.token_hash] = doc
        return reset

    async def get_password_reset_by_hash(self, token_hash: str) -> PasswordResetInDB | None:
        doc = self.password_resets.get(token_hash)
        if not doc:
            return None
        return PasswordResetInDB(**doc)

    async def mark_password_reset_used(self, reset_id: str) -> None:
        for doc in self.password_resets.values():
            if str(doc["_id"]) == str(reset_id):
                doc["used"] = True
