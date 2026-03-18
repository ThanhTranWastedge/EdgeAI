import pytest
import json
import uuid
from unittest.mock import patch, AsyncMock
from app.auth.utils import hash_password
from app.chat.providers.base import ChatResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_admin_in_db(username="admin"):
    """Insert an admin user directly into the DB and return its id."""
    from tests.conftest import TestingSessionLocal
    from app.models import User

    uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(
            id=uid, username=username,
            password_hash=hash_password("admin"), role="admin",
        )
        db.add(user)
        await db.commit()
    return uid


async def _login(client, username, password):
    resp = await client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    return resp.json()["access_token"]


async def _admin_token(client):
    await _create_admin_in_db()
    return await _login(client, "admin", "admin")


async def _create_manager(client, admin_token, username="mgr", password="mgr"):
    """Create a manager user via the admin endpoint and return (token, user_id)."""
    resp = await client.post(
        "/api/admin/users",
        json={"username": username, "password": password, "role": "manager"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    user_id = resp.json()["id"]
    token = await _login(client, username, password)
    return token, user_id


async def _create_regular_user_via_db(username="regularuser", password="p"):
    """Insert a regular user directly into the DB and return its id."""
    from tests.conftest import TestingSessionLocal
    from app.models import User

    uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(
            id=uid, username=username,
            password_hash=hash_password(password), role="user",
        )
        db.add(user)
        await db.commit()
    return uid


async def _create_integration_in_db(admin_id):
    """Insert an integration directly into the DB and return its id."""
    from tests.conftest import TestingSessionLocal
    from app.models import Integration

    iid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        integration = Integration(
            id=iid,
            name="Test Integration",
            provider_type="openai_compatible",
            provider_config=json.dumps({
                "base_url": "http://x",
                "api_key": "k",
                "model": "m",
                "system_prompt": "",
            }),
            updated_by=admin_id,
        )
        db.add(integration)
        await db.commit()
    return iid


# ---------------------------------------------------------------------------
# 1. Manager can list non-admin users
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_list_users(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    # Create a regular user via the manager endpoint
    await client.post(
        "/api/manager/users",
        json={"username": "u1", "password": "p", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )

    resp = await client.get(
        "/api/manager/users", headers={"Authorization": f"Bearer {mgr_token}"}
    )
    assert resp.status_code == 200
    users = resp.json()
    usernames = [u["username"] for u in users]
    # Should contain the manager and the regular user, but NOT the admin
    assert "mgr" in usernames
    assert "u1" in usernames
    assert "admin" not in usernames


# ---------------------------------------------------------------------------
# 2. Manager can create user with "user" role
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_create_user_role_user(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    resp = await client.post(
        "/api/manager/users",
        json={"username": "newuser", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["username"] == "newuser"
    assert resp.json()["role"] == "user"


# ---------------------------------------------------------------------------
# 3. Manager can create user with "manager" role
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_create_user_role_manager(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    resp = await client.post(
        "/api/manager/users",
        json={"username": "mgr2", "password": "pw", "role": "manager"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "manager"


# ---------------------------------------------------------------------------
# 4. Manager CANNOT create user with "admin" role (403)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_cannot_create_admin(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    resp = await client.post(
        "/api/manager/users",
        json={"username": "sneakyadmin", "password": "pw", "role": "admin"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 5. Manager can update user role (user -> manager)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_update_user_role(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    create = await client.post(
        "/api/manager/users",
        json={"username": "promote_me", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    resp = await client.put(
        f"/api/manager/users/{uid}",
        json={"role": "manager"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "manager"


# ---------------------------------------------------------------------------
# 6. Manager CANNOT update admin user (403)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_cannot_update_admin(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    # Get admin user id
    from tests.conftest import TestingSessionLocal
    from app.models import User
    from sqlalchemy import select

    async with TestingSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        admin_user = result.scalar_one()
        admin_id = admin_user.id

    resp = await client.put(
        f"/api/manager/users/{admin_id}",
        json={"role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 7. Manager CANNOT change own role (403)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_cannot_change_own_role(client):
    admin_token = await _admin_token(client)
    mgr_token, mgr_id = await _create_manager(client, admin_token)

    resp = await client.put(
        f"/api/manager/users/{mgr_id}",
        json={"role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 8. Manager can reset user password
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_reset_password(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    create = await client.post(
        "/api/manager/users",
        json={"username": "resetme", "password": "old", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    resp = await client.put(
        f"/api/manager/users/{uid}",
        json={"password": "newpass"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 200

    # Verify new password works
    login = await client.post(
        "/api/auth/login", json={"username": "resetme", "password": "newpass"}
    )
    assert login.status_code == 200


# ---------------------------------------------------------------------------
# 9. Manager can delete user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_delete_user(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    create = await client.post(
        "/api/manager/users",
        json={"username": "deleteme", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    resp = await client.delete(
        f"/api/manager/users/{uid}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# 10. Manager CANNOT delete admin user (403)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_cannot_delete_admin(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    from tests.conftest import TestingSessionLocal
    from app.models import User
    from sqlalchemy import select

    async with TestingSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        admin_user = result.scalar_one()
        admin_id = admin_user.id

    resp = await client.delete(
        f"/api/manager/users/{admin_id}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 11. Manager CANNOT delete self (403)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_cannot_delete_self(client):
    admin_token = await _admin_token(client)
    mgr_token, mgr_id = await _create_manager(client, admin_token)

    resp = await client.delete(
        f"/api/manager/users/{mgr_id}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 12. Regular user CANNOT access manager endpoints (403)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_regular_user_cannot_access_manager(client):
    admin_token = await _admin_token(client)

    # Create a regular user via admin
    create = await client.post(
        "/api/admin/users",
        json={"username": "regular", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create.status_code == 201
    user_token = await _login(client, "regular", "pw")

    # All manager endpoints should return 403
    resp = await client.get(
        "/api/manager/users", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 403

    resp = await client.post(
        "/api/manager/users",
        json={"username": "x", "password": "x", "role": "user"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 13. GET /api/manager/users/{id}/access returns empty list for new user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_user_access_empty(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    create = await client.post(
        "/api/manager/users",
        json={"username": "noaccess", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    resp = await client.get(
        f"/api/manager/users/{uid}/access",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# 14. PUT /api/manager/users/{id}/access sets integration access
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_set_user_access(client):
    admin_id = await _create_admin_in_db()
    admin_token = await _login(client, "admin", "admin")
    mgr_token, _ = await _create_manager(client, admin_token)
    iid = await _create_integration_in_db(admin_id)

    create = await client.post(
        "/api/manager/users",
        json={"username": "grantme", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    resp = await client.put(
        f"/api/manager/users/{uid}/access",
        json={"integration_ids": [iid]},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["integration_id"] == iid
    assert data[0]["integration_name"] == "Test Integration"

    # Verify via GET
    resp2 = await client.get(
        f"/api/manager/users/{uid}/access",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert len(resp2.json()) == 1


# ---------------------------------------------------------------------------
# 15. PUT /api/manager/users/{id}/access with invalid integration IDs -> 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_set_user_access_invalid_integration(client):
    admin_token = await _admin_token(client)
    mgr_token, _ = await _create_manager(client, admin_token)

    create = await client.post(
        "/api/manager/users",
        json={"username": "badaccess", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    fake_id = str(uuid.uuid4())
    resp = await client.put(
        f"/api/manager/users/{uid}/access",
        json={"integration_ids": [fake_id]},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 16. Integration access filtering: user WITH access sees integration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_user_with_access_sees_integration(client):
    admin_id = await _create_admin_in_db()
    admin_token = await _login(client, "admin", "admin")
    mgr_token, _ = await _create_manager(client, admin_token)
    iid = await _create_integration_in_db(admin_id)

    # Create user and grant access
    create = await client.post(
        "/api/manager/users",
        json={"username": "hasaccess", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    await client.put(
        f"/api/manager/users/{uid}/access",
        json={"integration_ids": [iid]},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )

    user_token = await _login(client, "hasaccess", "pw")
    resp = await client.get(
        "/api/integrations", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 200
    integrations = resp.json()
    assert len(integrations) == 1
    assert integrations[0]["id"] == iid


# ---------------------------------------------------------------------------
# 17. Integration access filtering: user WITHOUT access sees empty list
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_user_without_access_sees_empty(client):
    admin_id = await _create_admin_in_db()
    admin_token = await _login(client, "admin", "admin")
    await _create_integration_in_db(admin_id)

    # Create user with no access grants
    await client.post(
        "/api/admin/users",
        json={"username": "noaccessuser", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_token = await _login(client, "noaccessuser", "pw")

    resp = await client.get(
        "/api/integrations", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# 18. Chat access: user without access gets 403 on POST /api/chat/{id}/send
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_access_denied_without_integration_access(client):
    admin_id = await _create_admin_in_db()
    admin_token = await _login(client, "admin", "admin")
    iid = await _create_integration_in_db(admin_id)

    # Create a regular user with NO integration access
    await client.post(
        "/api/admin/users",
        json={"username": "nochatuser", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    user_token = await _login(client, "nochatuser", "pw")

    resp = await client.post(
        f"/api/chat/{iid}/send",
        json={"message": "hello"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 19. Cascade: deleting user via manager removes their access rows
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_user_cascades_access(client):
    from tests.conftest import TestingSessionLocal
    from app.models import UserIntegrationAccess
    from sqlalchemy import select

    admin_id = await _create_admin_in_db()
    admin_token = await _login(client, "admin", "admin")
    mgr_token, _ = await _create_manager(client, admin_token)
    iid = await _create_integration_in_db(admin_id)

    # Create user and grant access
    create = await client.post(
        "/api/manager/users",
        json={"username": "cascade_user", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    await client.put(
        f"/api/manager/users/{uid}/access",
        json={"integration_ids": [iid]},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )

    # Verify access row exists
    async with TestingSessionLocal() as db:
        rows = await db.execute(
            select(UserIntegrationAccess).where(
                UserIntegrationAccess.user_id == uid
            )
        )
        assert len(rows.scalars().all()) == 1

    # Delete user via manager
    resp = await client.delete(
        f"/api/manager/users/{uid}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert resp.status_code == 204

    # Verify access rows are gone
    async with TestingSessionLocal() as db:
        rows = await db.execute(
            select(UserIntegrationAccess).where(
                UserIntegrationAccess.user_id == uid
            )
        )
        assert len(rows.scalars().all()) == 0


# ---------------------------------------------------------------------------
# 20. Cascade: deleting integration removes access rows
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_integration_cascades_access(client):
    from tests.conftest import TestingSessionLocal
    from app.models import UserIntegrationAccess
    from sqlalchemy import select

    admin_id = await _create_admin_in_db()
    admin_token = await _login(client, "admin", "admin")
    mgr_token, _ = await _create_manager(client, admin_token)
    iid = await _create_integration_in_db(admin_id)

    # Create user and grant access
    create = await client.post(
        "/api/manager/users",
        json={"username": "cascade_int_user", "password": "pw", "role": "user"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    uid = create.json()["id"]

    await client.put(
        f"/api/manager/users/{uid}/access",
        json={"integration_ids": [iid]},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )

    # Verify access row exists
    async with TestingSessionLocal() as db:
        rows = await db.execute(
            select(UserIntegrationAccess).where(
                UserIntegrationAccess.integration_id == iid
            )
        )
        assert len(rows.scalars().all()) == 1

    # Delete integration via admin endpoint
    resp = await client.delete(
        f"/api/integrations/{iid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204

    # Verify access rows are gone
    async with TestingSessionLocal() as db:
        rows = await db.execute(
            select(UserIntegrationAccess).where(
                UserIntegrationAccess.integration_id == iid
            )
        )
        assert len(rows.scalars().all()) == 0
