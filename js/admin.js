(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cfg = window.SCHEDULE_SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.publishableKey || !window.supabase?.createClient) {
    $("adminLoading").hidden = true; $("adminDenied").hidden = false;
    $("adminDenied").querySelector("p").textContent = "Не настроено подключение Supabase. Проверь js/config.js.";
    return;
  }
  const client = window.supabase.createClient(cfg.url.replace(/\/$/, ""), cfg.publishableKey);
  const roleLabels = { user: "Пользователь", leader: "Староста", admin: "Администратор" };
  let users = [];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);

  function message(text, error = false) {
    $("adminMessage").textContent = text;
    $("adminMessage").dataset.kind = error ? "error" : "success";
  }
  function draw() {
    const query = $("userSearch").value.trim().toLowerCase();
    const visible = users.filter((u) => `${u.email} ${u.display_name}`.toLowerCase().includes(query));
    $("userCount").textContent = `Показано ${visible.length} из ${users.length}`;
    if (!visible.length) {
      $("usersBody").innerHTML = '<tr><td colspan="5">Пользователи не найдены.</td></tr>';
      return;
    }
    $("usersBody").innerHTML = visible.map((u) => `
      <tr>
        <td><strong>${escapeHtml(u.display_name || "Без имени")}</strong><small>${escapeHtml(u.email || "")}</small></td>
        <td>${escapeHtml(u.group_id || "—")}</td>
        <td><select data-role-select="${escapeHtml(u.user_id)}" aria-label="Роль для ${escapeHtml(u.email)}">
          ${["user","leader","admin"].map((role) => `<option value="${role}" ${u.role === role ? "selected" : ""}>${roleLabels[role]}</option>`).join("")}
        </select></td>
        <td>${u.created_at ? new Date(u.created_at).toLocaleDateString("ru-RU") : "—"}</td>
        <td><button class="account-primary small-action" data-save-role="${escapeHtml(u.user_id)}" type="button">Сохранить</button></td>
      </tr>`).join("");
  }
  async function loadUsers() {
    const { data, error } = await client.rpc("admin_list_users");
    if (error) throw error;
    users = data || [];
    draw();
  }
  async function init() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
      $("adminLoading").hidden = true; $("adminDenied").hidden = false;
      $("adminDenied").querySelector("p").textContent = "Войди в аккаунт администратора, чтобы продолжить.";
      return;
    }
    const { data: roleRow, error: roleError } = await client.from("user_roles")
      .select("role").eq("user_id", session.user.id).maybeSingle();
    if (roleError || roleRow?.role !== "admin") {
      $("adminLoading").hidden = true; $("adminDenied").hidden = false; return;
    }
    $("adminLoading").hidden = true; $("adminPanel").hidden = false;
    $("userSearch").addEventListener("input", draw);
    $("usersBody").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-save-role]");
      if (!button) return;
      const id = button.dataset.saveRole;
      const select = $("usersBody").querySelector(`[data-role-select="${CSS.escape(id)}"]`);
      const role = select?.value;
      button.disabled = true;
      try {
        const { error } = await client.rpc("admin_set_user_role", { target_user_id: id, new_role: role });
        if (error) throw error;
        const user = users.find((u) => u.user_id === id);
        if (user) user.role = role;
        message("Роль успешно обновлена.");
        draw();
      } catch (err) {
        message("Не удалось изменить роль: " + (err.message || "ошибка"), true);
        button.disabled = false;
      }
    });
    await loadUsers();
  }
  init().catch((err) => {
    $("adminLoading").hidden = true; $("adminPanel").hidden = false;
    $("usersBody").innerHTML = '<tr><td colspan="5">Не удалось загрузить список. Выполни SQL-миграцию из файла supabase-roles.sql.</td></tr>';
    message(err.message || "Ошибка загрузки пользователей", true);
  });
})();
