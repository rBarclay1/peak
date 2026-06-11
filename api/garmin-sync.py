"""Vercel Cron function: sync Garmin Connect daily metrics into Supabase.

Runs headless on a schedule (see vercel.json crons).

Auth strategy (tried in order):
  1. GARMIN_TOKEN env var — a pre-serialized DI token JSON string (fastest,
     no SSO round-trip).  Generate / refresh it on any machine that has a
     valid local session:

       python -c "
       import os
       from garminconnect import Garmin
       g = Garmin()
       g.client.load(os.path.expanduser('~/.garminconnect'))
       print(g.client.dumps())
       "

     Store the output as GARMIN_TOKEN in the Vercel project (Production).

  2. GARMIN_EMAIL + GARMIN_PASSWORD env vars — used automatically when the
     token is absent, expired, or otherwise fails.  The account must NOT
     have MFA enabled (serverless functions can't prompt interactively).
     When this path is taken, the response includes a `new_token` field with
     the freshly-minted DI token — save it as GARMIN_TOKEN to avoid the
     slower SSO login on future runs.
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


def safe(fn, default=None, label=""):
    try:
        return fn()
    except Exception as exc:
        if label:
            print(f"[garmin-sync] {label}: {exc}")
        return default


def fetch_day(garmin, d):
    cdate = d.isoformat()
    row = {"user_id": USER_ID, "date": cdate}
    got = False

    # Sleep (score, total + stages)
    sleep = safe(lambda: garmin.get_sleep_data(cdate), label=f"sleep {cdate}") or {}
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
    hrv = safe(lambda: garmin.get_hrv_data(cdate), label=f"hrv {cdate}") or {}
    last_night = (hrv.get("hrvSummary") or {}).get("lastNightAvg")
    if last_night is not None:
        row["hrv_score"] = last_night
        got = True

    # Resting HR
    rhr = safe(lambda: garmin.get_rhr_day(cdate), label=f"rhr {cdate}") or {}
    metrics = ((rhr.get("allMetrics") or {}).get("metricsMap") or {}).get(
        "WELLNESS_RESTING_HEART_RATE"
    )
    if metrics:
        val = metrics[0].get("value")
        if val is not None:
            row["resting_hr"] = int(val)
            got = True

    # Running activity (first run of the day, if any)
    runs = safe(lambda: garmin.get_activities_by_date(cdate, cdate, "running"), label=f"runs {cdate}") or []
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
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")

    if not token and not (email and password):
        raise RuntimeError(
            "Set GARMIN_TOKEN, or set both GARMIN_EMAIL and GARMIN_PASSWORD"
        )

    # Pass credentials so login() can fall back to them automatically when the
    # token is absent or fails to load (tokens_loaded = False path).
    garmin = Garmin(email=email, password=password)
    new_token = None

    try:
        garmin.login(token)
    except Exception as token_err:
        # The token loaded but is expired (or the profile-fetch failed).
        # If credentials are available, do a fresh SSO login.
        if not (email and password):
            raise RuntimeError(
                f"Token auth failed and no GARMIN_EMAIL/GARMIN_PASSWORD fallback: {token_err}"
            ) from token_err
        garmin = Garmin(email=email, password=password)
        garmin.login(None)  # full SSO, no token
        new_token = garmin.client.dumps()

    today = date.today()
    rows = []
    for i in range(days):
        d = today - timedelta(days=i)
        r = fetch_day(garmin, d)
        if r:
            rows.append(r)
    if rows:
        upsert(rows)
    result: dict = {"synced": len(rows), "dates": [r["date"] for r in rows]}
    if new_token:
        # Token was refreshed via SSO. Surface it so the operator can update
        # the GARMIN_TOKEN env var and avoid the slower SSO login next time.
        result["new_token"] = new_token
        result["warning"] = (
            "Token was expired — re-authenticated via email/password. "
            "Save new_token as GARMIN_TOKEN in Vercel to restore fast-path auth."
        )
    return result


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

    def do_POST(self):
        # User-initiated sync from the app (the cron uses GET + CRON_SECRET).
        # No secret here so the button works from the browser; it only pulls
        # Garmin data into Supabase, so the worst a stray call does is re-sync.
        try:
            result = run_sync(3)
            self._send(200, {"ok": True, **result})
        except Exception as e:  # noqa: BLE001 — surface any failure as JSON
            self._send(500, {"ok": False, "error": str(e)})
