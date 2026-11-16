$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
Set-Location $repo
cmd /c "python tools\rank_candidates.py `"$data`" > `"$data\rank_stdout.txt`" 2>&1 & echo exit=%ERRORLEVEL% >> `"$data\rank_stdout.txt`""
