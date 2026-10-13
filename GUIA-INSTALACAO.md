# VENEK — Estúdio de Imagens IA

## Publicação

- Interface pública: GitHub Pages, pasta raiz, branch main.
- Servidor: importe este mesmo repositório na Vercel (Framework: Other).
- Configure variáveis de ambiente na Vercel: OPENAI_API_KEY e VENEK_APP_PASSWORD.
- NÃO compartilhe os valores destas variáveis em chat, GitHub, capturas de tela ou arquivos públicos.
- Em GitHub Pages abra Configuração da conexão IA, informe https://SEU-PROJETO.vercel.app/api/generate, e use sua senha de acesso.
- O modelo por padrão é gpt-image-1, edição de imagem; as imagens podem gerar custos por uso.
- Endpoint aceita PNG/JPG/WEBP de até ~3MB; faça redução de arquivo antes de enviar se necessário.
- Use sua própria senha forte e não divulgue o link do servidor junto com a senha.

## Cuidados

- GitHub Pages é site público. A chave OpenAI fica SOMENTE nas variáveis privadas da Vercel.
- Senha é barreira simples de acesso; para equipe grande implemente autenticação por usuário, limites de requisições e monitoramento de gastos.
- Preservação exata das peças não é garantida; verifique a imagem antes de anunciar.
- Vercel pode cobrar conforme uso e limites de plano. Confira duração de função e limites de payload.
- Proporção é ajustada no PNG exportado pela interface; a geração API utiliza tamanhos nativos 1024x1024, 1024x1536 ou 1536x1024.
