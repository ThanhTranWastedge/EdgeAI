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


@pytest.mark.asyncio
async def test_me_includes_default_integration_id(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid

    default_id = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(
            id=str(uuid.uuid4()),
            username="default-me",
            password_hash=hash_password("p"),
            role="admin",
            default_integration_id=default_id,
        )
        db.add(user)
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "default-me", "password": "p"})
    token = login.json()["access_token"]

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["default_integration_id"] == default_id


@pytest.mark.asyncio
async def test_update_default_integration_requires_access_for_user_role(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration
    from app.constants import ROLE_USER
    import json
    import uuid

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="default-limited", password_hash=hash_password("p"), role=ROLE_USER)
        integration = Integration(
            id=iid,
            name="No Access Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        db.add_all([user, integration])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "default-limited", "password": "p"})
    token = login.json()["access_token"]

    response = await client.put(
        "/api/auth/default-integration",
        json={"integration_id": iid},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "No access to this integration"


@pytest.mark.asyncio
async def test_update_default_integration_sets_and_clears_value(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration, UserIntegrationAccess
    from app.constants import ROLE_USER
    import json
    import uuid

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="default-setter", password_hash=hash_password("p"), role=ROLE_USER)
        integration = Integration(
            id=iid,
            name="Granted Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        access = UserIntegrationAccess(user_id=uid, integration_id=iid, granted_by=uid)
        db.add_all([user, integration, access])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "default-setter", "password": "p"})
    token = login.json()["access_token"]

    set_response = await client.put(
        "/api/auth/default-integration",
        json={"integration_id": iid},
        headers={"Authorization": f"Bearer {token}"},
    )
    clear_response = await client.put(
        "/api/auth/default-integration",
        json={"integration_id": None},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert set_response.status_code == 200
    assert set_response.json()["default_integration_id"] == iid
    assert clear_response.status_code == 200
    assert clear_response.json()["default_integration_id"] is None
