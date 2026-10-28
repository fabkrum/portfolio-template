# The Install script for Windows. Paste one line into PowerShell:
#
#   irm https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.ps1 | iex
#
# It checks Google Chrome and installs the GitHub CLI, Git, Node and the
# Antigravity CLI where they are missing. With one sign-in to GitHub in the
# browser, it creates your portfolio repo from the workshop's template,
# switches GitHub Pages on and lets git push use that sign-in. It downloads
# Chrome DevTools for agents for the QA role, puts your repo in your home
# folder, sets the Antigravity CLI up for the workshop, checks your Gemini
# quota and starts the Antigravity CLI in your repo. It is safe to run again at
# any time.
#
# Without a terminal, or when the GitHub sign-in does not work, it asks for
# your GitHub username instead, and you make the repo on github.com.
# PORTFOLIO_GITHUB_USER and PORTFOLIO_REPO answer that up front, without the
# GitHub CLI. PORTFOLIO_UNATTENDED=1 signs in to nothing and starts nothing,
# and PORTFOLIO_AGY_INSTALLER names another installer for the Antigravity CLI
# (the automated tests use all four).
#
# In a workshop, the guide's line also names the event, before irm:
# WORKSHOP_EVENT, WORKSHOP_DATE (YYYY-MM-DD) and WORKSHOP_CITY. The script
# saves them in workshop.json in your repo, where the Analyst finds them.
# WORKSHOP_START and WORKSHOP_END (HH:MM), when the line names them, let the
# Role clock follow the room (tools/clock.mjs):
#
#   $env:WORKSHOP_EVENT="DevFest Milano 2026"; $env:WORKSHOP_DATE="2026-10-10"; $env:WORKSHOP_CITY="Milan"; irm ... | iex
#
# At home, the prep page's line sets WORKSHOP_PREP=1 instead: the tools, the
# GitHub sign-in and the Antigravity CLI's sign-in, but no repo. The repo is
# made in the room by the guide's line, from the template of the event's
# format, so one prep page serves the 90- and the 120-minute workshop:
#
#   $env:WORKSHOP_PREP="1"; irm ... | iex
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
    $state = @{ NewTerminal = $false; HaveGit = $false; GhSignedIn = $false; AgySignedOut = $false }
    $prep = ($env:WORKSHOP_PREP -eq '1')
    # At home the Antigravity CLI starts here for its sign-in, as there is no
    # repo folder yet.
    $prepDir = Join-Path $HOME '.portfolio-prep'

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

    function Get-SavedPath {
        @('Machine', 'User') | ForEach-Object { [Environment]::GetEnvironmentVariable('Path', $_) -split ';' } | Where-Object { $_ }
    }

    # Picks up what an installer just added to PATH, in this window too. Other
    # windows only see it once they are opened again.
    function Sync-SessionPath($before) {
        $session = $env:Path -split ';'
        foreach ($entry in Get-SavedPath) {
            if ($session -notcontains $entry) { $env:Path = "$env:Path;$entry" }
            if ($before -notcontains $entry) { $state.NewTerminal = $true }
        }
    }

    function Invoke-Winget($id) {
        if (-not (Test-Command winget)) { return }
        Write-Info 'Windows may ask whether to allow the installer to make changes: click Yes.'
        $before = Get-SavedPath
        $output = & winget install --id $id --exact --source winget --silent --accept-package-agreements --accept-source-agreements 2>&1
        if ($LASTEXITCODE -ne 0) { Write-Info "(winget: $(($output | Select-Object -Last 1) -join ' '))" }
        Sync-SessionPath $before
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
        if ($user -notmatch '^[A-Za-z0-9-]+$' -or -not (Test-RepoName $repo)) {
            Write-Host ''
            Write-Host "That does not look like a GitHub username: `"$user/$repo`"."
            Write-Host 'Run this command again and type just your username, for example: ada-lovelace'
            return $null
        }
        return (ConvertTo-RepoTarget $user $repo)
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

    # -------------------------------------------------------------- GitHub

    # The workshop's template, which every participant's repo is a copy of.
    $templateRepo = 'fabkrum/portfolio-template'
    $ghHome = Join-Path $env:LOCALAPPDATA 'Programs\gh'

    # The repo, its folder in the home folder and its address on GitHub.
    function ConvertTo-RepoTarget($user, $name) {
        return @{ User = $user; Name = $name; Dir = (Join-Path $HOME $name); Url = "https://github.com/$user/$name" }
    }

    function Test-RepoName($name) { ($name -match '^[A-Za-z0-9._-]+$') -and ($name -notmatch '^\.\.?$') }

    # The address GitHub Pages publishes the repo at.
    function Get-SiteUrl($repo) {
        if ($repo.Name -eq "$($repo.User).github.io") { return "https://$($repo.User).github.io/" }
        return "https://$($repo.User).github.io/$($repo.Name)/"
    }

    # Someone is at the keyboard: the script runs in a window, and no test or
    # robot runs it.
    function Test-Interactive {
        (-not $env:PORTFOLIO_UNATTENDED) -and [Environment]::UserInteractive -and
            -not [Console]::IsInputRedirected -and -not [Console]::IsOutputRedirected
    }

    # The GitHub CLI does the GitHub steps when someone is there to click
    # "Authorize" in the browser, and no username was given up front.
    function Test-WantsGitHubCli { (-not $env:PORTFOLIO_GITHUB_USER) -and (Test-Interactive) }

    # Fallback when winget is missing or fails: the newest release from
    # github.com/cli/cli, checked against its checksums, into your user folder.
    # The version comes from where the releases/latest page leads, not from
    # GitHub's API, which allows a room behind one address only 60 calls an hour.
    function Install-GhZip {
        $work = Join-Path ([IO.Path]::GetTempPath()) "portfolio-gh-$PID"
        try {
            $request = [Net.WebRequest]::Create('https://github.com/cli/cli/releases/latest')
            $request.Method = 'HEAD'
            $response = $request.GetResponse()
            $latest = $response.ResponseUri.AbsoluteUri
            $response.Close()
            $version = $latest -replace '^.*/v', ''
            if ($version -notmatch '^[0-9.]+$') { return $false }
            $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
            $name = "gh_$($version)_windows_$arch.zip"
            $base = "https://github.com/cli/cli/releases/download/v$version"
            New-Item -ItemType Directory -Force -Path $work | Out-Null
            $zip = Join-Path $work $name
            Invoke-WebRequest -Uri "$base/$name" -OutFile $zip -UseBasicParsing
            $sums = (Invoke-WebRequest -Uri "$base/gh_$($version)_checksums.txt" -UseBasicParsing).Content
            if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
            $expected = (($sums -split "`n") | Where-Object { $_ -match " $([regex]::Escape($name))$" }) -replace ' .*$', ''
            if (-not $expected -or ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $expected.ToUpper())) { return $false }
            if (Test-Path $ghHome) { Remove-Item $ghHome -Recurse -Force }
            Expand-Archive -Path $zip -DestinationPath $ghHome -Force
            $bin = Join-Path $ghHome 'bin'
            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
            if (($userPath -split ';') -notcontains $bin) {
                [Environment]::SetEnvironmentVariable('Path', (@($userPath, $bin) | Where-Object { $_ }) -join ';', 'User')
                $state.NewTerminal = $true
            }
            $env:Path = "$env:Path;$bin"
            return (Test-Command gh)
        } catch {
            return $false
        } finally {
            Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    function Get-GhVersion { ((& gh --version | Select-Object -First 1) -replace '^gh version (\S+).*$', 'gh $1') }

    function Install-Gh {
        $bin = Join-Path $ghHome 'bin'
        if (-not (Test-Command gh) -and (Test-Path (Join-Path $bin 'gh.exe'))) { $env:Path = "$env:Path;$bin" }
        if (Test-Command gh) {
            Write-Ok "The GitHub CLI is installed ($(Get-GhVersion))."
            return $true
        }
        Write-Info 'Installing the GitHub CLI...'
        Invoke-Winget 'GitHub.cli'
        if (-not (Test-Command gh)) { Install-GhZip | Out-Null }
        if (Test-Command gh) {
            Write-Ok "Installed the GitHub CLI ($(Get-GhVersion))."
            return $true
        }
        Write-Info 'The GitHub CLI could not be installed. That is fine: you do the GitHub steps on github.com instead.'
        return $false
    }

    function Test-GitHubSignedIn {
        & gh auth status --hostname github.com *> $null
        return ($LASTEXITCODE -eq 0)
    }

    # One sign-in in the browser: the GitHub CLI shows a code, the browser
    # opens GitHub's page for it, the participant types it and clicks
    # Authorize. Without its questions, the GitHub CLI asks nothing in this
    # window; Git gets the sign-in afterwards. It keeps the sign-in in the
    # Windows credential store, and git push uses it at Ops.
    function Connect-GitHub {
        if (-not (Test-GitHubSignedIn)) {
            Write-Info 'Now sign in to GitHub. Your browser opens github.com/login/device: type the code shown below (eight characters, such as ABCD-1234), click Continue, then Authorize.'
            Write-Info 'If the browser does not open, or it is not signed in to your own GitHub account, open https://github.com/login/device in any browser that is.'
            try { Start-Process 'https://github.com/login/device' } catch { Write-Verbose "browser: $_" }
            # The GitHub CLI waits until the code is used or runs out, after 15
            # minutes; this script waits 5 at most.
            $env:GH_PROMPT_DISABLED = '1'
            $login = Start-Process -FilePath (Get-Command gh).Source -ArgumentList 'auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web', '--scopes', 'workflow' -NoNewWindow -PassThru
            if (-not $login.WaitForExit(300000)) { & taskkill.exe /pid $login.Id /t /f 2>&1 | Out-Null }
            Remove-Item Env:GH_PROMPT_DISABLED -ErrorAction SilentlyContinue
            if (-not (Test-GitHubSignedIn)) {
                Write-Info 'The sign-in to GitHub did not finish. That is fine: you do the GitHub steps on github.com instead.'
                return $null
            }
        }
        $user = (& gh api user --jq .login 2>$null)
        if (-not $user) { return $null }
        $state.GhSignedIn = $true
        Write-Ok "Signed in to GitHub as $user."
        return $user
    }

    # The participant's repo on GitHub: used when it is a copy of the
    # template, created from the template when it is missing. A repo of that
    # name that is something else, such as a live site, stays as it is: the
    # new repo gets another name; a later run finds that name by itself.
    # Returns the repo and 'existing' or 'created', or $null after a to-do.
    function Get-GitHubRepo($repo) {
        for ($try = 0; $try -lt 3; $try++) {
            # No double quotes in the arguments: Windows PowerShell would drop them.
            $answer = (& gh api "repos/$($repo.User)/$($repo.Name)" --jq .template_repository.full_name 2>&1)
            if ($LASTEXITCODE -eq 0) {
                if ("$answer".Trim() -eq $templateRepo) {
                    Write-Ok "Your repo is on GitHub: $($repo.Url)"
                    return @{ Repo = $repo; State = 'existing' }
                }
                $suggested = "$($repo.Name)-2026"
                $suggestedFrom = (& gh api "repos/$($repo.User)/$suggested" --jq .template_repository.full_name 2>$null)
                if ($LASTEXITCODE -eq 0 -and "$suggestedFrom".Trim() -eq $templateRepo) {
                    $repo = ConvertTo-RepoTarget $repo.User $suggested
                    continue
                }
                Write-Info "You already have a repo called $($repo.Name) on GitHub, and it is not a copy of the workshop's template. It stays as it is."
                $name = (Read-Host "          Name for your new repo [$suggested]") -replace '\s', ''
                if (-not (Test-RepoName $name)) { $name = $suggested }
                $repo = ConvertTo-RepoTarget $repo.User $name
                continue
            }
            if ("$answer" -notmatch '404') {
                Write-Todo 'GitHub did not answer about your repo.' 'Check your internet connection, then run this command again.'
                return $null
            }
            & gh repo create $repo.Name --template $templateRepo --public *> $null
            if ($LASTEXITCODE -ne 0) {
                Write-Todo 'Your repo could not be created on GitHub.' 'Check your internet connection, then run this command again.'
                return $null
            }
            # GitHub copies the template's files a moment after the repo exists.
            for ($waited = 0; $waited -lt 30; $waited++) {
                & gh api "repos/$($repo.User)/$($repo.Name)/contents/site/content.json" *> $null
                if ($LASTEXITCODE -eq 0) { break }
                Start-Sleep -Seconds 1
            }
            Write-Ok "Created your repo $($repo.Url) from the workshop's template."
            return @{ Repo = $repo; State = 'created' }
        }
        Write-Todo 'No free name for your repo was found.' 'Run this command again and type another name when it asks.'
        return $null
    }

    # Pages publishes the site with the repo's deploy workflow. A deploy that
    # ran before Pages was on, such as the one creating the repo starts,
    # published nothing, so switching Pages on starts one more. GitHub answers
    # 409 when Pages is on already.
    function Enable-GitHubPage($repo) {
        $answer = (& gh api --method POST "repos/$($repo.User)/$($repo.Name)/pages" -f build_type=workflow 2>&1)
        if ($LASTEXITCODE -eq 0) {
            & gh workflow run deploy.yml -R "$($repo.User)/$($repo.Name)" *> $null
        } elseif ("$answer" -notmatch '409') {
            Write-Todo 'GitHub Pages could not be switched on.' "On github.com, open your repo, then Settings > Pages, and pick GitHub Actions as the source."
            return
        }
        Write-Ok "GitHub Pages is on: your site goes live at $(Get-SiteUrl $repo) a minute after each push."
    }

    # The repo to set up: with the GitHub CLI when it can sign in, otherwise
    # the username question.
    function Get-RepoWithGitHub {
        if ($prep) {
            # At home: the sign-in only. The repo is the room's.
            $user = $null
            if ((Test-WantsGitHubCli) -and (Install-Gh)) { $user = Connect-GitHub }
            if (-not $user) { Write-Info "In the workshop, the guide's line asks for the GitHub sign-in again." }
            return @{ User = $user; Name = ''; Dir = ''; Failed = $true }
        }
        if ((Test-WantsGitHubCli) -and (Install-Gh)) {
            $user = Connect-GitHub
            if ($user) {
                $name = if ($env:PORTFOLIO_REPO -and (Test-RepoName $env:PORTFOLIO_REPO)) { $env:PORTFOLIO_REPO } else { 'portfolio' }
                $found = Get-GitHubRepo (ConvertTo-RepoTarget $user $name)
                if (-not $found) {
                    # The GitHub step already said what to do.
                    $repo = ConvertTo-RepoTarget $user $name
                    $repo.Failed = $true
                    return $repo
                }
                Enable-GitHubPage $found.Repo
                return $found.Repo
            }
        }
        $repo = Get-RepoTarget
        if ($repo -and (Test-Interactive)) {
            Write-Info "Without the GitHub sign-in, the guide's Setup page shows how to switch GitHub Pages on yourself."
        }
        return $repo
    }

    # git push uses the GitHub CLI's sign-in, and commits get the account's
    # name and its noreply address, which keeps the participant's own email
    # address out of the public repo. A name and address Git has already stay.
    function Initialize-GitForGitHub($repo) {
        if (-not $state.GhSignedIn -or -not $state.HaveGit) { return }
        & gh auth setup-git *> $null
        if (-not (& git config --global user.name)) {
            & git config --global user.name (& gh api user --jq '.name // .login')
        }
        if (-not (& git config --global user.email)) {
            & git config --global user.email "$(& gh api user --jq .id)+$($repo.User)@users.noreply.github.com"
        }
        Write-Ok 'git push uses your GitHub sign-in.'
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

    # New windows search the machine-wide PATH before the user's, so an old
    # Node installed for all users would hide the one in the user folder.
    function Test-NodeForNewTerminal {
        foreach ($dir in Get-SavedPath) {
            $exe = Join-Path $dir 'node.exe'
            if (Test-Path $exe) {
                if ((Get-NodeMajor $exe) -lt $nodeMin) {
                    Write-Todo "New windows would still find an older Node in $dir." 'Uninstall "Node.js" in Settings > Apps, then run this command again.'
                }
                return
            }
        }
    }

    function Install-Node {
        if ((Get-NodeMajor node) -ge $nodeMin) {
            Write-Ok "Node is installed ($(& node --version))."
            return
        }
        if (Test-Command node) { Write-Info "Your Node is $(& node --version); the Check needs $nodeMin or newer." }
        if ((Get-NodeMajor (Join-Path $nodeHome 'node.exe')) -ge $nodeMin) {
            # Downloaded by an earlier run; this window just does not know it yet.
            $env:Path = "$nodeHome;$env:Path"
        } else {
            Write-Info 'Installing Node...'
            Invoke-Winget 'OpenJS.NodeJS.LTS'
        }
        if ((Get-NodeMajor node) -lt $nodeMin) {
            Write-Info 'Downloading Node from nodejs.org instead...'
            Install-NodeZip | Out-Null
        }
        if ((Get-NodeMajor node) -ge $nodeMin) {
            Write-Ok "Node is installed ($(& node --version))."
            Test-NodeForNewTerminal
            return
        }
        Write-Todo 'Node could not be installed.' 'Install the LTS version from https://nodejs.org (the Check needs it), then run this command again.'
    }

    # ------------------------------------------ Chrome DevTools for agents

    # The package and version .agents/mcp_config.json starts;
    # tests/devtools.test.js keeps the two the same.
    $devtoolsPackage = 'chrome-devtools-mcp@1.10.1'

    # Runs a command line in cmd.exe for at most $seconds, with nothing to read
    # and its output thrown away; then stops it with everything it started.
    # cmd.exe runs npm.cmd and npx.cmd: PowerShell would pick npm.ps1 and
    # npx.ps1, which the default execution policy does not let run.
    function Invoke-AtMost($seconds, $commandLine) {
        try {
            $start = New-Object System.Diagnostics.ProcessStartInfo
            $start.FileName = 'cmd.exe'
            $start.Arguments = "/d /s /c `"$commandLine <NUL >NUL 2>&1`""
            $start.UseShellExecute = $false
            $start.CreateNoWindow = $true
            $process = [Diagnostics.Process]::Start($start)
            if ($process.WaitForExit($seconds * 1000)) { return ($process.ExitCode -eq 0) }
            & taskkill.exe /pid $process.Id /t /f 2>&1 | Out-Null
            return $false
        } catch {
            return $false
        }
    }

    # Starts the server from the npm cache alone, offline, the way Antigravity
    # will: true only if the server is there and runs on this laptop. The
    # first start unpacks it from the cache; stopped half-way through that,
    # npx would keep a broken copy for good. Offline it never waits for the
    # network, so it gets all the time a slow laptop needs.
    function Test-DevToolsServer {
        Invoke-AtMost 300 "npx.cmd --offline -y $devtoolsPackage --version"
    }

    # The Antigravity CLI starts Chrome DevTools for agents with npx, from the
    # npm cache. Putting it there now means nothing is downloaded during the QA
    # block. If it is there already, nothing is downloaded now either. The
    # download runs on its own, so stopping it half-way, at the time limit or
    # with Ctrl+C, leaves nothing broken behind. QA works without it, so this
    # never stops the script.
    function Install-DevToolsServer {
        if ((Get-NodeMajor node) -lt $nodeMin) { return }
        $version = & node --version
        if ($version -match '^v22\.(\d+)\.' -and [int]$Matches[1] -lt 12) {
            Write-Info "Chrome DevTools for agents needs Node 22.12 or newer, and you have $version."
            Write-Info 'The QA role works without it. To get it anyway, install the LTS version from https://nodejs.org, then run this command again.'
            return
        }
        if (Test-DevToolsServer) {
            Write-Ok 'Chrome DevTools for agents is ready.'
            return
        }
        Write-Info 'Downloading Chrome DevTools for agents for the QA role...'
        if ((Invoke-AtMost 180 "npm.cmd cache add $devtoolsPackage") -and (Test-DevToolsServer)) {
            Write-Ok 'Chrome DevTools for agents is ready.'
        } else {
            Write-Info 'Chrome DevTools for agents could not be set up. That is fine: the QA role works without it.'
        }
    }

    # ---------------------------------------------------- Antigravity CLI

    $agyInstaller = if ($env:PORTFOLIO_AGY_INSTALLER) { $env:PORTFOLIO_AGY_INSTALLER } else { 'https://antigravity.google/cli/install.ps1' }
    $agyBin = Join-Path $env:LOCALAPPDATA 'agy\bin'
    $agySettings = Join-Path $HOME '.gemini\antigravity-cli\settings.json'
    # The workshop's model, as agy's own /model menu saves it: Flash, low
    # effort, so a free account's weekly quota lasts the whole workshop.
    $agyModel = 'Gemini 3.8 Flash (Low)'
    $quotaMin = 60

    # Antigravity's own installer puts agy.exe in your user folder and adds
    # that folder to PATH; this window finds it too.
    function Use-AgyBin {
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        if (($userPath -split ';') -notcontains $agyBin) {
            [Environment]::SetEnvironmentVariable('Path', (@($userPath, $agyBin) | Where-Object { $_ }) -join ';', 'User')
            $state.NewTerminal = $true
        }
        if (($env:Path -split ';') -notcontains $agyBin) { $env:Path = "$env:Path;$agyBin" }
    }

    function Install-Agy {
        if (-not (Test-Command agy) -and (Test-Path (Join-Path $agyBin 'agy.exe'))) { Use-AgyBin }
        if (Test-Command agy) {
            Write-Ok "The Antigravity CLI is installed (agy $(& agy --version 2>$null))."
            return
        }
        Write-Info 'Installing the Antigravity CLI...'
        $before = Get-SavedPath
        try {
            # Run here, the way its own line runs it (irm ... | iex), with its
            # messages left out.
            $installer = Invoke-RestMethod -Uri $agyInstaller -UseBasicParsing
            & ([scriptblock]::Create($installer)) *> $null
        } catch {
            Write-Verbose "agy installer: $_"
        }
        Sync-SessionPath $before
        if (Test-Path (Join-Path $agyBin 'agy.exe')) { Use-AgyBin }
        if (Test-Command agy) {
            Write-Ok "Installed the Antigravity CLI (agy $(& agy --version 2>$null))."
            return
        }
        Write-Todo 'The Antigravity CLI could not be installed.' 'Check your internet connection, then run this command again.'
    }

    # Auto mode and the workshop's model, written into agy's settings, and the
    # repo folder added to the trusted folders, so agy starts there without
    # asking. Every other setting stays as it is; a file that is not JSON is
    # left alone. Node
    # does it, as on macOS and Linux, from a file: Windows PowerShell would
    # drop the double quotes of a script given to node on the command line.
    $agySettingsScript = @'
const fs = require("fs"), path = require("path");
const file = process.env.AGY_SETTINGS;
let settings = {};
if (fs.existsSync(file)) {
  try { settings = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); } catch { process.exit(1); }
  if (settings === null || typeof settings !== "object" || Array.isArray(settings)) process.exit(1);
}
const workshop = { agentMode: "auto", model: process.env.AGY_MODEL };
const trusted = Array.isArray(settings.trustedWorkspaces) ? settings.trustedWorkspaces : [];
const trust = process.env.AGY_TRUST;
if (trust) workshop.trustedWorkspaces = trusted.includes(trust) ? trusted : [...trusted, trust];
if (JSON.stringify({ ...settings, ...workshop }) === JSON.stringify(settings)) process.exit(0);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify({ ...settings, ...workshop }, null, 2) + "\n");
'@

    function Initialize-AgyForWorkshop($repo) {
        if (-not (Test-Command agy) -or (Get-NodeMajor node) -lt $nodeMin) { return }
        $settingsFile = Join-Path ([IO.Path]::GetTempPath()) "portfolio-agy-settings-$PID.js"
        [IO.File]::WriteAllText($settingsFile, $agySettingsScript)
        $env:AGY_SETTINGS = $agySettings
        $env:AGY_MODEL = $agyModel
        $env:AGY_TRUST = if ($repo.Dir -and (Test-Path $repo.Dir)) { $repo.Dir } else { '' }
        if ($prep) {
            New-Item -ItemType Directory -Force -Path $prepDir -ErrorAction SilentlyContinue | Out-Null
            if (Test-Path $prepDir) { $env:AGY_TRUST = $prepDir }
        }
        & node $settingsFile 2>$null
        $written = ($LASTEXITCODE -eq 0)
        Remove-Item $settingsFile -Force -ErrorAction SilentlyContinue
        Remove-Item Env:AGY_SETTINGS, Env:AGY_MODEL, Env:AGY_TRUST -ErrorAction SilentlyContinue
        if ($written) {
            Write-Ok "The Antigravity CLI starts in auto mode, with Gemini 3.8 Flash, the workshop's model."
        } else {
            Write-Info "The settings of the Antigravity CLI could not be read, so they stay as they are: $agySettings"
            Write-Info 'In the Antigravity CLI, press Shift+Tab until it shows auto, and pick Gemini 3.8 Flash with /model.'
        }
    }

    # Asks agy for the quota left, which costs none of it: the percentage, or
    # 'signed-out', or $null. Not signed in, agy asks for the sign-in at once
    # and then waits for it; that is not waited for.
    function Read-Quota {
        $work = Join-Path ([IO.Path]::GetTempPath()) "portfolio-usage-$PID"
        New-Item -ItemType Directory -Force -Path $work | Out-Null
        $out = Join-Path $work 'usage.json'
        $empty = Join-Path $work 'empty.txt'
        [IO.File]::WriteAllText($empty, '')
        try {
            $errors = Join-Path $work 'errors.txt'
            $usageRun = Start-Process -FilePath (Get-Command agy).Source -ArgumentList '-p', '/usage', '--output-format', 'json' -WorkingDirectory $work -RedirectStandardInput $empty -RedirectStandardOutput $out -RedirectStandardError $errors -NoNewWindow -PassThru
            $asksToSignIn = { Select-String -Path $out, $errors -Pattern 'Authentication required' -Quiet -ErrorAction SilentlyContinue }
            for ($waited = 0; $waited -lt 30 -and -not $usageRun.HasExited; $waited++) {
                if (& $asksToSignIn) { break }
                Start-Sleep -Seconds 1
            }
            if (-not $usageRun.HasExited) { & taskkill.exe /pid $usageRun.Id /t /f 2>&1 | Out-Null }
            if (& $asksToSignIn) { return 'signed-out' }
            $usage = Get-Content $out -Raw | ConvertFrom-Json
            $gemini = $usage.command.data.groups | Where-Object { $_.name -like 'Gemini*' } | Select-Object -First 1
            $weekly = $gemini.buckets | Where-Object { $_.window -eq 'weekly' } | Select-Object -First 1
            if ($null -eq $weekly) { return $null }
            return [int][Math]::Floor([double]$weekly.remaining_fraction * 100)
        } catch {
            return $null
        } finally {
            Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    # The workshop uses up to 30% of a free account's weekly Gemini quota.
    # Below twice that, the participant hears it now, not in the middle of
    # the Developer.
    function Test-Quota {
        if (-not (Test-Command agy)) { return }
        $left = Read-Quota
        if ($left -eq 'signed-out') {
            $state.AgySignedOut = $true
            Write-Info 'When the Antigravity CLI starts, it asks you to sign in with your Google account, in the browser.'
        } elseif ($null -eq $left) {
            Write-Info 'Your Gemini quota could not be read. That is fine: the workshop works without this check.'
        } elseif ($left -ge $quotaMin) {
            Write-Ok "Your Google account has $left% of this week's Gemini quota left."
        } else {
            Write-Info "Your Google account has $left% of this week's Gemini quota left, and the workshop can use up to 30%."
            Write-Info 'It may run out before the end. To be safe, sign in with another Google account: in the Antigravity CLI, type /logout.'
        }
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

    # The finished copy replaces the repo folder only if that folder is missing
    # or empty, so a half-finished run never ends up inside an existing folder.
    function Move-IntoPlace($from, $repo) {
        if (Test-Path $repo.Dir) {
            if (Get-ChildItem $repo.Dir -Force | Select-Object -First 1) { return $false }
            Remove-Item $repo.Dir -Force
        }
        Move-Item $from $repo.Dir
        return $true
    }

    function Copy-RepoWithGit($repo) {
        $partial = "$($repo.Dir).partial"
        if (Test-Path $partial) { Remove-Item $partial -Recurse -Force }
        if (-not (Invoke-Git clone -q "$($repo.Url).git" $partial)) { return $false }
        return (Move-IntoPlace $partial $repo)
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
            $moved = Move-IntoPlace $top.FullName $repo
            Remove-Item $work -Recurse -Force
            return $moved
        } catch {
            return $false
        }
    }

    function Get-Repo($repo) {
        if ($repo.Failed) { return }
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
            Write-Todo 'Your repo folder could not be connected to Git yet.' 'Check your internet connection, then run this command again.'
            return
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

    # The last step: the Antigravity CLI, started in the repo folder, takes
    # over this window. Only in a terminal, and only when nothing is left to
    # do.
    function Test-CanStartAgent($repo) {
        ($next.Count -eq 0) -and (Test-Command agy) -and $repo.Dir -and (Test-Path $repo.Dir) -and (Test-Interactive)
    }

    # ------------------------------------------------------------ workshop

    # The event this laptop is set up for, as the guide's line names it, saved
    # in workshop.json in the repo: the Analyst adds it to the site. Written
    # again on every run; without WORKSHOP_EVENT, nothing is written.
    function Save-Workshop($repo) {
        if (-not $env:WORKSHOP_EVENT -or -not (Test-LooksLikeTemplate $repo.Dir)) { return }
        $workshop = [ordered]@{ event = $env:WORKSHOP_EVENT }
        if ($env:WORKSHOP_DATE) { $workshop.date = $env:WORKSHOP_DATE }
        if ($env:WORKSHOP_CITY) { $workshop.city = $env:WORKSHOP_CITY }
        # The start and end (HH:MM) let the Role clock follow the room.
        if ($env:WORKSHOP_START) { $workshop.start = $env:WORKSHOP_START }
        if ($env:WORKSHOP_END) { $workshop.end = $env:WORKSHOP_END }
        try {
            # ConvertTo-Json escapes what JSON needs. The file is UTF-8 without
            # a byte order mark: Set-Content in Windows PowerShell would write
            # an accent in the event's name in another encoding.
            [IO.File]::WriteAllText((Join-Path $repo.Dir 'workshop.json'), ($workshop | ConvertTo-Json))
            Write-Ok "Saved your workshop in workshop.json: $($env:WORKSHOP_EVENT)."
        } catch {
            Write-Info 'Your workshop could not be saved in workshop.json. That is fine: the Analyst works without it.'
        }
    }

    # ---------------------------------------------------------------- main

    Write-Host 'Setting up your laptop for the portfolio workshop.'

    Write-Heading 'Apps'
    Test-Chrome

    Write-Heading 'GitHub'
    $repo = Get-RepoWithGitHub
    if (-not $repo) { return }

    Write-Heading 'Tools'
    Install-Git
    Install-Node
    Install-DevToolsServer

    Write-Heading 'Your repo'
    if ($prep) {
        Write-Info "Your repo is made in the workshop: the guide's line there makes it from the workshop's template."
    } else {
        Get-Repo $repo
        Save-Workshop $repo
    }
    Initialize-GitForGitHub $repo

    Write-Heading 'Antigravity CLI'
    Install-Agy
    Initialize-AgyForWorkshop $repo
    Test-Quota

    Write-Heading 'Summary'
    if ($next.Count -eq 0) {
        Write-Host 'Everything is ready.'
    } else {
        Write-Host 'Still to do:'
        for ($i = 0; $i -lt $next.Count; $i++) { Write-Host "  $($i + 1). $($next[$i])" }
    }
    Write-Host 'Run this command again any time; it only does what is still missing.'
    if ($prep) {
        if ($state.NewTerminal) {
            Write-Host 'New programs were added: close this window and open a new terminal window before you continue.'
        }
        Write-Host 'In the workshop, the guide gives you one more line: it makes your repo and starts the Antigravity CLI in it.'
        if (($next.Count -eq 0) -and $state.AgySignedOut -and (Test-Command agy) -and (Test-Interactive) -and (Test-Path $prepDir)) {
            Write-Host ''
            Write-Host 'Starting the Antigravity CLI, so you can sign in. When it is ready, type /exit and press Enter.'
            Write-Host ''
            Set-Location $prepDir
            & agy
        }
        return
    }
    if (Test-CanStartAgent $repo) {
        Write-Host "To come back later, open a new terminal window and type: cd $($repo.Name), then agy"
        Write-Host ''
        Write-Host 'Starting the Antigravity CLI in your repo folder.'
        Write-Host ''
        Set-Location $repo.Dir
        & agy
        return
    }
    if ($state.NewTerminal) {
        Write-Host 'New programs were added: close this window and open a new terminal window before you continue.'
    }
    Write-Host "To start the workshop, type: cd $($repo.Name), then agy"
}
