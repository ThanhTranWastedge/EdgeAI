import pytest
import json
import uuid
from app.auth.utils import hash_password


async def setup_message(client):
    """Create user, integration, session, message, and return token + message_id."""
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration, Session, Message

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    mid = str(uuid.uuid4())

    async with TestingSessionLocal() as db:
        user = User(id=uid, username="pinner", password_hash=hash_password("p"), role="user")
        integration = Integration(id=iid, name="Test", provider_type="ragflow", provider_config="{}", updated_by=uid)
        session = Session(id=sid, user_id=uid, integration_id=iid, title="test")
        message = Message(id=mid, session_id=sid, role="assistant", content="Pin this response", sequence=2)
        db.add_all([user, integration, session, message])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "pinner", "password": "p"})
    token = login.json()["access_token"]
    return token, mid, iid


@pytest.mark.asyncio
async def test_create_pin(client):
    token, mid, iid = await setup_message(client)
    response = await client.post(
        "/api/pins",
        json={"message_id": mid, "label": "useful response"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["label"] == "useful response"
    assert response.json()["content"] == "Pin this response"


@pytest.mark.asyncio
async def test_list_pins(client):
    token, mid, iid = await setup_message(client)
    await client.post("/api/pins", json={"message_id": mid, "label": "pin1"}, headers={"Authorization": f"Bearer {token}"})
    response = await client.get("/api/pins", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_update_pin_label(client):
    token, mid, iid = await setup_message(client)
    create = await client.post("/api/pins", json={"message_id": mid, "label": "old"}, headers={"Authorization": f"Bearer {token}"})
    pid = create.json()["id"]
    response = await client.put(f"/api/pins/{pid}", json={"label": "new"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["label"] == "new"


@pytest.mark.asyncio
async def test_delete_pin(client):
    token, mid, iid = await setup_message(client)
    create = await client.post("/api/pins", json={"message_id": mid, "label": "del"}, headers={"Authorization": f"Bearer {token}"})
    pid = create.json()["id"]
    response = await client.delete(f"/api/pins/{pid}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204

    # Verify message.pinned is reset
    from tests.conftest import TestingSessionLocal
    from app.models import Message
    from sqlalchemy import select
    async with TestingSessionLocal() as db:
        result = await db.execute(select(Message).where(Message.id == mid))
        msg = result.scalar_one()
        assert msg.pinned is False


@pytest.mark.asyncio
async def test_duplicate_pin_rejected(client):
    token, mid, iid = await setup_message(client)
    await client.post("/api/pins", json={"message_id": mid, "label": "first"}, headers={"Authorization": f"Bearer {token}"})
    response = await client.post("/api/pins", json={"message_id": mid, "label": "second"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 409
