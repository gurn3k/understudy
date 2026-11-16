$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
Set-Location $repo
cmd /c "python tools\run_replay.py `"$data`" > `"$data\replay_stdout.txt`" 2>&1 & echo exit=%ERRORLEVEL% >> `"$data\replay_stdout.txt`""
