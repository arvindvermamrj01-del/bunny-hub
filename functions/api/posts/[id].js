import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignB2 } from "../../_shared/b2.js";
import { presignR2 } from "../../_shared/r2.js";

const ROLES=["admin","sub_admin","content_editor"];
const validPath=(path,userId)=>typeof path==="string"&&path.startsWith(userId+"/")&&!path.includes("..")&&!path.startsWith("/");
async function signedMedia(env,post,path){
  if(!path||!validPath(path,post.created_by))throw new Error("Stored media ownership check failed.");
  const signed=post.storage_provider==="backblaze_b2"
    ? await presignB2(env,"GET",path,"",3600)
    : await presignR2(env,"GET",path,"",3600);
  return signed.url;
}
async function findOwnedPost(env,id,userId){
  const url=new URL(supabaseBase(env)+"/rest/v1/vh_posts");
  url.search=new URLSearchParams({id:"eq."+id,created_by:"eq."+userId,select:"id,title,description,category,post_type,status,visibility,storage_provider,storage_path,thumbnail_path,file_name,file_size,created_by"}).toString();
  const response=await fetch(url,{headers:supabaseAdminHeaders(env)});
  if(!response.ok)throw new Error("Post could not be loaded.");
  const rows=await response.json();
  return rows[0]||null;
}
export async function onRequestGet({request,env,params}){
  try{
    const {user}=await requireRole(request,env,ROLES);
    const id=String(params?.id||"");
    if(!/^[1-9]\d*$/.test(id))return json({error:"Invalid post ID."},400);
    const post=await findOwnedPost(env,id,user.id);
    if(!post)return json({error:"Post not found."},404);
    const url=await signedMedia(env,post,post.storage_path);
    const thumbnailUrl=post.thumbnail_path?await signedMedia(env,post,post.thumbnail_path):null;
    return json({post:{...post,preview_url:url,thumbnail_url:thumbnailUrl,expires_in:3600}});
  }catch(error){return json({error:error.message||"Could not preview post."},error.status||503);}
}
export async function onRequestPatch({request,env,params}){
  try{
    const {user}=await requireRole(request,env,ROLES);
    const id=String(params?.id||"");
    if(!/^[1-9]\d*$/.test(id))return json({error:"Invalid post ID."},400);
    let body;try{body=await request.json();}catch(_){return json({error:"Invalid JSON body."},400);}
    const existing=await findOwnedPost(env,id,user.id);
    if(!existing)return json({error:"Post not found or not owned by this account."},404);
    const title=String(body.title??existing.title).trim().slice(0,180);
    const description=String(body.description??existing.description??"").trim().slice(0,5000);
    const category=String(body.category??existing.category??"").trim().slice(0,80);
    if(!title)return json({error:"Post title is required."},400);
    const action=String(body.action||"save");
    let status=existing.status,visibility=existing.visibility;
    if(action==="publish"){status="published";visibility="public";}
    else if(action==="unpublish"){status="draft";visibility="private";}
    else if(action!=="save")return json({error:"Unsupported post action."},400);
    const url=supabaseBase(env)+"/rest/v1/vh_posts?id=eq."+encodeURIComponent(id)+"&created_by=eq."+encodeURIComponent(user.id);
    const response=await fetch(url,{method:"PATCH",headers:{...supabaseAdminHeaders(env),Prefer:"return=representation"},body:JSON.stringify({title,description,category,status,visibility,updated_at:new Date().toISOString()})});
    const rows=await response.json().catch(()=>[]);
    if(!response.ok)return json({error:"Post changes could not be saved."},502);
    return json({post:rows[0]||null});
  }catch(error){return json({error:error.message||"Could not update post."},error.status||503);}
}
async function removeObject(env,provider,path){
  if(!path)return;
  const signed=provider==="backblaze_b2"?await presignB2(env,"DELETE",path,"",900):await presignR2(env,"DELETE",path,"",900);
  const response=await fetch(signed.url,{method:"DELETE",headers:signed.headers||{}});
  if(!response.ok&&response.status!==404)throw new Error("Could not delete uploaded media (HTTP "+response.status+").");
}
export async function onRequestDelete({request,env,params}){
  try{
    const {user}=await requireRole(request,env,ROLES);
    const id=String(params?.id||"");
    if(!/^[1-9]\d*$/.test(id))return json({error:"Invalid post ID."},400);
    const post=await findOwnedPost(env,id,user.id);
    if(!post)return json({error:"Post not found or not owned by this account."},404);
    if(!validPath(post.storage_path,user.id)||post.thumbnail_path&&!validPath(post.thumbnail_path,user.id))return json({error:"Stored media ownership check failed; nothing was deleted."},403);
    await removeObject(env,post.storage_provider,post.storage_path);
    if(post.thumbnail_path)await removeObject(env,post.storage_provider,post.thumbnail_path);
    const deleted=await fetch(supabaseBase(env)+"/rest/v1/vh_posts?id=eq."+encodeURIComponent(id)+"&created_by=eq."+encodeURIComponent(user.id),{method:"DELETE",headers:{...supabaseAdminHeaders(env),Prefer:"return=minimal"}});
    if(!deleted.ok)return json({error:"Media removed, but the post record could not be deleted."},502);
    return json({deleted:true});
  }catch(error){return json({error:error.message||"Could not delete post."},error.status||503);}
}
