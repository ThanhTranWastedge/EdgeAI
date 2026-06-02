import warnings

import pytest
from sqlalchemy import text
from sqlalchemy.exc import SAWarning


@pytest.mark.asyncio
async def test_run_startup_migrations_adds_missing_columns():
    from tests.conftest import engine
    from app.database import Base
    from app.migrations import run_startup_migrations

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.execute(text("CREATE TABLE users (id VARCHAR PRIMARY KEY, username VARCHAR NOT NULL, password_hash VARCHAR NOT NULL, role VARCHAR NOT NULL)"))
        await conn.execute(text("CREATE TABLE sessions (id VARCHAR PRIMARY KEY, user_id VARCHAR NOT NULL, integration_id VARCHAR NOT NULL, title VARCHAR NOT NULL)"))
        await conn.execute(text("CREATE TABLE messages (id VARCHAR PRIMARY KEY, session_id VARCHAR NOT NULL, role VARCHAR NOT NULL, content TEXT NOT NULL, sequence INTEGER NOT NULL)"))
        await run_startup_migrations(conn)

        users = await conn.execute(text("PRAGMA table_info(users)"))
        sessions = await conn.execute(text("PRAGMA table_info(sessions)"))
        messages = await conn.execute(text("PRAGMA table_info(messages)"))

    assert "default_integration_id" in {row[1] for row in users}
    session_columns = {row[1] for row in sessions}
    assert {"integration_name", "last_integration_id", "last_integration_name"}.issubset(session_columns)
    message_columns = {row[1] for row in messages}
    assert {"integration_id", "integration_name"}.issubset(message_columns)


@pytest.mark.asyncio
async def test_run_startup_migrations_is_idempotent():
    from tests.conftest import engine
    from app.database import Base
    from app.migrations import run_startup_migrations

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await run_startup_migrations(conn)
        await run_startup_migrations(conn)

        users = await conn.execute(text("PRAGMA table_info(users)"))
        sessions = await conn.execute(text("PRAGMA table_info(sessions)"))
        messages = await conn.execute(text("PRAGMA table_info(messages)"))

    assert "default_integration_id" in {row[1] for row in users}
    session_columns = {row[1] for row in sessions}
    assert {"integration_name", "last_integration_id", "last_integration_name"}.issubset(session_columns)
    message_columns = {row[1] for row in messages}
    assert {"integration_id", "integration_name"}.issubset(message_columns)


@pytest.mark.asyncio
async def test_model_metadata_marks_default_integration_fk_cycle():
    from tests.conftest import engine
    from app.database import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        with warnings.catch_warnings(record=True) as recorded:
            warnings.simplefilter("always")
            await conn.run_sync(Base.metadata.drop_all)

    cycle_warnings = [
        warning
        for warning in recorded
        if issubclass(warning.category, SAWarning)
        and "Can't sort tables for DROP" in str(warning.message)
    ]
    assert cycle_warnings == []
