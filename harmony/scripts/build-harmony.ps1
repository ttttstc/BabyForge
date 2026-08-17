param(
  [string]$DevEcoRoot = 'E:\soft\DevEco Studio',
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$hvigor = Join-Path $DevEcoRoot 'tools\hvigor\bin\hvigorw.bat'
$nodeRoot = Join-Path $DevEcoRoot 'tools\node'
$sdkRoot = Join-Path $DevEcoRoot 'sdk'

foreach ($requiredPath in @($hvigor, $nodeRoot, $sdkRoot)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "找不到 DevEco 依赖：$requiredPath。请通过 -DevEcoRoot 指定 DevEco Studio 根目录。"
  }
}

$previousSdkHome = $env:DEVECO_SDK_HOME
$previousPath = $env:PATH

try {
  $env:DEVECO_SDK_HOME = $sdkRoot
  $env:PATH = "$nodeRoot;$previousPath"
  Push-Location $projectRoot

  if ($Clean) {
    & $hvigor --mode module -p product=default clean --no-daemon
    if ($LASTEXITCODE -ne 0) {
      throw "HarmonyOS clean 失败，退出码：$LASTEXITCODE"
    }
  }

  & $hvigor --mode module -p product=default assembleHap --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "HarmonyOS HAP 构建失败，退出码：$LASTEXITCODE"
  }
}
finally {
  Pop-Location
  $env:DEVECO_SDK_HOME = $previousSdkHome
  $env:PATH = $previousPath
}
