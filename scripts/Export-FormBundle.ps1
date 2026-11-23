<#
.SYNOPSIS
  Genera un paquete .bundle.json con los formularios y columnas de una tabla de una solucion, usando PAC CLI.

.DESCRIPTION
  Flujo: elegir entorno -> elegir solucion -> (publicar) -> exportar y desempaquetar -> elegir tabla -> escribir paquete.
  El script NO interpreta XML: vuelca Entity.xml, los ficheros de FormXml y el idioma base tal cual.
  El parseo lo hace la herramienta web al cargar el paquete.

  Requisitos: PAC CLI instalado y una sesion creada con `pac auth create`.
  Solo exporta la solucion como NO gestionada (entorno de desarrollo).

.EXAMPLE
  .\Export-FormBundle.ps1

.EXAMPLE
  .\Export-FormBundle.ps1 -Environment https://org.crm4.dynamics.com -Solution MiSolucion -Entity account -SkipPublish
#>
[CmdletBinding()]
param(
    [string]$Environment,
    [string]$Solution,
    [string]$Entity,
    [string]$OutDir = (Join-Path (Get-Location).Path 'bundles'),
    [switch]$SkipPublish,
    [switch]$KeepWork
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }

function Invoke-Pac {
    param([Parameter(Mandatory)][string[]]$PacArgs)
    # En Windows PowerShell 5.1, con 'Stop' el stderr de un programa nativo se convierte en excepcion: se relaja solo aqui.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $output = (& pac @PacArgs 2>&1 | Out-String) }
    finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) {
        throw "pac $($PacArgs -join ' ') fallo (codigo $LASTEXITCODE):`n$output"
    }
    return $output
}

function Select-Item {
    param([string]$Title, [object[]]$Items, [scriptblock]$Label)
    if ($Items.Count -eq 0) { throw "No hay elementos para elegir: $Title" }
    if ($Items.Count -eq 1) {
        Write-Host ("{0}: {1} (unico)" -f $Title, (& $Label $Items[0]))
        return $Items[0]
    }
    Write-Host ''
    Write-Host $Title -ForegroundColor Yellow
    for ($i = 0; $i -lt $Items.Count; $i++) {
        Write-Host ('  [{0}] {1}' -f ($i + 1), (& $Label $Items[$i]))
    }
    while ($true) {
        $answer = Read-Host 'Numero (q para salir)'
        if ($answer -eq 'q') { throw 'Cancelado por el usuario.' }
        $n = 0
        if ([int]::TryParse($answer, [ref]$n) -and $n -ge 1 -and $n -le $Items.Count) { return $Items[$n - 1] }
        Write-Host 'Opcion no valida.' -ForegroundColor Red
    }
}

# pac env list no tiene --json: se leen las lineas que contengan un GUID y una URL https.
function Get-Environments {
    $text = Invoke-Pac @('env', 'list')
    $guid = '[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}'
    $found = @()
    foreach ($line in ($text -split "`r?`n")) {
        $idMatch = [regex]::Match($line, $guid)
        $urlMatch = [regex]::Match($line, 'https://[^\s/]+')
        if (-not ($idMatch.Success -and $urlMatch.Success)) { continue }
        $name = ''
        if ($urlMatch.Index -gt $idMatch.Index) {
            $name = $line.Substring(0, $idMatch.Index).Trim().TrimStart('*').Trim()
        }
        if (-not $name) { $name = $urlMatch.Value.Substring('https://'.Length) }
        $found += [pscustomobject]@{ Name = $name; Id = $idMatch.Value; Url = $urlMatch.Value; Active = $line.TrimStart().StartsWith('*') }
    }
    return $found
}

function Get-Prop($Obj, [string[]]$Names) {
    foreach ($n in $Names) {
        $p = $Obj.PSObject.Properties | Where-Object { $_.Name -ieq $n } | Select-Object -First 1
        if ($p -and $null -ne $p.Value) { return $p.Value }
    }
    return $null
}

# pac solution list --json: se acepta tanto un array como un objeto que lo contenga.
function Get-Solutions([string]$EnvUrl) {
    $raw = Invoke-Pac @('solution', 'list', '--environment', $EnvUrl, '--json')
    $start = $raw.IndexOfAny([char[]]@('[', '{'))
    $end = [Math]::Max($raw.LastIndexOf(']'), $raw.LastIndexOf('}'))
    if ($start -lt 0 -or $end -le $start) { return @() }
    try { $data = $raw.Substring($start, $end - $start + 1) | ConvertFrom-Json } catch { return @() }

    if ($null -eq $data) { return @() }
    if ($data -isnot [System.Array]) {
        $inner = $data.PSObject.Properties | Where-Object { $_.Value -is [System.Array] } | Select-Object -First 1
        $data = if ($inner) { $inner.Value } else { @($data) }
    }
    $list = @()
    foreach ($item in $data) {
        $unique = Get-Prop $item @('SolutionUniqueName', 'UniqueName', 'uniquename', 'Name')
        if (-not $unique) { continue }
        $managed = Get-Prop $item @('IsManaged', 'Managed', 'ismanaged')
        if ($managed -eq $true -or "$managed" -ieq 'true') { continue }
        $friendly = Get-Prop $item @('FriendlyName', 'DisplayName', 'friendlyname')
        $version = Get-Prop $item @('Version', 'SolutionVersion')
        $list += [pscustomobject]@{ Unique = "$unique"; Friendly = "$friendly"; Version = "$version" }
    }
    return $list
}

if (-not (Get-Command pac -ErrorAction SilentlyContinue)) {
    throw 'No encuentro "pac". Instalalo (dotnet tool install --global Microsoft.PowerApps.CLI.Tool) y ejecuta "pac auth create".'
}

