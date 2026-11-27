/* BunnyHub appearance system: 5 trending themes. */
(() => {
  "use strict";
  const root=document.documentElement;
  const key="vh_theme_preference";
  const themes={
    cyberpunk:{label:"Cyberpunk Neon",theme:"cyberpunk",color:"#070812"},
    obsidian:{label:"Obsidian Noir",theme:"obsidian",color:"#030305"},
    chroma:{label:"AI Chroma Glitch",theme:"chroma",color:"#090614"},
    solarize:{label:"Solarize Minimal",theme:"solarize",color:"#0b0f14"},
    quantum:{label:"Quantum Frost",theme:"quantum",color:"#071121"}
  };
  const panel=()=>document.getElementById("themePanel");
  const apply=value=>{
    const selected=themes[value]?value:"cyberpunk";
    root.dataset.vhTheme=themes[selected].theme||selected;
    root.dataset.theme="dark";
    root.style.colorScheme="dark";
    try{localStorage.setItem(key,selected);}catch(_){}
    document.querySelectorAll("[data-theme-choice]").forEach(button=>{
      const active=button.dataset.themeChoice===selected;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    const label=document.getElementById("themeCurrentLabel");
    if(label)label.textContent=themes[selected].label;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=themes[selected].color||"#070812";
  };
  window.setVHTheme=apply;
  const isMobile=()=>window.matchMedia?.("(max-width:760px)")?.matches===true;
  const setPanelOpen=open=>{
    const el=panel();if(!el)return;
    el.classList.toggle("open",!!open);
    el.setAttribute("aria-hidden",String(!open));
    document.getElementById("themeToggle")?.setAttribute("aria-expanded",String(open));
    document.body.classList.toggle("vh-mobile-settings-open",!!open&&isMobile());
  };
  window.toggleThemePanel=()=>{
    const el=panel();if(!el)return;
    setPanelOpen(!el.classList.contains("open"));
  };
  document.addEventListener("DOMContentLoaded",()=>{
    const appearancePanel=panel();
    if(appearancePanel&&appearancePanel.parentElement!==document.body)document.body.appendChild(appearancePanel);
    let saved="cyberpunk";
    try{
      const migrationKey="vh_theme_trending5_migrated";
      if(!localStorage.getItem(migrationKey)){
        const prev=localStorage.getItem(key);
        if(!themes[prev])localStorage.setItem(key,"cyberpunk");
        localStorage.setItem(migrationKey,"1");
      }
      const raw=localStorage.getItem(key);
      saved=themes[raw]?raw:"cyberpunk";
    }catch(_){}
    apply(saved);
    document.querySelectorAll("[data-theme-choice]").forEach(button=>{
      button.addEventListener("click",()=>{apply(button.dataset.themeChoice);setPanelOpen(false);});
    });
    document.addEventListener("click",event=>{
      const el=panel(),toggle=document.getElementById("themeToggle");
      const settingsButton=event.target?.closest?.('.vh-mobile-nav-item[data-vh-action="settings"]');
      if(el?.classList.contains("open")&&!el.contains(event.target)&&!toggle?.contains(event.target)&&!settingsButton){
        setPanelOpen(false);
      }
    });
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape")setPanelOpen(false);
    });
  });
})();
