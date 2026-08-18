param(
  [string]$HdcPath = 'E:\soft\commandline-tools-windows-x64-5.0.7.200\command-line-tools\sdk\default\openharmony\toolchains\hdc.exe',
  [string]$HapSignToolPath = '',
  [string]$ConnectKey = '',
  [switch]$Launch
)

$ErrorActionPreference = 'Stop'

$harmonyRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputRoot = Join-Path $harmonyRoot 'entry\build\default\outputs\default'

if (-not (Test-Path -LiteralPath $HdcPath)) {
  throw "找不到 HDC：$HdcPath。请通过 -HdcPath 指定 hdc.exe。"
}

$hapFiles = @(Get-ChildItem -LiteralPath $outputRoot -Filter '*.hap' -File -ErrorAction SilentlyContinue)
$signedHap = $hapFiles |
  Where-Object { $_.Name -match '(?:^|[-_])signed\.hap$' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -eq $signedHap) {
  throw "未找到签名 HAP。请先在 DevEco Studio 完成本地自动签名，再运行本脚本；unsigned HAP 不允许安装。"
}

$latestUnsignedHap = $hapFiles |
  Where-Object { $_.Name -notmatch '(?:^|[-_])signed\.hap$' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if ($null -ne $latestUnsignedHap -and $latestUnsignedHap.LastWriteTime -gt $signedHap.LastWriteTime) {
  throw "存在比签名 HAP 更新的 unsigned HAP：$($latestUnsignedHap.Name)。请先在 DevEco Studio 重新签名当前构建。"
}

$resolvedHapSignToolPath = $HapSignToolPath
if ([string]::IsNullOrWhiteSpace($resolvedHapSignToolPath)) {
  $resolvedHapSignToolPath = $env:HAP_SIGN_TOOL
}
if ([string]::IsNullOrWhiteSpace($resolvedHapSignToolPath) -or -not (Test-Path -LiteralPath $resolvedHapSignToolPath -PathType Leaf)) {
  throw '未找到 hap-sign-tool.jar，无法验证签名。请设置 HAP_SIGN_TOOL 或传入 -HapSignToolPath。'
}
$javaCommand = Get-Command java.exe -ErrorAction SilentlyContinue
if ($null -eq $javaCommand) {
  throw '未找到 Java，无法验证 HAP 签名。请将 DevEco/JDK 的 java.exe 加入 PATH。'
}
$signatureTempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("babyforge-hap-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $signatureTempDirectory -Force | Out-Null
try {
  $certChainPath = Join-Path $signatureTempDirectory 'cert-chain.cer'
  $profilePath = Join-Path $signatureTempDirectory 'profile.p7b'
  $signatureOutput = & $javaCommand.Source -jar $resolvedHapSignToolPath verify-app -inFile $signedHap.FullName -outCertChain $certChainPath -outProfile $profilePath 2>&1
  if ($LASTEXITCODE -ne 0) {
    $signatureDetail = ($signatureOutput | Out-String).Trim()
    throw "HAP 签名验签失败：$signatureDetail"
  }
} finally {
  if (Test-Path -LiteralPath $signatureTempDirectory) {
    [System.IO.Directory]::Delete($signatureTempDirectory, $true)
  }
}

$moduleJson = (& tar.exe -xOf $signedHap.FullName module.json 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($moduleJson)) {
  throw "签名 HAP 缺少可读的 module.json，已拒绝安装。"
}
try {
  $module = $moduleJson | ConvertFrom-Json
} catch {
  throw "签名 HAP 的 module.json 不是有效 JSON，已拒绝安装。"
}

$ability = @($module.module.abilities | Where-Object { $_.name -eq 'EntryAbility' }) | Select-Object -First 1
$isPhone = @($module.module.deviceTypes) -contains 'phone'
$isValidTarget = $module.app.bundleName -eq 'com.ni.babyforge' -and
  $isPhone -and
  $null -ne $ability -and
  $ability.orientation -eq 'portrait'
if (-not $isValidTarget) {
  throw '签名 HAP 不是 com.ni.babyforge 的 phone/portrait EntryAbility，已拒绝安装。'
}

$deviceArgs = @()
if (-not [string]::IsNullOrWhiteSpace($ConnectKey)) {
  $deviceArgs += @('-t', $ConnectKey)
}

$targetOutput = (& $HdcPath @deviceArgs list targets 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "HDC 无法列出设备：$targetOutput"
}
if ([string]::IsNullOrWhiteSpace($targetOutput) -or $targetOutput -match '\[Empty\]') {
  throw '没有检测到已授权的 HarmonyOS 真机，请开启 USB 调试并确认 RSA 授权。'
}

Write-Output "使用设备：$targetOutput"
Write-Output "安装：$($signedHap.FullName)"
& $HdcPath @deviceArgs install $signedHap.FullName
if ($LASTEXITCODE -ne 0) {
  throw "HAP 安装失败，退出码：$LASTEXITCODE"
}

if ($Launch) {
  & $HdcPath @deviceArgs shell aa start -a EntryAbility -b com.ni.babyforge
  if ($LASTEXITCODE -ne 0) {
    throw "应用启动失败，退出码：$LASTEXITCODE"
  }
  Write-Output '已请求启动 com.ni.babyforge。'
}

Write-Output 'HarmonyOS HAP 安装完成。'
