/* Google AdSense & Custom Ad Script Controller with Timing & Cooldown. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const db=window.VH_SUPABASE;
  let settings={
    ads_enabled:"off",
    adsense_publisher_id:"",
    adsense_slot_home:"",
    adsense_slot_footer:"",
    ad_network_mode:"off",
    ad_delay_sec:"5",
    ad_frequency_min:"15",
    custom_ad_script:""
  };
  const validPublisher=value=>/^ca-pub-\d{10,20}$/.test(String(value||"").trim());
  const validSlot=value=>/^\d{6,20}$/.test(String(value||"").trim());
  let scriptClient="";
  let customInjected=false;
  let customTimer=null;
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
  function injectCustomScript(rawHtml){
    if(customInjected||!rawHtml)return;
    const freqMin=Math.max(0,Number(settings.ad_frequency_min)||0);
    const cooldownKey="vh_custom_ad_last_run";
    try{
      if(freqMin>0){
        const last=Number(localStorage.getItem(cooldownKey)||0);
        if(last&&(Date.now()-last)<freqMin*60*1000)return;
      }
    }catch(_){}
    const delayMs=Math.max(0,Math.min(120,Number(settings.ad_delay_sec)||0))*1000;
    clearTimeout(customTimer);
    customTimer=setTimeout(()=>{
      if(customInjected)return;
      const activePage=document.querySelector(".page.active")?.id||"page-home";
      if(["page-admin","page-admin-login"].includes(activePage))return;
      try{
        const container=document.createElement("div");
        container.innerHTML=rawHtml;
        container.querySelectorAll("script").forEach(oldScript=>{
          const s=document.createElement("script");
          Array.from(oldScript.attributes).forEach(attr=>s.setAttribute(attr.name,attr.value));
          if(oldScript.textContent)s.textContent=oldScript.textContent;
          s.dataset.vhCustomAd="1";
          document.head.appendChild(s);
        });
        customInjected=true;
        try{localStorage.setItem(cooldownKey,String(Date.now()));}catch(_){}
      }catch(err){console.warn("Custom ad script error:",err);}
    },delayMs);
  }
  function apply(next){
    settings={...settings,...(next||{})};
    const mode=settings.ad_network_mode||(settings.ads_enabled==="on"?"adsense":"off");
    const useAdsense=settings.ads_enabled==="on"&&(mode==="adsense"||mode==="both"||mode==="off");
    const useCustom=(mode==="custom"||mode==="both")&&Boolean(String(settings.custom_ad_script||"").trim());
    const publisher=String(settings.adsense_publisher_id||"").trim();
    const activePage=document.querySelector(".page.active")?.id||"page-home";
    const allowedPage=["page-home","page-movies","page-series","page-shorts","page-songs"].includes(activePage);
    if(useCustom&&allowedPage){
      injectCustomScript(String(settings.custom_ad_script||"").trim());
    }
    if(!useAdsense||!validPublisher(publisher)||!allowedPage){
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
      const {data,error}=await db.from("vh_site_settings").select("setting_key,setting_value").in("setting_key",["ads_enabled","adsense_publisher_id","adsense_slot_home","adsense_slot_footer","ad_network_mode","ad_delay_sec","ad_frequency_min","custom_ad_script"]);
      if(error)throw error;
      const next={};(data||[]).forEach(row=>next[row.setting_key]=row.setting_value);
      apply(next);
    }catch(error){console.warn("Ad settings unavailable:",error.message);apply({ads_enabled:"off",ad_network_mode:"off"});}
  }
  document.addEventListener("DOMContentLoaded",load);
  document.addEventListener("BunnyHub:page-changed",()=>apply(settings));
  window.addEventListener("vh:site-settings-updated",event=>apply(event.detail||{}));
})();
