# Asserts what a participant has after the Install script, as seen from a fresh
# terminal: one whose PATH comes only from the Windows registry.
#
# Usage: pwsh tests/install/assert-ready.ps1 -RepoDir <folder> -Origin <url> [-WithoutGit]
#   -WithoutGit  the repo was downloaded because Git was missing: expect the
#                files, but no Git connection yet.
param(
    [Parameter(Mandatory)] [string] $RepoDir,
    [Parameter(Mandatory)] [string] $Origin,
    [switch] $WithoutGit
)

$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machinePath;$userPath"

$failures = 0
function Write-Pass($text) { Write-Output "ok:   $text" }
function Write-Failure($text) { Write-Output "FAIL: $text"; $script:failures++ }

$nodeVersion = ''
if (Get-Command node -ErrorAction SilentlyContinue) { $nodeVersion = (& node --version) }
if ($nodeVersion -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22) {
    Write-Pass "Node $nodeVersion in a fresh terminal"
} else {
    Write-Failure "Node 22 or newer in a fresh terminal (got '$nodeVersion')"
}

if ((Test-Path (Join-Path $RepoDir 'tools/check.mjs')) -and (Test-Path (Join-Path $RepoDir 'site/content.json'))) {
    Write-Pass "repo files in $RepoDir"
} else {
    Write-Failure "repo files in $RepoDir"
}

if ($WithoutGit) {
    if (Test-Path (Join-Path $RepoDir '.git')) { Write-Failure 'no Git connection yet' } else { Write-Pass 'downloaded without Git' }
} else {
    if (Get-Command git -ErrorAction SilentlyContinue) { Write-Pass "$(& git --version) in a fresh terminal" } else { Write-Failure 'Git in a fresh terminal' }
    $actualOrigin = (& git -C $RepoDir remote get-url origin 2>$null)
    if ($actualOrigin -eq $Origin) { Write-Pass "origin is $Origin" } else { Write-Failure "origin is $Origin (got '$actualOrigin')" }
    $changes = (& git -C $RepoDir status --porcelain 2>&1) -join "`n"
    if (-not $changes) { Write-Pass 'working tree matches the repo' } else { Write-Failure "working tree matches the repo: $changes" }
}

# Antigravity IDE starts Chrome DevTools for agents with npx, the version in
# .agents/mcp_config.json. The Install script put it in the npm cache, so it
# starts from there without the network.
$config = Get-Content (Join-Path $PSScriptRoot '../../.agents/mcp_config.json') -Raw | ConvertFrom-Json
$devtools = $config.mcpServers.'chrome-devtools'.args | Where-Object { $_ -like 'chrome-devtools-mcp@*' }
$devtoolsVersion = ''
if (Get-Command npx.cmd -ErrorAction SilentlyContinue) { $devtoolsVersion = (& npx.cmd --offline -y $devtools --version 2>$null | Select-Object -Last 1) }
if ($devtools -and $devtoolsVersion -eq ($devtools -replace '^chrome-devtools-mcp@', '')) {
    Write-Pass "Chrome DevTools for agents $devtoolsVersion starts from the npm cache, offline, in a fresh terminal"
} else {
    Write-Failure "Chrome DevTools for agents ($devtools) starts from the npm cache, offline (got '$devtoolsVersion')"
}

Push-Location $RepoDir
$checkOutput = (& node tools/check.mjs 2>&1) -join "`n"
Pop-Location
if ($checkOutput -match 'items pass') {
    Write-Pass 'the Check runs in the repo'
} else {
    Write-Failure "the Check runs in the repo. Output:`n$checkOutput"
}

if ($failures -gt 0) { exit 1 }
