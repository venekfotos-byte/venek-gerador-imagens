const ALLOWED_ORIGINS = new Set(['https://venekfotos-byte.github.io','https://venek-gerador-imagens.vercel.app']);
export default async function handler(req,res) {
  const origin = req.headers.origin; if(origin && ALLOWED_ORIGINS.has(origin))res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Venek-Access');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({error:'Método não permitido.'});
  if(req.headers.origin && !ALLOWED_ORIGINS.has(req.headers.origin)) return res.status(403).json({error:'Origem não autorizada.'});
  if(!process.env.OPENAI_API_KEY || !process.env.VENEK_APP_PASSWORD)
    return res.status(503).json({error:'Configure OPENAI_API_KEY e VENEK_APP_PASSWORD na Vercel.'});
  if(req.headers['x-venek-access']!==process.env.VENEK_APP_PASSWORD)
    return res.status(401).json({error:'Senha do aplicativo incorreta.'});
  try {
    const {image,prompt,mode,ratio}=req.body||{};
    if(typeof image!=='string'||typeof prompt!=='string'||image.length>4800000||prompt.length>6000)
      return res.status(400).json({error:'Envie uma foto menor que 3 MB e uma instrução válida.'});
    const m=image.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if(!m) return res.status(400).json({error:'Formato inválido. Use PNG, JPG ou WEBP.'});
    const buf=Buffer.from(m[2],'base64');
    if(buf.length>3300000) return res.status(413).json({error:'Foto muito grande. Reduza para 3 MB.'});
    const transparent = mode==='transparent' || mode==='remove' || mode==='sem-fundo';
    const size = ratio==='9:16'||ratio==='4:5'||ratio==='3:4'?'1024x1536':ratio==='16:9'?'1536x1024':'1024x1024';
    const guidance=transparent?'Recorte somente o produto, sem fundo. Preserve a peça com máxima fidelidade, com transparência real no PNG.':'Edite a imagem usando a foto como referência principal. Preserve a forma, a cor, proporções, inscrições e detalhes reais do produto. Altere somente o fundo e a composição solicitados.';
    const data=new FormData();
    const mime=m[1],ext=mime==='image/jpeg'?'jpg':mime==='image/webp'?'webp':'png';
    data.append('image',new Blob([buf],{type:mime}), 'produto.'+ext);
    data.append('model','gpt-image-1');
    data.append('prompt',guidance+'\n'+prompt);
    data.append('size',size);
    data.append('quality','medium');
    data.append('output_format','png');
    if(transparent) data.append('background','transparent');
    const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:data});
    const out=await response.json().catch(()=>({}));
    if(!response.ok) {
      const detail=out.error?.message||'Erro ao gerar imagem.';
      return res.status(response.status===429?429:502).json({error:detail.slice(0,500)});
    }
    const b64=out.data?.[0]?.b64_json;
    if(!b64) return res.status(502).json({error:'A API não retornou a imagem.'});
    res.setHeader('Content-Type','image/png');
    return res.status(200).send(Buffer.from(b64,'base64'));
  } catch(e) {return res.status(500).json({error:'Erro interno ao processar imagem. Verifique o log na Vercel.'});}
}
