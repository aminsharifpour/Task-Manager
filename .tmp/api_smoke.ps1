$ErrorActionPreference = "Stop"
function Assert-True($condition, $message) { if (-not $condition) { throw "ASSERT FAILED: $message" } }
function Req($method, $url, $body = $null) {
  $params = @{ Method = $method; Uri = $url; TimeoutSec = 15 }
  if ($null -ne $body) { $params['ContentType'] = 'application/json'; $params['Body'] = ($body | ConvertTo-Json -Depth 10) }
  return Invoke-RestMethod @params
}
function StatusOnly($method, $url, $body = $null) {
  $params = @{ Method = $method; Uri = $url; TimeoutSec = 15 }
  if ($null -ne $body) { $params['ContentType'] = 'application/json'; $params['Body'] = ($body | ConvertTo-Json -Depth 10) }
  try { Invoke-RestMethod @params | Out-Null; return 200 } catch {
    if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
    throw
  }
}

$r = [ordered]@{}
$base = 'http://localhost:8787'

$health = Req 'GET' "$base/api/health"
Assert-True ($health.ok -eq $true) 'health'
$r.health = 'pass'

$p1 = Req 'POST' "$base/api/projects" @{ name = 'QA Project'; description = 'integration test' }
Assert-True ($null -ne $p1.id) 'project create'
$dupProjectStatus = StatusOnly 'POST' "$base/api/projects" @{ name = 'QA Project' }
Assert-True ($dupProjectStatus -eq 409) 'duplicate project'
$p1u = Req 'PATCH' "$base/api/projects/$($p1.id)" @{ name = 'QA Project Renamed'; description = 'edited' }
Assert-True ($p1u.name -eq 'QA Project Renamed') 'project update'
$r.projects = 'pass'

$t1 = Req 'POST' "$base/api/tasks" @{ title='Task 1'; description='desc'; assigner='A'; assigneePrimary='B'; assigneeSecondary='C'; projectName='QA Project Renamed'; announceDate='2026-02-20'; executionDate='2026-02-28' }
Assert-True ($t1.done -eq $false) 'task create'
$t1d = Req 'PATCH' "$base/api/tasks/$($t1.id)" @{ done = $true }
Assert-True ($t1d.done -eq $true) 'task toggle'
$badTaskStatus = StatusOnly 'POST' "$base/api/tasks" @{ title=''; description='d'; assigner='a'; assigneePrimary='b'; projectName='QA Project Renamed'; announceDate='2026-02-20'; executionDate='2026-02-28' }
Assert-True ($badTaskStatus -eq 400) 'task validation'
$r.tasks = 'pass'

$m1 = Req 'POST' "$base/api/minutes" @{ title='Minute 1'; date='2026-02-21'; attendees='x'; summary='s'; decisions='d'; followUps='f' }
Assert-True ($null -ne $m1.id) 'minute create'
$badMinuteStatus = StatusOnly 'POST' "$base/api/minutes" @{ title='Bad'; date='1404/12/01'; summary='s' }
Assert-True ($badMinuteStatus -eq 400) 'minute validation'
$m1u = Req 'PATCH' "$base/api/minutes/$($m1.id)" @{ title='Minute 1 edited'; date='2026-02-22'; attendees='y'; summary='s2'; decisions=''; followUps='' }
Assert-True ($m1u.title -eq 'Minute 1 edited') 'minute update'
$r.minutes = 'pass'

$a1 = Req 'POST' "$base/api/accounting/accounts" @{ name='Main Card'; bankName='Bank'; cardLast4='1234' }
Assert-True ($null -ne $a1.id) 'account create'
$badAccStatus = StatusOnly 'POST' "$base/api/accounting/accounts" @{ name='Bad'; cardLast4='12' }
Assert-True ($badAccStatus -eq 400) 'account validation'
$a1u = Req 'PATCH' "$base/api/accounting/accounts/$($a1.id)" @{ name='Main Card 2'; bankName='Bank2'; cardLast4='5678' }
Assert-True ($a1u.name -eq 'Main Card 2') 'account update'
$r.accounts = 'pass'

$tx1 = Req 'POST' "$base/api/accounting/transactions" @{ type='expense'; title='Coffee'; amount=100000; category='food'; date='2026-02-23'; note='n'; accountId=$a1.id }
Assert-True ($null -ne $tx1.id) 'transaction create'
$badTxStatus = StatusOnly 'POST' "$base/api/accounting/transactions" @{ type='expense'; title='Bad'; amount=1; category='x'; date='1404/12/01'; note=''; accountId=$a1.id }
Assert-True ($badTxStatus -eq 400) 'transaction validation'
$tx1u = Req 'PATCH' "$base/api/accounting/transactions/$($tx1.id)" @{ type='income'; title='Refund'; amount=120000; category='misc'; date='2026-02-23'; note=''; accountId=$a1.id }
Assert-True ($tx1u.type -eq 'income') 'transaction update'
$blockedAcc = StatusOnly 'DELETE' "$base/api/accounting/accounts/$($a1.id)"
Assert-True ($blockedAcc -eq 409) 'account has transaction'
Invoke-RestMethod -Method DELETE -Uri "$base/api/accounting/transactions/$($tx1.id)" | Out-Null
Invoke-RestMethod -Method DELETE -Uri "$base/api/accounting/accounts/$($a1.id)" | Out-Null
$r.transactions = 'pass'

$b1 = Req 'PUT' "$base/api/accounting/budgets/1404-12" @{ amount = 5000000 }
Assert-True ($b1.amount -eq 5000000) 'budget put'
$bGet = Req 'GET' "$base/api/accounting/budgets/1404-12"
Assert-True ($bGet.amount -eq 5000000) 'budget get'
$bHist = Req 'GET' "$base/api/accounting/budgets-history?month=1404-12"
Assert-True ($bHist.Count -ge 1) 'budget history'
$r.budgets = 'pass'

Invoke-RestMethod -Method DELETE -Uri "$base/api/minutes/$($m1.id)" | Out-Null
Invoke-RestMethod -Method DELETE -Uri "$base/api/tasks/$($t1.id)" | Out-Null
Invoke-RestMethod -Method DELETE -Uri "$base/api/projects/$($p1.id)" | Out-Null

"TEST_SUMMARY=" + ($r | ConvertTo-Json -Compress)
