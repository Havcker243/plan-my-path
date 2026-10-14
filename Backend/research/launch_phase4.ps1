# Phase 4 launch script — run this after Phase 3 completes
# Applies model upgrade (gemini-3.6-flash) and expanded seeds (303-305) to tau_recovery.py,
# then runs: task 0, seeds 303-305, all 3 faults + unfaulted reference, all 6 strategies

$ErrorActionPreference = "Stop"
$root = "C:\Users\dolap\Desktop\Projects\plan-my-path"

# 1. Verify Phase 3 is no longer running (check output file is stable)
$phase3out = "$root\docs\research\baselines\results\tau-matrix-20261012T015101Z-f78fdd"
$cells = (Get-ChildItem $phase3out -Filter "cell-*.json" -ErrorAction SilentlyContinue).Count
Write-Host "Phase 3 cells found: $cells (expected 36)"
if ($cells -lt 36) {
    Write-Warning "Phase 3 may not be complete ($cells/36 cells). Proceed anyway? Ctrl+C to abort."
    Start-Sleep -Seconds 5
}

# 2. Apply new strategies + seed/model upgrade via apply_new_strategies.py
$env:PYTHONUTF8 = "1"; $env:PYTHONIOENCODING = "utf-8"
& "Backend\.venv\Scripts\python.exe" Backend/research/apply_new_strategies.py
if ($LASTEXITCODE -ne 0) { Write-Error "apply_new_strategies.py failed"; exit 1 }

# Show new adapter hash
$adapterPath = "$root\Backend\research\tau_recovery.py"
$hash = (Get-FileHash $adapterPath -Algorithm SHA256).Hash.ToLower()
Write-Host "New adapter hash: $hash"

# 3. Run Phase 4 — task 0, seeds 303-305, all 3 faults + unfaulted, all 9 strategies
Set-Location $root
& "Backend\.venv\Scripts\python.exe" Backend/research/tau_recovery_matrix.py `
    --tasks 0 `
    --seeds 303 304 305 `
    --faults empty_read wrong_user_id tool_error `
    --execute
# Note: matrix reads STRATEGIES from the adapter; all 9 strategies will run automatically
