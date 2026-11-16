# Runs the full analysis and the independent recount in their own window.
$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
$log  = Join-Path $data "analyse_run.log"
Set-Location $repo
$t0 = Get-Date
python -m understudy.analyse "$data\cases.jsonl" "$data\analysis.json" *> "$data\analyse_stdout.txt"
$a = $LASTEXITCODE
$t1 = Get-Date
python tools\recount.py "$data\BPI_Challenge_2019.xes" "$data\checks.json" "$data\analysis.json" *> "$data\recount_stdout.txt"
$r = $LASTEXITCODE
$t2 = Get-Date
"analyse_exit=$a analyse_s=$([math]::Round(($t1-$t0).TotalSeconds,1)) recount_exit=$r recount_s=$([math]::Round(($t2-$t1).TotalSeconds,1))" | Out-File -Encoding utf8 $log
Get-Content "$data\analyse_stdout.txt","$data\recount_stdout.txt" | Out-File -Append -Encoding utf8 $log
