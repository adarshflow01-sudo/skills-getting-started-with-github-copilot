from fastapi.testclient import TestClient

from src.app import app, activities


client = TestClient(app)


def test_unregister_success():
    # ensure the participant exists first
    activity = "Chess Club"
    email = "michael@mergington.edu"
    assert email in activities[activity]["participants"]

    response = client.delete(f"/activities/{activity}/participants?email={email}")
    assert response.status_code == 200
    payload = response.json()
    assert "Unregistered" in payload["message"]
    assert email not in activities[activity]["participants"]


def test_unregister_not_signed():
    activity = "Chess Club"
    email = "not-signed@example.com"
    # make sure participant is not present
    if email in activities[activity]["participants"]:
        activities[activity]["participants"].remove(email)

    response = client.delete(f"/activities/{activity}/participants?email={email}")
    assert response.status_code == 400
    assert response.json()["detail"] == "Student not signed up for this activity"


def test_unregister_activity_not_found():
    activity = "Non-Existing Activity"
    email = "someone@example.com"
    response = client.delete(f"/activities/{activity}/participants?email={email}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Activity not found"


def test_unregister_missing_email_param():
    activity = "Chess Club"
    # omit the email query param entirely
    response = client.delete(f"/activities/{activity}/participants")
    # FastAPI/Starlette will respond with a 422 Unprocessable Entity for missing required query params
    assert response.status_code == 422


def test_unregister_last_participant_leaves_empty_list():
    # Use a fresh activity with one participant so removing the last leaves an empty list
    activity = "Basketball Team"
    # ensure the activity has exactly one participant (as defined in src/app.py)
    email = "alex@mergington.edu"
    assert activities[activity]["participants"] == [email]

    response = client.delete(f"/activities/{activity}/participants?email={email}")
    assert response.status_code == 200
    payload = response.json()
    assert "Unregistered" in payload["message"]
    # after removing the only participant, participants list should be empty
    assert activities[activity]["participants"] == []
