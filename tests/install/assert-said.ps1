# Asserts that the Install script told the participant each given message.
# Usage: pwsh tests/install/assert-said.ps1 -Log <log-file> -Message <message>, <message>...
param(
    [Parameter(Mandatory)] [string] $Log,
    [Parameter(Mandatory)] [string[]] $Message
)

$failures = 0
foreach ($text in $Message) {
    if (Select-String -Path $Log -SimpleMatch $text -Quiet) {
        Write-Output "ok:   said `"$text`""
    } else {
        Write-Output "FAIL: said `"$text`""
        $failures++
    }
}
if ($failures -gt 0) { exit 1 }
