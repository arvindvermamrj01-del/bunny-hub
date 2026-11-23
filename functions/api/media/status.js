import { json } from "../../_shared/auth.js";

export async function onRequestGet({ env }) {
  const configured = value => typeof value === "string" && value.trim().length > 0;
  const supabaseClient = configured(env.SUPABASE_URL) && configured(env.SUPABASE_ANON_KEY);
  return json({
    supabase: {
      clientConfigured: supabaseClient,
      serviceRoleConfigured: configured(env.SUPABASE_SERVICE_ROLE_KEY),
      note: "Private media signing requires the server-side service-role secret."
    },
    backblazeB2: {
      configured: ["B2_ENDPOINT","B2_BUCKET_NAME","B2_KEY_ID","B2_APPLICATION_KEY"].every(key => configured(env[key]))
    },
    cloudflareR2: {
      configured: ["R2_ACCOUNT_ID","R2_BUCKET_NAME","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY"].every(key => configured(env[key]))
    },
    pixelDrain: {
      configured: configured(env.PIXELDRAIN_API_KEY)
    }
  });
}
