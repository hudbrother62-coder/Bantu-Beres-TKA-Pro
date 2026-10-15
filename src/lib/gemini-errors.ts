export function explainGoogleError(status:number, raw:unknown, model="Gemini"):string {
 const value = raw && typeof raw==="object" && "error" in raw
   ? (raw as {error?:{message?:string;status?:string;details?:{reason?:string}[]}}).error
   : undefined;
 const msg = String(value?.message || "");
 const detail = (value?.details || []).map(d=>d.reason || "").join(" ");
 const code = String(value?.status || "");
 if (/API_KEY_INVALID|API_KEY_NOT_FOUND|API key not valid|invalid api key/i.test(detail+" "+msg))
   return "API key tidak valid atau tidak aktif. Buat API key baru dari Google AI Studio lalu uji kembali.";
 if (status===402 || /BILLING|insufficient.*credit/i.test(detail+" "+msg))
   return "Saldo atau penagihan Gemini tidak tersedia. Periksa billing di Google AI Studio.";
 if (/FAILED_PRECONDITION|free tier.*not available/i.test(code+" "+msg))
   return "Project Google tidak memenuhi syarat untuk layanan Gemini gratis. Periksa wilayah dan billing.";
 if (status===429 || code==="RESOURCE_EXHAUSTED")
   return "Kuota Gemini tercapai (429). Periksa batas penggunaan di Google AI Studio dan coba lagi nanti.";
 if (status===404)
   return "Model "+model+" tidak tersedia untuk API key ini (404). Cari dan pilih model lain.";
 if (status===403) {
   if (/denied access|project.*blocked|project.*suspend/i.test(msg))
     return "Google memblokir akses project/API key ini (403). Periksa pemberitahuan atau peninjauan di Google Cloud Console."; 
   if (/referer|referrer|api key restriction|ips? not allowed|permission|not permitted/i.test(msg))
     return "Google menolak izin API key (403). Periksa API restrictions, Application restrictions dan Gemini API di Google Cloud Console.";
   return "Akses Gemini ditolak Google (403). Model yang muncul di daftar belum tentu bisa generate; periksa izin API key, pembatasan project, atau akses dari server hosting.";
 }
 if (status===400)
   return "Google menolak format permintaan (400). Periksa parameter dan kesesuaian model. Belum tentu API key salah.";
 if (status===401)
   return "Otentikasi API key Gemini gagal (401). Periksa apakah key masih aktif.";
 if (status>=500) return "Server Gemini sedang bermasalah ("+status+"). Coba kembali nanti.";
 return "Gemini gagal (HTTP "+status+"). Periksa model, izin dan kuota di Google AI Studio.";
}
export function recommendedModels(models:string[]):string[] {
 const rank=["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-2.5-flash-lite","gemini-3.8-flash","gemini-3.6-flash","gemini-2.5-flash","gemini-3-flash-preview"];
 return [...new Set(models.filter(m=>/^gemini-[a-z0-9.-]{2,80}$/.test(m)
  && !/(image|embedding|live|tts|audio|transcribe)/i.test(m)))]
  .sort((a,b)=>(rank.indexOf(a)===-1?100:rank.indexOf(a))-(rank.indexOf(b)===-1?100:rank.indexOf(b))||a.localeCompare(b));
}
