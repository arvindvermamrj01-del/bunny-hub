/* Supabase publishing, private media assets, quality-aware playback. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) { console.error("BunnyHub: Supabase client is unavailable; publishing is disabled."); return; }
  const PRIVATE_BUCKET = "vh-private-media";
  const $ = id => document.getElementById(id);
  const originalOpenMovie = window.openMovie;
  let activeItem = null;
  let activeVideo = null;
  let lastProgressSave = 0;
  let activeProgressContentId = null;

  const toast = message => typeof window.toast === "function" ? window.toast(message) : window.alert(message);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const slug = value => String(value || "media").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-100) || "media";
  const qualityOrder = ["180p","240p","360p","420p","480p","720p","1080p","2k","4k","8k","original"];
  const resolutionLabel=value=>!value||String(value).toLowerCase()==="original"?"Original":String(value).replace(/^(\d)k$/i,"$1K");
  const staffRoles = ["admin","sub_admin","content_editor"];
  const googleDriveFileId = value => {
    const raw=String(value||"").trim();
    if(/^[A-Za-z0-9_-]{10,}$/.test(raw))return raw;
    try{
      const url=new URL(raw);
      if(!["drive.google.com","docs.google.com"].includes(url.hostname.toLowerCase()))return "";
      return url.pathname.match(new RegExp("/file/d/([A-Za-z0-9_-]{10,})"))?.[1]||url.searchParams.get("id")||"";
    }catch(_){return "";}
  };
  const validHttpUrl = raw => { if(!raw)return null; let url; try{url=new URL(raw);}catch(_){throw new Error("Media URL valid nahi hai.");} if(!["http:","https:"].includes(url.protocol))throw new Error("Media URL http/https hona chahiye."); return url.href; };
  const dbResolution = value => !value || String(value).toLowerCase() === "original" ? "original" : String(value).toLowerCase();
  const pixeldrainId = raw => {
    let parsed;try{parsed=new URL(String(raw||""));}catch(_){return "";}
    if(!["pixeldrain.com","www.pixeldrain.com"].includes(parsed.hostname.toLowerCase()))return "";
    return parsed.pathname.match(/^\/(?:u|api\/file)\/([A-Za-z0-9_-]{4,64})(?:\/|$)/)?.[1]||"";
  };
  const pixeldrainDirectUrl = raw => {
    const id=pixeldrainId(raw);
    if(!id)throw new Error("PixelDrain share URL valid nahi hai. pixeldrain.com/u/FILE_ID paste karein.");
    return "https://pixeldrain.com/api/file/"+encodeURIComponent(id);
  };
  const storedProvider = provider => provider==="pixeldrain"?"direct":provider;

  async function requireAdmin() {
    const {data:{user},error} = await db.auth.getUser();
    if (error || !user) throw new Error("Pehle Admin account se login karein.");
    const {data:profile,error:profileError} = await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!staffRoles.includes(profile?.role)) throw new Error("Admin permission nahi hai.");
    return user;
  }

  async function refreshStorageHealth() {
    const host=$("vhStorageHealth");
    if(!host)return;
    host.textContent="Checking media provider connections…";
    try{
      const response=await fetch("/api/media/status",{cache:"no-store"});
      const status=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(status.error||"Storage status unavailable.");

      let b2Verification=null;
      const {data:{session},error:sessionError}=await db.auth.getSession();
      if(!sessionError&&session?.access_token){
        const verifyResponse=await fetch("/api/media/verify-b2",{
          method:"POST",
          headers:{"Authorization":"Bearer "+session.access_token},
          cache:"no-store"
        });
        b2Verification=await verifyResponse.json().catch(()=>({}));
        if(!verifyResponse.ok)b2Verification.verified=false;
      }

      const entries=[
        ["Backblaze B2",!!b2Verification?.verified,b2Verification?.verified?"Verified":(b2Verification?.stage==="configuration"?"Not configured":"Not verified")],
        ["Cloudflare R2",status.cloudflareR2?.configured,status.cloudflareR2?.configured?"Credentials configured":"Not configured"],
        ["PixelDrain",status.pixelDrain?.configured,status.pixelDrain?.configured?"API key configured":"Not configured"]
      ];
      const lines=entries.map(([label,ready,state])=>'<span class="vh-storage-health-item '+(ready?"is-ready":"is-missing")+'"><i class="fas '+(ready?"fa-circle-check":"fa-circle-xmark")+'"></i><b>'+label+'</b><em>'+state+'</em></span>').join("");
      const service=status.supabase?.serviceRoleConfigured;
      const b2Note=b2Verification?.message||b2Verification?.error||"B2 live access was not verified. Sign in to the Admin panel and reload this section.";
      const safe=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
      const providerDetails=b2Verification&&!b2Verification.verified?[
        b2Verification.httpStatus?"HTTP status: "+b2Verification.httpStatus:"",
        b2Verification.providerCode?"Provider code: "+b2Verification.providerCode:"",
        b2Verification.providerMessage?"Provider message: "+b2Verification.providerMessage:"",
        b2Verification.requestId?"Request ID: "+b2Verification.requestId:""
      ].filter(Boolean):[];
      host.innerHTML='<div class="vh-storage-health-grid">'+lines+'</div><p class="vh-storage-health-note">'+
        safe(b2Note)+" "+
        (service?"Private media signing is configured.":"Supabase service-role key is missing. Private video playback, deletion and signed downloads cannot work until it is set as a Cloudflare Pages secret.")+
        (providerDetails.length?'<br><b>B2 provider diagnostics:</b><br>'+providerDetails.map(safe).join("<br>"):"")+
        '</p>';
    }catch(error){
      host.textContent="Storage status could not be checked: "+(error.message||"Unknown error");
    }
  }

  function ensureQualityFields() {
    const form = document.querySelector("#tab-add-movie form");
    if (!form || $("vhQualityUploads")) return;
    const block = document.createElement("section");
    block.id = "vhQualityUploads";
    block.className = "vh-quality-upload-panel";
    block.innerHTML = '<h3>Video qualities & alternate links</h3><p>Upload only qualities that actually exist. Do not label an upscaled file as native 4K/8K.</p><div class="vh-quality-grid">' +
      qualityOrder.map(q => '<label class="vh-quality-field"><span>'+q+' file</span><input type="file" accept="video/*" data-vh-quality-file="'+q+'"></label>').join("") +
      '</div><div class="vh-quality-links">' +
      [["180p","addDl180"],["240p","addDl240"],["420p","addDl420"],["480p","addDl480"],["720p","addDl720"],["1080p","addDl1080"],["2K","addDl2k"],["4K","addDl4k"],["8K","addDl8k"]].map(([q,id]) => '<label class="vh-quality-field"><span>'+q+' authorised link</span><input type="url" id="'+id+'" placeholder="Optional direct media URL"></label>').join("") +
      '</div><label class="vh-quality-field vh-language-field"><span>Source language label (for this video source)</span><input id="vhMediaLanguages" type="text" placeholder="Hindi"></label><label class="vh-quality-field vh-language-field"><span>Subtitle tracks — one per line: Label|language|HTTPS .vtt URL</span><textarea id="vhSubtitleTracks" rows="3" placeholder="Hindi|hi|https://cdn.example.com/subtitles/movie-hi.vtt"></textarea></label>';
    block.innerHTML += '<div class="vh-storage-health" id="vhStorageHealth" role="status" aria-live="polite">Checking media provider connections…</div>';
    const submit = form.querySelector('[type="submit"]');
    form.insertBefore(block, submit || null);
    if (window.VH_SECURE_ADMIN_SESSION_READY) refreshStorageHealth();
  }

  const VIDEO_MIME_BY_EXTENSION = Object.freeze({
    mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime",
    mkv: "video/x-matroska", webm: "video/webm", avi: "video/x-msvideo",
    mpg: "video/mpeg", mpeg: "video/mpeg", mpeg2: "video/mpeg",
    m4p: "video/mp4", m4v: "video/x-m4v", "3gp": "video/3gpp",
    "3g2": "video/3gpp2", ts: "video/mp2t", ogv: "video/ogg",
    wmv: "video/x-ms-wmv", flv: "video/x-flv"
  });

  function videoContentType(file) {
    const reported = String(file?.type || "").trim().toLowerCase();
    if (reported.startsWith("video/")) return reported;
    const extension = String(file?.name || "").split(".").pop().toLowerCase();
    const inferred = VIDEO_MIME_BY_EXTENSION[extension];
    if (inferred) return inferred;
    throw new Error("Browser video format identify nahi kar paaya. MP4, MKV, MOV, WebM, AVI ya supported video format use karein.");
  }

  async function uploadPrivate(file,user,provider) {
    if (!file) return null;
    const contentType = videoContentType(file);
    if (provider === "pixeldrain") {
      const maxBytes=90*1024*1024;
      if(file.size>maxBytes)throw new Error("PixelDrain in-app upload is limited to 90 MiB by the Cloudflare request limit. Upload larger files on PixelDrain first, then paste the share link; use B2/R2 for full-size movie uploads.");
      const {data:{session},error:sessionError}=await db.auth.getSession();
      if(sessionError||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
      const response=await fetch("/api/media/pixeldrain-upload",{
        method:"POST",
        headers:{
          "Authorization":"Bearer "+session.access_token,
          "Content-Type":contentType,
          "X-VH-File-Name":encodeURIComponent(file.name),
          "X-VH-File-Size":String(file.size)
        },
        body:file
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.id)throw new Error(result.error||"PixelDrain upload could not be prepared.");
      return {path:"pixeldrain://"+result.id,file,storage_provider:"direct",external_provider:"pixeldrain",asset_url:result.url};
    }
    if (provider === "cloudflare_r2" || provider === "backblaze_b2") {
      const {data:{session},error:sessionError}=await db.auth.getSession();
      if(sessionError||!session?.access_token)throw new Error("Admin session expired. Sign in again.");
      const response=await fetch("/api/media/upload-url",{
        method:"POST",
        headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
        body:JSON.stringify({contentType,fileName:file.name,fileSize:file.size,provider})
      });
      const signed=await response.json().catch(()=>({}));
      if(!response.ok||!signed.uploadUrl)throw new Error(signed.error||"Cloud storage upload could not be prepared.");
      const uploadResponse=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers||{"Content-Type":contentType},body:file});
      if(!uploadResponse.ok)throw new Error("Cloud storage upload failed with HTTP "+uploadResponse.status+". Check bucket CORS and credentials.");
      return {path:signed.key,file,storage_provider:provider};
    }
    if(provider!=="supabase")throw new Error("Is provider ke liye direct upload connector abhi configure nahi hai. Supabase/R2 upload choose karein ya authorised direct URL dein.");
    const path = user.id + "/" + crypto.randomUUID() + "-" + slug(file.name);
    const {error} = await db.storage.from(PRIVATE_BUCKET).upload(path,file,{upsert:false,contentType,cacheControl:"3600"});
    if (error) throw error;
    return {path,file,storage_provider:"supabase"};
  }

  async function signedAsset(asset, downloadName = "") {
    const provider = String(asset.storage_provider || "supabase").toLowerCase();
    const path = asset.storage_path || asset.video_url || "";
    if (!path) return null;
    if(provider==="direct"&&String(path).startsWith("pixeldrain://")){
      const id=String(path).slice("pixeldrain://".length);
      return /^[A-Za-z0-9_-]{4,64}$/.test(id)?"https://pixeldrain.com/api/file/"+encodeURIComponent(id):null;
    }
    if(provider==="google_drive"){
      const id=googleDriveFileId(asset.storage_path||asset.asset_url||path);
      return id?"https://drive.google.com/uc?export=download&id="+encodeURIComponent(id):(validHttpUrl(asset.asset_url||path)||null);
    }
    if (["supabase","cloudflare_r2","backblaze_b2"].includes(provider) && !/^https?:\/\//i.test(path)) {
      try {
        const response=await fetch("/api/media/access",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({contentId:asset.content_id,storagePath:path,provider,downloadName})
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok||!result.url)throw new Error(result.error||"Private media URL could not be signed.");
        return result.url;
      } catch(error) {
        console.warn("Secure media URL unavailable:",error.message);
        return null;
      }
    }
    return path;
  }

  function addToCatalog(row,assets=[]) {
    const mappedAssets = (assets || []).map(asset => ({...asset,url:asset.resolved_url || asset.url || null}));
    const primary = mappedAssets.find(asset => asset.is_primary) || mappedAssets[0];
    const item = {
      id: row.id, isSupabaseContent:true, title:row.title, type:row.content_type, created_at:row.created_at||null, parent_series_id:row.parent_series_id||null, season_number:row.season_number||null, episode_number:row.episode_number||null,
      industry:row.industry || "All", genre:row.genre || "Uncategorised",
      year:row.release_year || "", rating:row.rating ?? "", language:row.language || "",
      duration:row.duration || "", poster:row.poster_url || "", backdrop:row.poster_url || "",
      description:row.description || "", cast:row.cast || "", director:row.director || "", screenshots:Array.isArray(row.screenshots)?row.screenshots:(typeof row.screenshots==="string"?row.screenshots.split(",").map(x=>x.trim()).filter(Boolean):[]), trailer:row.trailer_url || "", telegram_url:row.telegram_url || "",
      video_url:primary?.url || (String(row.video_url||"").startsWith("private://") ? "" : row.video_url),
      media_assets:mappedAssets, subtitle_tracks:Array.isArray(row.subtitle_tracks)?row.subtitle_tracks:[], is_featured:row.is_featured===true, storage_provider:row.storage_provider||primary?.storage_provider||"supabase", is_short:row.content_type === "Short"
    };
    const list=window.BUNNY_HUB_DATA || (window.BUNNY_HUB_DATA=[]);
    const index=list.findIndex(item=>String(item.id)===String(row.id));
    if(index>=0)list[index]=item;else list.unshift(item);
  }

  async function loadUserWatchProgress() {
    try {
      const {data:{user}}=await db.auth.getUser();
      if(!user)return;
      const {data,error}=await db.from("vh_watch_progress").select("content_id,position_seconds").eq("user_id",user.id);
      if(error)throw error;
      window.VH_ACCOUNT_DATA?.migrateLegacy(user.id);
      (data||[]).forEach(row=>window.VH_ACCOUNT_DATA?.setProgress(row.content_id,row.position_seconds,user.id));
    } catch(error) {
      console.debug("Continue-watching cloud sync unavailable:",error.message);
    }
  }

  async function mapWithConcurrency(items,limit,mapper) {
    const output=new Array(items.length);
    let cursor=0;
    const workerCount=Math.min(Math.max(1,Number(limit)||1),items.length);
    const workers=Array.from({length:workerCount},async()=>{
      while(true){
        const index=cursor++;
        if(index>=items.length)return;
        output[index]=await mapper(items[index],index);
      }
    });
    await Promise.all(workers);
    return output;
  }

  window.refreshBunnyHubCatalog=loadPublished;

  async function loadPublished() {
    const coreColumns="id,title,content_type,video_url,poster_url,genre,language,release_year,rating,description,cast,duration,trailer_url,industry,published,created_at,storage_provider";
    const platformColumns=coreColumns+",telegram_url,is_featured,subtitle_tracks,director,screenshots";
    const episodeColumns=platformColumns+",parent_series_id,season_number,episode_number";
    const optionalColumnError=error=>error&&(/42703|42501|PGRST204/.test(String(error.code||""))||/column .* does not exist|permission denied for (?:column|table)|could not find the .* column/i.test(error.message||""));
    const queryColumns=columns=>db.from("vh_content").select(columns).eq("published",true).order("created_at",{ascending:false});
    let result=await queryColumns(episodeColumns);
    if(optionalColumnError(result.error)){
      console.warn("Episode metadata columns are not available; retrying the platform catalog.",result.error.message);
      result=await queryColumns(platformColumns);
      if(optionalColumnError(result.error)){
        console.warn("Platform metadata columns are not available; retrying the core catalog.",result.error.message);
        result=await queryColumns(coreColumns);
      }
    }
    const {data:rows,error}=result;
    if(error){console.error("Published content load failed:",error);toast("Catalog load failed: "+error.message);return;}
    const ids=(rows||[]).map(row=>row.id).filter(id=>id!=null);
    let assetRows=[];
    if(ids.length){
      const result=await db.from("vh_media_assets").select("*").in("content_id",ids);
      if(result.error) console.warn("Media asset metadata unavailable; falling back to primary video URL:",result.error.message);
      else assetRows=result.data||[];
    }
    // Resolve private links in small parallel batches instead of serial network round-trips.
    const resolvedAssets=await mapWithConcurrency(assetRows,8,async asset=>{
      const url=await signedAsset(asset);
      return url?{...asset,resolved_url:url,url}:null;
    });
    const grouped=new Map();
    for(const asset of resolvedAssets){
      if(!asset)continue;
      const list=grouped.get(String(asset.content_id))||[];
      list.push(asset);
      grouped.set(String(asset.content_id),list);
    }
    // addToCatalog prepends; reverse the descending DB rows so the newest entries remain first.
    (rows||[]).slice().reverse().forEach(row=>addToCatalog(row,grouped.get(String(row.id))||[]));
    await loadUserWatchProgress();
    window.renderBunnyHub?.();
    renderManageList($("manageSearch")?.value||"");
    document.dispatchEvent(new CustomEvent("BunnyHub:content-loaded"));
  }

  function ensureEditModal() {
    if ($("vhEditContentModal")) return;
    const modal=document.createElement("div");
    modal.id="vhEditContentModal";
    modal.className="vh-edit-modal";
    modal.innerHTML='<section class="vh-edit-panel" role="dialog" aria-modal="true" aria-labelledby="vhEditHeading"><button type="button" class="vh-edit-close" data-vh-edit-close aria-label="Close">×</button><h2 id="vhEditHeading">Edit published content</h2><p>Update movie details. Existing video uploads and quality links will remain untouched.</p><form id="vhEditContentForm"><div class="vh-edit-grid"><label>Title *<input name="title" required maxlength="250"></label><label>Release year<input name="release_year" type="number" min="1888" max="2100"></label><label>Genre<input name="genre"></label><label>Language<input name="language"></label><label>Industry<select name="industry"><option value="All">Other / Not specified</option><option value="Bollywood">Bollywood</option><option value="Hollywood">Hollywood</option><option value="South">South Indian</option></select></label><label class="vh-edit-featured">Feature on Homepage<input name="is_featured" type="checkbox"></label><label>Rating<input name="rating" type="number" min="0" max="10" step="0.1"></label><label>Duration<input name="duration" placeholder="e.g. 2h 15m"></label><label>Poster URL<input name="poster_url" type="url"></label><label>Trailer URL<input name="trailer_url" type="url"></label><label>Telegram Post URL<input name="telegram_url" type="url"></label><label>Director<input name="director"></label><label>Cast<input name="cast"></label><label class="vh-edit-wide">Description<textarea name="description" rows="4"></textarea></label><label class="vh-edit-wide">Screenshots URLs (comma or new line separated)<textarea name="screenshots" rows="4" placeholder="https://..."></textarea></label><label class="vh-edit-wide">Subtitle tracks — Label|language|HTTPS .vtt URL<textarea name="subtitle_tracks" rows="3" placeholder="Hindi|hi|https://cdn.example.com/movie-hi.vtt"></textarea></label></div><div class="vh-edit-actions"><button type="button" class="btn-delete" data-vh-edit-close>Cancel</button><button type="submit" class="btn-primary">Save changes</button></div></form></section>';
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-vh-edit-close]").forEach(button=>button.addEventListener("click",()=>modal.classList.remove("open")));
    modal.addEventListener("click",event=>{if(event.target===modal)modal.classList.remove("open");});
    $("vhEditContentForm").addEventListener("submit",saveEditedContent);
  }

  function parseSubtitleLines(raw) {
    return String(raw||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
      const parts=line.split("|").map(part=>part.trim());
      if(parts.length!==3)throw new Error("Subtitle line format: Label|language|HTTPS .vtt URL");
      const [label,language,rawUrl]=parts;
      const url=validHttpUrl(rawUrl);
      if(!url||!url.toLowerCase().split("?")[0].endsWith(".vtt"))throw new Error("Subtitle URL must point to a .vtt file.");
      if(!label||!language)throw new Error("Subtitle label and language are required.");
      return {label:label.slice(0,60),language:language.slice(0,12),url};
    });
  }

  function editField(form,name,value) {
    const field=form.elements.namedItem(name);
    if(field)field.value=value==null?"":String(value);
  }

  window.editPublishedContent=id=>{
    const item=(window.BUNNY_HUB_DATA||[]).find(entry=>entry.isSupabaseContent&&String(entry.id)===String(id));
    if(!item){toast("Content catalog mein nahi mila. Page refresh karke dobara try karein.");return;}
    ensureEditModal();
    const form=$("vhEditContentForm");
    form.dataset.contentId=String(id);
    editField(form,"title",item.title);
    editField(form,"release_year",item.year);
    editField(form,"genre",item.genre);
    editField(form,"language",item.language);
    editField(form,"industry",item.industry);
    form.elements.namedItem("is_featured").checked=item.is_featured===true;
    editField(form,"rating",item.rating);
    editField(form,"duration",item.duration);
    editField(form,"poster_url",item.poster);
    editField(form,"trailer_url",item.trailer);
    editField(form,"telegram_url",item.telegram_url);
    editField(form,"director",item.director);
    editField(form,"cast",item.cast);
    editField(form,"description",item.description);
    editField(form,"screenshots",Array.isArray(item.screenshots)?item.screenshots.join("\n"):item.screenshots);
    editField(form,"subtitle_tracks",(item.subtitle_tracks||[]).map(track=>[track.label,track.language,track.url].join("|")).join("\n"));
    $("vhEditContentModal").classList.add("open");
  };

  async function saveEditedContent(event) {
    event.preventDefault();
    const form=event.currentTarget;
    const button=form.querySelector('[type="submit"]');
    if(button)button.disabled=true;
    try {
      await requireAdmin();
      const id=form.dataset.contentId;
      const value=name=>String(form.elements.namedItem(name)?.value||"").trim();
      const optionalUrl=(raw,label)=>{
        if(!raw)return null;
        let parsed;try{parsed=new URL(raw);}catch(_){throw new Error(label+" URL valid nahi hai.");}
        if(!["http:","https:"].includes(parsed.protocol))throw new Error(label+" URL http/https hona chahiye.");
        return parsed.href;
      };
      const screenshotUrls=value("screenshots").split(/[\n,]+/).map(url=>url.trim()).filter(Boolean).map(url=>optionalUrl(url,"Screenshot"));
      const subtitleTracks=parseSubtitleLines(value("subtitle_tracks"));
      const year=Number(value("release_year"));
      const rating=value("rating")===""?null:Number(value("rating"));
      if(value("release_year")&&(!Number.isInteger(year)||year<1888||year>2100))throw new Error("Release year 1888–2100 ke beech hona chahiye.");
      if(rating!==null&&(!Number.isFinite(rating)||rating<0||rating>10))throw new Error("Rating 0 se 10 ke beech honi chahiye.");
      const updates={
        title:value("title"),
        release_year:value("release_year")?year:null,
        genre:value("genre")||null,
        language:value("language")||null,
        industry:value("industry")||"All",
        is_featured:form.elements.namedItem("is_featured")?.checked===true,
        rating,
        duration:value("duration")||null,
        poster_url:optionalUrl(value("poster_url"),"Poster"),
        trailer_url:optionalUrl(value("trailer_url"),"Trailer"),
        telegram_url:optionalUrl(value("telegram_url"),"Telegram"),
        director:value("director")||null,
        cast:value("cast")||null,
        description:value("description")||null,
        screenshots:screenshotUrls,
        subtitle_tracks:subtitleTracks
      };
      if(!updates.title)throw new Error("Title required hai.");
      const {data:updated,error}=await db.from("vh_content").update(updates).eq("id",id).select("*").single();
      if(error)throw error;
      const current=(window.BUNNY_HUB_DATA||[]).find(entry=>entry.isSupabaseContent&&String(entry.id)===String(id));
      addToCatalog(updated,current?.media_assets||[]);
      window.renderBunnyHub?.();
      renderManageList($("manageSearch")?.value||"");
      $("vhEditContentModal").classList.remove("open");
      toast("Movie details successfully update ho gayi.");
    } catch(error) {
      console.error("Content update failed:",error);
      toast(error.message||"Movie details update nahi ho paayi.");
    } finally {if(button)button.disabled=false;}
  }

  function renderManageList(query="") {
    const host=$("manageList");if(!host)return;
    const term=String(query).trim().toLowerCase();
    const items=(window.BUNNY_HUB_DATA||[]).filter(item=>item.isSupabaseContent&&[item.title,item.type,item.genre,item.language,item.industry].join(" ").toLowerCase().includes(term));
    host.innerHTML=items.length?items.map(item=>'<article class="manage-item"><div><strong>'+esc(item.title)+'</strong><small>'+esc(item.type)+' · '+esc(item.year)+' · '+esc(item.genre)+'</small></div><div class="manage-actions"><button type="button" class="btn-primary" onclick="editPublishedContent(&quot;'+esc(item.id)+'&quot;)">Edit</button><button type="button" class="btn-delete" onclick="deletePublishedContent(&quot;'+esc(item.id)+'&quot;)">Delete</button></div></article>').join(""):"<p>No published content found.</p>";
  }
  window.filterManageList=value=>renderManageList(value);

  window.deletePublishedContent=async id=>{
    if(id==null||!window.confirm("Delete this published item permanently?"))return;
    try{
      const actor=await requireAdmin();
      const {data:target,error:targetError}=await db.from("vh_content").select("id,content_type,created_by").eq("id",id).maybeSingle();
      if(targetError)throw targetError;if(!target)throw new Error("Content record not found.");
      if(window.VH_ROLE==="content_editor"&&target.created_by!==actor.id)throw new Error("Content Editors can delete only titles they created.");
      const contentIds=[id];
      if(target.content_type==="Web Series"){
        const {data:episodes,error:episodesError}=await db.from("vh_content").select("id").eq("parent_series_id",id).eq("content_type","Episode");
        if(episodesError)throw episodesError;
        (episodes||[]).forEach(episode=>contentIds.push(episode.id));
      }
      const {data:assets,error:assetsError}=await db.from("vh_media_assets").select("content_id,storage_path,storage_provider").in("content_id",contentIds);
      if(assetsError)throw assetsError;
      const {data:{session}}=await db.auth.getSession();
      for(const asset of assets||[]){
        const provider=String(asset.storage_provider||"").toLowerCase();
        const path=String(asset.storage_path||"");
        if(provider==="direct"&&path.startsWith("pixeldrain://")){
          const response=await fetch("/api/media/pixeldrain-delete",{
            method:"POST",headers:{"Authorization":"Bearer "+(session?.access_token||""),"Content-Type":"application/json"},
            body:JSON.stringify({storagePath:path})
          });
          const result=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(result.error||"PixelDrain file could not be removed; content was kept.");
          continue;
        }
        if(!["supabase","cloudflare_r2","backblaze_b2"].includes(provider)||!path||/^https?:\/\//i.test(path))continue;
        const response=await fetch("/api/media/delete",{
          method:"POST",
          headers:{"Authorization":"Bearer "+(session?.access_token||""),"Content-Type":"application/json"},
          body:JSON.stringify({contentId:String(asset.content_id),storagePath:path,provider})
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(result.error||"Media file could not be removed. Content was kept.");
      }
      const {error}=await db.from("vh_content").delete().eq("id",id);
      if(error)throw error;
      const catalog=window.BUNNY_HUB_DATA||[],deletedIds=new Set(contentIds.map(String));for(let i=catalog.length-1;i>=0;i--){if(catalog[i].isSupabaseContent&&deletedIds.has(String(catalog[i].id)))catalog.splice(i,1);}
      window.renderBunnyHub?.();renderManageList($("manageSearch")?.value||"");toast("Content deleted.");
    }catch(error){console.error("Content delete failed:",error);toast(error.message||"Could not delete content.");}
  };

  async function notifyTelegramPublish(contentId) {
    try {
      const {data:{session}}=await db.auth.getSession();
      if(!session?.access_token)return;
      const response=await fetch("/api/telegram/notify-publish",{
        method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
        body:JSON.stringify({contentId})
      });
      if(!response.ok)console.debug("Telegram publish announcement skipped:",(await response.json().catch(()=>({}))).error||response.status);
    }catch(error){console.debug("Telegram publish announcement skipped:",error.message);}
  }

  async function publish(form,type) {
    const user=await requireAdmin();
    const isShort=type==="Short";
    const title=$(isShort?"shortTitle":"addTitle")?.value.trim();
    if(!title)throw new Error("Title required hai.");
    const provider=$(isShort?"shortStorageProvider":"addStorageProvider")?.value||window.VH_STORAGE_DEFAULT||"backblaze_b2";
    const primaryFile=$(isShort?"shortVideoFile":"addVideoFile")?.files?.[0]||null;
    const primaryUrl=$(isShort?"shortVideoUrl":"addVideo")?.value.trim()||"";
    const uploads=[];
    const links=[];
    if(primaryFile){
      if(!["supabase","cloudflare_r2","backblaze_b2","pixeldrain"].includes(provider))throw new Error("Direct file upload ke liye Supabase, Cloudflare R2, Backblaze B2 ya configured PixelDrain choose karein. Baaki providers ke liye authorised direct URL dein.");
      uploads.push({resolution:"Original",file:primaryFile,is_primary:true});
    } else if(primaryUrl) links.push({resolution:"Original",url:provider==="pixeldrain"?pixeldrainDirectUrl(primaryUrl):validHttpUrl(primaryUrl),is_primary:true,storage_provider:storedProvider(provider)});
    if(!isShort){
      document.querySelectorAll("[data-vh-quality-file]").forEach(input=>{
        const file=input.files?.[0];if(file)uploads.push({resolution:input.dataset.vhQualityFile,file,is_primary:false});
      });
      [["180p","addDl180"],["240p","addDl240"],["420p","addDl420"],["480p","addDl480"],["720p","addDl720"],["1080p","addDl1080"],["2K","addDl2k"],["4K","addDl4k"],["8K","addDl8k"]].forEach(([resolution,id])=>{
        const rawUrl=$(id)?.value.trim();if(rawUrl)links.push({resolution,url:provider==="pixeldrain"?pixeldrainDirectUrl(rawUrl):validHttpUrl(rawUrl),is_primary:false,storage_provider:storedProvider(provider)});
      });
    }
    if(!uploads.length&&!links.length)throw new Error("Video file upload karein ya authorised video URL dein.");
    const uploaded=[];
    try {
      for(const entry of uploads){const result=await uploadPrivate(entry.file,user,provider);uploaded.push({...entry,...result,storage_provider:result.storage_provider||provider});}
      const primaryUpload=uploaded.find(x=>x.is_primary)||uploaded[0];
      const primaryLink=links.find(x=>x.is_primary)||links[0];
      const primary=primaryUpload||primaryLink;
      const row={
        title,content_type:type,video_url:primaryUpload?"private://"+primaryUpload.path:primary.url,
        storage_provider:primaryUpload?(primaryUpload.storage_provider||provider):(primary.storage_provider||provider),published:true,created_by:user.id,
        poster_url:isShort?null:validHttpUrl($("addPoster")?.value.trim()||"")||null,
        genre:isShort?"Shorts":($("addGenre")?.value||"Drama"),
        language:isShort?"":($("addLang")?.value.trim()||""),
        release_year:isShort?new Date().getFullYear():(Number($("addYear")?.value)||null),
        rating:isShort?null:(Number($("addRating")?.value)||null),
        description:isShort?($("shortDesc")?.value.trim()||""):($("addDesc")?.value.trim()||""),
        cast:isShort?"":($("addCast")?.value.trim()||""),
        director:isShort?"":($("addDirector")?.value.trim()||null),
        screenshots:isShort?[]:($("addScreenshots")?.value.split(/[\n,]+/).map(value=>value.trim()).filter(Boolean).map(value=>validHttpUrl(value))||[]),
        duration:isShort?"":($("addDuration")?.value.trim()||""),
        trailer_url:isShort?null:(validHttpUrl($("addTrailer")?.value.trim()||"")||null),
        telegram_url:isShort?null:(validHttpUrl($("addTgPost")?.value.trim()||"")||null),
        subtitle_tracks:isShort?[]:parseSubtitleLines($("vhSubtitleTracks")?.value||""),
        industry:isShort?"All":($("addIndustry")?.value||"All"),
        is_featured:isShort?!!$("shortFeatured")?.checked:!!$("addFeatured")?.checked
      };
      const {data:created,error}=await db.from("vh_content").insert(row).select("*").single();
      if(error)throw error;
      const assetRows=[
        ...uploaded.map(x=>({content_id:created.id,asset_type:"video",asset_url:"private://"+x.path,storage_path:x.path,storage_provider:x.storage_provider||provider,resolution:dbResolution(x.resolution),is_primary:x.is_primary,language:isShort?"":($("vhMediaLanguages")?.value.trim()||"")})),
        ...links.map(x=>({content_id:created.id,asset_type:"video",asset_url:x.url,storage_path:x.url,storage_provider:x.storage_provider||provider,resolution:dbResolution(x.resolution),is_primary:x.is_primary,language:isShort?"":($("vhMediaLanguages")?.value.trim()||"")}))
      ];
      if(assetRows.length){
        const {error:assetError}=await db.from("vh_media_assets").insert(assetRows);
        if(assetError){
          await db.from("vh_content").delete().eq("id",created.id);
          throw new Error("Media details save nahi hue: "+assetError.message+". Supabase migration check karein.");
        }
      }
      await notifyTelegramPublish(created.id);
      form?.reset();
      toast(type+" successfully publish ho gaya.");
      await loadPublished();
    } catch(error) {
      if(uploaded.length){
        const {data:{session}}=await db.auth.getSession();
        for(const asset of uploaded){
          try{
            if(asset.storage_provider==="direct"&&String(asset.path||"").startsWith("pixeldrain://")){
              const response=await fetch("/api/media/pixeldrain-delete",{
                method:"POST",headers:{"Authorization":"Bearer "+(session?.access_token||""),"Content-Type":"application/json"},
                body:JSON.stringify({storagePath:asset.path})
              });
              if(!response.ok)console.warn("PixelDrain cleanup needs attention:",await response.text());
              continue;
            }
            const response=await fetch("/api/media/delete",{
              method:"POST",headers:{"Authorization":"Bearer "+(session?.access_token||""),"Content-Type":"application/json"},
              body:JSON.stringify({storagePath:asset.path,provider:asset.storage_provider||provider})
            });
            if(!response.ok)console.warn("Uploaded file cleanup needs attention:",await response.text());
          }catch(cleanupError){console.warn("Uploaded file cleanup needs attention:",cleanupError.message);}
        }
      }
      throw error;
    }
  }

  window.addMovie=async event=>{
    event?.preventDefault();
    const form=event?.currentTarget||document.querySelector("#tab-add-movie form");
    const button=form?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{await publish(form,$("addType")?.value||"Movie");}
    catch(error){console.error("Publish failed:",error);toast(error.message||"Publish failed.");}
    finally{if(button)button.disabled=false;}
  };
  window.publishShort=async event=>{
    event?.preventDefault();const form=event?.currentTarget;const button=form?.querySelector('[type="submit"]');if(button)button.disabled=true;
    try{await publish(form,"Short");}
    catch(error){console.error("Short publish failed:",error);toast(error.message||"Short publish failed.");}
    finally{if(button)button.disabled=false;}
  };

  function ensurePlayerQualityControl(item) {
    const controls=$("playerOverlay")?.querySelector(".player-controls");
    if(!controls)return;
    let wrap=$("vhPlayerQualityWrap");
    if(!wrap){wrap=document.createElement("label");wrap.id="vhPlayerQualityWrap";wrap.className="vh-player-quality";wrap.innerHTML='<span>Video quality</span><select id="vhPlayerQuality" aria-label="Video quality"></select><small id="vhQualityHint"></small>';controls.prepend(wrap);}
    const select=$("vhPlayerQuality");
    const assets=(item.media_assets||[]).filter(asset=>asset.url&&(!asset.asset_type||asset.asset_type==="video"));
    const choices=assets.length?assets.slice():[{resolution:"Original",url:item.video_url,is_primary:true,asset_type:"video"}].filter(x=>x.url);
    choices.sort((a,b)=>{
      const ai=qualityOrder.indexOf(String(a.resolution||"").toLowerCase());
      const bi=qualityOrder.indexOf(String(b.resolution||"").toLowerCase());
      return (bi<0?-1:bi)-(ai<0?-1:ai);
    });
    select.innerHTML=choices.length?choices.map((asset,index)=>'<option value="'+index+'">'+esc(resolutionLabel(asset.resolution))+(asset.language?" · "+esc(asset.language):"")+'</option>').join(""):'<option value="">No playable rendition</option>';
    select.disabled=!choices.length;
    const hint=$("vhQualityHint");
    if(hint)hint.textContent=choices.length<2?(choices.length?"Only the uploaded source is available. Add real renditions to offer more resolutions.":"No playable video is attached to this title."):"Choose an available uploaded resolution.";
    select.onchange=()=>{const asset=choices[Number(select.value)];if(asset)playAsset(item,asset);};
    const preferred=choices.findIndex(asset=>asset.is_primary);
    select.value=choices.length?String(preferred>=0?preferred:0):"";
    ensurePlaybackExtras(controls,item);
    if(choices.length)playAsset(item,choices[Number(select.value)]);
  }

  function ensurePlaybackExtras(controls,item) {
    let wrap=$("vhPlayerExtras");
    if(!wrap){
      wrap=document.createElement("div");
      wrap.id="vhPlayerExtras";
      wrap.className="vh-player-extras";
      wrap.innerHTML='<label>Speed <select id="vhPlayerSpeed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><label>Subtitles <select id="vhPlayerSubtitle"><option value="-1">Off</option></select></label>';
      controls.appendChild(wrap);
    }
    const speed=$("vhPlayerSpeed");
    let savedSpeed="1";try{savedSpeed=localStorage.getItem("vh_playback_speed")||"1";}catch(_){}
    if(!["0.5","0.75","1","1.25","1.5","2"].includes(savedSpeed))savedSpeed="1";
    if(speed){speed.value=savedSpeed;speed.onchange=()=>{const value=speed.value;if(activeVideo)activeVideo.playbackRate=Number(value);try{localStorage.setItem("vh_playback_speed",value)}catch(_){}};}
    const tracks=(item.subtitle_tracks||[]).filter(track=>track.url);
    const subtitle=$("vhPlayerSubtitle");
    if(subtitle){
      subtitle.innerHTML='<option value="-1">Off</option>'+tracks.map((track,index)=>'<option value="'+index+'">'+esc(track.label||track.language||("Subtitle "+(index+1)))+'</option>').join("");
      subtitle.value="-1";
      subtitle.onchange=()=>setSubtitleMode(Number(subtitle.value));
    }
  }

  function setSubtitleMode(selectedIndex) {
    if(!activeVideo)return;
    Array.from(activeVideo.textTracks||[]).forEach((track,index)=>{track.mode=index===selectedIndex?"showing":"disabled";});
  }

  function attachSubtitleTracks(item,subtitleSelectId="vhPlayerSubtitle",speedSelectId="vhPlayerSpeed") {
    if(!activeVideo)return;
    activeVideo.querySelectorAll("track[data-vh-subtitle]").forEach(track=>track.remove());
    const tracks=(item.subtitle_tracks||[]).filter(track=>track.url);
    tracks.forEach(track=>{
      const node=document.createElement("track");
      node.kind="subtitles";
      node.label=String(track.label||track.language||"Subtitle");
      node.srclang=String(track.language||"en");
      node.src=track.url;
      node.dataset.vhSubtitle="1";
      node.addEventListener("load",()=>{node.track.mode="disabled";});
      activeVideo.appendChild(node);
    });
    const select=$(subtitleSelectId);
    if(select)select.value="-1";
    setSubtitleMode(-1);
    const speed=$(speedSelectId);
    if(speed)activeVideo.playbackRate=Number(speed.value)||1;
  }

  function playAsset(item,asset,targetVideoId=null,autoPlay=true) {
    if(!asset?.url){toast("Is quality ka playable URL available nahi hai.");return;}
    const inline=Boolean(targetVideoId);
    const provider=String(asset.storage_provider||"supabase").toLowerCase();
    const targetVideo=inline?$(targetVideoId):null;
    if(provider==="google_drive"){
      const id=googleDriveFileId(asset.storage_path||asset.url);
      const iframe=$(inline?"detailPlayerIframe":"playerIframe"),fallback=inline?null:$("playerFallback");
      if(inline){
        targetVideo?.pause();
        if(targetVideo){targetVideo.removeAttribute("src");targetVideo.load();targetVideo.classList.add("hidden");}
        $("detailPlayerEmpty")?.classList.add("hidden");
        if(!id||!iframe){
          $("detailPlayerEmpty").textContent="Google Drive preview is unavailable for this source.";
          $("detailPlayerEmpty")?.classList.remove("hidden");
          $("detailPlayerStatus").textContent="Preview unavailable";
          return;
        }
        activeVideo=null;
        iframe.src="https://drive.google.com/file/d/"+encodeURIComponent(id)+"/preview";
        iframe.classList.remove("hidden");
        $("detailPlayerStatus").textContent="Google Drive preview";
        $("detailSpeedWrap")?.classList.add("hidden");
        $("detailSubtitleWrap")?.classList.add("hidden");
        return;
      }
      if(!id||!iframe){window.open(asset.url,"_blank","noopener");toast("Google Drive preview could not be embedded; opening the shared file.");return;}
      const previousVideo=fallback?.querySelector("video");
      if(previousVideo){previousVideo.pause();previousVideo.removeAttribute("src");previousVideo.load();}
      activeVideo=null;
      $("vhPlayerExtras")?.classList.add("hidden");
      fallback?.classList.remove("active");
      iframe.src="https://drive.google.com/file/d/"+encodeURIComponent(id)+"/preview";
      iframe.classList.remove("hidden");
      return;
    }
    if(provider!=="supabase" && provider!=="cloudflare_r2" && provider!=="backblaze_b2" && provider!=="direct"){
      if(inline){
        targetVideo?.pause();
        targetVideo?.classList.add("hidden");
        $("detailPlayerIframe")?.classList.add("hidden");
        $("detailPlayerEmpty").textContent="This provider does not support secure in-page playback. Use its authorised source link.";
        $("detailPlayerEmpty")?.classList.remove("hidden");
        $("detailPlayerStatus").textContent="External provider source";
        $("detailSpeedWrap")?.classList.add("hidden");
        $("detailSubtitleWrap")?.classList.add("hidden");
        return;
      }
      window.open(asset.url,"_blank","noopener");
      toast("Ye external provider link hai; playback provider ke page par khulega.");
      return;
    }
    if(inline){
      if(!targetVideo)return;
      activeVideo=targetVideo;
      $("detailSpeedWrap")?.classList.remove("hidden");
      targetVideo.classList.remove("hidden");
      $("detailPlayerIframe")?.classList.add("hidden");
      if($("detailPlayerIframe"))$("detailPlayerIframe").src="";
      $("detailPlayerEmpty")?.classList.add("hidden");
    }else{
      $("vhPlayerExtras")?.classList.remove("hidden");
      activeVideo=$("playerFallback")?.querySelector("video");
      $("playerIframe")?.classList.add("hidden");
      $("playerFallback")?.classList.add("active");
    }
    if(!activeVideo)return;
    activeVideo.crossOrigin="anonymous";
    attachSubtitleTracks(item,inline?"detailPlayerSubtitle":"vhPlayerSubtitle",inline?"detailPlayerSpeed":"vhPlayerSpeed");
    activeVideo.onerror=()=>toast("Video stream nahi chal paayi. Direct file URL aur storage access check karein.");
    const video=activeVideo;
    let playbackUserId=window.VH_USER_ID||null;
    const progressKey=()=>window.VH_ACCOUNT_DATA?.progressKey(item.id,playbackUserId)||("vh_progress_"+String(item.id));
    if(activeProgressContentId!==String(item.id)){activeProgressContentId=String(item.id);lastProgressSave=0;}
    let resumeApplied=false;
    const persistPosition=(position,duration=video.duration)=>{
      if(!Number.isFinite(position)||position<1)return;
      try{window.VH_ACCOUNT_DATA?.setProgress(item.id,position,playbackUserId);if(!window.VH_ACCOUNT_DATA)localStorage.setItem(progressKey(),String(position));}catch(_){}
      db.auth.getUser().then(async({data:{user}})=>{
        if(!user)return;
        playbackUserId=user.id;
        window.VH_ACCOUNT_DATA?.setProgress(item.id,position,user.id);
        const {error}=await db.from("vh_watch_progress").upsert({
          user_id:user.id,content_id:String(item.id),position_seconds:position,
          duration_seconds:Number(duration)||0,updated_at:new Date().toISOString()
        },{onConflict:"user_id,content_id"});
        if(error)console.debug("Watch progress sync unavailable:",error.message);
      }).catch(error=>console.debug("Watch progress sync unavailable:",error.message));
    };
    video.onloadedmetadata=async()=>{
      if(resumeApplied)return;
      resumeApplied=true;
      let position=0;
      try{
        const {data:{user}}=await db.auth.getUser();
        if(user){
          playbackUserId=user.id;
          window.VH_ACCOUNT_DATA?.migrateLegacy(user.id);
          position=window.VH_ACCOUNT_DATA?.getProgress(item.id,user.id)||0;
          const {data,error}=await db.from("vh_watch_progress").select("position_seconds").eq("user_id",user.id).eq("content_id",String(item.id)).maybeSingle();
          if(!error&&data?.position_seconds)position=Number(data.position_seconds);
        }else{
          playbackUserId=null;
          position=window.VH_ACCOUNT_DATA?.getProgress(item.id,null)||Number(localStorage.getItem(progressKey())||0);
        }
      }catch(error){console.debug("Cloud resume point unavailable:",error.message);}
      if(video!==activeVideo||video.dataset.vhContentId!==String(item.id)||video.dataset.vhAssetUrl!==String(asset.url))return;
      if(Number.isFinite(position)&&position>5&&position<video.duration-5)video.currentTime=position;
    };
    video.ontimeupdate=()=>{
      if(!Number.isFinite(video.currentTime)||video.currentTime<1)return;
      const now=Date.now();
      if(now-lastProgressSave<20000)return;
      lastProgressSave=now;
      persistPosition(video.currentTime);
    };
    video.onpause=()=>{
      if(Number.isFinite(video.currentTime)&&video.currentTime>1&&video.currentTime<video.duration-5){
        lastProgressSave=Date.now();
        persistPosition(video.currentTime);
      }
    };
    video.onended=()=>{
      try{window.VH_ACCOUNT_DATA?.setProgress(item.id,0,playbackUserId);if(!window.VH_ACCOUNT_DATA)localStorage.setItem(progressKey(),"0");}catch(_){}
      db.auth.getUser().then(async({data:{user}})=>{
        if(!user)return;
        playbackUserId=user.id;
        window.VH_ACCOUNT_DATA?.setProgress(item.id,0,user.id);
        const {error}=await db.from("vh_watch_progress").upsert({
          user_id:user.id,content_id:String(item.id),position_seconds:0,
          duration_seconds:Number(video.duration)||0,updated_at:new Date().toISOString()
        },{onConflict:"user_id,content_id"});
        if(error)console.debug("Completed playback state was not synced:",error.message);
      }).catch(()=>{});
      window.renderBunnyHub?.();
    };
    video.onerror=()=>toast("Video stream nahi chal paayi. Direct file URL aur storage access check karein.");
    video.dataset.vhContentId=String(item.id);
    video.dataset.vhAssetUrl=String(asset.url);
    if(video.src!==asset.url){video.pause();video.src=asset.url;video.load();}
    if(autoPlay)video.play().catch(()=>{});
    const status=inline?$("detailPlayerStatus"):$("playerResolutionStatus");
    if(status)status.textContent=resolutionLabel(asset.resolution)+(asset.language?" · "+asset.language:"")+" · supplied source";
  }

  function setupDetailPlayer(item){
    const panel=$("detailPlaybackPanel"),video=$("detailVideo"),iframe=$("detailPlayerIframe");
    const select=$("detailQualitySelect"),empty=$("detailPlayerEmpty"),status=$("detailPlayerStatus");
    if(!panel||!video||!select||!empty)return;
    video.pause();
    video.removeAttribute("src");
    video.load();
    if(activeVideo===video)activeVideo=null;
    video.poster=item.poster||"";
    video.classList.remove("hidden");
    if(iframe){iframe.src="";iframe.classList.add("hidden");}
    empty.classList.add("hidden");
    const assets=(item.media_assets||[]).filter(asset=>asset?.url&&(!asset.asset_type||asset.asset_type==="video"));
    const choices=assets.length?assets.slice():[{resolution:"Original",url:item.video_url,storage_provider:item.storage_provider||"direct",content_id:item.id,is_primary:true}].filter(asset=>asset.url);
    choices.sort((a,b)=>{
      const ai=qualityOrder.indexOf(String(a.resolution||"").toLowerCase());
      const bi=qualityOrder.indexOf(String(b.resolution||"").toLowerCase());
      return (bi<0?-1:bi)-(ai<0?-1:ai);
    });
    select.replaceChildren();
    choices.forEach((asset,index)=>{
      const label=resolutionLabel(asset.resolution)+(asset.language?" · "+asset.language:"");
      select.add(new Option(label,String(index)));
    });
    select.disabled=!choices.length;
    select.classList.toggle("hidden",!choices.length);
    const subtitleSelect=$("detailPlayerSubtitle");
    const tracks=(item.subtitle_tracks||[]).filter(track=>track.url);
    if(subtitleSelect){
      subtitleSelect.replaceChildren(new Option("Subtitles off","-1"));
      tracks.forEach((track,index)=>subtitleSelect.add(new Option(track.label||track.language||("Subtitle "+(index+1)),String(index))));
      subtitleSelect.disabled=!tracks.length;
      subtitleSelect.classList.toggle("hidden",!tracks.length);
      $("detailSubtitleWrap")?.classList.toggle("hidden",!tracks.length);
      subtitleSelect.onchange=()=>setSubtitleMode(Number(subtitleSelect.value));
    }
    const speedWrap=$("detailSpeedWrap");
    if(speedWrap)speedWrap.classList.toggle("hidden",!choices.length);
    const speed=$("detailPlayerSpeed");
    if(speed){
      let saved="1";try{saved=localStorage.getItem("vh_playback_speed")||"1";}catch(_){}
      if(!["0.5","0.75","1","1.25","1.5","2"].includes(saved))saved="1";
      speed.value=saved;
      speed.onchange=()=>{if(activeVideo)activeVideo.playbackRate=Number(speed.value)||1;try{localStorage.setItem("vh_playback_speed",speed.value)}catch(_){}};
    }
    if(!choices.length){
      video.classList.add("hidden");
      empty.textContent="No verified video source has been published for this title yet. The details and authorised trailer remain available.";
      empty.classList.remove("hidden");
      if(status)status.textContent="Player not available";
    }else{
      const preferred=choices.findIndex(asset=>asset.is_primary);
      select.value=String(preferred>=0?preferred:0);
      const selected=choices[Number(select.value)];
      select.onchange=()=>{
        const next=choices[Number(select.value)];
        const wasPlaying=!video.paused;
        playAsset(item,next,"detailVideo",wasPlaying);
      };
      playAsset(item,selected,"detailVideo",false);
    }
    panel.classList.add("hidden");
    panel.classList.remove("vh-player-minimized");
    const minimize=$("detailPlayerMinimize");
    if(minimize){
      minimize.setAttribute("aria-expanded","true");
      minimize.setAttribute("aria-label","Minimise video player");
      minimize.innerHTML='<i class="fas fa-minus"></i>';
      minimize.onclick=()=>{
        const collapsed=panel.classList.toggle("vh-player-minimized");
        minimize.setAttribute("aria-expanded",String(!collapsed));
        minimize.setAttribute("aria-label",collapsed?"Expand video player":"Minimise video player");
        minimize.innerHTML=collapsed?'<i class="fas fa-plus"></i>':'<i class="fas fa-minus"></i>';
      };
    }
  }

  function stopDetailPlayback(){
    const video=$("detailVideo");
    if(video){
      video.pause();
      video.removeAttribute("src");
      video.load();
      if(activeVideo===video)activeVideo=null;
    }
    const iframe=$("detailPlayerIframe");
    if(iframe){iframe.src="";iframe.classList.add("hidden");}
  }

  const baseCloseMovieModal=window.closeModal;
  window.closeModal=function(...args){
    stopDetailPlayback();
    if(typeof baseCloseMovieModal==="function")return baseCloseMovieModal.apply(this,args);
  };
  window.closeModalBtn=window.closeModal;

  window.openMovie=function(id){
    const item=(window.BUNNY_HUB_DATA||[]).find(entry=>String(entry.id)===String(id));
    if(!item)return;
    activeItem=item;
    if(typeof originalOpenMovie==="function")originalOpenMovie(id);
    else {
      $("modalTitle").textContent=item.title;
      $("modalDesc").textContent=item.description||"";
      $("modalMeta").textContent=[item.year,item.genre,item.language,item.duration].filter(Boolean).join(" · ");
      $("modalPoster").src=item.poster||"";
      $("movieModal")?.classList.add("open");
    }
    setupDetailPlayer(item);
    const playButton=$("modalPlayBtn");
    if(playButton){
      playButton.onclick=()=>{
        const panel=$("detailPlaybackPanel");
        panel?.classList.remove("hidden");
        panel?.scrollIntoView({behavior:"smooth",block:"start"});
        if(activeVideo&&typeof activeVideo.play==="function"){
          const playback=activeVideo.play();
          playback?.catch(()=>{});
        }else if(!((item.media_assets||[]).some(asset=>asset?.url&&(!asset.asset_type||asset.asset_type==="video"))||item.video_url)){
          toast("No verified video source has been published for this title yet.");
        }
      };
    }
    const downloadButton=document.querySelector("#movieModal .btn-download");
    if(downloadButton)downloadButton.onclick=()=>window.downloadMovie();
  };

  window.downloadMovie=function(){
    if(!activeItem){toast("Pehle catalog se content select karein.");return;}
    const modal=$("downloadModal");
    const host=modal?.querySelector(".res-list");
    if(!modal||!host){toast("Download panel unavailable.");return;}
    $("dlModalTitle").textContent=activeItem.title;
    $("dlModalMeta").textContent=[activeItem.year,activeItem.genre,activeItem.language,activeItem.duration].filter(Boolean).join(" · ");
    $("dlModalPoster").src=activeItem.poster||"";
    const assets=(activeItem.media_assets||[]).filter(asset=>asset.url&&(!asset.asset_type||asset.asset_type==="video"));
    const choices=assets.length?assets.sort((a,b)=>{const ai=qualityOrder.indexOf(String(a.resolution||"").toLowerCase()),bi=qualityOrder.indexOf(String(b.resolution||"").toLowerCase());return (bi<0?-1:bi)-(ai<0?-1:ai);}):[{resolution:"Original",url:activeItem.video_url}].filter(asset=>asset.url);
    const audioInfo=$("dlModalAudioInfo"),languages=[...new Set(assets.map(asset=>String(asset.language||"").trim()).filter(Boolean))];
    if(audioInfo){audioInfo.textContent=languages.length?"Available source languages: "+languages.join(", "):"";audioInfo.style.display=languages.length?"":"none";}
    const screenshotHost=$("dlScreenshotSlider"),dots=$("dlSliderDots"),screens=Array.isArray(activeItem.screenshots)?activeItem.screenshots:[];
    if(screenshotHost)screenshotHost.innerHTML=screens.length?screens.map((url,index)=>'<img loading="lazy" src="'+esc(url)+'" alt="'+esc(activeItem.title)+' preview '+(index+1)+'">').join(""):"";
    if(dots)dots.textContent=screens.length?screens.length+" preview image(s)":"";
    document.querySelector("#downloadModal .screenshot-slider-wrap")?.classList.toggle("hidden",!screens.length);
    host.innerHTML=choices.length?choices.map((asset,index)=>'<div class="res-card"><div class="res-info"><span class="res-tag">'+esc(resolutionLabel(asset.resolution)) +'</span><div class="res-meta"><span>'+esc(asset.language||"Language not specified")+'</span><small>Verified source link · actual supplied quality</small></div></div><div class="res-actions"><button class="btn-dl-server" type="button" data-vh-download-index="'+index+'"><i class="fas fa-download"></i> Download file</button></div></div>').join(""):"<p>No verified video resolution links have been added for this title.</p>";
    host.querySelectorAll("[data-vh-download-index]").forEach(button=>button.addEventListener("click",async()=>{
      const asset=choices[Number(button.dataset.vhDownloadIndex)];if(!asset)return;
      const popup=window.open("about:blank","_blank");if(popup)popup.opener=null;
      try{
        const source=String(asset.storage_path||asset.asset_url||"").split("?")[0];
        const extension=(source.match(/\.([a-z0-9]{2,5})$/i)||[])[1]||"mp4";
        const downloadName=slug(activeItem.title)+"-"+slug(asset.resolution||"original")+"."+extension;
        const url=await signedAsset({...asset,content_id:activeItem.id},downloadName);
        const destination=url||asset.url;
        if(!destination)throw new Error("Download URL is unavailable.");
        if(popup)popup.location.href=destination;else window.location.href=destination;
      }catch(error){popup?.close();toast(error.message||"Download could not be prepared.");}
    }));
    const telegramUrl=String(activeItem.telegram_url||"").trim();
    const tg=$("dlModalTelegramBtn"),tgCallout=$("dlTelegramCallout");
    if(tg){tg.classList.toggle("hidden",!telegramUrl);if(telegramUrl)tg.href=telegramUrl;}
    if(tgCallout)tgCallout.classList.toggle("hidden",!telegramUrl);
    modal.classList.add("open");
  };

  window.triggerDownload=async(resolution,provider)=>{
    const asset=(activeItem?.media_assets||[]).find(item=>String(item.resolution).toLowerCase()===String(resolution).toLowerCase()&&(!provider||item.storage_provider===provider));
    if(!asset?.url){toast("Is resolution ka verified download link available nahi hai.");return;}
    const popup=window.open("about:blank","_blank");if(popup)popup.opener=null;
    try{
      const source=String(asset.storage_path||asset.asset_url||"").split("?")[0];
      const extension=(source.match(/\.([a-z0-9]{2,5})$/i)||[])[1]||"mp4";
      const url=await signedAsset({...asset,content_id:activeItem.id},slug(activeItem.title)+"-"+slug(asset.resolution||"original")+"."+extension);
      if(popup)popup.location.href=url||asset.url;else window.location.href=url||asset.url;
    }catch(error){popup?.close();toast(error.message||"Download could not be prepared.");}
  };
  window.playMovie=()=>{if(activeItem){$("movieModal")?.classList.remove("open");$("playerTitle").textContent="▶ "+activeItem.title;$("playerOverlay")?.classList.add("open");ensurePlayerQualityControl(activeItem);}};
  window.closePlayer=()=>{
    activeVideo=$("playerFallback")?.querySelector("video");
    if(activeVideo){activeVideo.pause();activeVideo.removeAttribute("src");activeVideo.load();}
    $("playerOverlay")?.classList.remove("open");
    $("playerIframe")?.setAttribute("src","");
  };

  document.addEventListener("DOMContentLoaded",()=>{
    ensureQualityFields();
    loadPublished();
  });
  db.auth.onAuthStateChange((_event,session)=>{if(session?.user){loadPublished();}});
  window.addEventListener("vh-secure-admin-session-ready",()=>refreshStorageHealth());
})();