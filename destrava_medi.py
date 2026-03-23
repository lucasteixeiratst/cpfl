import os
import json
import time
import subprocess
import serial
import serial.tools.list_ports

# --- CONFIGURAÇÕES MESTRAS ---
CONFIG = {
    "porta_com": "", # Agora fica em branco, o script descobre sozinho!
    "baudrate": 9600,
    "path_core_json": "/tmp/marthe/config_json/core.json",
    "path_net_json": "/tmp/marthe/config_json/config_json", # Mantive o seu caminho original
    "apn": "cpfl3g.m2m.vivo.com.br",
    "user_padrao": "vivo_medi_18302",
    "senha": "cpflvivo"
}

def limpar_tela():
    os.system('cls' if os.name == 'nt' else 'clear')

def encontrar_porta_modem():
    print("[*] Buscando porta COM do modem Fibocom automaticamente...")
    portas = serial.tools.list_ports.comports()
    
    for porta in portas:
        try:
            # Tenta abrir a porta e mandar um AT de teste
            with serial.Serial(porta.device, CONFIG["baudrate"], timeout=0.5) as ser:
                ser.write(b"AT\r")
                time.sleep(0.3)
                resposta = ser.read_all().decode(errors='ignore')
                
                if "OK" in resposta:
                    print(f"[V] Modem detectado na porta {porta.device}!\n")
                    time.sleep(1)
                    return porta.device
        except:
            pass # Se a porta estiver em uso ou der erro, ignora e testa a próxima
            
    return None

def enviar_at(comando, timeout=2):
    try:
        with serial.Serial(CONFIG["porta_com"], CONFIG["baudrate"], timeout=timeout) as ser:
            ser.write(f"{comando}\r".encode())
            time.sleep(0.5)
            return ser.read_all().decode(errors='ignore').strip()
    except:
        return "Erro Serial"

def adb_push(local, remoto):
    return subprocess.run(f'adb push "{local}" {remoto}', shell=True, capture_output=True, text=True)

def adb_pull(remoto, local):
    return subprocess.run(f'adb pull {remoto} "{local}"', shell=True, capture_output=True, text=True)

# =================================================================
# FUNÇÕES DE IDENTIDADE (SN/IMEI) COM PROTEÇÃO ANTI-AMNÉSIA
# =================================================================
def mudar_identidade(nova_serie=None, novo_imei=None):
    print("\n[*] Sincronizando identidade (JSON)...")
    res_pull = adb_pull(CONFIG["path_core_json"], "core_work.json")
    
    try:
        # Tenta ler o arquivo original da placa
        with open("core_work.json", "r") as f: 
            dados = json.load(f)
    except: 
        # TRAVA DE SEGURANÇA: Se falhar, resgata o IMEI direto do rádio para não apagar!
        print("[!] Arquivo core.json não encontrado. Lendo dados direto do rádio...")
        imei_resgate = enviar_at("AT+CGSN").replace("AT+CGSN", "").replace("OK", "").strip()
        
        dados = {
            "serie": "", 
            "imei": imei_resgate if imei_resgate else "", 
            "firmware": "118F011-01C", 
            "autoUpdateTs": True
        }

    # Aplica as mudanças solicitadas pelo usuário
    if nova_serie: dados["serie"] = nova_serie
    if novo_imei: dados["imei"] = novo_imei
    
    with open("core_new.json", "w") as f: 
        json.dump(dados, f, indent=2)
        
    res = adb_push("core_new.json", CONFIG["path_core_json"])
    
    if res.returncode == 0:
        print("[V] Sucesso! Reiniciando rádio para aplicar a identidade...")
        enviar_at("AT+CFUN=1,1")
    else:
        print("[X] Erro na injeção ADB. Verifique o cabo USB.")

