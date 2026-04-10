@echo off
setlocal
cd /d C:\Users\dolap\Desktop\Projects\plan-my-path\Backend
echo [%date% %time%] Starting sync... >> ..\logs\sync.log 2>&1
python scripts\sync_supabase.py --seasonal-only >> ..\logs\sync.log 2>&1
python scripts\seed_requirements.py >> ..\logs\sync.log 2>&1
echo [%date% %time%] Sync complete. >> ..\logs\sync.log 2>&1
endlocal
