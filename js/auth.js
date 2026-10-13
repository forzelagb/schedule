(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const overlay = $("authOverlay");
  const form = $("authForm");
  const tabs = { login: $("loginTab"), signup: $("signupTab") };
  const config = window.SCHEDULE_SUPABASE_CONFIG || {};
  const configured = config.url && config.publishableKey &&
    /^https:\/\/.+\.supabase\.co\/?$/.test(config.url) &&
    !config.url.includes("PASTE_YOUR") &&
    !config.publishableKey.includes("PASTE_YOUR");
  let client = null;
  let mode = "login";
  let currentUser = null;

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  function setMessage(message, kind = "") {
    const el = $("authMessage");
    el.textContent = message;
    el.dataset.kind = kind;
  }
  function setMode(next) {
    mode = next;
    tabs.login.classList.toggle("active", mode === "login");
    tabs.signup.classList.toggle("active", mode === "signup");
    $("displayNameField").hidden = mode !== "signup";
    $("authDisplayName").required = mode === "signup";
    $("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
    $("authTitle").textContent = currentUser ? "Твой профиль" : (mode === "signup" ? "Создать аккаунт" : "Профиль Schedule");
    $("authSubtitle").textContent = currentUser ? "Аккаунт подключён" : (mode === "signup" ? "Присоединись к Schedule" : "Войди или создай аккаунт");
    $("authSubmit").textContent = mode === "signup" ? "Зарегистрироваться" : "Войти";
    setMessage("");
  }
  function open() {
    overlay.hidden = false;
    document.body.classList.add("auth-open");
    if (currentUser) renderAccount(currentUser);
    else {
      $("authAccount").hidden = true;
      form.hidden = false;
      setMode(mode);
      setTimeout(() => (mode === "signup" ? $("authDisplayName") : $("authEmail")).focus(), 0);
    }
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove("auth-open");
    setMessage("");
  }
  function renderAccount(user) {
    currentUser = user;
    const meta = user.user_metadata || {};
    const displayName = meta.display_name || user.email?.split("@")[0] || "Пользователь";
    $("authAccount").hidden = false;
    form.hidden = true;
    $("accountName").textContent = displayName;
    $("accountEmail").textContent = user.email || "";
    $("accountAvatar").textContent = [...displayName][0]?.toUpperCase() || "S";
    $("profileButton").querySelector(".profile-label").textContent = displayName;
    $("profileButton").querySelector(".avatar").textContent = [...displayName][0]?.toUpperCase() || "S";
    setMode("login");
    $("authTitle").textContent = "Твой профиль";
    $("authSubtitle").textContent = "Аккаунт подключён";
  }
  function renderSignedOut() {
    currentUser = null;
    $("profileButton").querySelector(".profile-label").textContent = "Профиль";
    $("profileButton").querySelector(".avatar").textContent = "Г";
    $("authAccount").hidden = true;
    form.hidden = false;
    setMode("login");
  }
  async function loadProfile(user) {
    // The profile is created by the database trigger. Fetching it verifies access,
    // but auth user metadata remains the fallback for the account display.
    const { data, error } = await client.from("profiles")
      .select("display_name, group_id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) console.warn("Не удалось загрузить профиль:", error.message);
    if (data?.display_name) {
      user.user_metadata = { ...(user.user_metadata || {}), display_name: data.display_name };
    }
    renderAccount(user);
  }
  async function init() {
    $("profileButton").addEventListener("click", open);
    $("authClose").addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay.hidden) close(); });
    tabs.login.addEventListener("click", () => setMode("login"));
    tabs.signup.addEventListener("click", () => setMode("signup"));
    $("signOutButton").addEventListener("click", async () => {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) { setMessage("Не удалось выйти: " + error.message, "error"); return; }
      renderSignedOut();
      close();
      toast("Ты вышел из аккаунта.");
    });

    if (!configured || !window.supabase?.createClient) {
      $("profileButton").title = "Сначала настрой js/config.js";
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        setMessage("Подключение ещё не настроено. В js/config.js вставь Project URL и Publishable key из Supabase.", "error");
      });
      return;
    }

    client = window.supabase.createClient(config.url.replace(/\/$/, ""), config.publishableKey);
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) await loadProfile(session.user);
    client.auth.onAuthStateChange((event, session) => {
      // Defer DB calls out of the auth callback to avoid locking auth operations.
      if (event === "SIGNED_OUT" || !session?.user) {
        renderSignedOut();
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setTimeout(() => loadProfile(session.user), 0);
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = $("authEmail").value.trim();
      const password = $("authPassword").value;
      const displayName = $("authDisplayName").value.trim();
      const submit = $("authSubmit");
      submit.disabled = true;
      setMessage(mode === "signup" ? "Создаём аккаунт…" : "Выполняем вход…");
      try {
        if (mode === "signup") {
          const { data, error } = await client.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName }, emailRedirectTo: window.location.href.split("#")[0] }
          });
          if (error) throw error;
          if (data.session && data.user) {
            await loadProfile(data.user);
            setMessage("Аккаунт создан. Профиль добавлен автоматически.", "success");
            toast("Добро пожаловать в Schedule!");
          } else {
            setMessage("Почти готово! Проверь почту и подтверди адрес, затем войди в аккаунт.", "success");
          }
        } else {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (data.user) {
            await loadProfile(data.user);
            setMessage("Вход выполнен.", "success");
            toast("Ты вошёл в Schedule.");
          }
        }
      } catch (error) {
        const message = error?.message || "Не удалось выполнить запрос. Попробуй ещё раз.";
        setMessage(message, "error");
      } finally {
        submit.disabled = false;
      }
    });
  }
  init().catch((error) => {
    console.error("Ошибка инициализации Supabase:", error);
    toast("Не удалось подключиться к Supabase. Проверь настройки.");
  });
})();
