from datetime import UTC, datetime

from bson import ObjectId

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


class FakeCatalogRepository:
    """In-memory catalog repository simulating frame_materials and frame_moldings collections."""

    def __init__(self) -> None:
        self.materials: dict[str, dict] = {}
        self.moldings: dict[str, dict] = {}

    async def create_indexes(self) -> None:
        pass

    async def list_materials(
        self,
        category: str | None = None,
        available_only: bool = True,
    ):
        from app.models.catalog import FrameMaterialInDB

        res = []
        for doc in self.materials.values():
            if available_only and not doc.get("is_available", True):
                continue
            if category and doc.get("category", "").lower() != category.lower():
                continue
            res.append(FrameMaterialInDB(**doc))
        res.sort(key=lambda m: m.name)
        return res

    async def get_material_by_id(self, material_id: str):
        from app.models.catalog import FrameMaterialInDB

        doc = self.materials.get(str(material_id))
        return FrameMaterialInDB(**doc) if doc else None

    async def get_material_by_code(self, code: str):
        from app.models.catalog import FrameMaterialInDB

        for doc in self.materials.values():
            if doc.get("code") == code:
                return FrameMaterialInDB(**doc)
        return None

    async def upsert_material(self, material, overwrite: bool = False):
        doc = material.model_dump(by_alias=True)
        doc["_id"] = str(material.id)
        existing = await self.get_material_by_code(material.code)
        if existing:
            if overwrite:
                self.materials[str(existing.id)] = doc
                return material
            return existing
        self.materials[str(material.id)] = doc
        return material

    async def list_moldings(
        self,
        material_id: str | None = None,
        color: str | None = None,
        min_width: float | None = None,
        max_width: float | None = None,
        active_only: bool = True,
    ):
        from app.models.catalog import FrameMoldingInDB

        res = []
        for doc in self.moldings.values():
            if active_only and not doc.get("is_active", True):
                continue
            if material_id and str(doc.get("material_id")) != str(material_id):
                continue
            if color:
                colors = doc.get("available_colors", [])
                match = any(color.lower() in c.get("name", "").lower() for c in colors)
                if not match:
                    continue
            w = doc.get("profile_width_inches", 0.0)
            if min_width is not None and w < min_width:
                continue
            if max_width is not None and w > max_width:
                continue
            res.append(FrameMoldingInDB(**doc))
        res.sort(key=lambda m: m.name)
        return res

    async def get_molding_by_id(self, molding_id: str):
        from app.models.catalog import FrameMoldingInDB

        doc = self.moldings.get(str(molding_id))
        return FrameMoldingInDB(**doc) if doc else None

    async def get_molding_by_sku(self, sku: str):
        from app.models.catalog import FrameMoldingInDB

        for doc in self.moldings.values():
            if doc.get("sku") == sku:
                return FrameMoldingInDB(**doc)
        return None

    async def upsert_molding(self, molding, overwrite: bool = False):
        doc = molding.model_dump(by_alias=True)
        doc["_id"] = str(molding.id)
        existing = await self.get_molding_by_sku(molding.sku)
        if existing:
            if overwrite:
                self.moldings[str(existing.id)] = doc
                return molding
            return existing
        self.moldings[str(molding.id)] = doc
        return molding


