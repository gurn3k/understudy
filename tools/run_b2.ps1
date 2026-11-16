# Follow-up run of B (ADR 0018): blocks First..Last, in its own window; closes itself.
param([int]$First = 1, [int]$Last = 1)
$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
Set-Location $repo
$cap = 40 * ($Last - $First + 1) + 10
cmd /c "python tools\run_b2.py run live $First $Last $cap > `"$data\b2_run_${First}_${Last}.txt`" 2>&1"
"done" | Out-File -Encoding ascii "$data\b2_done_${First}_${Last}.txt"
