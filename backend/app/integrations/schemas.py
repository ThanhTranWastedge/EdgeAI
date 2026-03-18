from pydantic import BaseModel
from typing import Any


class IntegrationCreate(BaseModel):
    name: str
    provider_type: str  # "ragflow" or "openai_compatible"
    provider_config: dict[str, Any]
    description: str | None = None
    icon: str | None = None


class IntegrationUpdate(BaseModel):
    name: str | None = None
    provider_config: dict[str, Any] | None = None
    description: str | None = None
    icon: str | None = None


class IntegrationResponse(BaseModel):
    id: str
    name: str
    provider_type: str
    description: str | None
    icon: str | None

    model_config = {"from_attributes": True}