class FakeTemplateRepository:
    """In-memory template repository simulating layout_templates collection."""

    def __init__(self) -> None:
        self.templates: dict[str, dict] = {}

    async def create_indexes(self) -> None:
        pass

    async def list_templates(
        self,
        category: str | None = None,
        min_frames: int | None = None,
        max_frames: int | None = None,
        active_only: bool = True,
    ):
        from app.models.template import LayoutTemplateInDB

        res = []
        for doc in self.templates.values():
            if active_only and not doc.get("is_active", True):
                continue
            if category:
                cat_norm = category.lower().strip()
                doc_cat = doc.get("category", "").lower().strip()
                if cat_norm in ("centre", "focal_center"):
                    if doc_cat not in ("centre", "focal_center"):
                        continue
                elif doc_cat != cat_norm:
                    continue
            cnt = doc.get("slots_count", len(doc.get("slots", [])))
            if min_frames is not None and cnt < min_frames:
                continue
            if max_frames is not None and cnt > max_frames:
                continue
            res.append(LayoutTemplateInDB(**doc))
        res.sort(key=lambda t: (t.slots_count, t.name))
        return res

    async def get_template_by_id(self, template_id: str):
        from app.models.template import LayoutTemplateInDB

        doc = self.templates.get(str(template_id))
        return LayoutTemplateInDB(**doc) if doc else None

    async def get_template_by_slug(self, slug: str):
        from app.models.template import LayoutTemplateInDB

        for doc in self.templates.values():
            if doc.get("slug") == slug:
                return LayoutTemplateInDB(**doc)
        return None

    async def upsert_template(self, template, overwrite: bool = False):
        doc = template.model_dump(by_alias=True)
        doc["_id"] = str(template.id)
        existing = await self.get_template_by_slug(template.slug)
        if existing:
            if overwrite:
                self.templates[str(existing.id)] = doc
                return template
            return existing
        self.templates[str(template.id)] = doc
        return template


def populate_fake_catalog(
    fake_catalog_repo: FakeCatalogRepository,
    fake_template_repo: FakeTemplateRepository,
) -> None:
    """Populate in-memory repositories with master seed data idempotently."""
    from app.db.seed_catalog import SEED_MATERIALS, SEED_MOLDINGS, SEED_TEMPLATES
    from app.models.catalog import FrameColorOption, FrameMaterialInDB, FrameMoldingInDB
    from app.models.template import LayoutTemplateInDB, TemplateSlotInDB

    mat_map = {}
    for mat_data in SEED_MATERIALS:
        existing_id = None
        for mid, mdoc in fake_catalog_repo.materials.items():
            if mdoc.get("code") == mat_data["code"]:
                existing_id = mid
                break
        mat_id = existing_id or str(ObjectId())
        mat = FrameMaterialInDB(id=mat_id, **mat_data)
        doc = mat.model_dump(by_alias=True)
        doc["_id"] = mat_id
        fake_catalog_repo.materials[mat_id] = doc
        mat_map[mat.code] = mat_id

    for mold_data in SEED_MOLDINGS:
        mat_id = mat_map.get(mold_data["material_code"], "672520012e5c6a1b2c3d4e01")
        parent_mat = fake_catalog_repo.materials.get(mat_id)
        mat_name = parent_mat["name"] if parent_mat else "Solid Wood"
        colors = [FrameColorOption(**c) for c in mold_data["available_colors"]]

        existing_id = None
        for mold_id, mold_doc in fake_catalog_repo.moldings.items():
            if mold_doc.get("sku") == mold_data["sku"]:
                existing_id = mold_id
                break
        molding_id = existing_id or str(ObjectId())

        molding = FrameMoldingInDB(
            id=molding_id,
            sku=mold_data["sku"],
            name=mold_data["name"],
            material_id=mat_id,
            material_name=mat_name,
            profile_width_inches=mold_data["profile_width_inches"],
            profile_depth_inches=mold_data["profile_depth_inches"],
            rabbet_depth_inches=mold_data["rabbet_depth_inches"],
            price_per_linear_inch=mold_data["price_per_linear_inch"],
            available_colors=colors,
            thumbnail_url=mold_data["thumbnail_url"],
            is_active=mold_data["is_active"],
        )
        doc = molding.model_dump(by_alias=True)
        doc["_id"] = molding_id
        fake_catalog_repo.moldings[molding_id] = doc

    for tmpl_data in SEED_TEMPLATES:
        slots = [TemplateSlotInDB(**s) for s in tmpl_data["slots"]]
        existing_id = None
        for tid, tdoc in fake_template_repo.templates.items():
            if tdoc.get("slug") == tmpl_data["slug"]:
                existing_id = tid
                break
        tmpl_id = existing_id or str(ObjectId())

        tmpl = LayoutTemplateInDB(
            id=tmpl_id,
            slug=tmpl_data["slug"],
            name=tmpl_data["name"],
            description=tmpl_data["description"],
            category=tmpl_data["category"],
            min_wall_width_inches=tmpl_data["min_wall_width_inches"],
            min_wall_height_inches=tmpl_data["min_wall_height_inches"],
            recommended_wall_width_inches=tmpl_data["recommended_wall_width_inches"],
            recommended_wall_height_inches=tmpl_data["recommended_wall_height_inches"],
            slots_count=tmpl_data["slots_count"],
            slots=slots,
            thumbnail_url=tmpl_data["thumbnail_url"],
            is_active=tmpl_data["is_active"],
        )
        doc = tmpl.model_dump(by_alias=True)
        doc["_id"] = tmpl_id
        fake_template_repo.templates[tmpl_id] = doc


