from pydantic import BaseModel


class ManagerUserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class ManagerUserUpdate(BaseModel):
    role: str | None = None
    password: str | None = None


class SetUserAccess(BaseModel):
    integration_ids: list[str]


class UserAccessResponse(BaseModel):
    id: str
    integration_id: str
    integration_name: str
