/* BunnyHub responsive navigation: auto-collapsing premium desktop rail + labelled mobile dock. */
(() => {
  "use strict";
  const mobileQuery=()=>window.matchMedia("(max-width:760px)").matches;
  let autoSlideTimer=null,autoResumeTimer=null,autoDirection=1,sidebarCollapseTimer=null,lastPointerActivity=0;
  const AUTO_SLIDE_INTERVAL=3000;
  const AUTO_RESUME_DELAY=3000;
  const reducedMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clearAutoSlide(){
    if(autoSlideTimer){clearInterval(autoSlideTimer);autoSlideTimer=null;}
    if(autoResumeTimer){clearTimeout(autoResumeTimer);autoResumeTimer=null;}
  }
  function slideToNextItem(){
    const dock=document.querySelector(".vh-mobile-dock");if(!dock||!mobileQuery())return;
    const buttons=[...dock.querySelectorAll(":scope > .vh-mobile-nav-item")];if(buttons.length<2)return;
    const bounds=dock.getBoundingClientRect(),center=bounds.left+bounds.width/2;
    let current=0,best=Infinity;
    buttons.forEach((button,index)=>{const rect=button.getBoundingClientRect();const dist=Math.abs(rect.left+rect.width/2-center);if(dist<best){best=dist;current=index;}});
    let next=current+autoDirection;
    if(next>=buttons.length){autoDirection=-1;next=buttons.length-2;}
    else if(next<0){autoDirection=1;next=1;}
    const rect=buttons[next].getBoundingClientRect();
    const delta=(rect.left+rect.width/2)-(bounds.left+bounds.width/2);
    dock.scrollBy({left:delta,behavior:"smooth"});
  }
  function scheduleAutoSlide(delay=AUTO_RESUME_DELAY){
    clearAutoSlide();if(!mobileQuery()||reducedMotion()||document.hidden)return;
    autoResumeTimer=setTimeout(()=>{
      slideToNextItem();
      autoSlideTimer=setInterval(slideToNextItem,AUTO_SLIDE_INTERVAL);
    },Math.max(0,delay));
  }
  function startAutoSlide(delay=AUTO_RESUME_DELAY){scheduleAutoSlide(delay);}
  function pauseAutoSlide(resumeAfter=AUTO_RESUME_DELAY){clearAutoSlide();if(mobileQuery())scheduleAutoSlide(resumeAfter);}
  const items=[
    {page:"home",label:"Home",icon:"fa-house"},
    {page:"movies",label:"Movies",icon:"fa-clapperboard"},
    {page:"series",label:"Web Series",icon:"fa-tv"},
    {page:"shows",label:"Shows",icon:"fa-star"},
    {page:"songs",label:"Songs",icon:"fa-music"},
    {page:"shorts",label:"Shorts",icon:"fa-bolt"},
    {page:"watchlist",label:"Watchlist",icon:"fa-bookmark"},
    {page:"request",label:"Request Content",icon:"fa-paper-plane"},
    {action:"donate",label:"Donation",icon:"fa-heart"},
    {page:"feedback",label:"Feedback & Support",icon:"fa-comment-dots"},
    {page:"community",label:"BunnyHub Community",icon:"fa-users"},
    {action:"settings",label:"Settings",icon:"fa-gear"}
  ];
  const makeButton=item=>{
    const button=document.createElement("button");
    button.type="button";button.className="vh-mobile-nav-item";
    button.setAttribute("aria-label",item.label);button.title=item.label;
    if(item.page)button.dataset.vhPage=item.page;
    if(item.action)button.dataset.vhAction=item.action;
    const icon=document.createElement("i");icon.className="fas "+item.icon;icon.setAttribute("aria-hidden","true");
    const label=document.createElement("span");label.textContent=item.label;
    button.append(icon,label);
    button.addEventListener("click",event=>{
      event.preventDefault();
      event.stopPropagation();
      execute(button);
    });
    return button;
  };
  function sync(name){
    const page=String(name||"home").replace(/^page-/,"");
    document.querySelectorAll("#vhAppSidebar [data-vh-nav]").forEach(button=>{
      const active=button.dataset.vhNav===page;
      button.classList.toggle("active",active);button.setAttribute("aria-current",active?"page":"false");
    });
    document.querySelectorAll(".vh-mobile-dock [data-vh-page]").forEach(button=>{
      const active=button.dataset.vhPage===page;
      button.classList.toggle("active",active);button.setAttribute("aria-current",active?"page":"false");
    });
  }
  function routePage(page){
    const requested=String(page||"").replace(/^page-/,"");
    if(!requested)return false;
    try{
      if(typeof window.showPage==="function")window.showPage(requested);
    }catch(error){
      console.error("BunnyHub page router failed; applying safe route fallback:",error);
    }
    let resolved=requested;
    if(requested==="profile"&&!window.VH_USER_ID)resolved="login";
    if(requested==="admin"&&!window.VH_IS_ADMIN)resolved="admin-login";
    const target=document.getElementById("page-"+resolved);
    if(!target){
      console.error("BunnyHub navigation target is missing:",resolved);
      return false;
    }
    document.querySelectorAll(".page").forEach(section=>{
      const active=section===target;
      section.classList.toggle("active",active);
      section.style.setProperty("display",active?"block":"none","important");
    });
    const privatePages=["login","register","reset-password","admin-login","admin"];
    document.body.classList.toggle("vh-sidebar-hidden",privatePages.includes(resolved));
    document.getElementById("navLinks")?.classList.remove("open");
    if(document.getElementById("movieModal")?.classList.contains("open"))window.closeModalBtn?.();
    sync(resolved);
    try{window.scrollTo({top:0,behavior:"smooth"});}catch(_){}
    return true;
  }
  function execute(button){
    const page=button.dataset.vhPage||button.dataset.vhNav,action=button.dataset.vhAction;
    const donationModal=document.getElementById("donationModal");
    const donationOpen=!!donationModal?.classList.contains("open");
    if(donationOpen){
      window.closeDonationPanel?.();
      if(action==="donate"){
        if(mobileQuery())pauseAutoSlide(AUTO_RESUME_DELAY);
        return;
      }
    }
    if(mobileQuery()){
      try{button.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}catch(_){}
      pauseAutoSlide(AUTO_RESUME_DELAY);
    }else if(button.classList.contains("vh-sidebar-button")){
      revealSidebar();
    }
    if(action==="donate"){window.openDonationPanel?.();return;}
    if(action==="settings"){window.toggleThemePanel?.();return;}
    if(page)routePage(page);
  }
  function createDock(){
    if(document.querySelector(".vh-mobile-dock"))return;
    const dock=document.createElement("nav");dock.className="vh-mobile-dock";dock.setAttribute("aria-label","All BunnyHub sections");
    items.forEach(item=>dock.appendChild(makeButton(item)));
    dock.addEventListener("pointerdown",()=>pauseAutoSlide(AUTO_RESUME_DELAY),{passive:true});
    dock.addEventListener("wheel",()=>pauseAutoSlide(AUTO_RESUME_DELAY),{passive:true});
    dock.addEventListener("focusin",()=>pauseAutoSlide(AUTO_RESUME_DELAY));
    dock.addEventListener("mouseenter",()=>pauseAutoSlide(AUTO_RESUME_DELAY));
    dock.addEventListener("mouseleave",()=>pauseAutoSlide(AUTO_RESUME_DELAY));
    document.addEventListener("visibilitychange",()=>{if(document.hidden)clearAutoSlide();else startAutoSlide(AUTO_RESUME_DELAY);});
    window.addEventListener("resize",()=>{if(mobileQuery())startAutoSlide(AUTO_RESUME_DELAY);else clearAutoSlide();});
    document.body.appendChild(dock);
  }
  function bindAutoSlideActivity(){
    const resume=()=>{if(mobileQuery())pauseAutoSlide(AUTO_RESUME_DELAY);};
    document.addEventListener("pointerdown",resume,{passive:true});
    document.addEventListener("touchstart",resume,{passive:true});
    document.addEventListener("wheel",resume,{passive:true});
    document.addEventListener("keydown",resume);
    document.addEventListener("click",resume,true);
    document.addEventListener("pointermove",()=>{
      if(!mobileQuery())return;
      const now=Date.now();
      if(now-lastPointerActivity<350)return;
      lastPointerActivity=now;
      pauseAutoSlide(AUTO_RESUME_DELAY);
    },{passive:true});
  }
  function clearSidebarCollapse(){
    if(sidebarCollapseTimer){clearTimeout(sidebarCollapseTimer);sidebarCollapseTimer=null;}
  }
  function setSidebarExpanded(expanded){
    if(mobileQuery()){
      document.body.classList.remove("vh-sidebar-expanded");
      clearSidebarCollapse();
      return;
    }
    document.body.classList.toggle("vh-sidebar-expanded",!!expanded);
    const sidebar=document.getElementById("vhAppSidebar");
    sidebar?.setAttribute("aria-expanded",expanded?"true":"false");
  }
  function scheduleSidebarCollapse(delay=3000){
    clearSidebarCollapse();
    if(mobileQuery()||document.hidden)return;
    sidebarCollapseTimer=setTimeout(()=>{
      const sidebar=document.getElementById("vhAppSidebar");
      const focused=document.activeElement;
      if(sidebar?.contains(focused)&&focused?.matches?.(":focus-visible")){
        scheduleSidebarCollapse(3000);
        return;
      }
      setSidebarExpanded(false);
    },Math.max(0,delay));
  }
  function revealSidebar(){
    if(mobileQuery())return;
    setSidebarExpanded(true);
    scheduleSidebarCollapse(3000);
  }
  function bindDesktopSidebar(){
    const sidebar=document.getElementById("vhAppSidebar");if(!sidebar||sidebar.dataset.bound==="1")return;
    sidebar.dataset.bound="1";
    sidebar.setAttribute("aria-expanded","false");
    sidebar.addEventListener("pointerenter",revealSidebar,{passive:true});
    sidebar.addEventListener("pointermove",()=>{
      if(!document.body.classList.contains("vh-sidebar-expanded"))setSidebarExpanded(true);
      scheduleSidebarCollapse(3000);
    },{passive:true});
    sidebar.addEventListener("pointerdown",revealSidebar,{passive:true});
    sidebar.addEventListener("pointerleave",()=>scheduleSidebarCollapse(3000),{passive:true});
    sidebar.addEventListener("focusin",()=>{
      clearSidebarCollapse();
      setSidebarExpanded(true);
    });
    sidebar.addEventListener("focusout",()=>{
      requestAnimationFrame(()=>{
        if(!sidebar.contains(document.activeElement))scheduleSidebarCollapse(3000);
      });
    });
    sidebar.querySelectorAll("button[data-vh-nav],button[data-vh-action]").forEach(button=>{
      button.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        execute(button);
      });
    });
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden)clearSidebarCollapse();
      else if(!mobileQuery())scheduleSidebarCollapse(3000);
    });
    window.addEventListener("resize",()=>{
      if(mobileQuery()){clearSidebarCollapse();setSidebarExpanded(false);}
      else scheduleSidebarCollapse(3000);
    },{passive:true});
    if(!mobileQuery()){
      setSidebarExpanded(true);
      scheduleSidebarCollapse(3000);
    }
  }
  function setUserDropdownOpen(open){
    const button=document.getElementById("userAvatar");
    const menu=document.getElementById("userDropdown");
    if(!button||!menu)return;
    menu.classList.toggle("open",!!open);
    button.setAttribute("aria-expanded",open?"true":"false");
  }
  function bindUserDropdown(){
    const nav=document.getElementById("userNav");
    const button=document.getElementById("userAvatar");
    const menu=document.getElementById("userDropdown");
    if(!nav||!button||!menu||nav.dataset.vhMenuBound==="1")return;
    nav.dataset.vhMenuBound="1";
    button.addEventListener("click",event=>{
      event.preventDefault();
      event.stopPropagation();
      setUserDropdownOpen(!menu.classList.contains("open"));
    });
    menu.addEventListener("click",event=>{
      if(event.target.closest("a"))setUserDropdownOpen(false);
    });
    document.addEventListener("pointerdown",event=>{
      if(!nav.contains(event.target))setUserDropdownOpen(false);
    });
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&menu.classList.contains("open")){
        setUserDropdownOpen(false);
        button.focus();
      }
    });
  }
  function init(){
    createDock();bindAutoSlideActivity();bindDesktopSidebar();bindUserDropdown();
    if(mobileQuery())startAutoSlide(AUTO_RESUME_DELAY);
    document.addEventListener("BunnyHub:page-changed",event=>sync(event.detail?.name||"home"));
    window.addEventListener("hashchange",()=>sync(location.hash.replace(/^#/,"")||"home"));
    const hash=location.hash.replace(/^#/,"");sync(hash.startsWith("movie-")?"home":(hash||"home"));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
