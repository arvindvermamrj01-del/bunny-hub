import { json, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignB2 } from "../../_shared/b2.js";
import { presignR2 } from "../../_shared/r2.js";

export async function onRequestGet({env}){
  try{
    const url=new URL(supabaseBase(env)+"/rest/v1/vh_posts");
    url.search=new URLSearchParams({select:"id,title,description,category,post_type,status,visibility,storage_provider,storage_path,thumbnail_path,created_at,updated_at",status:"eq.published",visibility:"eq.public",order:"created_at.desc",limit:"60"}).toString();
    const response=await fetch(url,{headers:supabaseAdminHeaders(env)});
    if(!response.ok)return json({error:"Published posts could not be loaded."},502);
    const rows=await response.json();
    const posts=await Promise.all(rows.map(async post=>{
      const sign=path=>post.storage_provider==="backblaze_b2"?presignB2(env,"GET",path,"",3600):presignR2(env,"GET",path,"",3600);
      const media=await sign(post.storage_path);
      const thumb=post.thumbnail_path?await sign(post.thumbnail_path):null;
      return {id:post.id,title:post.title,description:post.description,category:post.category,post_type:post.post_type,created_at:post.created_at,media_url:media.url,thumbnail_url:thumb?.url||null};
    }));
    return json({posts,expires_in:3600},200,{"cache-control":"public, max-age=60"});
  }catch(error){return json({error:error.message||"Published posts are unavailable."},503);}
}
