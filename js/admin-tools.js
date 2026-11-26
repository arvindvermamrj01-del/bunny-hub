/* Supabase-backed admin tools. Privileged Auth user creation and OAuth are intentionally server-only. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = message => typeof window.toast === "function" ? window.toast(message) : window.alert(message);
  async function requireAdmin() {
    if (!db) throw new Error("Supabase connection missing.");
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Admin login required.");
    const { data: profile, error: pErr } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (pErr) throw pErr;
    if (profile?.role !== "admin") throw new Error("Admin permission required.");
    return user;
  }
  let users = [];
  async function loadUsers() {
    const body = $("adminUsersTableBody");
    if (!body) return;
    try {
      await requireAdmin();
      let result = await db.from("profiles").select("id,fullname,role,created_at").order("created_at",{ascending:false}).limit(500);
      if (result.error && /fullname|PGRST204|42703/i.test(result.error.message || "")) {
        result = await db.from("profiles").select("id,full_name,role,created_at").order("created_at",{ascending:false}).limit(500);
      }
      if (result.error) throw result.error;
      users = (result.data || []).map(profile => ({ ...profile, fullname: profile.fullname || profile.full_name || "" }));
      renderUsers($("userManageSearch")?.value || "");
    } catch (error) {
      body.innerHTML = '<tr><td colspan="5">' + esc(error.message || "Users could not be loaded.") + '</td></tr>';
    }
  }
  function renderUsers(query="") {
    const body=$("adminUsersTableBody"); if(!body)return;
    const q=String(query).trim().toLowerCase();
    const filtered=users.filter(u=>[u.fullname,u.id,u.role].join(" ").toLowerCase().includes(q));
    body.innerHTML=filtered.length?filtered.map((u,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(u.fullname||"—")+
      '</td><td><code>'+esc(u.id)+'</code></td><td>'+esc(u.created_at?new Date(u.created_at).toLocaleDateString():"—")+
      '</td><td>'+esc(u.role)+'</td></tr>').join(""):'<tr><td colspan="5">No matching user profiles found.</td></tr>';
  }
  window.filterUsersList=value=>renderUsers(value);

  async function loadDashboard() {
    try {
      await requireAdmin();
      const [contentRes,profileRes,eventRes,requestRes,songRes,donationRes]=await Promise.all([
        db.from("vh_content").select("id,content_type,title,created_at").eq("published",true),
        db.from("profiles").select("id,role"),
        db.from("vh_analytics_events").select("id",{count:"exact",head:true}),
        db.from("vh_requests").select("id",{count:"exact",head:true}),
        db.from("vh_songs").select("id",{count:"exact",head:true}).eq("is_published",true),
        db.from("vh_donations").select("id",{count:"exact",head:true}).eq("status","pending")
      ]);
      if(contentRes.error)throw contentRes.error;
      if(profileRes.error)throw profileRes.error;
      const items=contentRes.data||[],people=profileRes.data||[];
      if($("totalMovies"))$("totalMovies").textContent=items.filter(x=>x.content_type==="Movie").length;
      if($("totalSeries"))$("totalSeries").textContent=items.filter(x=>x.content_type==="Web Series").length;
      if($("totalShorts"))$("totalShorts").textContent=items.filter(x=>x.content_type==="Short").length;
      if($("totalSongs"))$("totalSongs").textContent=songRes.error?"—":(songRes.count??0);
      if($("pendingDonations"))$("pendingDonations").textContent=donationRes.error?"—":(donationRes.count??0);
      if($("totalUsers"))$("totalUsers").textContent=people.filter(x=>x.role==="user").length;
      if($("totalViews"))$("totalViews").textContent=eventRes.error?"—":(eventRes.count??0);
      const recent=$("recentMoviesAdmin");
      if(recent)recent.innerHTML=items.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,8)
        .map(x=>'<div class="request-item"><strong>'+esc(x.title)+'</strong><small>'+esc(x.content_type)+' · '+esc(new Date(x.created_at).toLocaleDateString())+'</small></div>').join("")||"<p>No published content yet.</p>";
      const requestStat=$("adminRequestCount");
      if(requestStat)requestStat.textContent=requestRes.error?"—":(requestRes.count??0);
    } catch(error) {
      console.warn("Dashboard data unavailable:",error);
      if($("recentMoviesAdmin"))$("recentMoviesAdmin").textContent=error.message||"Dashboard data unavailable.";
    }
  }

  async function loadReports() {
    try {
      await requireAdmin();
      const [eventsRes, contentRes] = await Promise.all([
        db.from("vh_analytics_events").select("event_type,content_id,created_at").order("created_at", {ascending:false}).limit(5000),
        db.from("vh_content").select("id,title,genre,content_type")
      ]);
      if (eventsRes.error) throw eventsRes.error;
      if (contentRes.error) throw contentRes.error;
      const events = eventsRes.data || [];
      const catalog = new Map((contentRes.data || []).map(item => [Number(item.id), item]));
      const countByContent = (type) => {
        const counts = new Map();
        events.filter(event => event.event_type === type && event.content_id != null).forEach(event => {
          const id = Number(event.content_id);
          counts.set(id, (counts.get(id) || 0) + 1);
        });
        return [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0,10)
          .map(([id,count]) => ({item:catalog.get(id),count})).filter(x => x.item);
      };
      const renderRanked = (hostId, rows, empty) => {
        const host = $(hostId); if (!host) return;
        host.innerHTML = rows.length ? rows.map((row,index) =>
          '<div class="request-item"><strong>' + (index+1) + '. ' + esc(row.item.title) +
          '</strong><small>' + esc(row.item.content_type) + ' · ' + row.count + ' events</small></div>'
        ).join("") : '<p>' + empty + '</p>';
      };
      renderRanked("topViewedList", countByContent("content_view"), "No content views recorded yet.");
      renderRanked("topDownloadedList", countByContent("download_click"), "No download-link clicks recorded yet.");
      const genreCounts = new Map();
      events.filter(event => event.event_type === "content_view" && event.content_id != null).forEach(event => {
        const item = catalog.get(Number(event.content_id));
        if (item) {
          const genre = item.genre || "Uncategorised";
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }
      });
      const genreHost = $("genreChart");
      if (genreHost) {
        const genres = [...genreCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0,8);
        genreHost.innerHTML = genres.length ? genres.map(([name,count]) =>
          '<div class="request-item"><strong>' + esc(name) + '</strong><small>' + count + ' content views</small></div>'
        ).join("") : "<p>No genre activity recorded yet.</p>";
      }
      const monthCounts = new Map();
      events.forEach(event => {
        const date = new Date(event.created_at);
        if (!Number.isNaN(date.getTime())) {
          const key = date.toLocaleString(undefined,{month:"short",year:"numeric"});
          monthCounts.set(key,(monthCounts.get(key)||0)+1);
        }
      });
      const monthHost = $("monthlyChart");
      if (monthHost) {
        const months = [...monthCounts.entries()].slice(0,12).reverse();
        monthHost.innerHTML = months.length ? months.map(([name,count]) =>
          '<div class="request-item"><strong>' + esc(name) + '</strong><small>' + count + ' tracked events</small></div>'
        ).join("") : "<p>No monthly activity recorded yet.</p>";
      }
    } catch (error) {
      console.warn("Reports unavailable:", error);
      ["topViewedList","topDownloadedList","genreChart","monthlyChart"].forEach(id => {
        const host = $(id); if (host) host.textContent = error.message || "Reports unavailable.";
      });
    }
  }

  async function loadCategories() {
    const host=$("categoriesList"); if(!host)return;
    try {
      await requireAdmin();
      const {data,error}=await db.from("vh_categories").select("*").order("name");
      if(error)throw error;
      host.innerHTML=(data||[]).length?(data||[]).map(x=>'<div class="manage-item" style="display:flex;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid var(--border)"><span><strong>'+esc(x.name)+'</strong><small style="display:block">'+esc(x.description||"")+'</small></span><button type="button" class="btn-delete" onclick="deleteCategory('+Number(x.id)+')">Delete</button></div>').join(""):"<p>No categories added.</p>";
    } catch(e){host.textContent=e.message||"Categories unavailable.";}
  }
  window.addCategory=async event=>{
    const form=event?.currentTarget;event?.preventDefault();const name=$("catName")?.value.trim();const description=$("catDesc")?.value.trim()||null;
    if(!name)return toast("Category name is required.");
    const button=event?.currentTarget?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{const user=await requireAdmin();const {error}=await db.from("vh_categories").insert({name,description});if(error)throw error;
      form?.reset();toast("Category saved.");await loadCategories();document.dispatchEvent(new Event("BunnyHub:categories-updated"));}
    catch(e){toast(e.message||"Category could not be saved.");}finally{if(button)button.disabled=false;}
  };
  window.deleteCategory=async id=>{
    if(!window.confirm("Delete this category?"))return;
    try{await requireAdmin();const {error}=await db.from("vh_categories").delete().eq("id",id);if(error)throw error;toast("Category deleted.");await loadCategories();document.dispatchEvent(new Event("BunnyHub:categories-updated"));}
    catch(e){toast(e.message||"Delete failed.");}
  };

  async function loadSongs(){
    const host=$("songsList");if(!host)return;
    try{await requireAdmin();const {data,error}=await db.from("vh_songs").select("*").order("created_at",{ascending:false});if(error)throw error;
      host.innerHTML=(data||[]).length?(data||[]).map(x=>'<div class="manage-item" style="display:flex;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid var(--border)"><span><strong>'+esc(x.title)+'</strong><small style="display:block">'+esc(x.artist||"")+' · '+(x.is_published?"Published":"Draft")+' · '+esc(x.storage_path?"Private "+String(x.storage_provider||"").toUpperCase():"Direct audio URL")+'</small></span><button type="button" class="btn-delete" onclick="deleteSong('+Number(x.id)+')">Delete</button></div>').join(""):"<p>No songs added.</p>";
    }catch(e){host.textContent=e.message||"Songs unavailable.";}
  }
  window.addSong=async event=>{
    const form=event?.currentTarget;event?.preventDefault();
    const title=$("songTitle")?.value.trim(),artist=$("songArtist")?.value.trim(),directAudio=$("songFileUrl")?.value.trim()||"",file=$("songAudioFile")?.files?.[0]||null,poster=$("songPoster")?.value.trim()||"";
    if(!title||(!file&&!directAudio))return toast("Enter a song title and either upload an audio file or provide a direct HTTPS audio URL.");
    if(file&&directAudio)return toast("Choose either an audio file upload or a direct audio URL, not both.");
    let posterUrl=null;
    try{if(poster){posterUrl=new URL(poster);if(posterUrl.protocol!=="https:"||posterUrl.username||posterUrl.password)throw new Error();}}catch(_){return toast("Poster must be a valid HTTPS URL.");}
    let directUrl=null;
    if(directAudio){try{directUrl=new URL(directAudio);if(directUrl.protocol!=="https:"||directUrl.username||directUrl.password)throw new Error();}catch(_){return toast("Audio URL must be a valid HTTPS URL.");}}
    if(file&&(file.size<=0||file.size>1024*1024*1024))return toast("Choose a valid audio file up to 1 GB.");
    const button=form?.querySelector('[type="submit"]');if(button)button.disabled=true;
    const status=$("songUploadStatus"),setStatus=message=>{if(status)status.textContent=message;};
    setStatus(file?"Preparing secure audio upload…":"Saving song link…");
    let uploaded=null,sessionToken="";
    try{
      const user=await requireAdmin();
      const {data:{session},error:sessionError}=await db.auth.getSession();
      if(sessionError||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
      sessionToken=session.access_token;
      let audioUrl=directUrl?.href||"",storageProvider="direct",storagePath=null;
      if(file){
        storageProvider=$("songStorageProvider")?.value||"backblaze_b2";
        if(!["backblaze_b2","cloudflare_r2"].includes(storageProvider))throw new Error("Choose Backblaze B2 or Cloudflare R2 for private audio uploads.");
        const extension=file.name.split(".").pop()?.toLowerCase()||"";
        const allowedAudioTypes=["audio/mpeg","audio/mp4","audio/aac","audio/ogg","audio/wav","audio/x-wav","audio/flac","audio/x-flac","audio/webm","audio/opus"];
        const inferred={"mp3":"audio/mpeg","mpga":"audio/mpeg","m4a":"audio/mp4","m4b":"audio/mp4","aac":"audio/aac","ogg":"audio/ogg","oga":"audio/ogg","opus":"audio/opus","wav":"audio/wav","flac":"audio/flac","webm":"audio/webm","weba":"audio/webm"};
        const reportedType=String(file.type||"").trim().toLowerCase();
        const contentType=allowedAudioTypes.includes(reportedType)?reportedType:(inferred[extension]||"");
        if(!allowedAudioTypes.includes(contentType))throw new Error("Use an MP3, M4A, AAC, OGG, WAV, FLAC or supported WebM audio file.");
        const signedResponse=await fetch("/api/media/upload-url",{method:"POST",headers:{"Authorization":"Bearer "+sessionToken,"Content-Type":"application/json"},body:JSON.stringify({provider:storageProvider,kind:"audio",contentType,fileName:file.name,fileSize:file.size})});
        const signed=await signedResponse.json().catch(()=>({}));
        if(!signedResponse.ok)throw new Error(signed.error||"Could not prepare secure audio upload.");
        setStatus("Uploading audio file to "+storageProvider.replace("_"," ")+"…");
        const uploadResponse=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers||{"Content-Type":contentType},body:file});
        if(!uploadResponse.ok)throw new Error("Audio upload to cloud storage failed.");
        uploaded={provider:storageProvider,path:signed.key};
        storagePath=signed.key;audioUrl="private://"+signed.key;
      }
      setStatus("Saving song details…");
      const songRow={title,artist,audio_url:audioUrl,poster_url:posterUrl?.href||null,storage_provider:storageProvider,storage_path:storagePath,is_published:true,created_by:user.id};
      let {error}=await db.from("vh_songs").insert(songRow);
      if(error&&!file&&/storage_provider|storage_path|column/i.test(error.message||"")){
        const legacy={title,artist,audio_url:audioUrl,poster_url:posterUrl?.href||null,is_published:true,created_by:user.id};
        const retry=await db.from("vh_songs").insert(legacy);error=retry.error;
      }
      if(error&&file&&/storage_provider|storage_path|column/i.test(error.message||""))throw new Error("Apply supabase/bunnyhub-song-storage.sql (or the feature upgrade bundle) before uploading private song audio.");
      if(error)throw error;
      form?.reset();setStatus(file?"Song uploaded and published.":"Song added to the public music library.");toast(file?"Song uploaded to private cloud storage.":"Song added.");
      await loadSongs();await window.refreshSongLibrary?.();
    }catch(error){
      if(uploaded&&sessionToken){
        try{await fetch("/api/media/delete",{method:"POST",headers:{"Authorization":"Bearer "+sessionToken,"Content-Type":"application/json"},body:JSON.stringify({provider:uploaded.provider,storagePath:uploaded.path})});}catch(_){}
      }
      setStatus(error.message||"Song could not be added.");
      toast(error.message||"Song could not be added.");
    }finally{if(button)button.disabled=false;}
  };
  window.deleteSong=async id=>{
    if(!window.confirm("Delete this song and its private audio file (if uploaded)?"))return;
    try{
      await requireAdmin();
      const {data:{session},error:sessionError}=await db.auth.getSession();
      if(sessionError||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
      const response=await fetch("/api/song/delete",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({songId:id})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){
        if(/storage_provider|storage_path|column/i.test(result.error||"")){
          const legacyDelete=await db.from("vh_songs").delete().eq("id",id);
          if(legacyDelete.error)throw legacyDelete.error;
        }else throw new Error(result.error||"Song deletion failed.");
      }
      toast("Song and stored audio deleted.");await loadSongs();await window.refreshSongLibrary?.();
    }catch(error){toast(error.message||"Delete failed.");}
  };

  window.saveWebsiteSettings=async event=>{
    event?.preventDefault();
    const button=event?.currentTarget?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{
      const user=await requireAdmin();
      const settings={
        site_name:$("settingSiteName")?.value.trim()||"BunnyHub",
        telegram_url:$("settingTelegram")?.value.trim()||"",
        seo_description:$("settingSeo")?.value.trim()||"",
        maintenance_mode:$("settingMaintenance")?.value||"off",
        donation_upi_id:$("settingDonationUpi")?.value.trim()||"",
        donation_display_name:$("settingDonationName")?.value.trim()||"BunnyHub",
        donation_qr_url:$("settingDonationQr")?.value.trim()||"",
        ads_enabled:$("settingAdsEnabled")?.value||"off",
        adsense_publisher_id:$("settingAdsPublisher")?.value.trim()||"",
        adsense_slot_home:$("settingAdsSlotHome")?.value.trim()||"",
        adsense_slot_footer:$("settingAdsSlotFooter")?.value.trim()||""
      };
      const vpa=settings.donation_upi_id;
      if(vpa&&!/^[A-Za-z0-9._-]{2,128}@[A-Za-z0-9.-]{2,64}$/.test(vpa))throw new Error("Enter a valid UPI ID (example: name@upi).");
      if(settings.donation_qr_url){let qr;try{qr=new URL(settings.donation_qr_url);}catch(_){throw new Error("Donation QR must be a valid HTTPS image URL.");}if(qr.protocol!=="https:"||qr.username||qr.password)throw new Error("Donation QR must use a public HTTPS URL.");}
      const publisher=settings.adsense_publisher_id;
      const homeSlot=settings.adsense_slot_home,footerSlot=settings.adsense_slot_footer;
      if(publisher&&!/^ca-pub-\d{10,20}$/.test(publisher))throw new Error("AdSense Publisher ID must look like ca-pub-1234567890123456.");
      if((homeSlot&&!/^\d{6,20}$/.test(homeSlot))||(footerSlot&&!/^\d{6,20}$/.test(footerSlot)))throw new Error("AdSense ad slot IDs must be numeric.");
      if(settings.ads_enabled==="on"&&(!/^ca-pub-\d{10,20}$/.test(publisher)||(!homeSlot&&!footerSlot)))throw new Error("To enable ads, enter a valid publisher ID and at least one ad slot ID.");
      const rows=Object.entries(settings).map(([setting_key,setting_value])=>({setting_key,setting_value,updated_by:user.id,updated_at:new Date().toISOString()}));
      const {error}=await db.from("vh_site_settings").upsert(rows,{onConflict:"setting_key"});if(error)throw error;
      window.dispatchEvent(new CustomEvent("vh:site-settings-updated", {detail:settings}));
      toast("Website settings saved and public site updated.");
    }catch(e){toast(e.message||"Settings could not be saved.");}finally{if(button)button.disabled=false;}
  };
  async function loadWebsiteSettings(){
    try{await requireAdmin();const {data,error}=await db.from("vh_site_settings").select("setting_key,setting_value");if(error)throw error;
      const map=Object.fromEntries((data||[]).map(x=>[x.setting_key,x.setting_value]));
      if($("settingSiteName")&&map.site_name)$("settingSiteName").value=map.site_name;
      if($("settingTelegram")&&map.telegram_url)$("settingTelegram").value=map.telegram_url;
      if($("settingSeo")&&map.seo_description)$("settingSeo").value=map.seo_description;
      if($("settingMaintenance")&&map.maintenance_mode)$("settingMaintenance").value=map.maintenance_mode;
      if($("settingDonationUpi"))$("settingDonationUpi").value=map.donation_upi_id||"";
      if($("settingDonationName"))$("settingDonationName").value=map.donation_display_name||"BunnyHub";
      if($("settingDonationQr"))$("settingDonationQr").value=map.donation_qr_url||"";
      if($("settingAdsEnabled"))$("settingAdsEnabled").value=map.ads_enabled||"off";
      if($("settingAdsPublisher"))$("settingAdsPublisher").value=map.adsense_publisher_id||"";
      if($("settingAdsSlotHome"))$("settingAdsSlotHome").value=map.adsense_slot_home||"";
      if($("settingAdsSlotFooter"))$("settingAdsSlotFooter").value=map.adsense_slot_footer||"";
    }catch(e){console.warn("Site settings not loaded:",e.message);}
  }

  async function loadDonations(){
    const host=$("adminDonationsList");if(!host)return;
    try{
      await requireAdmin();
      const {data,error}=await db.from("vh_donations").select("id,donor_name,amount,currency,payment_reference,status,created_at").order("created_at",{ascending:false}).limit(100);
      if(error)throw error;
      host.innerHTML=(data||[]).length?(data||[]).map(item=>
        '<article class="vh-donation-row"><div><strong>'+esc(item.donor_name)+'</strong><small>₹'+Number(item.amount).toLocaleString("en-IN")+' · '+esc(item.payment_reference)+'</small><small>'+esc(new Date(item.created_at).toLocaleString())+' · '+esc(item.status)+'</small></div><div class="vh-donation-actions">'+
        (item.status!=="verified"?'<button type="button" class="btn-primary" onclick="reviewDonation('+Number(item.id)+',\'verified\')">Verify</button>':'<span class="vh-donation-verified">Verified</span>')+
        (item.status!=="rejected"?'<button type="button" class="btn-delete" onclick="reviewDonation('+Number(item.id)+',\'rejected\')">Reject</button>':'')+
        '</div></article>'
      ).join(""):"<p>No donation confirmations submitted yet.</p>";
    }catch(error){host.textContent=error.message||"Donation records could not be loaded. Run the donation SQL migration first.";}
  }
  window.reviewDonation=async(id,status)=>{
    if(!["verified","rejected"].includes(status))return;
    if(status==="verified"&&!window.confirm("Have you checked this UPI reference against your bank/payment statement?"))return;
    try{
      const user=await requireAdmin();
      const {error}=await db.from("vh_donations").update({
        status,verified_at:status==="verified"?new Date().toISOString():null,
        verified_by:status==="verified"?user.id:null
      }).eq("id",id);
      if(error)throw error;
      toast(status==="verified"?"Donation marked as verified.":"Donation marked as rejected.");
      await loadDonations();
    }catch(error){toast(error.message||"Donation status could not be updated.");}
  };

  window.setupTelegramBotWebhook=async()=>{
    const status=$("telegramBotSetupStatus");if(status)status.textContent="Connecting Telegram webhook…";
    try{
      await requireAdmin();
      const {data:{session},error}=await db.auth.getSession();
      if(error||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
      const response=await fetch("/api/telegram/setup-webhook",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token}});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Telegram webhook setup failed.");
      if(status)status.textContent="Connected. Webhook: "+result.webhookUrl;
      toast("Telegram bot webhook connected.");
    }catch(error){if(status)status.textContent=error.message||"Telegram bot connection failed.";toast(error.message||"Telegram bot connection failed.");}
  };

  window.loadAdSenseRevenue=async()=>{
    const host=$("adsenseRevenueList");if(!host)return;
    host.textContent="Loading secure AdSense report…";
    try{
      await requireAdmin();
      const {data:{session},error}=await db.auth.getSession();
      if(error||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
      const range=$("adsenseRange")?.value||"LAST_7_DAYS";
      const response=await fetch("/api/adsense/report?range="+encodeURIComponent(range),{headers:{"Authorization":"Bearer "+session.access_token}});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"AdSense report unavailable.");
      const headers=result.headers||[],rows=result.rows||[];
      if(!headers.length||!rows.length){host.textContent="No AdSense report data is available for the last 7 days yet.";return;}
      const names=headers.map(item=>item.name||"");
      const index=key=>names.indexOf(key);
      const money=value=>"₹"+(Number(value)||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
      const body=rows.map(row=>{const cells=row.cells||[];return '<tr>'+names.map((name,i)=>'<td>'+esc(name==="ESTIMATED_EARNINGS"||name==="PAGE_VIEWS_RPM"?money(cells[i]?.value):cells[i]?.value??"—")+'</td>').join("")+'</tr>';}).join("");
      host.innerHTML='<div class="vh-adsense-summary"><strong>'+esc((result.dateRange||range).replaceAll("_"," "))+'</strong><span>Estimated earnings: '+money((result.totals?.cells||[])[index("ESTIMATED_EARNINGS")]?.value||0)+'</span></div><div class="vh-adsense-table-wrap"><table class="vh-adsense-table"><thead><tr>'+names.map(name=>'<th>'+esc(name.replaceAll("_"," "))+'</th>').join("")+'</tr></thead><tbody>'+body+'</tbody></table></div><small>Estimated earnings may be adjusted by Google for invalid traffic and finalisation.</small>';
    }catch(error){host.textContent=error.message||"AdSense report could not be loaded.";}
  };

  async function loadFeedbackAdmin(){
    const host=$("adminFeedbackList");if(!host)return;
    try{
      await requireAdmin();
      const {data,error}=await db.from("vh_feedback").select("id,category,title,description,status,admin_response,upvotes,created_at").order("created_at",{ascending:false}).limit(100);
      if(error)throw error;
      host.innerHTML=(data||[]).length?(data||[]).map(item=>'<article class="vh-admin-feedback"><div><strong>'+esc(item.title)+'</strong><small>'+esc(item.category)+' · '+Number(item.upvotes||0)+' votes · '+esc(new Date(item.created_at).toLocaleString())+'</small><p>'+esc(item.description)+'</p></div><div class="form-row"><label>Status<select id="feedbackStatus'+Number(item.id)+'"><option value="pending">Pending</option><option value="under_review">Under review</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="declined">Declined</option></select></label><label>Admin response<textarea id="feedbackResponse'+Number(item.id)+'" rows="2">'+esc(item.admin_response||"")+'</textarea></label><button type="button" class="btn-primary" onclick="saveFeedbackReview('+Number(item.id)+')">Save review</button></div></article>'
      ).join(""):"<p>No feedback has been submitted.</p>";
      (data||[]).forEach(item=>{const select=$("feedbackStatus"+item.id);if(select)select.value=item.status;});
    }catch(error){host.textContent=error.message||"Feedback could not be loaded. Apply the feature upgrade SQL first.";}
  }
  window.saveFeedbackReview=async id=>{
    const status=$("feedbackStatus"+id)?.value||"pending";
    const response=$("feedbackResponse"+id)?.value.trim()||"";
    try{
      await requireAdmin();
      const {error}=await db.from("vh_feedback").update({status,admin_response:response,updated_at:new Date().toISOString()}).eq("id",id);
      if(error)throw error;
      toast("Community feedback review saved.");
      await loadFeedbackAdmin();
    }catch(error){toast(error.message||"Feedback review could not be saved.");}
  };

  window.updateAdminCredentials=async event=>{
    const form=event?.currentTarget;event?.preventDefault();const current=$("changeCurrPass")?.value||"",next=$("changeNewPass")?.value||"",confirm=$("changeConfirmPass")?.value||"";
    if(next.length<12)return toast("New password must be at least 12 characters.");
    if(next!==confirm)return toast("New password and confirmation do not match.");
    const button=event?.currentTarget?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{const user=await requireAdmin();if(!user.email)throw new Error("Admin email unavailable; use Supabase password reset.");
      const {error:reauthError}=await db.auth.signInWithPassword({email:user.email,password:current});if(reauthError)throw new Error("Current password is incorrect.");
      const {error:updateError}=await db.auth.updateUser({password:next});if(updateError)throw updateError;form?.reset();toast("Admin password updated.");
    }catch(e){toast(e.message||"Password update failed.");}finally{if(button)button.disabled=false;}
  };

  async function teamRequest(method="GET",body=null) {
    const {data:{session},error}=await db.auth.getSession();
    if(error||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
    const response=await fetch("/api/admin/subadmins",{
      method,headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||"Staff management request failed.");
    return result;
  }
  async function loadSubAdmins() {
    const host=$("subAdminsList");if(!host)return;
    try {
      await requireAdmin();
      const result=await teamRequest("GET");
      host.innerHTML=result.team?.length?result.team.map(member=>
        '<article class="request-item" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">'+
        '<span><strong>'+esc(member.fullname||"Staff member")+'</strong><small>'+esc(String(member.role||"").replaceAll("_"," "))+' · '+esc(member.created_at?new Date(member.created_at).toLocaleDateString():"")+'</small></span>'+
        '<button type="button" class="btn-delete" onclick="revokeSubAdmin(\''+esc(member.id)+'\')">Revoke staff access</button></article>'
      ).join(""):"<p>No staff accounts have been created.</p>";
    } catch(error) { host.textContent=error.message||"Staff list unavailable."; }
  }
  window.addSubAdmin=async event=>{
    event?.preventDefault();
    const form=event?.currentTarget;
    const name=$("subName")?.value.trim();
    const email=$("subEmail")?.value.trim().toLowerCase();
    const password=$("subPassword")?.value||"";
    const role=$("subRole")?.value||"";
    const button=form?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try {
      if(!name||!email)throw new Error("Staff name and email are required.");
      if(password.length<12)throw new Error("Use a password with at least 12 characters.");
      const result=await teamRequest("POST",{name,email,password,role});
      form.reset();
      toast("Staff account created with "+role.replaceAll("_"," ")+" permissions.");
      await loadSubAdmins();
    } catch(error) { toast(error.message||"Staff account could not be created."); }
    finally { if(button)button.disabled=false; }
  };
  window.revokeSubAdmin=async userId=>{
    if(!window.confirm("Remove this staff member's BunnyHub permissions? The sign-in account will remain active as a normal user."))return;
    try{await teamRequest("DELETE",{userId});toast("Staff permissions revoked.");await loadSubAdmins();}
    catch(error){toast(error.message||"Could not revoke staff permissions.");}
  };
  window.importFromDrive=async()=>{
    const log=$("driveImportLog"),link=$("driveLink")?.value.trim()||"",title=$("driveName")?.value.trim()||"",contentType=$("driveType")?.value||"Movie";
    const button=document.querySelector('#tab-drive-import button[onclick="importFromDrive()"]');
    if(!link||!title){if(log)log.textContent="Enter a Google Drive file link and a catalog title.";return;}
    if(button)button.disabled=true;if(log)log.textContent="Verifying public Drive video and adding it to the catalog…";
    try{
      await requireAdmin();
      const {data:{session},error}=await db.auth.getSession();
      if(error||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
      const response=await fetch("/api/drive/import",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({driveUrl:link,title,contentType})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Google Drive import failed.");
      await window.refreshBunnyHubCatalog?.();
      try{await fetch("/api/telegram/notify-publish",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({contentId:result.contentId})});}catch(_){}
      if(log)log.textContent="Imported successfully: "+result.title+". Google Drive preview and direct download links are attached. The original Drive file is not copied into B2.";
      $("driveLink").value="";
      toast("Google Drive video added to BunnyHub.");
    }catch(error){
      if(log)log.textContent=error.message||"Google Drive import failed.";
      toast(error.message||"Google Drive import failed.");
    }finally{if(button)button.disabled=false;}
  };

  document.addEventListener("DOMContentLoaded",()=>{
    const watchers=[["tab-users-admin",loadUsers],["tab-team-admin",loadSubAdmins],["tab-dashboard",loadDashboard],["tab-reports",loadReports],["tab-categories",loadCategories],["tab-songs",loadSongs],["tab-settings",()=>{loadWebsiteSettings();loadDonations();}],["tab-community-admin",loadFeedbackAdmin]];
    watchers.forEach(([id,fn])=>{const el=$(id);if(el)new MutationObserver(()=>{if(el.classList.contains("active"))fn();}).observe(el,{attributes:true,attributeFilter:["class"]});});
    db?.auth.onAuthStateChange((_event,session)=>{if(session?.user){loadDashboard();if($("tab-users-admin")?.classList.contains("active"))loadUsers();}});
    if(window.VH_IS_ADMIN)loadDashboard();
  });
})();
