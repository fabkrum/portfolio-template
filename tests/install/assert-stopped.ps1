# Asserts that the Install script stopped at the repo, as it must for a repo
# that is not the participant's copy of the Template: it said nothing about a
# repo set up, and it left the repo folder as it found it.
#
# Usage: pwsh tests/install/assert-stopped.ps1 -Log <log-file> -RepoDir <folder> [-Commit <commit>]
#   -Commit  the folder was there before the run, at this commit: expect it
#            still there, unchanged, with nothing added (no workshop.json
#            either). Without it, the folder was not there: expect no folder
#            and no partial folder next to it.
param(
    [Parameter(Mandatory)] [string] $Log,
    [Parameter(Mandatory)] [string] $RepoDir,
    [string] $Commit
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

if (-not $Commit) {
    foreach ($dir in $RepoDir, "$RepoDir.partial") {
        if (Test-Path $dir) { Write-Failure "no folder $dir" } else { Write-Pass "no folder $dir" }
    }
} else {
    $actual = (& git -C $RepoDir rev-parse HEAD 2>$null)
    if ($actual -eq $Commit) { Write-Pass "$RepoDir still at $Commit" } else { Write-Failure "$RepoDir still at $Commit (got '$actual')" }
    # --ignored: a workshop.json the folder's own .gitignore hides counts too.
    $changes = (& git -C $RepoDir status --porcelain --ignored 2>&1) -join "`n"
    if (-not $changes) { Write-Pass "nothing changed or added in $RepoDir" } else { Write-Failure "nothing changed or added in $RepoDir`: $changes" }
}

if ($failures -gt 0) { exit 1 }
