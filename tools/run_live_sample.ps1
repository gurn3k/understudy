# Tiny live sample: B on 50 sampled invoices (2 calls), C with 1 policy (1 call).
$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
Set-Location $repo
cmd /c "python tools\run_bc.py b live 50 2 > `"$data\live_b50.txt`" 2>&1"
cmd /c "python tools\run_bc.py c live 1 1 > `"$data\live_c1.txt`" 2>&1"
"done" | Out-File -Encoding ascii "$data\live_sample_done.txt"
