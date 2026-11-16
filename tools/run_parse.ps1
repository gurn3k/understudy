# Runs the full parse in its own window and records wall time and peak memory.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
$log  = Join-Path $data "parse_run.log"
Set-Location $repo
$p = Start-Process -FilePath python -ArgumentList "-m","understudy.parse","`"$data\BPI_Challenge_2019.xes`"","`"$data`"" -NoNewWindow -PassThru -RedirectStandardOutput "$data\parse_stdout.txt" -RedirectStandardError "$data\parse_stderr.txt"
$null = $p.Handle  # cache the handle so ExitCode is readable
$peak = 0
while (-not $p.HasExited) { try { $p.Refresh(); if ($p.PeakWorkingSet64 -gt $peak) { $peak = $p.PeakWorkingSet64 } } catch {}; Start-Sleep -Milliseconds 500 }
"exit=$($p.ExitCode) peak_mb=$([math]::Round($peak/1MB)) finished=$(Get-Date -Format o)" | Out-File -Encoding utf8 $log
Get-Content "$data\parse_stdout.txt" | Out-File -Append -Encoding utf8 $log
