from fastapi.testclient import TestClient

from src.app import app, activities

client = TestClient(app)


def test_root_redirect():
    # Don't follow redirects so we can assert redirect response
    response = client.get("/", follow_redirects=False)
    assert response.status_code in (301, 302, 307)
    assert response.headers.get("location") == "/static/index.html"


def test_get_activities_structure():
    response = client.get("/activities")
    assert response.status_code == 200
    payload = response.json()
    # basic sanity checks for known activities and structure
    assert isinstance(payload, dict)
    assert "Chess Club" in payload
    ch = payload["Chess Club"]
    assert "participants" in ch and isinstance(ch["participants"], list)


def test_static_index_html_served():
    # ensure the static index.html is available
    response = client.get("/static/index.html")
    assert response.status_code == 200
    html = response.text
    assert "Mergington High School" in html


def test_signup_updates_activities():
    activity = "Chess Club"
    email = "integration-test@example.com"

    # ensure clean state for this test
    if email in activities[activity]["participants"]:
        activities[activity]["participants"].remove(email)

    r = client.post(f"/activities/{activity}/signup?email={email}")
    assert r.status_code == 200

    # GET /activities should reflect the new signup
    r2 = client.get("/activities")
    assert r2.status_code == 200
    assert email in r2.json()[activity]["participants"]

    # clean up
    activities[activity]["participants"].remove(email)
