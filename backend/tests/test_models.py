import pytest
from sqlalchemy import select
from app.models import User, Integration, Session, Message, PinnedResponse
import uuid


@pytest.mark.asyncio
async def test_create_user(setup_db):
    from tests.conftest import TestingSessionLocal
    async with TestingSessionLocal() as db:
        user = User(
            id=str(uuid.uuid4()),
            username="testuser",
            password_hash="fakehash",
            role="user",
        )
        db.add(user)
        await db.commit()
        result = await db.execute(select(User).where(User.username == "testuser"))
        fetched = result.scalar_one()
        assert fetched.username == "testuser"
        assert fetched.role == "user"


@pytest.mark.asyncio
async def test_create_integration(setup_db):
    from tests.conftest import TestingSessionLocal
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username="admin", password_hash="h", role="admin")
        db.add(user)
        await db.commit()

        integration = Integration(
            id=str(uuid.uuid4()),
            name="Marketing",
            provider_type="ragflow",
            provider_config='{"base_url":"http://localhost:9380","api_key":"test","chat_id":"abc","type":"chat"}',
            updated_by=user.id,
        )
        db.add(integration)
        await db.commit()
        result = await db.execute(select(Integration).where(Integration.name == "Marketing"))
        fetched = result.scalar_one()
        assert fetched.provider_type == "ragflow"


@pytest.mark.asyncio
async def test_pinned_response_unique_constraint(setup_db):
    from tests.conftest import TestingSessionLocal
    from sqlalchemy.exc import IntegrityError
    async with TestingSessionLocal() as db:
        user_id = str(uuid.uuid4())
        integration_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        msg_id = str(uuid.uuid4())

        user = User(id=user_id, username="u", password_hash="h", role="user")
        integration = Integration(id=integration_id, name="Test", provider_type="ragflow", provider_config="{}", updated_by=user_id)
        session = Session(id=session_id, user_id=user_id, integration_id=integration_id, title="t")
        message = Message(id=msg_id, session_id=session_id, role="assistant", content="resp", sequence=2)
        db.add_all([user, integration, session, message])
        await db.commit()

        pin1 = PinnedResponse(id=str(uuid.uuid4()), user_id=user_id, message_id=msg_id, integration_id=integration_id, label="pin1", content="resp")
        db.add(pin1)
        await db.commit()

        pin2 = PinnedResponse(id=str(uuid.uuid4()), user_id=user_id, message_id=msg_id, integration_id=integration_id, label="pin2", content="resp")
        db.add(pin2)
        with pytest.raises(IntegrityError):
            await db.commit()
