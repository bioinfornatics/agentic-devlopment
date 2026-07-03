<#
.SYNOPSIS
Install the Agentic Development Harness into the current user's Goose config.

.DESCRIPTION
Copies project-local harness files into:
  ~/.config/goose/recipes
  ~/.agents/skills
  ~/.agents/agents

Also upserts harness slash commands in:
  ~/.config/goose/config.yaml

.PARAMETER DryRun
Print actions without copying files.

.PARAMETER NoBackup
Do not backup existing target directories/config before replacing/editing them.

.PARAMETER SkipValidate
Skip goose recipe validation after copy.

.PARAMETER SkipSlashCommands
Do not update slash_commands in config.yaml.
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$NoBackup,
    [switch]$SkipValidate,
    [switch]$SkipSlashCommands
)

$ErrorActionPreference = 'Stop'

function Resolve-HomePath([string]$RelativePath) {
    return Join-Path $HOME $RelativePath
}

function Invoke-Step([scriptblock]$Action, [string]$Message) {
    if ($DryRun) {
        Write-Host "[dry-run] $Message"
    } else {
        & $Action
    }
}

function Backup-Or-Remove([string]$Path, [string]$Stamp) {
    if (Test-Path -LiteralPath $Path) {
        if (-not $NoBackup) {
            $BackupPath = "$Path.backup-$Stamp"
            Invoke-Step { Move-Item -LiteralPath $Path -Destination $BackupPath -Force } "Move $Path -> $BackupPath"
        } else {
            Invoke-Step { Remove-Item -LiteralPath $Path -Recurse -Force } "Remove $Path"
        }
    }
}

function Copy-HarnessDir([string]$Source, [string]$Destination, [string]$Stamp) {
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Required source directory not found: $Source"
    }

    $Parent = Split-Path -Parent $Destination
    Invoke-Step { New-Item -ItemType Directory -Force -Path $Parent | Out-Null } "Ensure directory $Parent"
    Backup-Or-Remove -Path $Destination -Stamp $Stamp
    Invoke-Step { Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force } "Copy $Source -> $Destination"
}

function Get-ItemCommand([string[]]$Chunk) {
    foreach ($Line in $Chunk) {
        if ($Line -match '^\s*command:\s*["'']?([^"''\s#]+)') {
            return $Matches[1].ToLowerInvariant()
        }
    }
    return $null
}

