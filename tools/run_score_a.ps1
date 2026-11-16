$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
Set-Location $repo
cmd /c "python tools\score_a.py `"$data`" > `"$data\score_a_stdout.txt`" 2>&1 & echo exit=%ERRORLEVEL% >> `"$data\score_a_stdout.txt`""