# =================================================================
# FUNÇÃO DE REDE SIMPLIFICADA (VIVO CPFL M2M)
# =================================================================
def configurar_rede_viva_cpfl():
    print("\n--- CONFIGURAÇÃO VIVO CPFL M2M ---")
    print(f" APN fixa: {CONFIG['apn']}")
    user = input(f" Editar Usuário [{CONFIG['user_padrao']}]: ") or CONFIG['user_padrao']
    print(f" Senha fixa: {CONFIG['senha']}")

    # Prepara o JSON no formato Sirius
    net_data = [
        {"Customizado": {"apn": "", "user": "", "pass": "", "pin": 0}},
        {"Vivo": {"apn": CONFIG['apn'], "user": user, "pass": CONFIG['senha'], "pin": 0}}
    ]

    with open("net_new.json", "w") as f: 
        json.dump(net_data, f, indent=2)

    print("[*] Injetando configuração de rede no Linux...")
    res = adb_push("net_new.json", CONFIG["path_net_json"])
    
    if res.returncode == 0:
        print("[V] Perfil de rede injetado no sistema com sucesso!")
        print("[*] Gravando parâmetros no modem celular...")
        enviar_at(f'AT+CGDCONT=1,"IP","{CONFIG["apn"]}"')
        enviar_at(f'AT$QCPDPP=1,3,"{CONFIG["senha"]}","{user}"')
        enviar_at("AT&W")
        enviar_at("AT+CFUN=1,1")
        print("[+] Modem reiniciando para aplicar a rede. Aguarde o IP subir.")
    else:
        print("[X] Erro na injeção ADB. A rede não foi salva.")

# =================================================================
# MENU PRINCIPAL
# =================================================================
def menu():
    limpar_tela()
    print("="*65)
    print("      PROVISIONADOR CPFL M2M - VERSÃO FINAL BANCADA")
    print("="*65)
    print(f" PORTA ATIVA: {CONFIG['porta_com']}")
    print("="*65)
    print(" [1] DIAGNÓSTICO COMPLETO (Sinal, IP, ICCID, SN)")
    print(" [2] CONFIGURAR REDE (VIVO CPFL M2M)")
    print(" [3] MUDAR NÚMERO DE SÉRIE (SN)")
    print(" [4] MUDAR IMEI")
    print(" [5] OTIMIZAR REDE (4G / Banda 28)")
    print(" [6] TERMINAL AT INTERATIVO")
    print(" [7] REBOOT / RESET RÁDIO")
    print(" [0] SAIR")
    print("="*65)

def main():
    limpar_tela()
    
    # Executa a busca automática antes de abrir o menu
    porta_detectada = encontrar_porta_modem()
    if porta_detectada:
        CONFIG["porta_com"] = porta_detectada
    else:
        print("[X] FATAL: Nenhum modem Fibocom respondeu aos comandos AT.")
        input("Verifique o cabo USB, a alimentação da placa e pressione ENTER para sair...")
        return

    while True:
        menu()
        opcao = input(" Escolha: ")
        
        if opcao == '1':
            print("\n--- STATUS GERAL ---")
            print(f" SN: {enviar_at('AT+SN?')}")
            print(f" IMEI: {enviar_at('AT+CGSN')}")
            print(f" IP (Operadora): {enviar_at('AT+CGPADDR=1')}")
            print(f" SINAL (RF): {enviar_at('AT+CSQ')}")
            input("\nPressione ENTER para voltar...")
            
        elif opcao == '2':
            configurar_rede_viva_cpfl()
            input("\nPressione ENTER para voltar...")
            
        elif opcao == '3':
            sn = input(" Digite o novo SN: ")
            if sn: mudar_identidade(nova_serie=sn)
            input("\nPressione ENTER para voltar...")
            
        elif opcao == '4':
            imei = input(" Digite o novo IMEI (15 dígitos): ")
            if len(imei) == 15: 
                mudar_identidade(novo_imei=imei)
            else:
                print("[X] Erro: O IMEI deve ter exatamente 15 dígitos.")
            input("\nPressione ENTER para voltar...")
            
        elif opcao == '5':
            print("\n[*] Aplicando trava de 4G na Banda 28...")
            enviar_at("AT+XRAT=4") # Força LTE (Auto)
            enviar_at("AT+XFREQ=0,0,0,0,0,0,1") # Força Banda 28
            enviar_at("AT&W")
            print("[+] Modem otimizado e configurações salvas!")
            input("\nPressione ENTER para voltar...")
            
        elif opcao == '6':
            print("\n--- TERMINAL AT (Digite 'sair' para voltar) ---")
            while True:
                c = input("AT> ")
                if c.lower() == 'sair': break
                print(enviar_at(c))
                
        elif opcao == '7':
            print("\n[*] Reiniciando módulo de rádio...")
            enviar_at("AT+CFUN=1,1")
            print("[+] Comando enviado.")
            time.sleep(2)
            break
            
        elif opcao == '0':
            print("\nSaindo...")
            break

if __name__ == "__main__":
    # Garante que as dependências existem antes de rodar
    try:
        import serial.tools.list_ports
    except ImportError:
        print("[X] A biblioteca 'pyserial' não está instalada.")
        print("[!] Instale rodando: pip install pyserial")
        exit()
        
    main()