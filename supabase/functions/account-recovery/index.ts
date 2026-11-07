import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const answer=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const credentials=()=>{
 const url=Deno.env.get('SUPABASE_URL')||'';
 const pubs=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
 const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
 return {url,publicKey:pubs.default||Deno.env.get('SUPABASE_ANON_KEY')||'',secretKey:secrets.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''};
};
const hex=(data:ArrayBuffer)=>Array.from(new Uint8Array(data),v=>v.toString(16).padStart(2,'0')).join('');
const sha=async(text:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return answer({error:'Method not allowed'},405);
 const size=Number(req.headers.get('content-length')||0);
 if(size>4096)return answer({error:'Payload terlalu besar.'},413);
 try {
  const c=credentials();
  if(!c.url||!c.publicKey||!c.secretKey)return answer({error:'Layanan belum dikonfigurasi.'},503);
  const body=await req.json();
  const admin=createClient(c.url,c.secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='issue'){
   const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
   if(!token)return answer({error:'Silakan login.'},401);
   const publicClient=createClient(c.url,c.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:userData,error:userError}=await publicClient.auth.getUser(token);
   const user=userData?.user;
   if(userError||!user?.id||!user.email)return answer({error:'Sesi tidak valid.'},401);
   const pw=typeof body.currentPassword==='string'?body.currentPassword:'';
   if(pw.length<1||pw.length>128)return answer({error:'Masukkan password saat ini.'},400);
   const check=await publicClient.auth.signInWithPassword({email:user.email,password:pw});
   if(check.error||check.data.user?.id!==user.id)return answer({error:'Password saat ini salah.'},401);
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   const raw=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const digest=await sha(raw);
   const {error:storeError}=await admin.from('bb_recovery_codes').upsert({
     user_id:user.id,account_email:user.email.toLowerCase(),code_hash:digest,used_at:null,created_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(storeError){console.error('recovery issue db error',storeError.code);return answer({error:'Tidak bisa membuat kode sekarang.'},503);}
   return answer({ok:true,code:raw});
  }
  if(body.action==='redeem'){
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   const value=typeof body.code==='string'?body.code.trim():'';
   const password=typeof body.newPassword==='string'?body.newPassword:'';
   if(email.length>200||!email.includes('@')||!/^[A-Za-z0-9_-]{43}$/.test(value))return answer({error:'Kode pemulihan tidak sesuai.'},400);
   if(password.length<8||password.length>128)return answer({error:'Password baru harus 8–128 karakter.'},400);
   const {data:userId,error:consumeError}=await admin.rpc('bb_consume_recovery_code',{p_email:email,p_hash:await sha(value)});
   if(consumeError){console.error('recovery consume db error',consumeError.code);return answer({error:'Layanan pemulihan tidak tersedia.'},503);}
   if(!userId)return answer({error:'Username atau kode pemulihan salah atau sudah digunakan.'},400);
   const {error:updateError}=await admin.auth.admin.updateUserById(userId,{password});
   if(updateError){console.error('recovery update failed',updateError.status);return answer({error:'Password gagal diperbarui. Hubungi dukungan untuk bantuan.'},503);}
   return answer({ok:true});
  }
  return answer({error:'Aksi tidak dikenal.'},404);
 }catch(e){console.error('recovery unexpected',e instanceof Error?e.name:'unknown');return answer({error:'Permintaan tidak berhasil.'},500);}
});