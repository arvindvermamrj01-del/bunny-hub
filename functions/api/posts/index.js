import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignB2 } from "../../_shared/b2.js";
import { presignR2 } from "../../_shared/r2.js";

const ROLES=["admin","sub_admin","content_editor"];
const cleanText=(value,max)=>String(value||"").trim().slice(0,max);
function validPath(path,userId){return typeof path==="string"&&path.startsWith(userId+"/")&&!path.includes("..")&&!path.startsWith("/");}

export async function onRequestGet({request,env}){
  try{
    const {user}=await requireRole(request,env,ROLES);
    const url=new URL(supabaseBase(env)+"/rest/v1/vh_posts");
    url.search=new URLSearchParams({select:"id,title,description,category,post_type,status,storage_provider,storage_path,thumbnail_path,created_at,updated_at",created_by:"eq."+user.id,order:"created_at.desc",limit:"100"}).toString();
    const response=await fetch(url,{headers:supabaseAdminHeaders(env)});
    const rows=await response.json().catch(()=>[]);
    if(!response.ok)return json({error:"Saved posts could not be loaded."},502);
    return json({posts:rows});
  }catch(error){return json({error:error.message||"Authentication required."},error.status||401);}
}

export async function onRequestPost({request,env}){
  try{
    const {user}=await requireRole(request,env,ROLES);
    let body;try{body=await request.json();}catch(_){return json({error:"Invalid JSON body."},400);}
    const title=cleanText(body.title,180),description=cleanText(body.description,5000),category=cleanText(body.category,80);
    const postType=String(body.postType||"");
    const provider=String(body.storageProvider||"").toLowerCase();
    const storagePath=String(body.storagePath||"");
    const thumbnailPath=body.thumbnailPath?String(body.thumbnailPath):null;
    const fileSize=Number(body.fileSize||0);
    if(!title)return json({error:"Post title is required."},400);
    if(!["video","song","photo"].includes(postType))return json({error:"Unsupported post type."},400);
    if(!["backblaze_b2","cloudflare_r2"].includes(provider))return json({error:"Unsupported storage provider."},400);
    if(!validPath(storagePath,user.id)||thumbnailPath&&!validPath(thumbnailPath,user.id))return json({error:"Uploaded file path does not belong to your account."},400);
    if(!Number.isFinite(fileSize)||fileSize<=0)return json({error:"Invalid media file size."},400);
    const payload={title,description,category,post_type:postType,status:"draft",visibility:"private",storage_provider:provider,storage_path:storagePath,thumbnail_path:thumbnailPath,file_name:cleanText(body.fileName,180),file_size:fileSize,created_by:user.id};
    const response=await fetch(supabaseBase(env)+"/rest/v1/vh_posts",{method:"POST",headers:{...supabaseAdminHeaders(env),Prefer:"return=representation"},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>[]);
    if(!response.ok)return json({error:data.message||data.details||"Draft could not be saved. Apply the Posts database setup SQL first."},response.status===404||response.status===400?503:502);
    return json({post:data[0]||null},201);
  }catch(error){return json({error:error.message||"Could not save post."},error.status||401);}
}
