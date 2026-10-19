param(
  [string]$Method = "GET",
  [string]$Url = "http://localhost:3000/api/credits",
  [string]$Body = "",
  [string]$AppKey = "000000Long"
)
try {
  $headers = @{ "x-app-key" = $AppKey }
  $params = @{ Uri = $Url; Method = $Method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 90 }
  if ($Body -ne "") {
    $params.Body = $Body
    $params.ContentType = "application/json"
  }
  $r = Invoke-WebRequest @params
  Write-Host ("STATUS: " + $r.StatusCode)
  Write-Host ("BODY: " + $r.Content.Substring(0, [Math]::Min(2000, $r.Content.Length)))
} catch {
  Write-Host ("ERROR: " + $_.Exception.Message)
  if ($_.Exception.Response) {
    Write-Host ("HTTP STATUS: " + [int]$_.Exception.Response.StatusCode)
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      Write-Host ("BODY: " + $reader.ReadToEnd())
    } catch {}
  }
}
