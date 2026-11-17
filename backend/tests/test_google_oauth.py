import pytest

from app.integrations import google_oauth


@pytest.fixture(autouse=True)
def isolated_token_store(tmp_path, monkeypatch):
    store_path = tmp_path / "google_tokens.json"
    monkeypatch.setattr(google_oauth, "_TOKEN_STORE_PATH", str(store_path))
    yield store_path


def test_is_connected_false_when_no_token_file(isolated_token_store):
    assert google_oauth.is_connected() is False


def test_client_config_raises_without_env_vars(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    with pytest.raises(google_oauth.GoogleNotConfiguredError):
        google_oauth._client_config()


def test_client_config_builds_web_config_from_env(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    config = google_oauth._client_config()
    assert config["web"]["client_id"] == "cid"
    assert config["web"]["client_secret"] == "secret"
    assert config["web"]["redirect_uris"] == [google_oauth._redirect_uri()]


def test_get_credentials_raises_when_not_connected(isolated_token_store):
    with pytest.raises(google_oauth.GoogleNotConnectedError):
        google_oauth.get_credentials()


def test_save_and_load_credentials_round_trip(isolated_token_store):
    class FakeCreds:
        token = "access-token"
        refresh_token = "refresh-token"
        token_uri = "https://oauth2.googleapis.com/token"
        client_id = "cid"
        client_secret = "secret"
        scopes = google_oauth.SCOPES

    google_oauth._save_credentials(FakeCreds())
    assert google_oauth.is_connected() is True

    raw = google_oauth._load_raw()
    assert raw["token"] == "access-token"
    assert raw["refresh_token"] == "refresh-token"


def test_disconnect_removes_token_file(isolated_token_store):
    class FakeCreds:
        token = "t"
        refresh_token = "r"
        token_uri = "https://oauth2.googleapis.com/token"
        client_id = "cid"
        client_secret = "secret"
        scopes = google_oauth.SCOPES

    google_oauth._save_credentials(FakeCreds())
    assert google_oauth.is_connected() is True
    google_oauth.disconnect()
    assert google_oauth.is_connected() is False
