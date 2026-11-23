/* Privacy-light first-party event tracking. Stores no email, IP, or identifying profile data. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE;
  if(!db)return;
  let sessionTag="";
  try{sessionTag=sessionStorage.getItem("vh_analytics_session")||crypto.randomUUID();sessionStorage.setItem("vh_analytics_session",sessionTag);}
  catch(_){sessionTag="tab-"+Date.now().toString(36);}
  const sent=new Set();
  const track=(event_type,content_id=null,tag=sessionTag)=>{
    const key=event_type+":"+String(content_id||"")+":"+(event_type==="page_view"?tag:"");
    if(event_type==="page_view"&&sent.has(key))return;
    sent.add(key);
    db.from("vh_analytics_events").insert({event_type,content_id,session_tag:tag})
      .then(({error})=>{if(error)console.debug("Analytics event not stored:",error.message);});
  };
  const currentPage=()=>document.querySelector(".page.active")?.id?.replace("page-","")||"home";
  const observePage=()=>{
    const page=currentPage();
    if(page)track("page_view",null,sessionTag+":"+page);
  };
  document.addEventListener("DOMContentLoaded",()=>{
    observePage();
    document.querySelectorAll(".page").forEach(page=>{
      new MutationObserver(()=>{if(page.classList.contains("active"))observePage();})
        .observe(page,{attributes:true,attributeFilter:["class"]});
    });
    document.addEventListener("click",event=>{
      const play=event.target.closest("#modalPlayBtn,#heroPlayBtn,.btn-play");
      if(play)track("play_click",window.VH_CURRENT_CONTENT_ID||null);
      const download=event.target.closest("[data-vh-download]");
      if(download)track("download_click",window.VH_CURRENT_CONTENT_ID||null);
    });
  });
  const originalOpen=window.openMovie;
  if(typeof originalOpen==="function"){
    window.openMovie=function(id){
      // content_id is a foreign key to vh_content; demo catalogue IDs must not be sent.
      const item=(window.BUNNY_HUB_DATA||[]).find(entry=>String(entry.id)===String(id));
      const contentId=item?.isSupabaseContent?(Number(id)||null):null;
      track("content_view",contentId);
      window.VH_CURRENT_CONTENT_ID=contentId;
      return originalOpen.apply(this,arguments);
    };
  }
})();