# 1. Entorno
$envName = $Environment
if (-not $Environment) {
    Write-Step 'Entornos (pac env list)'
    $envs = @()
    try { $envs = @(Get-Environments) } catch { Write-Warning $_.Exception.Message }
    if ($envs.Count -eq 0) {
        Write-Warning 'No pude leer la lista de entornos (hace falta "pac auth create"?).'
        $Environment = Read-Host 'URL o ID del entorno'
        $envName = $Environment
    }
    else {
        $chosenEnv = Select-Item -Title 'Entorno' -Items $envs -Label { param($e) "$(if ($e.Active) { '* ' })$($e.Name)  $($e.Url)" }
        $Environment = $chosenEnv.Url
        $envName = $chosenEnv.Name
    }
}

# 2. Solucion
if (-not $Solution) {
    Write-Step 'Soluciones no gestionadas (pac solution list)'
    $solutions = @(Get-Solutions $Environment)
    if ($solutions.Count -eq 0) {
        Write-Warning 'No pude leer la lista de soluciones.'
        $Solution = Read-Host 'Nombre unico de la solucion'
    }
    else {
        $chosenSol = Select-Item -Title 'Solucion' -Items $solutions -Label { param($s) "$($s.Unique)  ($($s.Friendly) $($s.Version))" }
        $Solution = $chosenSol.Unique
    }
}
if (-not $Solution) { throw 'Falta el nombre de la solucion.' }

# 3. Publicar (para que el export incluya los ultimos cambios)
if (-not $SkipPublish) {
    $answer = Read-Host 'Publicar todas las personalizaciones antes de exportar? Asi el paquete refleja lo ultimo (S/n)'
    if ($answer -notmatch '^(n|no)$') {
        Write-Step 'Publicando personalizaciones'
        Invoke-Pac @('solution', 'publish', '--environment', $Environment) | Out-Null
    }
}

# 4-5. Exportar, desempaquetar, elegir tabla y escribir paquete
$work = Join-Path ([IO.Path]::GetTempPath()) ('formbundle_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
    $zip = Join-Path $work 'solution.zip'
    $unpacked = Join-Path $work 'unpacked'

    Write-Step "Exportando '$Solution' (no gestionada)"
    Invoke-Pac @('solution', 'export', '--environment', $Environment, '--name', $Solution, '--path', $zip, '--overwrite') | Out-Null

    Write-Step 'Desempaquetando'
    Invoke-Pac @('solution', 'unpack', '--zipfile', $zip, '--folder', $unpacked) | Out-Null

    $entitiesRoot = Join-Path $unpacked 'Entities'
    if (-not (Test-Path $entitiesRoot)) { throw "La solucion '$Solution' no contiene tablas (no existe la carpeta Entities)." }

    $candidates = @(Get-ChildItem $entitiesRoot -Directory | ForEach-Object {
            $forms = @(Get-ChildItem (Join-Path $_.FullName 'FormXml') -Filter '*.xml' -File -Recurse -ErrorAction SilentlyContinue)
            if ($forms.Count -gt 0) { [pscustomobject]@{ Name = $_.Name; Path = $_.FullName; Forms = $forms } }
        })
    if ($Entity) { $candidates = @($candidates | Where-Object { $_.Name -ieq $Entity }) }
    if ($candidates.Count -eq 0) {
        throw 'Ninguna tabla de la solucion tiene formularios. Anade los formularios a la solucion (o usa "incluir todos los objetos").'
    }
    $chosen = Select-Item -Title 'Tabla' -Items $candidates -Label { param($c) "$($c.Name)  ($($c.Forms.Count) formularios)" }

    $utf8 = New-Object System.Text.UTF8Encoding($false)

    $entityXml = $null
    $entityFile = Join-Path $chosen.Path 'Entity.xml'
    if (Test-Path $entityFile) { $entityXml = [IO.File]::ReadAllText($entityFile, $utf8) }

    $baseLang = 1033
    $custFile = Join-Path (Join-Path $unpacked 'Other') 'Customizations.xml'
    if (Test-Path $custFile) {
        $m = [regex]::Match([IO.File]::ReadAllText($custFile, $utf8), '<Language>\s*(\d+)\s*</Language>')
        if ($m.Success) { $baseLang = [int]$m.Groups[1].Value }
    }

    $formFiles = @($chosen.Forms | ForEach-Object {
            [ordered]@{
                file = $_.FullName.Substring($chosen.Path.Length).TrimStart('\', '/')
                xml  = [IO.File]::ReadAllText($_.FullName, $utf8)
            }
        })

    $bundle = [ordered]@{
        schema       = 1
        generatedAt  = (Get-Date).ToUniversalTime().ToString('o')
        environment  = [ordered]@{ name = $envName; url = $Environment }
        solution     = [ordered]@{ uniqueName = $Solution }
        entity       = $chosen.Name
        baseLanguage = $baseLang
        entityXml    = $entityXml
        forms        = $formFiles
    }

    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $file = Join-Path $OutDir ('{0}.{1}.bundle.json' -f $chosen.Name.ToLower(), $Solution)
    [IO.File]::WriteAllText($file, ($bundle | ConvertTo-Json -Depth 6), $utf8)

    Write-Host ''
    Write-Host "Paquete creado: $file" -ForegroundColor Green
    Write-Host ('  {0} formulario(s), idioma base {1}' -f $formFiles.Count, $baseLang)
    Write-Host '  Abrelo en la herramienta con "Cargar paquete".'
}
finally {
    if ($KeepWork) { Write-Host "Carpeta temporal conservada: $work" }
    else { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
}
