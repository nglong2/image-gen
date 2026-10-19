param([string]$Url = "http://localhost:3000/")
try {
  $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 90
  Write-Host ("STATUS: " + $r.StatusCode)
  Write-Host ("LENGTH: " + $r.Content.Length)
} catch {
  Write-Host ("ERROR: " + $_.Exception.Message)
  if ($_.Exception.Response) {
    Write-Host ("HTTP STATUS: " + [int]$_.Exception.Response.StatusCode)
  }
}