function Update-SlashCommands([string]$ConfigPath, [string]$RecipeDir, [string]$Stamp) {
    if ($SkipSlashCommands) {
        Write-Host 'Skipping slash command update.'
        return
    }

    $Managed = @(
        @{ command = 'harness';   file = 'harness-master.yaml' },
        @{ command = 'research';  file = 'harness-research.yaml' },
        @{ command = 'plan';      file = 'harness-plan.yaml' },
        @{ command = 'implement'; file = 'harness-implement.yaml' },
        @{ command = 'review';    file = 'harness-review.yaml' },
        @{ command = 'webtest';   file = 'harness-web-test.yaml' },
        @{ command = 'release';   file = 'harness-release.yaml' },
        @{ command = 'memory';    file = 'harness-memory.yaml' },
        @{ command = 'sdd';       file = 'sdd-master.yaml' },
        @{ command = 'uiux';      file = 'ui-ux-suite.yaml' }
    )
    $ManagedNames = @{}
    foreach ($Item in $Managed) { $ManagedNames[$Item.command.ToLowerInvariant()] = $true }

    foreach ($Item in $Managed) {
        $RecipePath = Join-Path $RecipeDir $Item.file
        if (-not (Test-Path -LiteralPath $RecipePath -PathType Leaf)) {
            Write-Warning "Cannot add slash commands; missing installed recipe: $RecipePath"
            return
        }
    }

    $NewEntries = New-Object System.Collections.Generic.List[string]
    foreach ($Item in $Managed) {
        $RecipePath = Join-Path $RecipeDir $Item.file
        $NewEntries.Add("  - command: `"$($Item.command)`"")
        $NewEntries.Add("    recipe_path: `"$RecipePath`"")
    }

    if (Test-Path -LiteralPath $ConfigPath) {
        $Lines = @(Get-Content -LiteralPath $ConfigPath)
    } else {
        $Lines = @()
    }

    $Start = -1
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^slash_commands:\s*(#.*)?$') { $Start = $i; break }
    }

    $Out = New-Object System.Collections.Generic.List[string]
    if ($Start -lt 0) {
        foreach ($Line in $Lines) { $Out.Add($Line) }
        if ($Out.Count -gt 0 -and $Out[$Out.Count - 1].Trim().Length -gt 0) { $Out.Add('') }
        $Out.Add('slash_commands:')
        foreach ($Line in $NewEntries) { $Out.Add($Line) }
    } else {
        $End = $Lines.Count
        for ($j = $Start + 1; $j -lt $Lines.Count; $j++) {
            if ($Lines[$j] -match '^[A-Za-z0-9_][^:]*:\s*(#.*)?$') { $End = $j; break }
        }

        for ($i = 0; $i -lt $Start; $i++) { $Out.Add($Lines[$i]) }
        $Out.Add('slash_commands:')

        $Body = @()
        for ($i = $Start + 1; $i -lt $End; $i++) { $Body += $Lines[$i] }

        $Prefix = New-Object System.Collections.Generic.List[string]
        $Chunks = New-Object System.Collections.Generic.List[object]
        $Current = $null
        foreach ($Line in $Body) {
            if ($Line -match '^\s*-\s+') {
                if ($null -ne $Current) { $Chunks.Add($Current) }
                $Current = New-Object System.Collections.Generic.List[string]
                $Current.Add($Line)
            } elseif ($null -eq $Current) {
                $Prefix.Add($Line)
            } else {
                $Current.Add($Line)
            }
        }
        if ($null -ne $Current) { $Chunks.Add($Current) }

        foreach ($Line in $Prefix) { $Out.Add($Line) }
        foreach ($Chunk in $Chunks) {
            $Cmd = Get-ItemCommand -Chunk ([string[]]$Chunk.ToArray())
            if ($null -ne $Cmd -and $ManagedNames.ContainsKey($Cmd)) { continue }
            foreach ($Line in $Chunk) { $Out.Add($Line) }
        }
        foreach ($Line in $NewEntries) { $Out.Add($Line) }
        for ($i = $End; $i -lt $Lines.Count; $i++) { $Out.Add($Lines[$i]) }
    }

    if ($DryRun) {
        Write-Host '[dry-run] upsert slash_commands:'
        foreach ($Item in $Managed) {
            Write-Host "  /$($Item.command) -> $(Join-Path $RecipeDir $Item.file)"
        }
        return
    }

    $Parent = Split-Path -Parent $ConfigPath
    New-Item -ItemType Directory -Force -Path $Parent | Out-Null
    if ((Test-Path -LiteralPath $ConfigPath) -and (-not $NoBackup)) {
        Copy-Item -LiteralPath $ConfigPath -Destination "$ConfigPath.backup-$Stamp" -Force
    }
    Set-Content -LiteralPath $ConfigPath -Value $Out -Encoding UTF8
    Write-Host "Updated slash_commands in $ConfigPath"
    foreach ($Item in $Managed) {
        Write-Host "  /$($Item.command) -> $(Join-Path $RecipeDir $Item.file)"
    }
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$SourceRecipes = Join-Path $Root '.goose/recipes'
$SourceSkills = Join-Path $Root '.agents/skills'
$SourceAgents = Join-Path $Root '.agents/agents'
$DestRecipes = Resolve-HomePath '.config/goose/recipes'
$DestSkills = Resolve-HomePath '.agents/skills'
$DestAgents = Resolve-HomePath '.agents/agents'
$GooseConfig = Resolve-HomePath '.config/goose/config.yaml'

Write-Host 'Installing Agentic Development Harness'
Write-Host "  source:    $Root"
Write-Host "  recipes -> $DestRecipes"
Write-Host "  skills  -> $DestSkills"
Write-Host "  agents  -> $DestAgents"
Write-Host "  config  -> $GooseConfig"
Write-Host "  backup:    $(-not $NoBackup)"
Write-Host "  dry-run:   $DryRun"

Copy-HarnessDir -Source $SourceRecipes -Destination $DestRecipes -Stamp $Stamp
Copy-HarnessDir -Source $SourceSkills -Destination $DestSkills -Stamp $Stamp
Copy-HarnessDir -Source $SourceAgents -Destination $DestAgents -Stamp $Stamp
Update-SlashCommands -ConfigPath $GooseConfig -RecipeDir $DestRecipes -Stamp $Stamp

if (-not $SkipValidate) {
    $Goose = Get-Command goose -ErrorAction SilentlyContinue
    if ($null -ne $Goose) {
        if ($DryRun) {
            Write-Host '[dry-run] skip validation'
        } else {
            Write-Host 'Validating installed recipes...'
            Get-ChildItem -Path $DestRecipes -Recurse -Filter '*.yaml' | ForEach-Object {
                Write-Host $_.FullName
                goose recipe validate $_.FullName
            }
            Write-Host 'Installed skills visible to Goose:'
            goose skills list
        }
    } else {
        Write-Warning 'goose not found on PATH; skipping validation'
    }
}

Write-Host 'Install complete. Try: goose session, then /harness <task>'
