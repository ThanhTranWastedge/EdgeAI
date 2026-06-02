import pytest
from app.auth.utils import hash_password
import uuid


async def create_admin_and_login(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="admin", password_hash=hash_password("admin"), role="admin")
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    return login.json()["access_token"]


async def create_user_and_login(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="user1", password_hash=hash_password("pass"), role="user")
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": "user1", "password": "pass"})
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_create_integration_admin(client):
    token = await create_admin_and_login(client)
    response = await client.post(
        "/api/integrations",
        json={"name": "Marketing", "provider_type": "ragflow", "provider_config": {"base_url": "http://localhost:9380", "api_key": "key", "chat_id": "abc", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Marketing"
    assert response.json()["provider_type"] == "ragflow"


@pytest.mark.asyncio
async def test_create_integration_non_admin_forbidden(client):
    await create_admin_and_login(client)  # need admin to exist
    token = await create_user_and_login(client)
    response = await client.post(
        "/api/integrations",
        json={"name": "Test", "provider_type": "ragflow", "provider_config": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_integrations_admin_sees_all(client):
    token = await create_admin_and_login(client)
    await client.post(
        "/api/integrations",
        json={"name": "Chat1", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    response = await client.get("/api/integrations", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_list_integrations_user_denied_by_default(client):
    token = await create_admin_and_login(client)
    await client.post(
        "/api/integrations",
        json={"name": "Chat1", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    user_token = await create_user_and_login(client)
    response = await client.get("/api/integrations", headers={"Authorization": f"Bearer {user_token}"})
    assert response.status_code == 200
    assert len(response.json()) == 0


@pytest.mark.asyncio
async def test_update_integration(client):
    token = await create_admin_and_login(client)
    create = await client.post(
        "/api/integrations",
        json={"name": "Old", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    iid = create.json()["id"]
    response = await client.put(
        f"/api/integrations/{iid}",
        json={"name": "New"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New"


@pytest.mark.asyncio
async def test_delete_integration(client):
    token = await create_admin_and_login(client)
    create = await client.post(
        "/api/integrations",
        json={"name": "Del", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    iid = create.json()["id"]
    response = await client.delete(f"/api/integrations/{iid}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_create_integration_with_greeting(client):
    token = await create_admin_and_login(client)
    response = await client.post(
        "/api/integrations",
        json={"name": "Greeter", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}, "opening_greeting": "Hello! How can I help?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["opening_greeting"] == "Hello! How can I help?"


@pytest.mark.asyncio
async def test_update_integration_greeting(client):
    token = await create_admin_and_login(client)
    create = await client.post(
        "/api/integrations",
        json={"name": "G2", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    iid = create.json()["id"]
    assert create.json()["opening_greeting"] is None

    response = await client.put(
        f"/api/integrations/{iid}",
        json={"opening_greeting": "Welcome!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["opening_greeting"] == "Welcome!"


@pytest.mark.asyncio
async def test_delete_integration_clears_user_defaults(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration
    from app.auth.utils import hash_password
    from sqlalchemy import select
    import json
    import uuid

    admin_id = str(uuid.uuid4())
    integration_id = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        admin = User(id=admin_id, username="default-admin", password_hash=hash_password("admin"), role="admin")
        integration = Integration(
            id=integration_id,
            name="Defaulted Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=admin_id,
        )
        user = User(
            id=str(uuid.uuid4()),
            username="default-owner",
            password_hash=hash_password("p"),
            role="user",
            default_integration_id=integration_id,
        )
        db.add_all([admin, integration, user])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "default-admin", "password": "admin"})
    token = login.json()["access_token"]

    response = await client.delete(
        f"/api/integrations/{integration_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 204
    async with TestingSessionLocal() as db:
        result = await db.execute(select(User.default_integration_id).where(User.username == "default-owner"))
        assert result.scalar_one() is None
