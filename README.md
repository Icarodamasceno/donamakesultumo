# DONA MAKES

Loja + painel admin (Cloudflare Pages + D1).

## Subir no Cloudflare
1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → escolha o repositório.
2. Build command: vazio. Output directory: vazio (ou `/`). Deploy.
3. Criar o banco: Storage & Databases → D1 → Create → nome `dona-makes`.
4. No projeto Pages: Settings → Bindings → Add → D1 database → Variable name `DB` → escolha o banco → Save.
5. Settings → Variables and Secrets → Add:
   - `ADMIN_USER` = seu usuário
   - `ADMIN_PASSWORD` = sua senha (tipo Secret)
6. Deployments → Retry deployment (ou novo commit) para aplicar.

Painel: `/admin.html`. As tabelas e os produtos de exemplo são criados sozinhos no primeiro acesso.
