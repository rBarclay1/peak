#!/usr/bin/env python3
"""Sync Garmin Connect daily metrics into Supabase `garmin_data`.

Uses the unofficial `garminconnect` client. Reads credentials and Supabase
config from the project `.env`. Pulls the last N days (default 7) of sleep,
HRV, resting HR and running activities, then upserts one row per date.

Usage:
    pip install -r requirements.txt
    python scripts/garmin_sync.py [days]

First run may prompt for an MFA code; the session token is cached in
~/.garminconnect so later runs are non-interactive.
"""

import os
import sys
from datetime import date, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv
from garminconnect import Garmin
from garminconnect.exceptions import GarminConnectAuthenticationError

USER_ID = "placeholder-user"  # matches the app's prototype user
TOKENSTORE = os.path.expanduser("~/.garminconnect")

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

GARMIN_EMAIL = os.getenv("GARMIN_EMAIL")
GARMIN_PASSWORD = os.getenv("GARMIN_PASSWORD")
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

# Normalize to the bare project URL — tolerate a trailing slash or a stray
# `/rest/v1` so we don't end up posting to `.../rest/v1//rest/v1/...`.
if SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.rstrip("/")
    if SUPABASE_URL.endswith("/rest/v1"):
        SUPABASE_URL = SUPABASE_URL[: -len("/rest/v1")]


def login() -> Garmin:
    """Log in to Garmin Connect.

    Passing the tokenstore path to `login()` resumes a cached session when one
    exists (no credentials or MFA needed, and it skips Garmin's SSO endpoint
    that rate-limits by IP). On a fresh login it uses GARMIN_EMAIL/PASSWORD,
    may prompt for an MFA code, and persists the new tokens to the tokenstore
    for next time.
    """
    garmin = Garmin(
        email=GARMIN_EMAIL,
        password=GARMIN_PASSWORD,
        prompt_mfa=lambda: input("Garmin MFA code: "),
    )
    try:
        garmin.login(TOKENSTORE)
    except GarminConnectAuthenticationError:
        if not GARMIN_EMAIL or not GARMIN_PASSWORD:
            sys.exit("No cached Garmin session and no GARMIN_EMAIL/GARMIN_PASSWORD in .env")
        raise
    return garmin


def safe(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def fetch_day(garmin: Garmin, d: date) -> dict | None:
    cdate = d.isoformat()
    row = {"user_id": USER_ID, "date": cdate}
    got = False

    # --- Sleep (score, total + stages) ---
    sleep = safe(lambda: garmin.get_sleep_data(cdate)) or {}
    dto = sleep.get("dailySleepDTO") or {}
    score = (dto.get("sleepScores") or {}).get("overall", {}).get("value")
    if score is not None:
        row["sleep_score"] = score
        got = True
    total_s = dto.get("sleepTimeSeconds")
    if total_s:
        row["sleep_duration_hours"] = round(total_s / 3600, 2)
    for col, key in (
        ("sleep_deep_min", "deepSleepSeconds"),
        ("sleep_light_min", "lightSleepSeconds"),
        ("sleep_rem_min", "remSleepSeconds"),
        ("sleep_awake_min", "awakeSleepSeconds"),
    ):
        secs = dto.get(key)
        if secs is not None:
            row[col] = round(secs / 60)
            got = True

    # --- HRV (last-night average, ms) ---
    hrv = safe(lambda: garmin.get_hrv_data(cdate)) or {}
    last_night = (hrv.get("hrvSummary") or {}).get("lastNightAvg")
    if last_night is not None:
        row["hrv_score"] = last_night
        got = True

    # --- Resting HR ---
    rhr = safe(lambda: garmin.get_rhr_day(cdate)) or {}
    metrics = ((rhr.get("allMetrics") or {}).get("metricsMap") or {}).get(
        "WELLNESS_RESTING_HEART_RATE"
    )
    if metrics:
        val = metrics[0].get("value")
        if val is not None:
            row["resting_hr"] = int(val)
            got = True

    # --- Running activity (first run of the day, if any) ---
    runs = safe(lambda: garmin.get_activities_by_date(cdate, cdate, "running")) or []
    if runs:
        a = runs[0]
        dist_m = a.get("distance") or 0
        dur_s = a.get("duration") or 0
        if dist_m:
            row["run_distance_km"] = round(dist_m / 1000, 2)
        if dur_s:
            row["run_duration_mins"] = round(dur_s / 60, 1)
        if dist_m and dur_s:
            pace_s = dur_s / (dist_m / 1000)  # sec per km
            row["run_avg_pace"] = f"{int(pace_s // 60)}:{int(pace_s % 60):02d}/km"
        got = True

    if not got:
        return None
    from datetime import datetime, timezone

    row["synced_at"] = datetime.now(timezone.utc).isoformat()
    return row


def upsert(rows: list[dict]) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env")
    # PostgREST requires every object in a bulk upsert to have identical keys.
    # fetch_day only includes columns that had data, so union all keys across
    # the batch and fill any missing ones with None.
    all_keys = set()
    for r in rows:
        all_keys.update(r.keys())
    rows = [{k: r.get(k) for k in all_keys} for r in rows]
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/garmin_data",
        params={"on_conflict": "user_id,date"},
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=rows,
        timeout=30,
    )
    resp.raise_for_status()


def main() -> None:
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    garmin = login()
    today = date.today()
    rows = []
    for i in range(days):
        d = today - timedelta(days=i)
        row = fetch_day(garmin, d)
        if row:
            rows.append(row)
            print(f"  {d}: sleep={row.get('sleep_score')} hrv={row.get('hrv_score')}")
        else:
            print(f"  {d}: no data")
    if rows:
        upsert(rows)
        print(f"Synced {len(rows)} day(s) to Supabase.")
    else:
        print("Nothing to sync.")


if __name__ == "__main__":
    main()
