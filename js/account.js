(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cfg = window.SCHEDULE_SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.publishableKey || !window.supabase?.createClient) {
    $("loadingCard").hidden = true;
    $("signedOutCard").hidden = false;
    $("signedOutCard").querySelector("p").textContent = "Не настроено подключение Supabase. Проверь js/config.js.";
    return;
  }
  const client = window.supabase.createClient(cfg.url.replace(/\/$/, ""), cfg.publishableKey);
  const roleLabels = { user: "Пользователь", leader: "Староста", admin: "Администратор" };

  async function render() {
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    $("loadingCard").hidden = true;
    if (sessionError || !session?.user) {
      $("signedOutCard").hidden = false;
      return;
    }
    const user = session.user;
    const [{ data: profile, error: profileError }, { data: roleRow, error: roleError }] = await Promise.all([
      client.from("profiles").select("display_name, group_id").eq("id", user.id).maybeSingle(),
      client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle()
    ]);
    const role = roleRow?.role || "user";
    const name = profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Пользователь";
    $("displayName").textContent = name;
    $("email").textContent = user.email || "";
    $("avatar").textContent = [...name][0]?.toUpperCase() || "S";
    $("groupName").textContent = profile?.group_id || "Не указана";
    $("roleName").textContent = roleLabels[role] || role;
    $("roleBadge").textContent = role;
    $("roleBadge").dataset.role = role;
    $("adminLink").hidden = role !== "admin";
    $("profileCard").hidden = false;
    if (profileError || roleError) $("profileMessage").textContent = "Часть данных не загрузилась. Проверь RLS-политики таблиц profiles и user_roles.";
    $("signOut").addEventListener("click", async () => {
      $("signOut").disabled = true;
      const { error } = await client.auth.signOut();
      if (error) {
        $("profileMessage").textContent = "Не удалось выйти: " + error.message;
        $("signOut").disabled = false;
      } else location.href = "index.html";
    });
  }
  render().catch((err) => {
    $("loadingCard").hidden = true;
    $("signedOutCard").hidden = false;
    $("signedOutCard").querySelector("p").textContent = "Ошибка загрузки профиля: " + (err.message || "неизвестная ошибка");
  });
})();
