from sqlalchemy import text


async def _column_names(conn, table_name: str) -> set[str]:
    result = await conn.execute(text(f"PRAGMA table_info({table_name})"))
    return {row[1] for row in result}


async def _add_column_if_missing(conn, table_name: str, column_name: str, ddl: str) -> None:
    columns = await _column_names(conn, table_name)
    if column_name not in columns:
        await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}"))


async def run_startup_migrations(conn) -> None:
    await _add_column_if_missing(conn, "users", "default_integration_id", "VARCHAR")
    await _add_column_if_missing(conn, "sessions", "integration_name", "VARCHAR")
    await _add_column_if_missing(conn, "sessions", "last_integration_id", "VARCHAR")
    await _add_column_if_missing(conn, "sessions", "last_integration_name", "VARCHAR")
    await _add_column_if_missing(conn, "messages", "integration_id", "VARCHAR")
    await _add_column_if_missing(conn, "messages", "integration_name", "VARCHAR")
