# Wrapper for the Garmin -> Supabase sync, invoked by the "PeakGarminSync"
# scheduled task at 07:00, 12:00, and 20:00 daily. Runs the Python script and
# appends timestamped output (including errors) to garmin_sync.log so missed
# or failed syncs can be inspected.
$ErrorActionPreference = 'Continue'
$root = 'C:\Users\barcl\Documents\summerGrind'
$python = 'C:\Users\barcl\AppData\Local\Programs\Python\Python312\python.exe'
$log = Join-Path $root 'scripts\garmin_sync.log'

Set-Location $root
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
"`n===== $ts =====" | Out-File -FilePath $log -Append -Encoding utf8
& $python (Join-Path $root 'scripts\garmin_sync.py') *>> $log
