/* Admin season/episode publishing and series detail episode browser. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE,$=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast=message=>typeof window.toast==="function"?window.toast(message):window.alert(message);
  const staffRoles=["admin","sub_admin","content_editor"];
  const validUrl=value=>{if(!value)return null;let u;try{u=new URL(value);}catch(_){throw new Error("Episode URL valid nahi hai.");}if(!["http:","https:"].includes(u.protocol))throw new Error("Only HTTP/HTTPS video URLs are allowed.");return u.href;};
  async function requireStaff(){
    const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error("Admin login required.");
    const {data:profile,error:pError}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if(pError)throw pError;if(!staffRoles.includes(profile?.role))throw new Error("Episode management permission required.");return user;
  }
  const VIDEO_MIME_BY_EXTENSION = Object.freeze({
    mp4:"video/mp4",m4v:"video/x-m4v",mov:"video/quicktime",
    mkv:"video/x-matroska",webm:"video/webm",avi:"video/x-msvideo",
    mpg:"video/mpeg",mpeg:"video/mpeg","3gp":"video/3gpp",
    "3g2":"video/3gpp2",ts:"video/mp2t",ogv:"video/ogg",
    wmv:"video/x-ms-wmv",flv:"video/x-flv"
  });
  function episodeVideoContentType(file){
    const reported=String(file?.type||"").trim().toLowerCase();
    if(reported.startsWith("video/"))return reported;
    const extension=String(file?.name||"").split(".").pop().toLowerCase();
    const inferred=VIDEO_MIME_BY_EXTENSION[extension];
    if(inferred)return inferred;
    throw new Error("Browser video format identify nahi kar paaya. MP4, MKV, MOV, WebM, AVI ya supported video format use karein.");
  }
  async function uploadEpisodeFile(file,user,provider){
    const contentType=episodeVideoContentType(file);
    if(file.size>5*1024*1024*1024)throw new Error("Episode file exceeds the 5 GB single-upload limit.");
    if(provider==="backblaze_b2"||provider==="cloudflare_r2"){
      const {data:{session}}=await db.auth.getSession();if(!session?.access_token)throw new Error("Admin session expired.");
      const response=await fetch("/api/media/upload-url",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({contentType,fileName:file.name,fileSize:file.size,provider})});
      const signed=await response.json().catch(()=>({}));if(!response.ok||!signed.uploadUrl)throw new Error(signed.error||"Cloud upload URL unavailable.");
      const uploaded=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers||{"Content-Type":contentType},body:file});
      if(!uploaded.ok)throw new Error("Cloud upload failed: HTTP "+uploaded.status);
      return {path:signed.key,provider};
    }
    if(provider==="supabase"){
      const path=user.id+"/"+crypto.randomUUID()+"-"+file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100);
      const {error}=await db.storage.from("vh-private-media").upload(path,file,{upsert:false,contentType,cacheControl:"3600"});
      if(error)throw error;return {path,provider};
    }
    throw new Error("File upload supports B2, R2 or Supabase. For other providers use an authorised direct URL.");
  }
  async function cleanupUploaded(path,provider){
    try{
      const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return;
      await fetch("/api/media/delete",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({storagePath:path,provider})});
    }catch(error){console.warn("Episode upload cleanup failed:",error.message);}
  }
  async function loadSeriesOptions(){
    const select=$("episodeSeriesId");if(!select||!db)return;
    const previous=select.value;
    try{
      const {data,error}=await db.from("vh_content").select("id,title").eq("content_type","Web Series").eq("published",true).order("title");
      if(error)throw error;
      select.innerHTML='<option value="">Select a Web Series</option>'+(data||[]).map(item=>'<option value="'+Number(item.id)+'">'+esc(item.title)+'</option>').join("");
      if((data||[]).some(item=>String(item.id)===previous))select.value=previous;
      if(select.value)loadEpisodeList(select.value);
    }catch(error){select.innerHTML='<option value="">Series list unavailable</option>';console.warn("Series list unavailable:",error.message);}
  }
  async function loadEpisodeList(seriesId){
    const host=$("episodeManageList");if(!host||!db)return;
    if(!seriesId){host.textContent="Choose a series to view its episodes.";return;}
    try{
      const {data,error}=await db.from("vh_content").select("id,title,season_number,episode_number,duration,created_at").eq("content_type","Episode").eq("parent_series_id",seriesId).eq("published",true).order("season_number").order("episode_number");
      if(error)throw error;
      host.innerHTML=(data||[]).length?(data||[]).map(item=>'<article class="manage-item"><div><strong>S'+String(item.season_number).padStart(2,"0")+' · E'+String(item.episode_number).padStart(2,"0")+' — '+esc(item.title)+'</strong><small>'+esc(item.duration||"Duration not set")+'</small></div><div class="manage-actions"><button type="button" class="btn-primary" onclick="playEpisode('+Number(item.id)+')">Watch</button><button type="button" class="btn-delete" onclick="deleteEpisode('+Number(item.id)+','+Number(seriesId)+')">Delete</button></div></article>').join(""):"<p>No episodes have been published for this series yet.</p>";
    }catch(error){host.textContent=error.message||"Episode list could not be loaded.";}
  }
  async function notifyTelegramPublish(contentId){
    try{
      const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return;
      const response=await fetch("/api/telegram/notify-publish",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({contentId})});
      if(!response.ok)console.debug("Telegram episode announcement skipped:",response.status);
    }catch(error){console.debug("Telegram episode announcement skipped:",error.message);}
  }
  window.publishEpisode=async event=>{
    event?.preventDefault();
    const form=event?.currentTarget,button=form?.querySelector('[type="submit"]'),status=$("episodePublishStatus");
    if(button)button.disabled=true;if(status)status.textContent="Publishing episode…";
    let uploaded=null,createdId=null,published=false;
    try{
      const user=await requireStaff();
      const seriesId=Number($("episodeSeriesId")?.value),season=Number($("episodeSeasonNumber")?.value),episode=Number($("episodeNumber")?.value);
      const title=$("episodeTitle")?.value.trim()||"",provider=$("episodeStorageProvider")?.value||"backblaze_b2";
      const file=$("episodeVideoFile")?.files?.[0]||null,rawUrl=$("episodeVideoUrl")?.value.trim()||"";
      const primaryResolution=$("episodeResolution")?.value||"original";
      const language=$("episodeLanguage")?.value.trim()||"";
      const series=(window.BUNNY_HUB_DATA||[]).find(item=>String(item.id)===String(seriesId)&&item.type==="Web Series");
      if(!seriesId||!series)throw new Error("Select a published Web Series.");
      if(!Number.isInteger(season)||season<1||season>100||!Number.isInteger(episode)||episode<1||episode>500)throw new Error("Season and episode numbers must be valid.");
      if(!title)throw new Error("Episode title is required.");
      if(file&&rawUrl)throw new Error("Choose either an uploaded primary video or a primary URL, not both.");
      const extraDefinitions=[["4K","episode4kUrl"],["1080p","episode1080Url"],["720p","episode720Url"],["480p","episode480Url"]];
      const extraAssets=extraDefinitions.map(([resolution,id])=>({resolution,url:$(id)?.value.trim()||""})).filter(item=>item.url).map(item=>({resolution:item.resolution,url:validUrl(item.url),storage_path:validUrl(item.url),storage_provider:"direct",asset_type:"video",language:language||series.language||"",is_primary:false}));
      if(file&&primaryResolution&&extraAssets.some(asset=>asset.resolution===primaryResolution))throw new Error("The primary quality is also listed as an alternate link.");
      let primaryAsset=null;
      if(file){
        uploaded=await uploadEpisodeFile(file,user,provider);
        primaryAsset={resolution:primaryResolution,asset_url:"private://"+uploaded.path,storage_path:uploaded.path,storage_provider:provider,asset_type:"video",language:language||series.language||"",is_primary:true};
      }else if(rawUrl){
        const url=validUrl(rawUrl);
        primaryAsset={resolution:primaryResolution,asset_url:url,storage_path:url,storage_provider:"direct",asset_type:"video",language:language||series.language||"",is_primary:true};
      }else if(extraAssets.length){
        primaryAsset=extraAssets.shift();primaryAsset.asset_url=primaryAsset.url;primaryAsset.is_primary=true;
      }else{
        throw new Error("Upload a primary video or provide at least one authorised quality URL.");
      }
      if(primaryAsset.resolution&&extraAssets.some(asset=>asset.resolution===primaryAsset.resolution))throw new Error("Duplicate video quality selected.");
      const allAssets=[primaryAsset,...extraAssets];
      const videoUrl=primaryAsset.asset_url,storageProvider=primaryAsset.storage_provider;
      const row={
        title,content_type:"Episode",parent_series_id:seriesId,season_number:season,episode_number:episode,
        video_url:videoUrl,storage_provider:storageProvider,published:true,created_by:user.id,
        release_year:Number($("episodeReleaseYear")?.value)||series.year||null,
        duration:$("episodeDuration")?.value.trim()||"",
        description:$("episodeDescription")?.value.trim()||"",
        poster_url:validUrl($("episodePoster")?.value.trim()||"")||series.poster||null,
        genre:series.genre||"Drama",language:language||series.language||"",industry:series.industry||"All"
      };
      const {data:created,error}=await db.from("vh_content").insert(row).select("id").single();
      if(error)throw error;createdId=created.id;
      const assetRows=allAssets.map(asset=>({content_id:created.id,asset_type:"video",asset_url:asset.asset_url||asset.url,storage_path:asset.storage_path||asset.url,storage_provider:asset.storage_provider||"direct",resolution:asset.resolution||null,is_primary:!!asset.is_primary,language:asset.language||""}));
      const {error:assetError}=await db.from("vh_media_assets").insert(assetRows);
      if(assetError)throw assetError;
      published=true;
      await notifyTelegramPublish(created.id);
      form?.reset();$("episodeSeasonNumber").value="1";
      if(status)status.textContent="Episode published successfully.";
      toast("Episode published successfully.");
      await loadEpisodeList(seriesId);
      await window.refreshBunnyHubCatalog?.();
    }catch(error){
      if(createdId&&!published)await db.from("vh_content").delete().eq("id",createdId);
      if(uploaded?.path&&!published)await cleanupUploaded(uploaded.path,uploaded.provider);
      if(status)status.textContent=published?"Episode was published, but the page refresh needs retry: "+(error.message||"refresh failed"):(error.message||"Episode could not be published.");
      toast(published?"Episode published. Reload the catalog if it does not appear.":(error.message||"Episode publish failed."));
    }finally{if(button)button.disabled=false;}
  };
  window.deleteEpisode=async(id,seriesId)=>{
    if(typeof window.deletePublishedContent==="function")await window.deletePublishedContent(id);
    await loadEpisodeList(seriesId);
  };
  window.playEpisode=id=>{
    window.openMovie?.(id);
    window.playMovie?.();
  };
  function renderSeriesEpisodes(series){
    const panel=$("seriesEpisodesPanel"),host=$("seriesEpisodesList");
    if(!panel||!host)return;
    const playButton=$("modalPlayBtn"),downloadButton=document.querySelector("#movieModal .btn-download");
    if(series&&series.type==="Web Series"){
      if(playButton){playButton.disabled=true;playButton.innerHTML='<i class="fas fa-list"></i> Choose an Episode';playButton.title="Select an episode from the list below";}
      if(downloadButton)downloadButton.classList.add("hidden");
    }else{
      if(playButton){playButton.disabled=false;playButton.innerHTML='<i class="fas fa-play"></i> Watch Now';playButton.title="Watch now";}
      if(downloadButton)downloadButton.classList.remove("hidden");
    }
    if(!series||series.type!=="Web Series"){panel.classList.add("hidden");host.textContent="";return;}
    const episodes=(window.BUNNY_HUB_DATA||[]).filter(item=>item.type==="Episode"&&String(item.parent_series_id)===String(series.id)).sort((a,b)=>(Number(a.season_number)-Number(b.season_number))||(Number(a.episode_number)-Number(b.episode_number)));
    if(!episodes.length){panel.classList.remove("hidden");host.innerHTML="<p>Episodes will appear here as soon as this series is updated by the team.</p>";return;}
    const groups=new Map();episodes.forEach(item=>{const key=Number(item.season_number)||1;const list=groups.get(key)||[];list.push(item);groups.set(key,list);});
    host.innerHTML=[...groups.entries()].map(([season,items])=>'<section class="vh-season-group"><h4>Season '+season+'</h4><div class="vh-episode-list">'+items.map(item=>'<article class="vh-episode-row"><div><strong>E'+String(item.episode_number).padStart(2,"0")+' · '+esc(item.title)+'</strong><small>'+esc(item.duration||"Episode")+(item.year?" · "+esc(item.year):"")+'</small><p>'+esc(item.description||"")+'</p></div><button type="button" class="btn-play" onclick="playEpisode('+Number(item.id)+')"><i class="fas fa-play"></i> Watch</button></article>').join("")+'</div></section>').join("");
    panel.classList.remove("hidden");
  }
  const baseOpen=window.openMovie;
  if(typeof baseOpen==="function"){
    window.openMovie=function(id){const result=baseOpen.apply(this,arguments);const item=(window.BUNNY_HUB_DATA||[]).find(entry=>String(entry.id)===String(id));renderSeriesEpisodes(item);return result;};
  }
  document.addEventListener("DOMContentLoaded",()=>{
    loadSeriesOptions();
    $("episodeSeriesId")?.addEventListener("change",event=>loadEpisodeList(event.target.value));
    document.addEventListener("BunnyHub:content-loaded",loadSeriesOptions);
  });
})();
