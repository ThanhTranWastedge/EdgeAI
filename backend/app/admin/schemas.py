from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    fullname: str | None = None
    role: str = "user"


class UserUpdate(BaseModel):
    role: str | None = None
    password: str | None = None
    fullname: str | None = None
