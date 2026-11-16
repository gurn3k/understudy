# Unattended follow-up run of B (ADR 0018), blocks 2-10, across 5-hour usage resets.
# Waits for the first reset, runs until a usage limit stops it, waits, and resumes.
# Saved responses are reused, so no call is made twice. Keeps the PC awake while it runs.
param([datetime]$Start = (Get-Date), [datetime]$GiveUp = (Get-Date).AddDays(1.5), [int]$WaitMin = 20)
$repo = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA "understudy\data"
$log = Join-Path $data "b2_loop.log"
Set-Location $repo
Add-Type -Namespace W -Name P -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
[void][W.P]::SetThreadExecutionState([uint32]"0x80000001")  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
function Say($m) { "$(Get-Date -Format s) $m" | Out-File -Append -Encoding utf8 $log }
function NextBlock { for ($b = 2; $b -le 10; $b++) { if (-not (Test-Path (Join-Path $data ("b2_live_block_{0:D2}.json" -f $b)))) { return $b } }; return 11 }
Say "loop armed; first attempt at $Start; gives up at $GiveUp"
while ((Get-Date) -lt $Start) { Start-Sleep -Seconds 60 }
while ($true) {
  $b = NextBlock
  if ($b -gt 10) { Say "all blocks done"; "done" | Out-File -Encoding ascii (Join-Path $data "b2_loop_done.txt"); break }
  if ((Get-Date) -gt $GiveUp) { Say "gave up before block $b"; "gave_up" | Out-File -Encoding ascii (Join-Path $data "b2_loop_done.txt"); break }
  Say "attempt from block $b"
  cmd /c "python tools\run_b2.py run live $b 10 400 >> `"$data\b2_run_loop.txt`" 2>&1"
  $after = NextBlock
  Say "attempt ended; next block now $after"
  if ($after -le 10) { Start-Sleep -Seconds (60 * $WaitMin) }
}
[void][W.P]::SetThreadExecutionState([uint32]"0x80000000")
