"""Fetch live stats from Modrinth + the Fortnite Ecosystem API and write stats.json.

Run by a daily GitHub Action (or manually: `python fetch_stats.py`).
Uses only the Python standard library, so no `pip install` is needed anywhere.

Notes on the Fortnite Ecosystem API:
  - It is a ROLLING window: it returns up to the last ~7 days in daily buckets.
    There is no "lifetime plays" and no follower count in the public API, so we
    report 7-day activity (plays, minutes) which is additive, and peak CCU (max).
  - Islands need >=5 unique players in an interval or the value comes back null.
"""

import json
import urllib.request
import urllib.error

MODRINTH_USER = "Gurkis"

# Only islands that are clearly Gurkis's own. (Melon Run is a charity collab
# published under another creator, so its plays aren't attributable here.)
ISLANDS = {
    "Battle43": "1322-0197-1845",
    "Just Drive": "7882-5895-5239",
    "Burning Rubber": "2860-7316-8507",
}

UA = "gurkis-portfolio-stats/1.0 (+https://github.com)"


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def modrinth_stats():
    """Lifetime total downloads summed across all the user's projects."""
    projects = get_json(f"https://api.modrinth.com/v2/user/{MODRINTH_USER}/projects")
    total = sum(int(p.get("downloads", 0) or 0) for p in projects)
    followers = sum(int(p.get("followers", 0) or 0) for p in projects)
    return {"downloads": total, "projects": len(projects), "followers": followers}


def _sum_values(series):
    return sum(int(d.get("value", 0) or 0) for d in (series or []))


def _max_values(series):
    vals = [int(d.get("value", 0) or 0) for d in (series or [])]
    return max(vals) if vals else 0


def fortnite_stats():
    """7-day rolling activity across the owned islands."""
    plays = minutes = 0
    peak_ccu = 0
    islands_with_data = 0
    for name, code in ISLANDS.items():
        try:
            m = get_json(f"https://api.fortnite.com/ecosystem/v1/islands/{code}/metrics")
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as e:
            print(f"  ! skipped {name} ({code}): {e}")
            continue
        p = _sum_values(m.get("plays"))
        plays += p
        minutes += _sum_values(m.get("minutesPlayed"))
        peak_ccu = max(peak_ccu, _max_values(m.get("peakCCU")))
        if p:
            islands_with_data += 1
        print(f"  {name}: {p} plays (7d)")
    return {
        "plays_7d": plays,
        "hours_7d": round(minutes / 60),
        "peak_ccu": peak_ccu,
        "active_islands": islands_with_data,
    }


def main():
    print("Modrinth...")
    modrinth = modrinth_stats()
    print(f"  downloads: {modrinth['downloads']:,} across {modrinth['projects']} projects")

    print("Fortnite...")
    fortnite = fortnite_stats()

    data = {
        # generated_at is filled by the GitHub Action via env, or left None locally.
        "generated_at": None,
        "modrinth": modrinth,
        "fortnite": fortnite,
    }

    import os
    stamp = os.environ.get("STATS_TIMESTAMP")
    if stamp:
        data["generated_at"] = stamp

    out = os.path.join(os.path.dirname(__file__), "stats.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"\nWrote {out}")
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
