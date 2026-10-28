from fastapi.testclient import TestClient
import app as app_module

client = TestClient(app_module.app)

def test_home():
    response = client.get("/")
    assert response.status_code == 200
    assert "running" in response.json()["message"]

def test_register_login_and_transaction():
    # Unique email makes the test repeatable.
    import uuid
    email = f"test-{uuid.uuid4().hex[:10]}@example.com"
    reg = client.post("/api/auth/register", json={"name":"Test User","email":email,"password":"test-password-123"})
    assert reg.status_code == 200
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/transactions", headers=headers, json={
        "title":"Test lunch","amount":120,"kind":"expense","category":"Food","spent_on":"2026-10-27","note":"test"
    })
    assert created.status_code == 200
    assert created.json()["title"] == "Test lunch"
    assert client.get("/api/transactions", headers=headers).status_code == 200
