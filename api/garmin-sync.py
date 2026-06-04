"""Vercel Cron function: sync Garmin Connect daily metrics into Supabase.

Runs headless on a schedule (see vercel.json crons). Authenticates from a
pre-serialized Garmin session token stored in the GARMIN_TOKEN env var — no
files, no MFA. Generate that token once from a machine with a cached session:

    python -c "import os;from garminconnect import Garmin;g=Garmin();\
g.client.load(os.path.expanduser('~/.garminconnect'));print(g.client.dumps())"

and store the output as GARMIN_TOKEN in the Vercel project (Production).
"""

from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import date, datetime, timedelta, timezone

import requests
from garminconnect import Garmin

USER_ID = "placeholder-user"  # matches the app's prototype user


def supabase_base():
    url = (os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    if url.endswith("/rest/v1"):
        url = url[: -len("/rest/v1")]
    return url


def safe(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def fetch_day(garmin, d):
    cdate = d.isoformat()
    row = {"user_id": USER_ID, "date": cdate}
    got = False

    # Sleep (score, total + stages)
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

    # HRV (last-night average, ms)
    hrv = safe(lambda: garmin.get_hrv_data(cdate)) or {}
    last_night = (hrv.get("hrvSummary") or {}).get("lastNightAvg")
    if last_night is not None:
        row["hrv_score"] = last_night
        got = True

    # Resting HR
    rhr = safe(lambda: garmin.get_rhr_day(cdate)) or {}
    metrics = ((rhr.get("allMetrics") or {}).get("metricsMap") or {}).get(
        "WELLNESS_RESTING_HEART_RATE"
    )
    if metrics:
        val = metrics[0].get("value")
        if val is not None:
            row["resting_hr"] = int(val)
            got = True

    # Running activity (first run of the day, if any)
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
            pace_s = dur_s / (dist_m / 1000)
            row["run_avg_pace"] = f"{int(pace_s // 60)}:{int(pace_s % 60):02d}/km"
        got = True

    if not got:
        return None
    row["synced_at"] = datetime.now(timezone.utc).isoformat()
    return row


def upsert(rows):
    base = supabase_base()
    key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    if not base or not key:
        raise RuntimeError("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY")
    # PostgREST needs every object in a bulk upsert to share the same keys.
    all_keys = set()
    for r in rows:
        all_keys.update(r.keys())
    rows = [{k: r.get(k) for k in all_keys} for r in rows]
    resp = requests.post(
        f"{base}/rest/v1/garmin_data",
        params={"on_conflict": "user_id,date"},
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=rows,
        timeout=30,
    )
    resp.raise_for_status()


def run_sync(days=3):
    token = os.environ.get("GARMIN_TOKEN")
    if not token:
        raise RuntimeError("GARMIN_TOKEN not set")
    garmin = Garmin()
    # A >512-char token string is loaded directly (no SSO, no MFA); login()
    # also refreshes the access token and loads the profile.
    garmin.login(token)
    today = date.today()
    rows = []
    for i in range(days):
        d = today - timedelta(days=i)
        r = fetch_day(garmin, d)
        if r:
            rows.append(r)
    if rows:
        upsert(rows)
    return {"synced": len(rows), "dates": [r["date"] for r in rows]}


class handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        # When CRON_SECRET is set, Vercel sends it as a Bearer token on cron
        # invocations. Reject anything else so the endpoint isn't public.
        secret = os.environ.get("CRON_SECRET")
        if secret:
            auth = self.headers.get("authorization") or self.headers.get("Authorization")
            if auth != f"Bearer {secret}":
                self._send(401, {"ok": False, "error": "unauthorized"})
                return
        try:
            result = run_sync(3)
            self._send(200, {"ok": True, **result})
        except Exception as e:  # noqa: BLE001 — surface any failure as JSON
            self._send(500, {"ok": False, "error": str(e)})
