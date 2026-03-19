import pytest
import uuid
from app.auth.utils import hash_password


async def admin_login(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="admin", password_hash=hash_password("admin"), role="admin")
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_create_user(client):
    token = await admin_login(client)
    response = await client.post(
        "/api/admin/users",
        json={"username": "newuser", "password": "pass123", "role": "user"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["username"] == "newuser"


@pytest.mark.asyncio
async def test_list_users(client):
    token = await admin_login(client)
    response = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_update_user(client):
    token = await admin_login(client)
    create = await client.post(
        "/api/admin/users",
        json={"username": "upd", "password": "p", "role": "user"},
        headers={"Authorization": f"Bearer {token}"},
    )
    uid = create.json()["id"]
    response = await client.put(
        f"/api/admin/users/{uid}",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_delete_user(client):
    token = await admin_login(client)
    create = await client.post(
        "/api/admin/users",
        json={"username": "del", "password": "p", "role": "user"},
        headers={"Authorization": f"Bearer {token}"},
    )
    uid = create.json()["id"]
    response = await client.delete(f"/api/admin/users/{uid}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_admin_cannot_delete_self(client):
    token = await admin_login(client)
    # Get admin's own user ID
    users = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    admin_user = [u for u in users.json() if u["username"] == "admin"][0]
    response = await client.delete(
        f"/api/admin/users/{admin_user['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Cannot delete own account"
