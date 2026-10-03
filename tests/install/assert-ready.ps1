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

Push-Location $RepoDir
$checkOutput = (& node tools/check.mjs 2>&1) -join "`n"
Pop-Location
if ($checkOutput -match 'items pass') {
    Write-Pass 'the Check runs in the repo'
} else {
    Write-Failure "the Check runs in the repo. Output:`n$checkOutput"
}

if ($failures -gt 0) { exit 1 }
