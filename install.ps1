# The Install script for Windows. Paste one line into PowerShell:
#
#   irm https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.ps1 | iex
#
# It checks Google Chrome and Antigravity IDE, installs Git and Node where they
# are missing, puts your own portfolio repo in your home folder and opens it in
# Antigravity IDE. It is safe to run again at any time.
#
# It asks for your GitHub username. PORTFOLIO_GITHUB_USER and PORTFOLIO_REPO
# answer that up front (the automated tests use them).
#
# Everything runs inside one script block, so nothing is left behind in your
# PowerShell window, and it never closes that window.

& {
    $ErrorActionPreference = 'Continue'
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $nodeMin = 22
    $nodeHome = Join-Path $env:LOCALAPPDATA 'Programs\node'
    $next = New-Object System.Collections.Generic.List[string]
    $state = @{ NewTerminal = $false; HaveGit = $false; IdeExe = $null }

    function Write-Ok($text) { Write-Host "  [ok]    $text" -ForegroundColor Green }
    function Write-Info($text) { Write-Host "          $text" }
    # A problem and the one thing the participant should do about it.
    function Write-Todo($problem, $action) {
        Write-Host "  [to do] $problem" -ForegroundColor Yellow
        Write-Host "          $action"
        $next.Add($action)
    }
    function Write-Heading($text) { Write-Host ''; Write-Host $text }
    function Test-Command($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

    # Picks up what an installer just added to PATH, in this window too.
    function Sync-SessionPath {
        $known = $env:Path -split ';'
        foreach ($scope in 'Machine', 'User') {
            foreach ($entry in ([Environment]::GetEnvironmentVariable('Path', $scope) -split ';')) {
                if ($entry -and ($known -notcontains $entry)) {
                    $env:Path = "$env:Path;$entry"
                    $state.NewTerminal = $true
                }
            }
        }
    }

    function Invoke-Winget($id) {
        if (-not (Test-Command winget)) { return }
        Write-Info 'Windows may ask whether to allow the installer to make changes: click Yes.'
        $output = & winget install --id $id --exact --source winget --silent --accept-package-agreements --accept-source-agreements 2>&1
        if ($LASTEXITCODE -ne 0) { Write-Info "(winget: $(($output | Select-Object -Last 1) -join ' '))" }
        Sync-SessionPath
    }

    function Test-Page($url) {
        try {
            Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing | Out-Null
            return $true
        } catch {
            return $false
        }
    }

    # ------------------------------------------------------------ questions

    function Get-RepoTarget {
        $user = "$env:PORTFOLIO_GITHUB_USER"
        $repo = if ($env:PORTFOLIO_REPO) { $env:PORTFOLIO_REPO } else { 'portfolio' }
        if (-not $user) { $user = Read-Host 'What is your GitHub username' }
        # Accept a pasted link such as https://github.com/ada/portfolio as well.
        $user = ($user -replace '\s', '') -replace '^https?://', '' -replace '^github\.com/', '' -replace '^@', ''
        if ($user -match '^([^/]+)/([^/]+)') {
            $user = $Matches[1]
            $repo = $Matches[2] -replace '\.git$', ''
        }
        if ($user -notmatch '^[A-Za-z0-9-]+$') {
            Write-Host ''
            Write-Host "That does not look like a GitHub username: `"$user`"."
            Write-Host 'Run this command again and type just your username, for example: ada-lovelace'
            return $null
        }
        return @{ User = $user; Name = $repo; Dir = (Join-Path $HOME $repo); Url = "https://github.com/$user/$repo" }
    }

    # --------------------------------------------------------- desktop apps

    function Test-Chrome {
        foreach ($root in $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA) {
            if ($root -and (Test-Path (Join-Path $root 'Google\Chrome\Application\chrome.exe'))) {
                Write-Ok 'Google Chrome is installed.'
                return
            }
        }
        Write-Todo 'Google Chrome is not installed.' 'Install Google Chrome from https://www.google.com/chrome/ (the Check uses it), then run this command again.'
    }

    function Test-Ide {
        foreach ($root in (Join-Path $env:LOCALAPPDATA 'Programs'), $env:ProgramFiles) {
            $exe = Join-Path $root 'Antigravity IDE\Antigravity IDE.exe'
            if ($root -and (Test-Path $exe)) {
                $state.IdeExe = $exe
                Write-Ok 'Antigravity IDE is installed.'
                return
            }
        }
        if (Test-Path (Join-Path $env:LOCALAPPDATA 'Programs\Antigravity\Antigravity.exe')) {
            Write-Info 'You have Antigravity 2.0, the agent dashboard. Today you need the editor, Antigravity IDE.'
        }
        Write-Todo 'Antigravity IDE is not installed.' 'Download "Antigravity IDE" (not "Antigravity 2.0") from https://antigravity.google/download and install it, then run this command again.'
    }

    # ----------------------------------------------------------------- Git

    function Install-Git {
        if (-not (Test-Command git)) {
            Write-Info 'Installing Git...'
            Invoke-Winget 'Git.Git'
        }
        if (Test-Command git) {
            $state.HaveGit = $true
            Write-Ok "Git is installed ($(& git --version))."
            return
        }
        Write-Todo 'Git could not be installed.' 'Install Git from https://git-scm.com/download/win (keep the default choices), then run this command again.'
    }

    # ---------------------------------------------------------------- Node

    function Get-NodeMajor($exe) {
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { return 0 }
        $version = & $exe --version 2>$null
        if ($version -match '^v(\d+)\.') { return [int]$Matches[1] }
        return 0
    }

    # Fallback when winget is missing or fails: the current Node LTS from
    # nodejs.org into your user folder. No admin rights needed.
    function Install-NodeZip {
        try {
            $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
            $version = ($index | Where-Object { $_.lts } | Select-Object -First 1).version
            $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
            $name = "node-$version-win-$arch"
            $work = Join-Path ([IO.Path]::GetTempPath()) "portfolio-install-$PID"
            New-Item -ItemType Directory -Force -Path $work | Out-Null
            $zip = Join-Path $work "$name.zip"
            Invoke-WebRequest -Uri "https://nodejs.org/dist/$version/$name.zip" -OutFile $zip -UseBasicParsing
            $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$version/SHASUMS256.txt" -UseBasicParsing).Content
            $expected = (($sums -split "`n") | Where-Object { $_ -match " $name\.zip$" }) -replace ' .*$', ''
            if (-not $expected -or ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $expected.ToUpper())) { return $false }
            Expand-Archive -Path $zip -DestinationPath $work -Force
            if (Test-Path $nodeHome) { Remove-Item $nodeHome -Recurse -Force }
            New-Item -ItemType Directory -Force -Path (Split-Path $nodeHome) | Out-Null
            Move-Item (Join-Path $work $name) $nodeHome
            Remove-Item $work -Recurse -Force
            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
            if (($userPath -split ';') -notcontains $nodeHome) {
                [Environment]::SetEnvironmentVariable('Path', (@($nodeHome, $userPath) | Where-Object { $_ }) -join ';', 'User')
            }
            $env:Path = "$nodeHome;$env:Path"
            $state.NewTerminal = $true
            return $true
        } catch {
            return $false
        }
    }

    function Install-Node {
        if ((Get-NodeMajor node) -ge $nodeMin) {
            Write-Ok "Node is installed ($(& node --version))."
            return
        }
        if (Test-Command node) { Write-Info "Your Node is $(& node --version); the Check needs $nodeMin or newer." }
        Write-Info 'Installing Node...'
        Invoke-Winget 'OpenJS.NodeJS.LTS'
        if ((Get-NodeMajor node) -lt $nodeMin) {
            $localNode = Join-Path $nodeHome 'node.exe'
            if ((Get-NodeMajor $localNode) -ge $nodeMin) {
                $env:Path = "$nodeHome;$env:Path"
            } else {
                Write-Info 'Downloading Node from nodejs.org instead...'
                Install-NodeZip | Out-Null
            }
        }
        if ((Get-NodeMajor node) -ge $nodeMin) {
            Write-Ok "Node is installed ($(& node --version))."
            return
        }
        Write-Todo 'Node could not be installed.' 'Install the LTS version from https://nodejs.org (the Check needs it), then run this command again.'
    }

    # ---------------------------------------------------------------- repo

    function Test-LooksLikeTemplate($dir) {
        (Test-Path (Join-Path $dir 'tools\check.mjs')) -or (Test-Path (Join-Path $dir 'site\content.json'))
    }

    function Invoke-Git {
        $previous = $env:GIT_TERMINAL_PROMPT
        $env:GIT_TERMINAL_PROMPT = '0'
        & git @args 2>&1 | Out-Null
        $env:GIT_TERMINAL_PROMPT = $previous
        return ($LASTEXITCODE -eq 0)
    }

    function Copy-RepoWithGit($repo) {
        $partial = "$($repo.Dir).partial"
        if (Test-Path $partial) { Remove-Item $partial -Recurse -Force }
        if (-not (Invoke-Git clone -q "$($repo.Url).git" $partial)) { return $false }
        if (Test-Path $repo.Dir) { Remove-Item $repo.Dir -Force }
        Move-Item $partial $repo.Dir
        return $true
    }

    # A folder downloaded while Git was missing gets Git's history added; the
    # files in it, including any changes, stay as they are.
    function Connect-DownloadToGit($repo) {
        $partial = "$($repo.Dir).partial"
        if (Test-Path $partial) { Remove-Item $partial -Recurse -Force }
        if (-not (Invoke-Git clone -q --no-checkout "$($repo.Url).git" $partial)) { return $false }
        Move-Item (Join-Path $partial '.git') (Join-Path $repo.Dir '.git') -Force
        Remove-Item $partial -Recurse -Force
        return (Invoke-Git -C $repo.Dir reset -q)
    }

    function Copy-RepoWithoutGit($repo) {
        try {
            $work = Join-Path ([IO.Path]::GetTempPath()) "portfolio-repo-$PID"
            if (Test-Path $work) { Remove-Item $work -Recurse -Force }
            New-Item -ItemType Directory -Force -Path $work | Out-Null
            $zip = Join-Path $work 'repo.zip'
            Invoke-WebRequest -Uri "$($repo.Url)/archive/HEAD.zip" -OutFile $zip -UseBasicParsing
            Expand-Archive -Path $zip -DestinationPath (Join-Path $work 'files') -Force
            $top = Get-ChildItem (Join-Path $work 'files') -Directory | Select-Object -First 1
            if (Test-Path $repo.Dir) { Remove-Item $repo.Dir -Force }
            Move-Item $top.FullName $repo.Dir
            Remove-Item $work -Recurse -Force
            return $true
        } catch {
            return $false
        }
    }

    function Get-Repo($repo) {
        $dir = $repo.Dir
        if (Test-Path (Join-Path $dir '.git')) {
            Write-Ok "Your repo is already in $dir."
            return
        }
        if ((Test-Path $dir) -and (Get-ChildItem $dir -Force | Select-Object -First 1)) {
            if (-not (Test-LooksLikeTemplate $dir)) {
                Write-Todo "There is already a folder $dir, and it is not your portfolio repo." 'Rename or move that folder, then run this command again.'
                return
            }
            if (-not $state.HaveGit) {
                Write-Ok "Your repo is already in $dir (downloaded without Git)."
                return
            }
            if (Connect-DownloadToGit $repo) {
                Write-Ok "Connected your repo folder to Git: $dir"
                return
            }
        }
        if (-not (Test-Page $repo.Url)) {
            Write-Todo "I could not find your repo at $($repo.Url)." "Check your username, and that you created your copy from the template, named it `"$($repo.Name)`" and made it Public. Then run this command again."
            return
        }
        if ($state.HaveGit) {
            if (Copy-RepoWithGit $repo) {
                Write-Ok "Copied your repo to $dir."
                return
            }
            Write-Info 'Git could not copy your repo; downloading it instead.'
        }
        if (Copy-RepoWithoutGit $repo) {
            Write-Ok "Downloaded your repo to $dir (without Git for now; it gets connected once Git is installed)."
            return
        }
        Write-Todo "Your repo could not be downloaded from $($repo.Url)." 'Check your internet connection, then run this command again.'
    }

    function Open-InIde($repo) {
        if (-not $state.IdeExe -or -not (Test-Path $repo.Dir)) { return }
        try {
            Start-Process -FilePath $state.IdeExe -ArgumentList "`"$($repo.Dir)`""
            Write-Ok 'Opened your repo in Antigravity IDE.'
        } catch {
            Write-Todo 'Antigravity IDE did not open by itself.' "Open Antigravity IDE, choose File > Open Folder and pick $($repo.Dir)."
        }
    }

    # ---------------------------------------------------------------- main

    Write-Host 'Setting up your laptop for the portfolio workshop.'
    $repo = Get-RepoTarget
    if (-not $repo) { return }

    Write-Heading 'Apps'
    Test-Chrome
    Test-Ide

    Write-Heading 'Tools'
    Install-Git
    Install-Node

    Write-Heading 'Your repo'
    Get-Repo $repo
    Open-InIde $repo

    Write-Heading 'Summary'
    if ($next.Count -eq 0) {
        Write-Host 'Everything is ready.'
    } else {
        Write-Host 'Still to do:'
        for ($i = 0; $i -lt $next.Count; $i++) { Write-Host "  $($i + 1). $($next[$i])" }
    }
    if ($state.NewTerminal) {
        Write-Host 'New programs were added: close this window and open a new terminal window before you continue.'
    }
    Write-Host 'Run this command again any time; it only does what is still missing.'
}
