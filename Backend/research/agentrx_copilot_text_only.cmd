@echo off
rem AgentRx needs text generation; constrain the upstream CLI's allow-all flag.
call "C:\nvm4w\nodejs\copilot.cmd" %* --available-tools --deny-tool shell --deny-tool write --deny-tool url --disable-builtin-mcps --no-custom-instructions --no-auto-update
exit /b %errorlevel%
