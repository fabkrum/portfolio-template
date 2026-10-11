# Asserts that the Install script stopped at the repo, as it must for a repo
# that is not the participant's copy of the Template: it said nothing about a
# repo set up, and it left the repo folder as it found it.
#
# Usage: pwsh tests/install/assert-stopped.ps1 -Log <log-file> -RepoDir <folder> [-Commit <commit> | -WithoutGit]
#   -Commit      the folder was there before the run, at this commit: expect
#                it still there, at that commit, with no file changed or
#                added.
#   -WithoutGit  the folder was there before the run, downloaded without Git:
#                expect it still there and still without Git.
#   Either way, no workshop.json for the event in $env:WORKSHOP_EVENT (one
#   from an earlier run may stay) and no partial folder. Without either, the
#   folder was not there: expect no folder and no partial folder next to it.
param(
    [Parameter(Mandatory)] [string] $Log,
    [Parameter(Mandatory)] [string] $RepoDir,
    [string] $Commit,
    [switch] $WithoutGit
)

# Git as a fresh terminal finds it: the Install script may have installed it.
$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machinePath;$userPath"

$failures = 0
function Write-Pass($text) { Write-Output "ok:   $text" }
function Write-Failure($text) { Write-Output "FAIL: $text"; $script:failures++ }

# Opening the folder in Antigravity IDE shows as one of the last two, where
# the IDE is installed.
foreach ($text in 'Copied your repo', 'Downloaded your repo', 'Connected your repo folder', 'Your repo is already in',
    'Saved your workshop', 'Everything is ready.', 'Opened your repo', 'Antigravity IDE did not open by itself') {
    if (Select-String -Path $Log -SimpleMatch $text -Quiet) { Write-Failure "did not say `"$text`"" } else { Write-Pass "did not say `"$text`"" }
}

if (Test-Path "$RepoDir.partial") { Write-Failure "no folder $RepoDir.partial" } else { Write-Pass "no folder $RepoDir.partial" }
if (-not $Commit -and -not $WithoutGit) {
    if (Test-Path $RepoDir) { Write-Failure "no folder $RepoDir" } else { Write-Pass "no folder $RepoDir" }
} else {
    if ($WithoutGit) {
        if (Test-Path (Join-Path $RepoDir '.git')) { Write-Failure "$RepoDir still without Git" } else { Write-Pass "$RepoDir still without Git" }
    } else {
        $actual = (& git -C $RepoDir rev-parse HEAD 2>$null)
        if ($actual -eq $Commit) { Write-Pass "$RepoDir still at $Commit" } else { Write-Failure "$RepoDir still at $Commit (got '$actual')" }
        $changes = (& git -C $RepoDir status --porcelain 2>&1) -join "`n"
        if (-not $changes) { Write-Pass "nothing changed or added in $RepoDir" } else { Write-Failure "nothing changed or added in $RepoDir`: $changes" }
    }
    # workshop.json is ignored in a copy of the Template, so Git does not see it.
    $workshop = Join-Path $RepoDir 'workshop.json'
    if ($env:WORKSHOP_EVENT -and (Test-Path $workshop) -and (Select-String -Path $workshop -SimpleMatch $env:WORKSHOP_EVENT -Quiet)) {
        Write-Failure "no workshop.json for `"$($env:WORKSHOP_EVENT)`" in $RepoDir"
    } else {
        Write-Pass "no workshop.json for this run's event in $RepoDir"
    }
}

if ($failures -gt 0) { exit 1 }
