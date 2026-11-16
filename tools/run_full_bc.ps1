# Deciding runs: C policies 2-3 (policy 1 is reused from the saved response), then B on the full 1,500 sample.
$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
Set-Location $repo
cmd /c "python tools\run_bc.py c live 3 2 > `"$data\live_c3.txt`" 2>&1"
cmd /c "python tools\run_bc.py b live 1500 58 > `"$data\live_b1500.txt`" 2>&1"
"done" | Out-File -Encoding ascii "$data\full_bc_done.txt"
