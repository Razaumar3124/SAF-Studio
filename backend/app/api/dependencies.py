from typing import Annotated

from fastapi import Depends
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import Settings, get_settings
from app.db.dependencies import get_db

SettingsDep = Annotated[Settings, Depends(get_settings)]
DatabaseDep = Annotated[AsyncDatabase, Depends(get_db)]
