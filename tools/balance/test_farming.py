import json
from pathlib import Path

from farming import analyze

FIXTURE = Path(__file__).parent / "fixtures" / "farming_snapshot.json"


def test_fixture_flags_farmers_not_honest_humans():
    snapshot = json.loads(FIXTURE.read_text(encoding="utf-8"))
    report = analyze(snapshot)
    codes_by_wallet = {}
    for item in report["findings"]:
        codes_by_wallet.setdefault(item["wallet"], set()).add(item["code"])

    honest = "0x1111111111111111111111111111111111111111"
    assert honest not in {item["wallet"] for item in report["farming"]}

    official = "0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528"
    assert codes_by_wallet[official] == {"official_bot"}

    farmer = "0x2222222222222222222222222222222222222222"
    assert "cloned_latency" in codes_by_wallet[farmer]
    assert "superhuman_timing" in codes_by_wallet[farmer]

    capper = "0x3333333333333333333333333333333333333333"
    assert "daily_cap_exceeded" in codes_by_wallet[capper]

    spoof = "0x4444444444444444444444444444444444444444"
    assert "unlisted_bot_flag" in codes_by_wallet[spoof]


def test_empty_snapshot_is_clean():
    report = analyze({"games": [], "progress": []})
    assert report["farming"] == []
    assert report["wallets"] == 0
