/* Shared request submission and admin moderation for BunnyHub. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  const notify = message => {
    const toast = $("toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(notify.timer);
      notify.timer = setTimeout(() => toast.classList.remove("show"), 3000);
    } else {
      window.alert(message);
    }
  };
  const localRecent = request => {
    try {
      const list = JSON.parse(localStorage.getItem("vh_requests") || "[]");
      list.unshift({ title: request.request_title, type: request.content_type, date: new Date().toLocaleDateString() });
      localStorage.setItem("vh_requests", JSON.stringify(list.slice(0, 8)));
      const host = $("requestsList");
      if (host) host.innerHTML = list.slice(0, 8).map(item =>
        '<div class="request-item"><b>' + escapeHTML(item.title) + '</b><small>' +
        escapeHTML(item.type) + ' · ' + escapeHTML(item.date) + '</small></div>'
      ).join("");
    } catch (_) { /* Local preview is optional; Supabase is the source of truth. */ }
  };
  window.submitRequest = async event => {
    const form=event?.currentTarget,submitter=event?.submitter;
    event?.preventDefault();
    const title = $("reqTitle")?.value.trim();
    if (!title) return notify("Please enter the movie or series title.");
    const request = {
      request_title: title,
      content_type: $("reqType")?.value || "Movie",
      release_year: Number($("reqYear")?.value) || null,
      preferred_language: $("reqLang")?.value.trim() || null,
      notes: $("reqNotes")?.value.trim() || null,
      status: "pending",
      requester_id: null
    };
    if (!db) return notify("Request service is not connected yet. Please try again later.");
    try {
      const {data:{user}} = await db.auth.getUser();
      if (user) request.requester_id = user.id;
    } catch (_) { /* Guest requests remain supported. */ }
    const button = submitter || form?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      let createdRequest=null,insertResult;
      const insertQuery=db.from("vh_requests").insert(request);
      insertResult=request.requester_id?await insertQuery.select("id").single():await insertQuery;
      if(insertResult.error)throw insertResult.error;
      createdRequest=insertResult.data;
      // Notify the admin chat only for authenticated requests; notification failure never blocks submission.
      if (request.requester_id && createdRequest?.id) {
        try {
          const {data:{session}} = await db.auth.getSession();
          if (session?.access_token) await fetch("/api/telegram/notify-request", {
            method:"POST",
            headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
            body:JSON.stringify({requestId:createdRequest.id})
          });
        } catch (notificationError) {
          console.debug("Telegram request notification skipped:",notificationError.message);
        }
      }
      // Analytics is best-effort: a tracking failure must never undo a successful request.
      db.from("vh_analytics_events").insert({ event_type: "request_submit" })
        .then(({ error: analyticsError }) => {
          if (analyticsError) console.debug("Request analytics not stored:", analyticsError.message);
        });
      localRecent(request);
      $("reqTitle").value = "";
      $("reqYear").value = "";
      $("reqLang").value = "";
      $("reqNotes").value = "";
      notify("Request submitted successfully.");
      loadOwnRequests();
    } catch (error) {
      console.error("Request submission failed:", error);
      notify(error.message || "Request could not be submitted. Please try again.");
    } finally {
      if (button) button.disabled = false;
    }
  };

  async function loadOwnRequests() {
    const host=$("myRequestHistory");
    if(!host||!db)return;
    try {
      const {data:{user},error:authError}=await db.auth.getUser();
      if(authError)throw authError;
      if(!user){host.textContent="Sign in to view requests linked to your account.";if($("statRequests"))$("statRequests").textContent="0";return;}
      const {data,error}=await db.from("vh_requests").select("id,request_title,content_type,status,priority,admin_note,created_at").eq("requester_id",user.id).order("created_at",{ascending:false}).limit(50);
      if(error)throw error;
      if($("statRequests"))$("statRequests").textContent=String(data?.length||0);
      host.innerHTML=data?.length?data.map(item=>'<article class="request-history-item"><strong>'+escapeHTML(item.request_title)+'</strong><small>'+escapeHTML(item.content_type)+' · '+escapeHTML(item.status||"pending")+' · '+escapeHTML(item.priority||"normal")+' · '+escapeHTML(new Date(item.created_at).toLocaleDateString())+'</small>'+(item.admin_note?'<p>'+escapeHTML(item.admin_note)+'</p>':'')+'</article>').join(""):"No account-linked requests yet.";
    } catch(error) {
      console.warn("Personal request history unavailable:",error.message);
      host.textContent="Request history will be available after the request workflow database migration is applied.";
    }
  }
  async function isAdmin() {
    if (!db) throw new Error("Supabase is not connected.");
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Admin login required.");
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!["admin","sub_admin","moderator"].includes(profile?.role)) throw new Error("Request moderation permission required.");
    return user;
  }
  async function loadRequests() {
    const host = $("adminRequestsList");
    if (!host || !db) return;
    try {
      await isAdmin();
      const { data, error } = await db.from("vh_requests").select("*")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      if (!data?.length) {
        host.textContent = "No requests have been submitted yet.";
        return;
      }
      host.innerHTML = '<div class="request-admin-toolbar"><input id="vhRequestFilter" type="search" placeholder="Search requests..." aria-label="Search requests"><select id="vhRequestStatus" aria-label="Filter by status"><option value="">All statuses</option><option>pending</option><option>approved</option><option>completed</option><option>declined</option></select></div><div id="vhRequestCards"></div>';
      const cards=host.querySelector("#vhRequestCards");
      const render=()=>{
        const term=(host.querySelector("#vhRequestFilter")?.value||"").toLowerCase();
        const filter=host.querySelector("#vhRequestStatus")?.value||"";
        const visible=data.filter(item=>(!filter||(item.status||"pending")===filter)&&[item.request_title,item.content_type,item.preferred_language,item.notes].join(" ").toLowerCase().includes(term));
        cards.innerHTML=visible.length?visible.map(item=>{
          const status=item.status||"pending";
          return '<article class="request-item" style="padding:14px;margin:10px 0;border:1px solid var(--border);border-radius:10px">' +
            '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong>'+escapeHTML(item.request_title)+'</strong><span>'+escapeHTML(status.toUpperCase())+'</span></div>' +
            '<small>'+escapeHTML(item.content_type)+' · '+escapeHTML(item.release_year||"Year unknown")+' · '+escapeHTML(item.preferred_language||"Language not specified")+' · '+escapeHTML(new Date(item.created_at).toLocaleString())+'</small>' +
            (item.notes?'<p>'+escapeHTML(item.notes)+'</p>':'') +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            (status!=="approved"?'<button type="button" onclick="moderateRequest('+Number(item.id)+',\'approved\')">Approve</button>':'') +
            (status!=="declined"?'<button type="button" onclick="moderateRequest('+Number(item.id)+',\'declined\')">Decline</button>':'') +
            (status!=="completed"?'<button type="button" onclick="moderateRequest('+Number(item.id)+',\'completed\')">Complete</button>':'') +
            '<button type="button" onclick="addRequestNote('+Number(item.id)+')">Add note</button><button type="button" onclick="setRequestPriority('+Number(item.id)+')">Priority</button><button type="button" onclick="deleteRequest('+Number(item.id)+')">Delete</button></div>' +
            '<small>Priority: '+escapeHTML(item.priority||"normal")+'</small>' +
            (item.admin_note?'<p><strong>Admin note:</strong> '+escapeHTML(item.admin_note)+'</p>':'')+'</article>';
        }).join(""):"<p>No matching requests.</p>";
      };
      host.querySelector("#vhRequestFilter").addEventListener("input",render);
      host.querySelector("#vhRequestStatus").addEventListener("change",render);
      render();
    } catch (error) {
      host.textContent = error.message || "Could not load requests.";
    }
  }
  window.moderateRequest = async (id, status) => {
    try {
      const user = await isAdmin();
      const { error } = await db.from("vh_requests").update({
        status, reviewed_at: new Date().toISOString(), reviewed_by: user.id
      }).eq("id", id);
      if (error) throw error;
      notify("Request status updated.");
      await loadRequests();
    } catch (error) { notify(error.message || "Could not update request."); }
  };
  window.setRequestPriority = async id => {
    const priority=window.prompt("Priority: low, normal, high, urgent","normal");
    if(priority===null)return;
    const value=priority.trim().toLowerCase();
    if(!["low","normal","high","urgent"].includes(value))return notify("Choose low, normal, high or urgent.");
    try {
      await isAdmin();
      const {error}=await db.from("vh_requests").update({priority:value}).eq("id",id);
      if(error)throw error;
      notify("Priority updated.");
      await loadRequests();
    } catch(error) { notify(error.message||"Could not update priority."); }
  };
  window.addRequestNote = async id => {
    const note=window.prompt("Admin note / response for this request:");
    if(note===null)return;
    try {
      await isAdmin();
      const {error}=await db.from("vh_requests").update({admin_note:note.trim()||null}).eq("id",id);
      if(error)throw error;
      notify("Admin note saved.");
      await loadRequests();
    } catch(error) { notify(error.message||"Could not save note."); }
  };
  window.deleteRequest = async id => {
    if (!window.confirm("Permanently delete this request?")) return;
    try {
      await isAdmin();
      const { error } = await db.from("vh_requests").delete().eq("id", id);
      if (error) throw error;
      notify("Request deleted.");
      await loadRequests();
    } catch (error) { notify(error.message || "Could not delete request."); }
  };
  document.addEventListener("DOMContentLoaded", () => {
    const tab = $("tab-requests-admin");
    if (tab) {
      const observer = new MutationObserver(() => {
        if (tab.classList.contains("active")) loadRequests();
      });
      observer.observe(tab, { attributes: true, attributeFilter: ["class"] });
    }
    db?.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { loadRequests(); loadOwnRequests(); }
      else loadOwnRequests();
    });
    loadOwnRequests();
  });
})();
