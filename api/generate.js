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
    const transparent = mode==='transparente'||mode==='transparent'||mode==='remove'||mode==='sem-fundo';
    const white = mode==='branco'||mode==='white';
    const size = ratio==='9:16'||ratio==='4:5'||ratio==='3:4'?'1024x1536':ratio==='16:9'?'1536x1024':'1024x1024';
    const sharp=(await import('sharp')).default;
    const original = await sharp(buf).rotate().ensureAlpha().png().toBuffer();
    const {width:ow,height:oh}=await sharp(original).metadata();
    const pictureFile=new Blob([original],{type:'image/png'});
    async function imageEdit(instruction, bg) {
      const fd=new FormData();
      fd.append('image',pictureFile,'produto-original.png');
      fd.append('model','gpt-image-1');
      fd.append('prompt',instruction);
      fd.append('size',size);
      fd.append('quality','medium');
      fd.append('output_format','png');
      if(bg)fd.append('background',bg);
      const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:fd});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error?.message||'Falha na edição pela OpenAI.');
      if(!data.data?.[0]?.b64_json)throw Error('A API não retornou imagem.');
      return Buffer.from(data.data[0].b64_json,'base64');
    }
    // A IA fornece apenas uma máscara de segmentação: pixels internos sempre vêm do arquivo original.
    const segmentation=await imageEdit('Isole o objeto/produto principal exatamente na mesma posição, tamanho e orientação da imagem enviada. Deixe tudo fora do produto com transparência total (alpha=0), incluindo sombra e cenário. Mantenha bordas precisas e todos os detalhes externos, recortes, orifícios e vazados. Não mude a posição e não aumente nem diminua o objeto. Saída PNG com transparência real.', 'transparent');
    const mask=await sharp(segmentation).resize(ow,oh,{fit:'fill'}).extractChannel('alpha').png().toBuffer();
    const alphaMatte=await sharp({create:{width:ow,height:oh,channels:3,background:'#ffffff'}}).joinChannel(mask).png().toBuffer();
    const cutout=await sharp(original).composite([{input:alphaMatte,blend:'dest-in'}]).png().toBuffer();
    let result;
    if(transparent) result=cutout;
    else if(white){
      const whiteBG=await sharp({create:{width:ow,height:oh,channels:4,background:'#ffffff'}}).png().toBuffer();
      result=await sharp(whiteBG).composite([{input:cutout,gravity:'centre'}]).png().toBuffer();
    }else{
      // O cenário é gerado separadamente; a peça final é sempre o recorte ORIGINAL.
      const response=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-image-1',size,quality:'medium',output_format:'png',prompt:'Crie APENAS um cenário de fundo fotográfico de anúncio de produto. Não desenhe, represente, reconstrua nem insira o produto; mantenha a área central livre para receber o produto real em sobreposição. Ambiente solicitado: '+prompt.slice(0,4000)+'. Fundo realista, perspectiva coerente e apoio discreto.'})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error?.message||'Falha ao criar fundo pela OpenAI.');
      const bg=Buffer.from(data.data?.[0]?.b64_json||'','base64');if(!bg.length)throw Error('A API não retornou cenário.');
      const {width:bw,height:bh}=await sharp(bg).metadata();
      const factor=Math.min(bw*.78/ow,bh*.78/oh,1.5);
      const rw=Math.max(1,Math.round(ow*factor)),rh=Math.max(1,Math.round(oh*factor));
      const resized=await sharp(cutout).resize(rw,rh).png().toBuffer();
      result=await sharp(bg).composite([{input:resized,left:Math.floor((bw-rw)/2),top:Math.floor((bh-rh)/2)}]).png().toBuffer();
    }
    res.setHeader('Content-Type','image/png');
    return res.status(200).send(result);
  } catch(e) {return res.status(500).json({error:'Erro interno ao processar imagem. Verifique o log na Vercel.'});}
}