class FakePhotoRepository:
    """In-memory photo repository simulating MongoDB photos collection."""

    def __init__(self) -> None:
        self.photos: dict[str, dict] = {}

    async def create_indexes(self) -> None:
        pass

    async def create(self, photo):
        doc = photo.model_dump(by_alias=True)
        doc["_id"] = str(photo.id)
        self.photos[str(photo.id)] = doc
        return photo

    async def get_by_id(self, photo_id: str, include_deleted: bool = False):
        from app.models.photo import PhotoInDB

        doc = self.photos.get(str(photo_id))
        if not doc:
            return None
        if not include_deleted and doc.get("is_deleted", False):
            return None
        return PhotoInDB(**doc)

    async def list_by_user(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 50,
    ):
        from app.models.photo import PhotoInDB

        all_user_photos = [
            PhotoInDB(**d)
            for d in self.photos.values()
            if str(d.get("user_id")) == str(user_id) and not d.get("is_deleted", False)
        ]
        all_user_photos.sort(key=lambda p: p.created_at, reverse=True)
        total = len(all_user_photos)
        skip = max(0, (page - 1) * page_size)
        items = all_user_photos[skip : skip + page_size]
        return items, total

    async def update_visual_analysis(self, photo_id: str, analysis) -> bool:
        doc = self.photos.get(str(photo_id))
        if not doc:
            return False
        doc["visual_analysis"] = analysis.model_dump()
        doc["updated_at"] = datetime.now(UTC)
        return True

    async def soft_delete(self, photo_id: str, user_id: str) -> bool:
        doc = self.photos.get(str(photo_id))
        if not doc:
            return False
        if str(doc.get("user_id")) != str(user_id):
            return False
        if doc.get("is_deleted", False):
            return False
        doc["is_deleted"] = True
        doc["updated_at"] = datetime.now(UTC)
        return True

    async def hard_delete(self, photo_id: str) -> bool:
        return self.photos.pop(str(photo_id), None) is not None


class FakeR2Storage:
    """In-memory mock Cloudflare R2 object storage."""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str, dict]] = {}
        self.bucket_name = "saf-studio-photos-test"
        self.should_fail_upload = False
        self.should_fail_download = False

    async def put_object(
        self,
        key: str,
        data: bytes,
        content_type: str,
        metadata: dict[str, str] | None = None,
    ) -> str:
        from app.core.exceptions import StorageUnavailableException

        if self.should_fail_upload:
            raise StorageUnavailableException(issue="Simulated R2 network failure on upload")

        self.objects[key] = (data, content_type, metadata or {})
        return key

    async def get_object(self, key: str) -> tuple[bytes, str]:
        from app.core.exceptions import (
            ResourceNotFoundException,
            StorageUnavailableException,
        )

        if self.should_fail_download:
            raise StorageUnavailableException(issue="Simulated R2 network failure on download")

        if key not in self.objects:
            raise ResourceNotFoundException(
                message=f"Photo media for key '{key}' not found in storage.",
                field="key",
            )
        data, c_type, _ = self.objects[key]
        return data, c_type

    async def delete_object(self, key: str) -> bool:
        return self.objects.pop(key, None) is not None

    async def delete_objects(self, keys: list[str]) -> None:
        for k in keys:
            self.objects.pop(k, None)

    async def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return (
            f"https://mock-r2.cloudflarestorage.com/{self.bucket_name}/{key}?expires={expires_in}"
        )
