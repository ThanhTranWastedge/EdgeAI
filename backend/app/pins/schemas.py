from pydantic import BaseModel


class PinCreate(BaseModel):
    message_id: str
    label: str


class PinUpdate(BaseModel):
    label: str


class PinResponse(BaseModel):
    id: str
    message_id: str
    integration_id: str
    label: str
    content: str
    integration_name: str | None = None

    model_config = {"from_attributes": True}
