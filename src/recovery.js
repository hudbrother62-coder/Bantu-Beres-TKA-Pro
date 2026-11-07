import {createClient} from '@supabase/supabase-js';
const cfg={url:import.meta.env.VITE_SUPABASE_URL||'',key:import.meta.env.VITE_SUPABASE_ANON_KEY||''};
const sb=cfg.url&&cfg.key?createClient(cfg.url,cfg.key):null,$=id=>document.getElementById(id);
const setup=new URLSearchParams(location.search).get('mode')==='setup';
const error=m=>{$('error').textContent=m;$('notice').textContent='';};
const notice=m=>{$('notice').textContent=m;$('error').textContent='';};
if(!sb){document.getElementById('error').textContent='Koneksi akun belum dikonfigurasi.';document.getElementById('setup-form').hidden=true;document.getElementById('redeem-form').hidden=true;}
else if(setup){
 $('title').textContent='Siapkan kode pemulihan';
 $('description').textContent='Konfirmasi password saat ini. Kode 256-bit hanya ditampilkan sekali dan mengganti kode sebelumnya.';
 sb.auth.getUser().then(({data,error:err})=>{if(err||!data.user){error('Login ke TKA Pro dahulu untuk membuat kode pemulihan.');return;}$('setup-form').hidden=false;}).catch(()=>error('Koneksi akun gagal.'));
}else if(sb) $('redeem-form').hidden=false;
async function invoke(body){
 if(!sb)throw Error('Koneksi akun belum tersedia.');
 const {data,error:problem}=await sb.functions.invoke('account-recovery',{body});
 if(problem){let message='Permintaan gagal.';try{const d=await problem.context?.json();message=d?.error||message;}catch{}throw Error(message)}
 return data;
}
$('setup-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const data=await invoke({action:'issue',currentPassword:$('current-password').value});if(!data?.code)throw Error('Kode tidak diterima.');$('recovery-code').value=data.code;$('generated').hidden=false;$('setup-form').hidden=true;notice('Kode berhasil dibuat. Simpan sekarang. Kode lama tidak berlaku dan kode ini tidak akan ditampilkan ulang.');}
 catch(e){error(e.message)}finally{button.disabled=false;}
});
$('redeem-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{
  const username=$('username').value.trim().toLowerCase(),password=$('new-password').value;
  if(password!==$('confirm-password').value)throw Error('Konfirmasi password tidak sama.');
  if(!/^[a-z0-9._-]{3,32}$/.test(username))throw Error('Username harus 3–32 karakter.');
  const email=username+'@users.tka-pro.invalid';
  const result=await invoke({action:'redeem',email,code:$('code').value.trim(),newPassword:password});
  if(!result?.ok)throw Error('Pemulihan belum berhasil.');
  if(sb)await sb.auth.signOut().catch(()=>undefined);
  $('redeem-form').hidden=true;notice('Password berhasil diganti. Silakan kembali ke login dengan password baru.');
 }catch(e){error(e.message)}finally{button.disabled=false;}
});
$('copy').addEventListener('click',()=>void navigator.clipboard.writeText($('recovery-code').value).then(()=>notice('Kode disalin. Simpan di tempat aman.')).catch(()=>error('Gagal menyalin. Salin manual.')));
