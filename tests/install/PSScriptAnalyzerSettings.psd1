@{
    Severity     = @('Error', 'Warning', 'Information')
    # The Install script talks to a person in a console window: Write-Host is
    # the right tool for that, not a pipeline output.
    ExcludeRules = @('PSAvoidUsingWriteHost')
}
