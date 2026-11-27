"""Unit tests for public read-only material listing and opt-in startup seeds."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.app import create_app


def test_public_gradient_card_materials_lists_read_only_without_file_urls(
    monkeypatch,
    tmp_path: Path,
) -> None:
    archive_path = tmp_path / "Bambu Lab" / "PLA Basic White" / "material.json"
    archive_path.parent.mkdir(parents=True)
    archive_path.write_text("{}", encoding="utf-8")

    monkeypatch.setattr(
        "api.routers.single_stage.list_saved_stage_a_material_archives",
        lambda: [
            {
                "material_name": "PLA Basic White",
                "directory_name": "Bambu Lab/PLA Basic White",
                "created_at": "2026-11-18T00:00:00Z",
                "updated_at": "2026-11-18T00:00:00Z",
                "archive_path": str(archive_path),
                "stage_a_params_path": "",
                "estimated_rgb": [255, 255, 255],
                "layer_height_mm": 0.08,
                "mean_delta_e": 1.1,
                "verification_count": 2,
                "verification_history": [],
            }
        ],
    )

    client = TestClient(create_app())
    resp = client.get(
        "/api/extractor/public-gradient-card-materials?include_file_urls=true",
        headers={"Host": "stack.filament.ibaozi.com"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert len(payload["materials"]) == 1
    item = payload["materials"][0]
    assert item["directory_name"] == "Bambu Lab/PLA Basic White"
    assert item["material_file_url"] is None
    assert item["stage_a_params_url"] is None
    assert str(archive_path) not in resp.text

    # Cross-site requests are still rejected.
    blocked = client.get(
        "/api/extractor/public-gradient-card-materials",
        headers={
            "Host": "stack.filament.ibaozi.com",
            "Sec-Fetch-Site": "cross-site",
        },
    )
    assert blocked.status_code == 403

    # Management listing endpoint remains restricted to local origin.
    mgmt = client.get(
        "/api/extractor/gradient-card-materials",
        headers={"Host": "stack.filament.ibaozi.com"},
    )
    assert mgmt.status_code == 403


def test_lifespan_auto_installs_seeds_only_when_opted_in(monkeypatch) -> None:
    monkeypatch.setenv("LUMINA_AUTO_INSTALL_SEEDS", "1")
    with patch(
        "api.material_seed.install_material_seed_if_needed",
        return_value={"installed_count": 662, "seed_source": "/seeds/materials.zip"},
    ) as mat_seed, patch(
        "api.lut_seed.install_lut_seed_if_needed",
        return_value={"installed_count": 99, "seed_source": "/seeds/luts.zip"},
    ) as lut_seed, patch(
        "api.app.install_workshop_seed_if_needed",
        return_value=None,
    ), patch(
        "api.app.start_material_sync_auto_refresh_tasks",
        return_value=[],
    ):
        with TestClient(create_app()) as client:
            assert client.get("/api/health").status_code == 200

    mat_seed.assert_called_once()
    lut_seed.assert_called_once()
