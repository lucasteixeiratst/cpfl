# API de arquivos CPFL no Cloudflare

Worker preparado para servir KML/KMZ/ZIP de um bucket R2 privado. Toda requisição de arquivo exige uma sessão válida do Supabase e aceita somente o teste local e o GitHub Pages configurado.

Para publicar, ative o R2, crie o bucket `cpfl-network-files` e execute `npx wrangler deploy` nesta pasta. A ativação do R2 cria uma assinatura renovável, mesmo com franquia gratuita, por isso essa etapa exige confirmação explícita do proprietário da conta.
