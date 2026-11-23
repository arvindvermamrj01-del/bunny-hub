/* Google AdSense placements. No click tracking is added; Google handles ad reporting. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const db=window.VH_SUPABASE;
  let settings={ads_enabled:"off",adsense_publisher_id:"",adsense_slot_home:"",adsense_slot_footer:""};
  const validPublisher=value=>/^ca-pub-\d{10,20}$/.test(String(value||"").trim());
  const validSlot=value=>/^\d{6,20}$/.test(String(value||"").trim());
  let scriptClient="";
  function clear(host){if(host){host.replaceChildren();host.hidden=true;}}
  function renderPlacement(id,slot,publisher){
    const host=$(id);if(!host)return;
    clear(host);
    if(!validSlot(slot))return;
    const ins=document.createElement("ins");
    ins.className="adsbygoogle";
    ins.style.display="block";
    ins.dataset.adClient=publisher;
    ins.dataset.adSlot=slot;
    ins.dataset.adFormat="auto";
    ins.dataset.fullWidthResponsive="true";
    ins.setAttribute("aria-label","Advertisement");
    host.appendChild(ins);
    host.hidden=false;
    try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}
    catch(error){console.warn("AdSense placement unavailable:",error);clear(host);}
  }
  function apply(next){
    settings={...settings,...(next||{})};
    const enabled=settings.ads_enabled==="on";
    const publisher=String(settings.adsense_publisher_id||"").trim();
    const activePage=document.querySelector(".page.active")?.id||"page-home";
    const allowedPage=["page-home","page-movies","page-series","page-shorts","page-songs"].includes(activePage);
    if(!enabled||!validPublisher(publisher)||!allowedPage){
      clear($("vhAdHomeTop"));clear($("vhAdFooter"));return;
    }
    const script=document.querySelector('script[data-vh-adsense]');
    if(script&&script.dataset.client!==publisher){script.remove();scriptClient="";}
    if(!scriptClient||scriptClient!==publisher){
      const node=document.createElement("script");
      node.async=true;node.crossOrigin="anonymous";node.dataset.vhAdsense="1";node.dataset.client=publisher;
      node.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+encodeURIComponent(publisher);
      node.onerror=()=>{scriptClient="";clear($("vhAdHomeTop"));clear($("vhAdFooter"));console.warn("AdSense script could not load.");};
      document.head.appendChild(node);scriptClient=publisher;
    }
    if(activePage==="page-home")renderPlacement("vhAdHomeTop",settings.adsense_slot_home,publisher);
    else clear($("vhAdHomeTop"));
    renderPlacement("vhAdFooter",settings.adsense_slot_footer,publisher);
  }
  async function load(){
    if(!db)return;
    try{
      const {data,error}=await db.from("vh_site_settings").select("setting_key,setting_value").in("setting_key",["ads_enabled","adsense_publisher_id","adsense_slot_home","adsense_slot_footer"]);
      if(error)throw error;
      const next={};(data||[]).forEach(row=>next[row.setting_key]=row.setting_value);
      apply(next);
    }catch(error){console.warn("AdSense settings unavailable:",error.message);apply({ads_enabled:"off"});}
  }
  document.addEventListener("DOMContentLoaded",load);
  document.addEventListener("BunnyHub:page-changed",()=>apply(settings));
  window.addEventListener("vh:site-settings-updated",event=>apply(event.detail||{}));
})();
