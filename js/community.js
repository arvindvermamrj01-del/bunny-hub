/* Community suggestions, bug reports, public roadmap and one-vote-per-user flow. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE,$=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const notify=message=>typeof window.toast==="function"?window.toast(message):window.alert(message);
  let loading=false;
  async function loadBoard(){
    const host=$("communityFeedbackList");if(!host||!db||loading)return;
    loading=true;
    try{
      const {data,error}=await db.from("vh_feedback").select("id,category,title,description,status,admin_response,upvotes,created_at").in("status",["planned","in_progress","completed"]).order("upvotes",{ascending:false}).order("created_at",{ascending:false}).limit(50);
      if(error)throw error;
      if(!data?.length){host.innerHTML="<p>No public roadmap items yet. Approved ideas will appear here.</p>";return;}
      host.innerHTML=data.map(item=>'<article class="community-feedback-card"><div class="community-feedback-meta"><span>'+esc(item.category.replace("_"," "))+'</span><span>'+esc(item.status.replace("_"," "))+'</span></div><h3>'+esc(item.title)+'</h3><p>'+esc(item.description)+'</p>'+(item.admin_response?'<blockquote class="community-admin-response"><strong>BunnyHub team:</strong> '+esc(item.admin_response)+'</blockquote>':'')+'<div class="community-feedback-actions"><button type="button" onclick="voteCommunityFeedback('+Number(item.id)+')"><i class="fas fa-arrow-up"></i> Vote · '+Number(item.upvotes||0)+'</button><small>'+new Date(item.created_at).toLocaleDateString()+'</small></div></article>').join("");
    }catch(error){host.textContent=error.message||"Community board is unavailable. Apply the feature upgrade SQL first.";}
    finally{loading=false;}
  }
  window.voteCommunityFeedback=async id=>{
    if(!db)return;
    try{
      const {data:{user},error:authError}=await db.auth.getUser();
      if(authError||!user){notify("Sign in to vote on community improvements.");window.showPage?.("login");return;}
      const {error}=await db.rpc("vh_vote_feedback",{p_feedback_id:Number(id)});
      if(error)throw error;
      await loadBoard();
    }catch(error){notify(error.message||"Your vote could not be saved.");}
  };
  async function submitFeedback(event){
    event.preventDefault();
    const form=event.currentTarget;
    const status=$("communitySubmitStatus"),button=event.currentTarget.querySelector('[type="submit"]');
    if(button)button.disabled=true;if(status)status.textContent="Submitting…";
    try{
      if(!db)throw new Error("Community service is unavailable.");
      const {data:{user},error:authError}=await db.auth.getUser();
      if(authError||!user){window.showPage?.("login");throw new Error("Please sign in before submitting feedback.");}
      const category=$("communityCategory")?.value||"suggestion";
      const title=$("communityTitle")?.value.trim()||"",description=$("communityDescription")?.value.trim()||"";
      if(!["suggestion","bug","complaint"].includes(category)||title.length<4||title.length>120||description.length<10||description.length>3000)throw new Error("Check the feedback type, title and details.");
      const {error}=await db.from("vh_feedback").insert({user_id:user.id,category,title,description,status:"pending",upvotes:0});
      if(error)throw error;
      form?.reset();
      if(status)status.textContent="Submitted. Your feedback is waiting for admin review.";
    }catch(error){if(status)status.textContent=error.message||"Feedback submission failed.";}
    finally{if(button)button.disabled=false;}
  }
  document.addEventListener("DOMContentLoaded",()=>{
    $("communityFeedbackForm")?.addEventListener("submit",submitFeedback);
    loadBoard();
    const page=$("page-community");
    if(page)new MutationObserver(()=>{if(page.classList.contains("active"))loadBoard();}).observe(page,{attributes:true,attributeFilter:["class"]});
  });
})();
