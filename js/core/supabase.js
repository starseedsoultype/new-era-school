import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "./config.js";

export function schoolClient() {
  if (SUPABASE_PUBLIC_KEY === "YOUR-PUBLIC-KEY" || !globalThis.supabase?.createClient) {
    throw new Error("School setup is pending. Ask your parent to check the connection.");
  }
  return globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
}

export function schoolApi(client) {
  async function invoke(name, body) {
    const result = await client.functions.invoke(name, { body });
    if (result.error) throw result.error;
    return result.data;
  }
  return {
    session: (action, fields = {}) => invoke("session", { action, ...fields }),
    stars: (action, fields = {}) => invoke("stars", { action, ...fields }),
    submit: body => invoke("submit", body),
    teacher: body => invoke("teacher", body),
    async alternatives(task, difficulty) {
      const { data, error } = await client.from("tasks").select("content")
        .eq("skill_id", task.skill).eq("content->>difficulty", String(difficulty))
        .neq("id", task.id).order("id");
      if (error) throw error;
      return data.map(row => row.content).filter(content => content.checked);
    },
    async photoRegistered(sessionId, path) {
      const { data, error } = await client.from("notebook_photos").select("id")
        .eq("session_id", sessionId).eq("path", path).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async upload(path, blob) {
      const { error } = await client.storage.from("notebook")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
    },
  };
}
