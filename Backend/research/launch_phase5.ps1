# Phase 5 launch script — run after Phase 4 completes
# Tasks 1 and 2, seeds 300-305, all 3 faults + unfaulted references, all 6 strategies
# Model: gemini/gemini-3.6-flash (set by launch_phase4.ps1 already)

$ErrorActionPreference = "Stop"
$root = "C:\Users\dolap\Desktop\Projects\plan-my-path"
Set-Location $root

$env:PYTHONUTF8 = "1"; $env:PYTHONIOENCODING = "utf-8"
& "Backend\.venv\Scripts\python.exe" Backend/research/tau_recovery_matrix.py `
    --tasks 1 2 `
    --seeds 300 301 302 303 304 305 `
    --faults empty_read wrong_user_id tool_error `
    --execute
