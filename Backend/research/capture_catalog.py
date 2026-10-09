"""Archive catalog retrieval provenance. Source bodies stay in ignored local logs."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
import uuid

ROOT = Path(__file__).resolve().parents[2]


def main():
    facts = ROOT / "docs/research/fisk-catalog-rules.json"
    rules = json.loads(facts.read_text())
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:6]
    archive = ROOT / "logs/catalog-sources" / stamp
    archive.mkdir(parents=True)
    target = ROOT / "docs/research/baselines/results" / ("catalog-capture-" + stamp)
    target.mkdir(parents=True)
    record = {"edition_selected": rules["edition"], "facts_sha256": hashlib.sha256(facts.read_bytes()).hexdigest(),
              "retrieved_at_utc": datetime.now(timezone.utc).isoformat(), "sources": []}
    for name, url in rules["sources"].items():
        item = {"id": name, "requested_url": url}
        try:
            with urlopen(Request(url, headers={"User-Agent": "AcademicResearchSourceCapture/1.0"}), timeout=30) as response:
                body = response.read()
                path = archive / f"{name}.html"
                path.write_bytes(body)
                item.update(status="retrieved", final_url=response.url, sha256=hashlib.sha256(body).hexdigest(),
                            local_archive=path.relative_to(ROOT).as_posix(), bytes=len(body))
        except Exception as exc:
            item.update(status="failed", error=f"{type(exc).__name__}: {exc}")
        record["sources"].append(item)
        (target / "sources.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    print(f"Source manifest: {target / 'sources.json'}")
    print(f"Retrieved: {sum(s['status'] == 'retrieved' for s in record['sources'])}/{len(record['sources'])}")
    if any(s["status"] == "failed" for s in record["sources"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
