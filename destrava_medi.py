# =================================================================
# PROVISIONADOR M2M - NATIVO WINDOWS (SEM PYTHON)
# =================================================================
param (
    [switch]$status,
    [switch]$rede,
    [string]$user = "vivo_medi_18302",
    [string]$sn,
    [string]$imei,
    [switch]$otimizar,
    [switch]$reboot,
    [string]$cmd
)

$APN = "cpfl3g.m2m.vivo.com.br"
$SENHA = "cpflvivo"
$CORE_JSON_PATH = "/tmp/marthe/config_json/core.json"
$NET_JSON_PATH = "/tmp/marthe/config_json/config_json"

# --- 1. BUSCA AUTOMÁTICA DA PORTA ---
$portas = [System.IO.Ports.SerialPort]::GetPortNames()
$porta_ativa = $null
foreach ($p in $portas) {
    try {
        $s = New-Object System.IO.Ports.SerialPort $p,9600,None,8,one
        $s.Open(); $s.WriteLine("AT`r"); Start-Sleep -m 300
        if ($s.ReadExisting() -match "OK") { $porta_ativa = $p; $s.Close(); break }
        $s.Close()
    } catch { }
}

if (!$porta_ativa) {
    Write-Host "[X] FATAL: Nenhum modem Fibocom detectado na USB." -ForegroundColor Red
    exit
}

$port = New-Object System.IO.Ports.SerialPort $porta_ativa,9600,None,8,one
$port.Open()

function Send-AT($comando, $wait=1) {
    $port.DiscardInBuffer()
    $port.WriteLine("$comando`r")
    Start-Sleep -Seconds $wait
    return ($port.ReadExisting() -replace "$comando`r`n", "") -replace "`n|`r", " "
}

# --- 2. LÓGICA DE IDENTIDADE (SN/IMEI) ---
if ($sn -or $imei) {
    if ($imei -and $imei.Length -ne 15) { Write-Host "[X] Erro: O IMEI deve ter 15 dígitos." -ForegroundColor Red; exit }
    
    Write-Host "[*] Sincronizando identidade (JSON)..." -ForegroundColor Cyan
    adb pull $CORE_JSON_PATH "core_work.json" | Out-Null
    
    $dados = @{ serie=""; imei=""; firmware="118F011-01C"; autoUpdateTs=$true }
    if (Test-Path "core_work.json") {
        $dados = Get-Content "core_work.json" -Raw | ConvertFrom-Json
    } else {
        Write-Host "[!] core.json não encontrado. Lendo rádio..." -ForegroundColor Yellow
        $imei_resgate = Send-AT "AT+CGSN" -replace "OK", ""
        $dados.imei = $imei_resgate.Trim()
    }

    if ($sn) { $dados.serie = $sn; Write-Host "[+] Novo SN: $sn" -ForegroundColor Green }
    if ($imei) { $dados.imei = $imei; Write-Host "[+] Novo IMEI: $imei" -ForegroundColor Green }
    
    $dados | ConvertTo-Json -Depth 10 | Set-Content "core_new.json"
    $res = adb push "core_new.json" $CORE_JSON_PATH
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[V] Sucesso! Reiniciando rádio..." -ForegroundColor Green
        Send-AT "AT+CFUN=1,1" | Out-Null
    } else {
        Write-Host "[X] Erro ADB." -ForegroundColor Red
    }
}

# --- 3. LÓGICA DE REDE ---
if ($rede) {
    Write-Host "[*] Configurando Rede - APN: $APN | User: $user" -ForegroundColor Cyan
    
    $net_data = @(
        @{ Customizado = @{ apn=""; user=""; pass=""; pin=0 } },
        @{ Vivo = @{ apn=$APN; user=$user; pass=$SENHA; pin=0 } }
    )
    $net_data | ConvertTo-Json -Depth 10 | Set-Content "net_new.json"
    adb push "net_new.json" $NET_JSON_PATH | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Send-AT "AT+CGDCONT=1,`"IP`",`"$APN`"" | Out-Null
        Send-AT "AT`$QCPDPP=1,3,`"$SENHA`",`"$user`"" | Out-Null
        Send-AT "AT&W" | Out-Null
        Send-AT "AT+CFUN=1,1" | Out-Null
        Write-Host "[V] Rede injetada e modem reiniciando." -ForegroundColor Green
    } else { Write-Host "[X] Erro ADB." -ForegroundColor Red }
}

# --- 4. COMANDOS RÁPIDOS ---
if ($status) {
    Write-Host "`n--- STATUS GERAL ---" -ForegroundColor Cyan
    Write-Host " SN: $(Send-AT 'AT+SN?')"
    Write-Host " IMEI: $(Send-AT 'AT+CGSN')"
    Write-Host " IP: $(Send-AT 'AT+CGPADDR=1')"
    Write-Host " SINAL: $(Send-AT 'AT+CSQ')"
    Write-Host "--------------------`n" -ForegroundColor Cyan
}

if ($otimizar) {
    Write-Host "[*] Travando 4G (Banda 28)..." -ForegroundColor Cyan
    Send-AT "AT+XRAT=4" | Out-Null; Send-AT "AT+XFREQ=0,0,0,0,0,0,1" | Out-Null; Send-AT "AT&W" | Out-Null
    Write-Host "[+] Otimizado!" -ForegroundColor Green
}

if ($reboot) { Send-AT "AT+CFUN=1,1" | Out-Null; Write-Host "[+] Rádio reiniciado." -ForegroundColor Green }
if ($cmd) { Write-Host "AT> $cmd`n$(Send-AT $cmd)" -ForegroundColor Yellow }

$port.Close()