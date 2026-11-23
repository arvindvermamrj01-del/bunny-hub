/* BunnyHub appearance system: original HyperOS/ColorOS-inspired themes. */
(() => {
  "use strict";
  const root=document.documentElement;
  const key="vh_theme_preference";
  const themes={
    hyperos:{label:"Xiaomi HyperOS 4",theme:"hyperos"},
    miuiOneUi:{label:"MIUI × One UI 9 Blend",theme:"miui-oneui"},
    oneui:{label:"Samsung One UI 9",theme:"oneui"},
    oxygenos:{label:"OxygenOS 16",theme:"oxygenos"},
    hydrogenos:{label:"HydrogenOS Heritage",theme:"hydrogenos"},
    coloros:{label:"ColorOS 17",theme:"coloros"},
    amoled:{label:"AMOLED Black",theme:"amoled"},
    light:{label:"Light Glass",theme:"light"}
  };
  const panel=()=>document.getElementById("themePanel");
  const apply=value=>{
    const selected=themes[value]?value:"coloros";
    root.dataset.vhTheme=themes[selected].theme||selected;
    root.dataset.theme=selected==="light"?"light":"dark";
    root.style.colorScheme=selected==="light"?"light":"dark";
    try{localStorage.setItem(key,selected);}catch(_){}
    document.querySelectorAll("[data-theme-choice]").forEach(button=>{
      const active=button.dataset.themeChoice===selected;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    const label=document.getElementById("themeCurrentLabel");
    if(label)label.textContent=themes[selected].label;
    const meta=document.querySelector('meta[name="theme-color"]');
    const themeColors={light:"#eef3fb",amoled:"#000000",coloros:"#071b2a",hyperos:"#0b1020",miuiOneUi:"#141e33",oneui:"#111827",oxygenos:"#10151d",hydrogenos:"#101820"};
    if(meta)meta.content=themeColors[selected]||"#0b1020";
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
    /* Render the appearance chooser as a body-level popup so desktop fixed positioning is viewport-relative. */
    const appearancePanel=panel();
    if(appearancePanel&&appearancePanel.parentElement!==document.body)document.body.appendChild(appearancePanel);
    let saved="coloros";
    try{
      const migrationKey="vh_theme_coloros_default_migrated";
      if(!localStorage.getItem(migrationKey)){
        const previous=localStorage.getItem(key);
        if(!previous||previous==="hyperos")localStorage.setItem(key,localStorage.getItem("vh_theme")==="light"?"light":"coloros");
        localStorage.setItem(migrationKey,"1");
      }
      saved=localStorage.getItem(key)||(localStorage.getItem("vh_theme")==="light"?"light":"coloros");
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
