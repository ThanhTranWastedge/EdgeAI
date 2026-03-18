import pytest
import uuid
from app.auth.utils import hash_password


async def _create_user_and_login(client, username="cpuser", password="oldpass"):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username=username, password_hash=hash_password(password), role="user")
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": username, "password": password})
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_change_password_success(client):
    token = await _create_user_and_login(client)
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "oldpass", "new_password": "newpass"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Password updated"

    # Verify login works with new password
    login = await client.post("/api/auth/login", json={"username": "cpuser", "password": "newpass"})
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current(client):
    token = await _create_user_and_login(client, username="cpuser2", password="correct")
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong", "new_password": "newpass"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert "incorrect" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_change_password_unauthenticated(client):
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "x", "new_password": "y"},
    )
    assert response.status_code == 403
