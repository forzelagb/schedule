(() => {
  "use strict";
  const DATA = window.CAMPUSFLOW_DATA;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "schedule-preferences-v2";
  function loadPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  }
  const saved = loadPreferences();
  function parseLocalDate(value, fallback) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
    const [y,m,d] = value.split("-").map(Number);
    const parsed = new Date(y,m-1,d);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }
  const todayAtStart = new Date();
  const state = {
    course: String(saved.course || "2"),
    group: String(saved.group || "g-d"),
    weekStart: startOfWeek(parseLocalDate(saved.weekStart, todayAtStart)),
    selectedDate: parseLocalDate(saved.selectedDate, todayAtStart),
    manualWeekType: null, // Не восстанавливаем старый ручной выбор: тип недели считается по календарю.
    showAllChanges: true
  };
  // Если сохранённая дата оказалась из другой недели, держим выбор внутри отображаемой недели.
  if (startOfWeek(state.selectedDate).getTime() !== state.weekStart.getTime()) {
    state.selectedDate = new Date(state.weekStart);
  }
  const dayNames = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const shortDays = ["Пн","Вт","Ср","Чт","Пт","Сб"];
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const lessonThemes = {
    purple: ["var(--lesson-purple)","var(--lesson-purple-line)"],
    pink: ["var(--lesson-pink)","var(--lesson-pink-line)"],
    lavender: ["var(--lesson-lavender)","var(--lesson-lavender-line)"],
    rose: ["var(--lesson-rose)","var(--lesson-rose-line)"],
    neutral: ["var(--lesson-neutral)","var(--lesson-neutral-line)"]
  };
  const palette = ["purple","pink","lavender","rose","neutral"];

  function startOfWeek(date) {
    const d = new Date(date.getFullYear(),date.getMonth(),date.getDate());
    d.setDate(d.getDate()-((d.getDay()+6)%7)); d.setHours(0,0,0,0); return d;
  }
  function addDays(date,n) { const d=new Date(date); d.setDate(d.getDate()+n); return d; }
  function sameDay(a,b) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
  function fmtDate(d,withYear=false) { return `${d.getDate()} ${months[d.getMonth()]}${withYear?" "+d.getFullYear():""}`; }
  function weekTypeFor(date) {
    // Расчёт чередования недель устойчив к переходам на летнее/зимнее время.
    // Опорная дата задана по подтверждению пользователя; сверить с официальным календарём техникума.
    const anchor = parseLocalDate(DATA.calendarConfig.anchorMonday, new Date(2026,8,7));
    const a = startOfWeek(anchor), b = startOfWeek(date);
    const utcDay = d => Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()) / 86400000;
    const diffWeeks = Math.round((utcDay(b)-utcDay(a))/7);
    const same = ((diffWeeks % 2) + 2) % 2 === 0;
    return same ? DATA.calendarConfig.anchorType : (DATA.calendarConfig.anchorType === "numerator" ? "denominator" : "numerator");
  }
  function toLocalISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }
  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        course: state.course, group: state.group, weekStart: toLocalISO(state.weekStart),
        selectedDate: toLocalISO(state.selectedDate)
      }));
    } catch (_) { /* Storage may be disabled; the timetable still works. */ }
  }
  function syncCalendarToToday() {
    const now = new Date();
    if (!sameDay(now, syncCalendarToToday.lastDate)) {
      syncCalendarToToday.lastDate = new Date(now.getFullYear(),now.getMonth(),now.getDate());
      // Keep the user's selected week unless it was the previously current week.
      if (state.weekStart.getTime() === startOfWeek(syncCalendarToToday.previousDate || now).getTime()) {
        state.weekStart = startOfWeek(now);
        state.selectedDate = now;
        state.manualWeekType = null;
      }
      syncCalendarToToday.previousDate = now;
      renderAll();
    } else {
      renderToday();
    }
  }
  syncCalendarToToday.lastDate = new Date(todayAtStart.getFullYear(),todayAtStart.getMonth(),todayAtStart.getDate());
  syncCalendarToToday.previousDate = todayAtStart;
  function currentType() { return state.manualWeekType || weekTypeFor(state.weekStart); }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function getGroupLessons(group, weekday, type) {
    return DATA.lessons.filter(l=>l.group===group&&l.weekday===weekday&&(l.weekType==="both"||l.weekType===type))
      .sort((a,b)=>a.slot-b.slot);
  }
  function groupName(g) {
    const shortProgram = g.program.includes("Экономика") ? "Экономика" :
      g.program.includes("11 классов") ? "ИСиП · база 11 кл." :
      g.program.includes("Разработка") ? "Разработка ПО" : "ИСиП · база 9 кл.";
    return `${g.label} — ${shortProgram}`;
  }
  function renderGroups() {
    const options=DATA.groups.filter(g=>g.course===state.course);
    if (!options.some(g=>g.id===state.group)) state.group=options[0]?.id || DATA.groups[0].id;
    $("groupSelect").innerHTML=options.map(g=>`<option value="${g.id}">${esc(groupName(g))}</option>`).join("");
    $("groupSelect").value=state.group;
  }
  function renderFilters() {
    $("courseSelect").value=state.course; renderGroups();
    const end=addDays(state.weekStart,5);
    $("weekRange").textContent=`${state.weekStart.getDate()}–${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
    const type=currentType();
    $("numeratorButton").classList.toggle("active",type==="numerator");
    $("denominatorButton").classList.toggle("active",type==="denominator");
    $("weekInfoType").textContent=`Сейчас: ${type==="numerator"?"числитель":"знаменатель"}`;
  }
  function themeForLesson(lesson) {
    const seed=lesson.subject.split("").reduce((n,c)=>n+c.charCodeAt(0),0);
    return palette[seed%palette.length];
  }
  function cardMarkup(lesson) {
    const [bg,line]=lessonThemes[themeForLesson(lesson)];
    const room=lesson.room ? `<span class="lesson-room">${esc(lesson.room)}</span>` : "";
    const teacher=lesson.teacher ? `<span>${esc(lesson.teacher)}</span>` : "";
    return `<article class="lesson-card" style="--lesson-bg:${bg};--lesson-line:${line}" title="${esc(lesson.subject)}"><strong>${esc(lesson.subject)}</strong>${teacher}${room}</article>`;
  }
  function renderCalendar() {
    const today=new Date(), type=currentType();
    $("dayHeads").innerHTML=Array.from({length:6},(_,i)=>{
      const d=addDays(state.weekStart,i), isToday=sameDay(d,today), selected=sameDay(d,state.selectedDate);
      const past=new Date(d.getFullYear(),d.getMonth(),d.getDate())<new Date(today.getFullYear(),today.getMonth(),today.getDate());
      return `<button type="button" class="day-head ${isToday?"today":""} ${selected?"selected":""} ${past?"past":""}" data-day="${i}" aria-pressed="${selected}"><strong>${dayNames[i]}</strong><small>${d.getDate()} ${months[d.getMonth()].slice(0,3)}</small></button>`;
    }).join("");
    const times=DATA.slots.map((s,i)=>`<div class="time-slot"><strong>${s.start}</strong><span>${s.end}</span><small>${i+1} пара</small></div>`).join("");
    const columns=Array.from({length:6},(_,i)=>{
      const d=addDays(state.weekStart,i), isToday=sameDay(d,today);
      const past=new Date(d.getFullYear(),d.getMonth(),d.getDate())<new Date(today.getFullYear(),today.getMonth(),today.getDate());
      const lessons=getGroupLessons(state.group,i,type);
      const cells=DATA.slots.map((slot,index)=>{
        const lesson=lessons.find(l=>l.slot===index);
        return `<div class="lesson-cell">${lesson?cardMarkup(lesson):`<div class="empty-cell">—</div>`}</div>`;
      }).join("");
      return `<div class="day-column ${isToday?"today":""} ${past?"past":""}">${cells}</div>`;
    }).join("");
    $("scheduleGrid").innerHTML=`<div class="time-column">${times}</div><div class="day-columns">${columns}</div>`;
    $("dayHeads").querySelectorAll("[data-day]").forEach(btn=>btn.addEventListener("click",()=>{
      state.selectedDate=addDays(state.weekStart,Number(btn.dataset.day)); renderCalendar();
    }));
  }
  function renderToday() {
    const today=new Date(), weekday=(today.getDay()+6)%7, type=weekTypeFor(today);
    $("todayDate").textContent=`${fmtDate(today)}, ${dayNames[weekday] || "воскресенье"}`;
    $("todayWeekBadge").textContent=type==="numerator"?"Числитель":"Знаменатель";
    const lessons=weekday<6?getGroupLessons(state.group,weekday,type):[];
    const nowMins=today.getHours()*60+today.getMinutes();
    const future=lessons.filter(l=>{
      const [h,m]=DATA.slots[l.slot].end.split(":").map(Number); return h*60+m>=nowMins;
    });
    const visible=future.length?future.slice(0,3):lessons.slice(-2);
    $("todayLessons").innerHTML=visible.length?visible.map(l=>{
      const s=DATA.slots[l.slot], [bg,line]=lessonThemes[themeForLesson(l)];
      return `<div class="today-lesson"><div class="today-time"><strong>${s.start}</strong><span>${s.end}</span></div><div class="today-lesson-content" style="--lesson-bg:${bg};--lesson-line:${line}"><strong>${esc(l.subject)}</strong>${l.teacher?`<span>${esc(l.teacher)}</span>`:""}${l.room?`<span>${esc(l.room)}</span>`:""}</div></div>`;
    }).join(""):`<div class="no-results">На сегодня занятий по выбранной группе нет.</div>`;
  }
  function renderChanges() {
    const changes=(DATA.changes||[]).filter(c=>!c.group||c.group===state.group);
    $("changesList").innerHTML=changes.length?changes.map(c=>{
      const icons={cancel:"×",room:"⌂",add:"+",info:"i"};
      return `<article class="change-item"><div class="change-icon ${esc(c.type)}">${icons[c.type]||"i"}</div><div class="change-content"><small>${esc(c.when||"Обновление")}</small><strong>${esc(c.title)}</strong><p>${esc(c.description)}</p></div></article>`;
    }).join(""):`<div class="no-results">Пока нет опубликованных изменений.<br>Здесь будут отображаться отмены, переносы и замены занятий.</div>`;
  }
  function renderAll() { renderFilters(); renderCalendar(); renderToday(); renderChanges(); savePreferences(); }
  function changeWeek(n) {
    const dayIndex=Math.min(Math.max((state.selectedDate.getDay()+6)%7,0),5);
    state.weekStart=addDays(state.weekStart,n*7);
    state.selectedDate=addDays(state.weekStart,dayIndex);
    state.manualWeekType=null; renderAll();
  }
  function showToast(message) {
    const el=$("toast"); el.textContent=message; el.classList.add("show");
    clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>el.classList.remove("show"),2200);
  }
  function applyTheme(theme) {
    document.documentElement.dataset.theme=theme;
    const dark=theme==="dark";
    $("themeToggle").setAttribute("aria-label",dark?"Включить светлую тему":"Включить тёмную тему");
    $("themeToggle").title=dark?"Переключить на светлую тему":"Переключить на тёмную тему";
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.content=dark?"#111116":"#f5f3f8";
    try { localStorage.setItem("schedule-theme",theme); } catch (_) {}
  }
  function initTheme() {
    let saved=null;
    try { saved=localStorage.getItem("schedule-theme") || localStorage.getItem("campusflow-theme"); } catch (_) {}
    const systemDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved||(systemDark?"dark":"light"));
  }
  $("courseSelect").addEventListener("change",e=>{state.course=e.target.value;renderAll();});
  $("groupSelect").addEventListener("change",e=>{state.group=e.target.value;renderAll();});
  $("prevWeek").addEventListener("click",()=>changeWeek(-1));
  $("nextWeek").addEventListener("click",()=>changeWeek(1));
  $("numeratorButton").addEventListener("click",()=>{state.manualWeekType="numerator";renderAll();});
  $("denominatorButton").addEventListener("click",()=>{state.manualWeekType="denominator";renderAll();});
  $("goToday").addEventListener("click",()=>{
    const now=new Date(); state.weekStart=startOfWeek(now); state.selectedDate=now; state.manualWeekType=null; renderAll();
    document.querySelector(".calendar").scrollIntoView({behavior:"smooth",block:"start"});
  });
  $("notificationsButton").addEventListener("click",()=>{
    $("changesPanel").scrollIntoView({behavior:"smooth",block:"center"});
    showToast("Изменения расписания");
  });
  $("themeToggle").addEventListener("click",()=>{
    const next=document.documentElement.dataset.theme==="dark"?"light":"dark";
    applyTheme(next);
  });

  $("contactButton").addEventListener("click",()=>showToast("Добавим ссылку для связи перед публикацией."));
  $("communityButton").addEventListener("click",()=>showToast("Ссылку на сообщество добавим, когда выберем площадку."));
  $("footerYear").textContent = new Date().getFullYear();
  initTheme(); renderAll();
  document.addEventListener("visibilitychange",()=>{ if (!document.hidden) syncCalendarToToday(); });
  window.addEventListener("focus",syncCalendarToToday);
  window.setInterval(syncCalendarToToday,60*1000);
})();
