@echo off
setlocal
cd /d C:\Users\dolap\Desktop\Projects\plan-my-path\Backend
python scripts\sync_supabase.py --seasonal-only >> ..\logs\sync.log 2>&1
endlocal
