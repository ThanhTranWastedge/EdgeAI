import pytest
from app.auth.utils import hash_password, verify_password, create_access_token, create_refresh_token, decode_token


def test_password_hash_and_verify():
    hashed = hash_password("mysecret")
    assert hashed != "mysecret"
    assert verify_password("mysecret", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_access_token_roundtrip():
    token = create_access_token({"sub": "user123", "role": "admin"})
    payload = decode_token(token)
    assert payload["sub"] == "user123"
    assert payload["role"] == "admin"
    assert payload["type"] == "access"


def test_refresh_token_roundtrip():
    token = create_refresh_token({"sub": "user123"})
    payload = decode_token(token)
    assert payload["sub"] == "user123"
    assert payload["type"] == "refresh"
