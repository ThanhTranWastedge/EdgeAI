import pytest
from app.auth.utils import hash_password


@pytest.mark.asyncio
async def test_login_success(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid
    async with TestingSessionLocal() as db:
        user = User(
            id=str(uuid.uuid4()),
            username="testuser",
            password_hash=hash_password("testpass"),
            role="user",
        )
        db.add(user)
        await db.commit()

    response = await client.post("/api/auth/login", json={"username": "testuser", "password": "testpass"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["username"] == "testuser"


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username="u", password_hash=hash_password("right"), role="user")
        db.add(user)
        await db.commit()

    response = await client.post("/api/auth/login", json={"username": "u", "password": "wrong"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username="r", password_hash=hash_password("p"), role="user")
        db.add(user)
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "r", "password": "p"})
    refresh_token = login.json()["refresh_token"]

    response = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "refresh_token" in response.json()


@pytest.mark.asyncio
async def test_me_endpoint(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username="me", password_hash=hash_password("p"), role="admin")
        db.add(user)
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "me", "password": "p"})
    token = login.json()["access_token"]

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["username"] == "me"
    assert response.json()["role"] == "admin"
