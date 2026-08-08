param(
  [Parameter(Mandatory = $true)]
  [string]$EnvFile,
  [string]$Repository = 'ttttstc/BabyForge'
)

$requiredNames = @('OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'OPENAI_USE_RESPONSES')
$configLines = Get-Content -LiteralPath $EnvFile

foreach ($secretName in $requiredNames) {
  $prefix = "$secretName="
  $assignment = $configLines | Where-Object { $_.StartsWith($prefix) } | Select-Object -First 1
  if (-not $assignment) { throw "Missing $secretName in $EnvFile" }
  $secretValue = $assignment.Substring($prefix.Length).Trim()
  if ($secretValue.Length -ge 2 -and (($secretValue[0] -eq '"' -and $secretValue[-1] -eq '"') -or ($secretValue[0] -eq "'" -and $secretValue[-1] -eq "'"))) {
    $secretValue = $secretValue.Substring(1, $secretValue.Length - 2)
  }
  if (-not $secretValue) { throw "$secretName is empty in $EnvFile" }
  $secretValue | gh secret set $secretName --repo $Repository
  if ($LASTEXITCODE -ne 0) { throw "Failed to set $secretName" }
  Write-Output "Updated $secretName"
}
