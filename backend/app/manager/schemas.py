from pydantic import BaseModel


class SetUserAccess(BaseModel):
    integration_ids: list[str]


class UserAccessResponse(BaseModel):
    id: str
    integration_id: str
    integration_name: str
