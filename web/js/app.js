(() => {
    "use strict";
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const TODAY = () => new Date().toISOString().slice(0, 10);
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `sw-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    const fmtDate = (value) => {
        if (!value)
            return "No date";
        const date = new Date(`${value}T12:00:00`);
        return Number.isNaN(date.getTime()) ? escapeHTML(value) : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
    };
    const fmtMinutes = (minutes) => {
        const n = Math.max(0, Math.round(Number(minutes) || 0));
        const h = Math.floor(n / 60);
        const m = n % 60;
        return h ? `${h}h ${m}m` : `${m}m`;
    };
    const dateDaysAgo = (days) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
    const startOfWeek = (date = new Date()) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d;
    };
    const readSetting = (key, fallback = null) => {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        }
        catch {
            return fallback;
        }
    };
    const writeSetting = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const THEMES = [
        "Midnight",
        "Ocean",
        "Forest",
        "Lavender",
        "Sunset",
        "Mint",
        "Neon",
        "Crimson",
        "Deep Space",
        "Sakura",
        "Slate",
        "Amber",
        "Rose",
        "Teal",
        "Indigo",
        "Peach",
        "Olive",
        "Charcoal",
        "Ink",
        "Cloud",
        "Aurora",
        "Cobalt",
        "Light",
        "Paper",
        "Nord"
    ];
    const THEME_COLORS = {
        Midnight: "#91a7ff",
        Ocean: "#72b7e8",
        Forest: "#7ac69c",
        Lavender: "#c0a3f3",
        Sunset: "#f2a07c",
        Mint: "#69d7bd",
        Neon: "#b6e879",
        Crimson: "#ff849b",
        "Deep Space": "#81a9ff",
        Sakura: "#f5a3cb",
        Slate: "#b1c1d5",
        Amber: "#efc477",
        Rose: "#ff91a8",
        Teal: "#65d0cc",
        Indigo: "#a5adff",
        Peach: "#ffb48d",
        Olive: "#c1d17b",
        Charcoal: "#c3cad5",
        Ink: "#a2c8ff",
        Cloud: "#91a4dc",
        Aurora: "#7de0ac",
        Cobalt: "#7cbaff",
        Light: "#586dd1",
        Paper: "#a15c36",
        Nord: "#88c0d0"
    };
    const PAGES = {
        home: "Overview",
        mission: "Daily mission",
        exams: "Exam readiness map",
        planner: "Study planner",
        focus: "Focus timer",
        cards: "Offline flashcards",
        mood: "Mood check-in",
        journal: "Private journal",
        breathing: "Guided breathing",
        insights: "Study insights",
        settings: "Settings & privacy"
    };
    const state = {
        page: "home",
        data: {},
        timer: null,
        timerMode: "focus",
        timerInterval: null,
        installPrompt: null,
        currentCard: null,
        cardFlipped: false,
        breathInterval: null,
        breathTimeout: null,
        breathRunning: false,
        breathPhase: 0,
        reminderTimeouts: [],
        taskReminderTimeouts: new Map(),
        unlocked: false
    };
    const loadType = async (type) => (await SWStore.all(type)).sort((a, b) => (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0));
    const getData = async () => {
        const types = ["task", "chapter", "flashcard", "session", "mood", "journal", "mission", "distraction"];
        const result = {};
        for (const type of types)
            result[type] = await loadType(type);
        state.data = result;
        return result;
    };
    function toast(message, kind = "success") {
        const node = document.createElement("div");
        node.className = `toast ${kind}`;
        node.textContent = message;
        $("#toast-region").append(node);
        window.setTimeout(() => node.remove(), 3400);
    }
    function applyTheme(name = (localStorage.getItem("studywell_theme") || "Midnight")) {
        if (!THEMES.includes(name))
            name = "Midnight";
        document.documentElement.dataset.theme = name;
        localStorage.setItem("studywell_theme", name);
        const themeColor = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
        $("meta[name='theme-color']").setAttribute("content", themeColor || "#111318");
    }
    function go(page) {
        if (!PAGES[page])
            page = "home";
        state.page = page;
        history.replaceState(null, "", `#${page}`);
        render();
    }
    function iconButton(action, label, icon = "close", id = "") {
        const icons = {
            edit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>`,
            delete: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>`,
            close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`
        };
        const iconMarkup = icons[icon] || escapeHTML(icon);
        return `<button class="icon-button" type="button" data-action="${action}" ${id ? `data-id="${escapeHTML(id)}"` : ""} aria-label="${escapeHTML(label)}">${iconMarkup}</button>`;
    }
    function emptyState(title, text, action = "", label = "") {
        return `<div class="empty-state">
<strong>${escapeHTML(title)}</strong>
<p>${escapeHTML(text)}</p>${action ? `<button class="button secondary" type="button" data-action="${action}">${escapeHTML(label)}</button>` : ""}</div>`;
    }
    function cardHeading(title, subtitle = "", action = "", label = "") {
        return `<div class="card-heading">
<div>
<h2>${escapeHTML(title)}</h2>${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}</div>${action ? `<button class="button secondary small" type="button" data-action="${action}">${escapeHTML(label)}</button>` : ""}</div>`;
    }
    function taskCard(task, compact = false) {
        const done = task.done;
        const overdue = !done && task.date && task.date < TODAY();
        return `<div class="list-item">
<button class="check-button ${done ? "checked" : ""}" data-action="toggle-task" data-id="${escapeHTML(task.id)}" aria-label="${done ? "Mark incomplete" : "Mark complete"}"></button>
<div class="list-main">
<strong class="${done ? "struck" : ""}">${escapeHTML(task.title)}</strong>
<p>${escapeHTML(task.subject || "General study")} · ${fmtDate(task.date)} · ${fmtMinutes(task.minutes || 25)}</p>
</div>
<div class="list-actions">${overdue ? '<span class="tag bad">Overdue</span>' : task.priority === "High" ? '<span class="tag warn">High</span>' : ""}${compact ? "" : iconButton("edit-task", "Edit task", "edit", task.id)}${iconButton("delete-task", "Delete task", "delete", task.id)}</div>
</div>`;
    }
    function renderHome(data) {
        const tasks = data.task.filter((task) => !task.done).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).slice(0, 4);
        const sessions = data.session.filter((s) => s.date === TODAY());
        const todayMinutes = sessions.reduce((sum, s) => sum + (s.actualMinutes || s.plannedMinutes || 0), 0);
        const doneToday = data.task.filter((task) => task.done && task.completedDate === TODAY()).length;
        const dueCards = data.flashcard.filter((card) => !card.nextReview || card.nextReview <= TODAY()).length;
        const latestMood = data.mood[0];
        const firstName = escapeHTML(readSetting("studywell_name", "Student") || "Student");
        const lastSessionDate = data.session.map((session) => session.date).filter(Boolean).sort().reverse()[0];
        const comeback = !!lastSessionDate && lastSessionDate < dateDaysAgo(3);
        return `<div class="stack">${comeback ? `<section class="card">
<p class="eyebrow">COMEBACK MODE</p>
<h2>No need to catch up all at once.</h2>
<p class="muted" style="margin-bottom:12px">Your last recorded focus session was ${fmtDate(lastSessionDate)}. Start again with one 10-minute task. You do not need to make up for missed days.</p>
<button class="button primary" data-action="comeback-start">Start a 10-minute restart</button>
</section>` : ""}
      <section class="card hero-card">
<p class="eyebrow">YOUR SPACE, YOUR PACE</p>
<h2>${firstName === "Student" ? "Make today count." : `Welcome back, ${firstName}.`}</h2>
<p>Small, focused sessions beat an overloaded plan. Choose one useful thing and start there.</p>
<div class="inline-row">
<button class="button primary" data-action="go-mission">Build today's mission</button>
<button class="button secondary" data-action="go-focus">Start a focus session</button>
</div>
</section>
      <div class="grid four">
<div class="card metric-card">
<span class="metric-label">Focus today</span>
<strong class="metric-value">${fmtMinutes(todayMinutes)}</strong>
<span class="metric-foot">Recorded focus sessions</span>
</div>
<div class="card metric-card">
<span class="metric-label">Tasks completed today</span>
<strong class="metric-value">${doneToday}</strong>
<span class="metric-foot">Small wins count</span>
</div>
<div class="card metric-card">
<span class="metric-label">Cards due</span>
<strong class="metric-value">${dueCards}</strong>
<span class="metric-foot">Recall practice waiting</span>
</div>
<div class="card metric-card">
<span class="metric-label">Latest check-in</span>
<strong class="metric-value">${latestMood ? `${latestMood.score}/5` : "—"}</strong>
<span class="metric-foot">${latestMood ? fmtDate(latestMood.date) : "No check-in yet"}</span>
</div>
</div>
      <div class="layout-main">
<section class="card">${cardHeading("Next up", "Your nearest unfinished tasks", "go-planner", "Open planner")}${tasks.length ? `<div class="item-list">${tasks.map((task) => taskCard(task, true)).join("")}</div>` : emptyState("Your list is clear", "Add a task or plan an upcoming exam.", "add-task", "Add a task")}</section>
<section class="card">${cardHeading("Quick check-in", "Notice your energy without judging it.", "go-mood", "Full check-in")}<div class="between">
<div>
<strong>${latestMood ? `Last time: ${latestMood.score}/5` : "How are you feeling?"}</strong>
<p class="helper">A short check-in can help you plan realistically.</p>
</div>
<button class="button secondary" data-action="go-mood">Check in</button>
</div>
<div class="divider">
</div>
<div class="progress-row">
<span>Study system setup</span>
<strong>${Math.min(100, [data.task.length > 0, data.chapter.length > 0, data.flashcard.length > 0, data.mood.length > 0, data.journal.length > 0].filter(Boolean).length * 20)}%</strong>
</div>
<div class="progress-track">
<div class="progress-fill" style="width:${Math.min(100, [data.task.length > 0, data.chapter.length > 0, data.flashcard.length > 0, data.mood.length > 0, data.journal.length > 0].filter(Boolean).length * 20)}%">
</div>
</div>
<p class="helper">You can use every feature independently. No account or internet needed after the app is cached.</p>
</section>
</div>
    </div>`;
    }
    function renderMission(data) {
        const available = Number(readSetting("sw_mission_minutes", 90));
        const energy = readSetting("sw_mission_energy", "Medium");
        const unfinished = data.task.filter((task) => !task.done).sort((a, b) => {
            const priority = { High: 0, Medium: 1, Low: 2 };
            return (a.date || "9999").localeCompare(b.date || "9999") || priority[a.priority] - priority[b.priority];
        });
        const chapters = data.chapter.filter((chapter) => chapter.status !== "Ready").sort((a, b) => (a.examDate || "9999").localeCompare(b.examDate || "9999") || ({ Hard: 0, Medium: 1, Easy: 2 }[a.difficulty] - { Hard: 0, Medium: 1, Easy: 2 }[b.difficulty]));
        const cap = Math.max(15, available * (energy === "Low" ? .65 : energy === "High" ? 1 : .82));
        let remaining = cap;
        const plan = [];
        for (const task of unfinished) {
            const duration = Math.min(Math.max(10, Number(task.minutes) || 25), remaining);
            if (remaining >= 10) {
                plan.push({ title: task.title, subject: task.subject || "Task", minutes: duration, reason: task.date && task.date <= TODAY() ? "Deadline priority" : `${task.priority || "Medium"} priority` });
                remaining -= duration;
            }
        }
        for (const chapter of chapters) {
            if (remaining < 10)
                break;
            const duration = Math.min(chapter.difficulty === "Hard" ? 25 : 15, remaining);
            plan.push({ title: `Revise: ${chapter.name}`, subject: chapter.subject, minutes: duration, reason: chapter.examDate && chapter.examDate <= TODAY() ? "Exam due" : `${chapter.difficulty} chapter` });
            remaining -= duration;
        }
        const used = plan.reduce((sum, item) => sum + item.minutes, 0);
        state.currentMission = plan;
        return `<div class="stack">
<section class="card hero-card">
<p class="eyebrow">LOCAL PLANNING RULES · NO AI API</p>
<h2>Build a plan that fits your day.</h2>
<p>Choose your available time and current energy. StudyWell will prioritise deadlines and unfinished chapters using your own saved data.</p>
<div class="form-grid">
<label class="field">
<span class="field-label">Time available</span>
<select class="input" id="mission-minutes">
<option value="30" ${available === 30 ? "selected" : ""}>30 minutes</option>
<option value="60" ${available === 60 ? "selected" : ""}>1 hour</option>
<option value="90" ${available === 90 ? "selected" : ""}>1.5 hours</option>
<option value="120" ${available === 120 ? "selected" : ""}>2 hours</option>
<option value="180" ${available === 180 ? "selected" : ""}>3 hours</option>
<option value="240" ${available === 240 ? "selected" : ""}>4 hours</option>
</select>
</label>
<label class="field">
<span class="field-label">Energy right now</span>
<select class="input" id="mission-energy">
<option ${energy === "Low" ? "selected" : ""}>Low</option>
<option ${energy === "Medium" ? "selected" : ""}>Medium</option>
<option ${energy === "High" ? "selected" : ""}>High</option>
</select>
</label>
</div>
<div class="form-actions">
<button class="button primary" data-action="build-mission">Build my mission</button>
<button class="button secondary" data-action="save-mission" ${plan.length ? "" : "disabled"}>Save this plan</button>
</div>
</section>
<section class="card">${cardHeading("Suggested mission", `${plan.length} blocks · ${fmtMinutes(used)} planned`)}${plan.length ? `<div class="stack">${plan.map((item, index) => `<div class="mission-task">
<span class="task-time">${String(index + 1).padStart(2, "0")} · ${item.minutes}m</span>
<div class="task-content">
<strong>${escapeHTML(item.title)}</strong>
<small>${escapeHTML(item.subject)} · ${escapeHTML(item.reason)}</small>
</div>
<button class="button secondary small" data-action="mission-focus" data-title="${escapeHTML(item.title)}" data-minutes="${item.minutes}">Focus</button>
</div>`).join("")}</div>
<p class="helper">This is a suggested plan, not a prediction of performance. Adjust it to your real schedule.</p>` : emptyState("Nothing to schedule yet", "Add tasks in Planner or chapters in Exam map, then build your mission.", "add-task", "Add a task")}</section>${data.mission.length ? `<section class="card">${cardHeading("Saved mission snapshots", "Plans you chose to keep")}<div class="item-list">${data.mission.slice(0, 5).map((mission) => `<div class="list-item">
<div class="list-main">
<strong>${fmtDate(mission.date)} · ${escapeHTML(mission.energy || "Personal plan")}</strong>
<p>${(mission.blocks || []).length} blocks · ${fmtMinutes((mission.blocks || []).reduce((sum, block) => sum + (Number(block.minutes) || 0), 0))}</p>
</div>${iconButton("delete-record", "Delete saved mission", "delete", mission.id)}</div>`).join("")}</div>
</section>` : ""}</div>`;
    }
    function renderPlanner(data) {
        const filter = readSetting("sw_task_filter", "All");
        const tasks = data.task.filter((task) => filter === "All" || (filter === "Open" && !task.done) || (filter === "Completed" && task.done)).sort((a, b) => Number(a.done) - Number(b.done) || (a.date || "9999").localeCompare(b.date || "9999"));
        return `<div class="stack">
<section class="card">${cardHeading("Plan your work", "Tasks, assignments and study blocks in one place.", "add-task", "+ New task")}<div class="form-grid">
<label class="field">
<span class="field-label">Filter tasks</span>
<select class="input" id="task-filter">
<option ${filter === "All" ? "selected" : ""}>All</option>
<option ${filter === "Open" ? "selected" : ""}>Open</option>
<option ${filter === "Completed" ? "selected" : ""}>Completed</option>
</select>
</label>
<div class="field">
<span class="field-label">Task overview</span>
<div class="inline-row">
<span class="tag">${data.task.filter((t) => !t.done).length} open</span>
<span class="tag good">${data.task.filter((t) => t.done).length} complete</span>
<span class="tag bad">${data.task.filter((t) => !t.done && t.date && t.date < TODAY()).length} overdue</span>
</div>
</div>
</div>
</section>
<section class="card">${cardHeading("Your tasks", `${tasks.length} shown`)}${tasks.length ? `<div class="item-list">${tasks.map((task) => taskCard(task)).join("")}</div>` : emptyState("No tasks in this view", "Add a task or change the filter to see your work.", "add-task", "Create a task")}</section>
</div>`;
    }
    function renderExams(data) {
        const chapters = data.chapter;
        const subjects = [...new Set(chapters.map((chapter) => chapter.subject))].sort();
        const exams = subjects.map((subject) => {
            const rows = chapters.filter((chapter) => chapter.subject === subject);
            const ready = rows.filter((chapter) => chapter.status === "Ready").length;
            const nextExam = rows.map((chapter) => chapter.examDate).filter(Boolean).sort()[0];
            const pct = Math.round(ready / Math.max(1, rows.length) * 100);
            return `<section class="card">${cardHeading(subject, `${rows.length} chapters · ${nextExam ? `Exam ${fmtDate(nextExam)}` : "No exam date set"}`, "add-chapter", "+ Chapter")}<div class="progress-row">
<span>Readiness</span>
<strong>${pct}%</strong>
</div>
<div class="progress-track">
<div class="progress-fill ${pct === 100 ? "good" : ""}" style="width:${pct}%">
</div>
</div>
<div class="divider">
</div>
<div class="chapter-list">${rows.map((chapter) => `<div class="chapter-row">
<div class="chapter-name">${escapeHTML(chapter.name)}<div class="helper">${chapter.examDate ? fmtDate(chapter.examDate) : "No date"} · ${escapeHTML(chapter.difficulty)}</div>
</div>
<select class="input chapter-status" data-action="chapter-status" data-id="${escapeHTML(chapter.id)}" aria-label="Status for ${escapeHTML(chapter.name)}">
<option ${chapter.status === "Not started" ? "selected" : ""}>Not started</option>
<option ${chapter.status === "Learning" ? "selected" : ""}>Learning</option>
<option ${chapter.status === "Revise" ? "selected" : ""}>Revise</option>
<option ${chapter.status === "Ready" ? "selected" : ""}>Ready</option>
</select>${iconButton("edit-chapter", "Edit chapter", "edit", chapter.id)}${iconButton("delete-chapter", "Delete chapter", "delete", chapter.id)}</div>`).join("")}</div>
</section>`;
        }).join("");
        return `<div class="stack">
<section class="card hero-card">
<p class="eyebrow">EXAM PREPARATION</p>
<h2>Know what is ready — and what needs work.</h2>
<p>Add subjects and chapters, set exam dates and update preparation status. StudyWell can use these details to suggest revision blocks in your daily mission.</p>
<div class="inline-row">
<button class="button primary" data-action="add-chapter">+ Add subject or chapter</button>
<span class="tag">${chapters.length} chapters</span>
<span class="tag good">${chapters.filter((c) => c.status === "Ready").length} ready</span>
</div>
</section>${exams || emptyState("Your exam map is empty", "Start with one subject and a few chapters. You can add more later.", "add-chapter", "Add your first chapter")}</div>`;
    }
    function renderFocus(data) {
        const saved = readSetting("sw_timer_settings", { focus: 25, short: 5, long: 15, cycles: 4 });
        const timer = state.timer || readSetting("sw_timer_state", null);
        if (timer && timer.mode)
            state.timerMode = timer.mode;
        if (timer && timer.running && timer.endAt) {
            const left = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
            if (left === 0)
                finishTimer(true);
        }
        const active = state.timer || readSetting("sw_timer_state", null);
        const duration = active ? active.durationSeconds : (Number(saved[state.timerMode] || saved.focus || 25) * 60);
        const left = active ? Math.max(0, active.running ? Math.ceil((active.endAt - Date.now()) / 1000) : active.remainingSeconds) : duration;
        const mins = String(Math.floor(left / 60)).padStart(2, "0");
        const secs = String(left % 60).padStart(2, "0");
        const progress = duration ? Math.max(0, Math.min(100, (1 - left / duration) * 100)) : 0;
        const sessions = data.session.filter((s) => s.date === TODAY());
        const todayMinutes = sessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
        const running = !!active?.running;
        return `<div class="layout-main">
<section class="card">
<div class="between">
<div>
<p class="eyebrow">SINGLE-TASK MODE</p>
<h2>Protect a little focus time.</h2>
<p class="helper">Write the outcome first. Your session is saved locally.</p>
</div>
<button class="button secondary small" data-action="timer-settings">Timer settings</button>
</div>
<div class="segmented" style="margin-top:18px">
<button type="button" data-action="timer-mode" data-mode="focus" class="${state.timerMode === "focus" ? "active" : ""}" ${active ? "disabled" : ""}>Focus</button>
<button type="button" data-action="timer-mode" data-mode="short" class="${state.timerMode === "short" ? "active" : ""}" ${active ? "disabled" : ""}>Short break</button>
<button type="button" data-action="timer-mode" data-mode="long" class="${state.timerMode === "long" ? "active" : ""}" ${active ? "disabled" : ""}>Long break</button>
</div>
<div class="timer-wrap">
<div class="timer-ring" style="--timer-progress:${progress}%">
<div class="timer-inner">
<div class="timer-time" id="timer-time">${mins}:${secs}</div>
<div class="timer-label" id="timer-label">${running ? "Session in progress" : "Ready when you are"}</div>
</div>
</div>
<div class="timer-controls">
<button class="button primary" data-action="timer-toggle">${running ? "Pause session" : active && !running && active.remainingSeconds < active.durationSeconds ? "Resume session" : "Start focus"}</button>
<button class="button secondary" data-action="timer-reset">Reset</button>
<button class="button secondary" data-action="timer-finish" ${active ? "" : "disabled"}>Finish early</button>
</div>
</div>
<div class="divider">
</div>
<div class="form-grid">
<label class="field">
<span class="field-label">Session goal</span>
<input class="input" id="focus-goal" maxlength="120" placeholder="e.g. Solve 8 physics questions" value="${escapeHTML(active?.goal || "")}">
</label>
<label class="field">
<span class="field-label">Subject</span>
<input class="input" id="focus-subject" maxlength="60" placeholder="e.g. Physics" value="${escapeHTML(active?.subject || "")}">
</label>
</div>
<p class="helper">Changing the goal after starting updates the current session.</p>
</section>
<div class="stack">
<section class="card">${cardHeading("Today's focus", "Recorded completed and partial sessions")}<div class="metric-value">${fmtMinutes(todayMinutes)}</div>
<p class="helper">${sessions.length} sessions recorded today</p>
</section>
<section class="card">${cardHeading("Session rules", "Keep it simple")}<div class="item-list">
<div class="list-item">
<span class="tag">01</span>
<div class="list-main">
<strong>Choose one outcome</strong>
<p>Make the goal observable, not vague.</p>
</div>
</div>
<div class="list-item">
<span class="tag">02</span>
<div class="list-main">
<strong>Take a real break</strong>
<p>Stand up, drink water, or look away from the screen.</p>
</div>
</div>
<div class="list-item">
<span class="tag">03</span>
<div class="list-main">
<strong>Record honestly</strong>
<p>Partial sessions are useful data too.</p>
</div>
</div>
</div>
</section>
<section class="card">${cardHeading("Distraction log", "Record interruptions without blaming yourself")}<form id="distraction-form" class="form-stack">
<label class="field">
<span class="field-label">What pulled your attention?</span>
<select class="input" id="distraction-kind">
<option>Phone or notifications</option>
<option>Noise or people</option>
<option>Worry or overthinking</option>
<option>Task felt too difficult</option>
<option>Tiredness</option>
<option>Other</option>
</select>
</label>
<label class="field">
<span class="field-label">Optional note</span>
<input class="input" id="distraction-note" maxlength="180" placeholder="What happened? (optional)">
</label>
<button class="button secondary full" type="submit">Log interruption</button>
</form>${data.distraction.length ? `<div class="divider">
</div>
<div class="item-list">${data.distraction.slice(0, 5).map((item) => `<div class="list-item">
<div class="list-main">
<strong>${escapeHTML(item.kind)}</strong>
<p>${fmtDate(item.date)}${item.note ? ` · ${escapeHTML(item.note)}` : ""}</p>
</div>${iconButton("delete-record", "Delete interruption", "delete", item.id)}</div>`).join("")}</div>` : ""}</section>
</div>
</div>`;
    }
    function renderCards(data) {
        const due = data.flashcard.filter((card) => !card.nextReview || card.nextReview <= TODAY());
        const selected = state.currentCard && due.some((card) => card.id === state.currentCard) ? due.find((card) => card.id === state.currentCard) : due[0];
        state.currentCard = selected?.id || null;
        const flipped = state.cardFlipped;
        const cardFace = selected ? `<div class="card flashcard" data-action="flip-card" role="button" tabindex="0" aria-label="Flip flashcard">
<div>
<div class="flash-label">${flipped ? "ANSWER" : "QUESTION"}</div>
<div class="flash-text">${escapeHTML(flipped ? selected.answer : selected.question)}</div>
<div class="flash-hint">Tap the card to ${flipped ? "see the question" : "reveal the answer"}</div>
</div>
</div>` : emptyState("Nothing due right now", data.flashcard.length ? "You are caught up. Add cards or come back when the next review is due." : "Create a few question-and-answer cards for active recall.", "add-card", "Create flashcard");
        return `<div class="stack">
<section class="card">${cardHeading("Practice recall", "Make your brain retrieve the answer before you reveal it.", "add-card", "+ New card")}<div class="between">
<div>
<span class="tag">${due.length} due</span> <span class="tag">${data.flashcard.length} total</span>
</div>
<button class="button secondary small" data-action="show-all-cards">Manage cards</button>
</div>
</section>
<section class="card">${cardFace}${selected && flipped ? `<div class="review-ratings" style="margin-top:14px">
<button class="button secondary" data-action="rate-card" data-rating="again">Again · 1d</button>
<button class="button secondary" data-action="rate-card" data-rating="hard">Hard · 2d</button>
<button class="button primary" data-action="rate-card" data-rating="good">Good · 4d</button>
<button class="button secondary" data-action="rate-card" data-rating="easy">Easy · 7d</button>
</div>` : selected ? `<div class="inline-row" style="justify-content:center;margin-top:12px">
<button class="button primary" data-action="flip-card">Reveal answer</button>
</div>` : ""}<p class="helper" style="text-align:center;margin-top:15px">Review dates are calculated locally. The intervals are a simple starting point, not a claim of a perfect algorithm.</p>
</section>
<section class="card">${cardHeading("How to get more from cards", "A short, consistent review beats rereading everything.")}<p class="muted" style="font-size:.83rem;margin:0">Write one clear question per card. Keep answers short enough to check. Rate how difficult recall felt, not how familiar the answer looked.</p>
</section>
</div>`;
    }
    function renderMood(data) {
        const latest = data.mood[0];
        const labels = ["Very low", "Low", "Okay", "Good", "Very good"];
        return `<div class="stack">
<section class="card">${cardHeading("How are you feeling today?", "No score is good or bad. This is just a check-in.")}<form id="mood-form" class="form-stack">
<div class="mood-options">${labels.map((label, index) => `<button class="mood-option ${readSetting("sw_mood_selected", 3) === index + 1 ? "active" : ""}" type="button" data-action="select-mood" data-score="${index + 1}" aria-pressed="${readSetting("sw_mood_selected", 3) === index + 1}">
<span class="mood-number">${index + 1}</span>
<span>${label}</span>
</button>`).join("")}</div>
<label class="field">
<span class="field-label">Optional note</span>
<textarea class="input" id="mood-note" maxlength="500" placeholder="Anything affecting your day? You can leave this blank.">
</textarea>
</label>
<button class="button primary" type="submit">Save check-in</button>
</form>
</section>
<section class="card">${cardHeading("Recent check-ins", "Your own notes and patterns")} ${data.mood.length ? `<div class="item-list">${data.mood.slice(0, 14).map((item) => `<div class="list-item">
<span class="tag ${item.score >= 4 ? "good" : item.score <= 2 ? "bad" : ""}">${item.score}/5</span>
<div class="list-main">
<strong>${labels[item.score - 1]} · ${fmtDate(item.date)}</strong>
<p>${escapeHTML(item.note || "No note added")}</p>
</div>${iconButton("delete-record", "Delete check-in", "delete", item.id)}</div>`).join("")}</div>` : emptyState("No check-ins yet", "Save your first check-in whenever it feels useful.")}</section>
<div class="notice">
<strong>Keep the interpretation grounded.</strong> Mood notes are personal reflections, not a diagnosis. Trends show what you recorded, not what caused it.</div>
</div>`;
    }
    function renderJournal(data) {
        const query = readSetting("sw_journal_search", "");
        const entries = data.journal.filter((entry) => !query || `${entry.title} ${entry.text} ${entry.tags}`.toLowerCase().includes(query.toLowerCase()));
        return `<div class="stack">
<section class="card">${cardHeading("A private place to think", "Your journal stays in this browser profile.", "add-journal", "+ New entry")}<label class="field">
<span class="field-label">Search entries</span>
<input id="journal-search" class="input" type="search" placeholder="Search title, text or tags" value="${escapeHTML(query)}">
</label>
<p class="helper">Drafts are saved while you type. Use the privacy settings if you share this device.</p>
</section>
<section class="card">${cardHeading("Past entries", `${entries.length} entries shown`)}${entries.length ? `<div class="item-list">${entries.map((entry) => `<article class="list-item">
<div class="list-main">
<strong>${escapeHTML(entry.title || "Untitled entry")}</strong>
<p>${fmtDate(entry.date)}${entry.tags ? ` · ${escapeHTML(entry.tags)}` : ""}</p>
<p>${escapeHTML(entry.text.slice(0, 180))}${entry.text.length > 180 ? "…" : ""}</p>
</div>
<div class="list-actions">${iconButton("edit-journal", "Edit entry", "edit", entry.id)}${iconButton("delete-record", "Delete entry", "delete", entry.id)}</div>
</article>`).join("")}</div>` : emptyState("No entries match", query ? "Try a different search or clear the search field." : "Start with one sentence. It does not need to be polished.", "add-journal", "Write an entry")}</section>
</div>`;
    }
    function renderBreathing() {
        const pattern = readSetting("sw_breath_pattern", "box");
        const patterns = { box: { name: "Box breathing", phases: [{ label: "Inhale", seconds: 4 }, { label: "Hold", seconds: 4 }, { label: "Exhale", seconds: 4 }, { label: "Hold", seconds: 4 }] }, calm: { name: "Slow breathing", phases: [{ label: "Inhale", seconds: 4 }, { label: "Exhale", seconds: 6 }] }, equal: { name: "Equal breathing", phases: [{ label: "Inhale", seconds: 5 }, { label: "Exhale", seconds: 5 }] } };
        const chosen = patterns[pattern] || patterns.box;
        return `<div class="layout-main">
<section class="card">
<p class="eyebrow">A QUIET PAUSE</p>
<h2>Follow a comfortable rhythm.</h2>
<p class="helper">Breathe gently. Stop if you feel uncomfortable, dizzy or short of breath. You do not need to hold your breath if that does not feel right.</p>
<label class="field">
<span class="field-label">Breathing pattern</span>
<select class="input" id="breath-pattern">
<option value="box" ${pattern === "box" ? "selected" : ""}>Box · 4 / 4 / 4 / 4</option>
<option value="calm" ${pattern === "calm" ? "selected" : ""}>Slow · 4 in / 6 out</option>
<option value="equal" ${pattern === "equal" ? "selected" : ""}>Equal · 5 in / 5 out</option>
</select>
</label>
<div class="breath-stage">
<div class="breath-circle" id="breath-circle">
<span id="breath-label">Ready</span>
</div>
</div>
<div class="between">
<span class="tag" id="breath-pattern-label">${chosen.name}</span>
<button class="button primary" data-action="breath-toggle">Start breathing</button>
</div>
</section>
<section class="card">${cardHeading("Use it your way", "No streaks and no pressure")}<div class="item-list">
<div class="list-item">
<span class="tag">01</span>
<div class="list-main">
<strong>Relax your shoulders</strong>
<p>Let your jaw and hands unclench.</p>
</div>
</div>
<div class="list-item">
<span class="tag">02</span>
<div class="list-main">
<strong>Keep the breath natural</strong>
<p>Use the animation as a guide, not a rule.</p>
</div>
</div>
<div class="list-item">
<span class="tag">03</span>
<div class="list-main">
<strong>Stop when you need to</strong>
<p>Return to normal breathing at any point.</p>
</div>
</div>
</div>
</section>
</div>`;
    }
    function renderInsights(data) {
        const weekStart = startOfWeek();
        const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); return date; });
        const values = days.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const minutes = data.session.filter((session) => session.date === key).reduce((sum, session) => sum + (session.actualMinutes || 0), 0);
            return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }), minutes };
        });
        const max = Math.max(30, ...values.map((value) => value.minutes));
        const weekMinutes = values.reduce((sum, value) => sum + value.minutes, 0);
        const completed = data.task.filter((task) => task.done && task.completedDate >= weekStart.toISOString().slice(0, 10)).length;
        const total = data.task.length;
        const bySubject = {};
        data.session.filter((session) => session.date >= weekStart.toISOString().slice(0, 10)).forEach((session) => { const subject = session.subject || "Unlabelled"; bySubject[subject] = (bySubject[subject] || 0) + (session.actualMinutes || 0); });
        const subjectRows = Object.entries(bySubject).sort((a, b) => b[1] - a[1]).slice(0, 7);
        const avgMood = data.mood.filter((m) => m.date >= weekStart.toISOString().slice(0, 10)).map((m) => m.score);
        const moodMean = avgMood.length ? (avgMood.reduce((a, b) => a + b, 0) / avgMood.length).toFixed(1) : "—";
        return `<div class="stack">
<section class="card hero-card">
<p class="eyebrow">WEEKLY REVIEW</p>
<h2>Your effort, in plain numbers.</h2>
<p>Use this as a reflection tool, not a grade. Recorded time can help you spot habits; it cannot measure understanding on its own.</p>
<div class="grid three">
<div>
<span class="metric-label">Focus this week</span>
<div class="metric-value">${fmtMinutes(weekMinutes)}</div>
</div>
<div>
<span class="metric-label">Tasks completed</span>
<div class="metric-value">${completed}</div>
</div>
<div>
<span class="metric-label">Average mood</span>
<div class="metric-value">${moodMean}${moodMean !== "—" ? "/5" : ""}</div>
</div>
</div>
</section>
<section class="card">${cardHeading("Daily focus", "Minutes recorded this Monday–Sunday")}<div class="week-bars">${values.map((value) => `<div class="week-day">
<strong>${value.minutes ? Math.round(value.minutes) : "0"}</strong>
<div class="bar-space">
<span class="bar" style="height:${Math.max(3, value.minutes / max * 100)}%">
</span>
</div>
<small>${value.label}</small>
</div>`).join("")}</div>
</section>
<section class="card">${cardHeading("Focus by subject", "Only sessions recorded this week")} ${subjectRows.length ? `<div class="chart-bars">${subjectRows.map(([subject, minutes]) => `<div class="chart-row">
<span class="chart-label">${escapeHTML(subject)}</span>
<div class="chart-track">
<span style="width:${Math.max(2, minutes / subjectRows[0][1] * 100)}%">
</span>
</div>
<span class="chart-value">${fmtMinutes(minutes)}</span>
</div>`).join("")}</div>` : emptyState("No focus sessions this week", "Complete a session with a subject name to see a useful breakdown.")}<div class="divider">
</div>
<div class="progress-row">
<span>Tasks marked complete overall</span>
<strong>${total ? Math.round(data.task.filter((t) => t.done).length / total * 100) : 0}%</strong>
</div>
<div class="progress-track">
<div class="progress-fill good" style="width:${total ? data.task.filter((t) => t.done).length / total * 100 : 0}%">
</div>
</div>
</section>
<section class="card">${cardHeading("Mood and focus side by side", "Recorded daily values for the last seven days")}<div class="item-list">${days.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const dayMood = data.mood.filter((m) => m.date === key);
            const avg = dayMood.length ? (dayMood.reduce((sum, m) => sum + m.score, 0) / dayMood.length).toFixed(1) : "—";
            const focus = values.find((v) => v.key === key)?.minutes || 0;
            return `<div class="list-item">
<div class="list-main">
<strong>${date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</strong>
<p>Focus: ${fmtMinutes(focus)} · Mood: ${avg}${avg !== "—" ? "/5" : ""}</p>
</div>
</div>`;
        }).join("")}</div>
<p class="helper">These are observations you recorded, not proof that one caused the other.</p>
</section>
<section class="card">${cardHeading("Review prompts", "Turn the numbers into a small next step")}<div class="form-stack">
<p class="muted" style="margin:0">What helped you focus this week?</p>
<textarea class="input" id="weekly-win" placeholder="Write a short note...">
</textarea>
<p class="muted" style="margin:0">What is one change to try next week?</p>
<textarea class="input" id="weekly-next" placeholder="Keep it realistic...">
</textarea>
<button class="button primary" data-action="save-weekly-review">Save weekly review</button>
</div>
</section>
</div>`;
    }
    function renderSettings() {
        const current = localStorage.getItem("studywell_theme") || "Midnight";
        const pinEnabled = !!localStorage.getItem("sw_pin_verifier");
        const reminders = readSetting("sw_reminders", { enabled: false, time: "18:00" });
        const autoLock = readSetting("sw_auto_lock", true);
        return `<div class="stack">
<section class="card">${cardHeading("Appearance", "Choose a restrained palette. Theme changes apply instantly.")}<div class="theme-grid">${THEMES.map((theme) => `<button class="theme-option ${theme === current ? "active" : ""}" data-action="set-theme" data-theme="${escapeHTML(theme)}">
<span class="theme-swatches">
<span style="background:${THEME_COLORS[theme]}">
</span>
<span style="background:${theme === "Light" ? "#f4f6fa" : theme === "Paper" ? "#f8f4ec" : "#151820"}">
</span>
<span style="background:${theme === "Light" ? "#ffffff" : theme === "Paper" ? "#fffdf8" : "#272c37"}">
</span>
</span>
<span>${escapeHTML(theme)}</span>
</button>`).join("")}</div>
</section>
<section class="card">${cardHeading("Privacy & app lock", "A PIN adds a barrier on this device; it does not encrypt all app data.")}<div class="setting-row">
<div class="setting-copy">
<strong>${pinEnabled ? "App lock is enabled" : "App lock is disabled"}</strong>
<p>Four digits, stored as a salted, slow-derived verifier.</p>
</div>
<button class="button secondary" data-action="${pinEnabled ? "change-pin" : "setup-pin"}">${pinEnabled ? "Change PIN" : "Set up PIN"}</button>
</div>${pinEnabled ? `<div class="setting-row">
<div class="setting-copy">
<strong>Require PIN after leaving app</strong>
<p>Lock when the app is hidden or the screen is switched away.</p>
</div>
<button class="switch" role="switch" aria-checked="${autoLock}" data-action="toggle-auto-lock" aria-label="Toggle auto lock">
</button>
</div>
<div class="setting-row">
<div class="setting-copy">
<strong>Disable PIN</strong>
<p>Remove the app-opening barrier from this browser profile.</p>
</div>
<button class="button danger" data-action="disable-pin">Disable</button>
</div>` : ""}<div class="notice" style="margin-top:15px">
<strong>Privacy limit:</strong> someone with access to your browser profile or developer tools may still inspect local app data. Do not store highly sensitive information here. Use a device lock as well.</div>
</section>
<section class="card">${cardHeading("Local reminders", "Best-effort reminders while supported by your browser.")}<div class="setting-row">
<div class="setting-copy">
<strong>Daily study reminder</strong>
<p>Notifications need your permission and may not fire when the browser is fully closed.</p>
</div>
<button class="switch" role="switch" aria-checked="${!!reminders.enabled}" data-action="toggle-reminders" aria-label="Toggle reminders">
</button>
</div>
<div class="form-grid" style="margin-top:14px">
<label class="field">
<span class="field-label">Reminder time</span>
<input class="input" id="reminder-time" type="time" value="${escapeHTML(reminders.time || "18:00")}">
</label>
<div class="field">
<span class="field-label">Permission</span>
<button class="button secondary full" data-action="request-notifications">Allow notifications</button>
</div>
</div>
<button class="button secondary" style="margin-top:12px" data-action="save-reminders">Save reminder settings</button>
</section>
<section class="card">${cardHeading("Backup & recovery", "Export a copy before moving devices or clearing browser data.")}<div class="grid two">
<button class="button secondary full" data-action="export-data">Export all data (.json)</button>
<button class="button secondary full" data-action="import-data">Restore from backup</button>
</div>
<p class="helper">Backups contain your saved records and supported settings. Keep exported files private. Importing can replace existing data.</p>
<input class="hidden" id="backup-file" type="file" accept="application/json,.json">
</section>
<section class="card">${cardHeading("Install and offline use", "A static PWA, with no account or backend.")}<div class="notice">
<strong>To install on Android:</strong> open this app in Chrome, tap the three-dot menu, then choose <em>Install app</em> or <em>Add to Home screen</em> if shown. The exact wording depends on Chrome and your device. The app needs an HTTPS-hosted first visit to register its service worker; after its files are cached, core features work offline.</div>
<div class="form-actions" style="margin-top:14px">
<button class="button secondary" data-action="install-help">Show install steps</button>
<button class="button secondary" data-action="check-offline">Check offline readiness</button>
</div>
<p id="offline-status" class="helper">
</p>
</section>
<section class="card">${cardHeading("Profile", "This name is only used inside the app.")}<form id="profile-form" class="form-stack">
<label class="field">
<span class="field-label">Display name</span>
<input class="input" id="profile-name" maxlength="40" value="${escapeHTML(readSetting("studywell_name", "") || "")}" placeholder="Optional">
</label>
<button class="button secondary" type="submit">Save profile</button>
</form>
<div class="divider">
</div>
<div class="between">
<div>
<strong>Delete all app data</strong>
<p class="helper">Permanently removes saved tasks, notes, cards, sessions and settings.</p>
</div>
<button class="button danger" data-action="clear-all">Delete all</button>
</div>
</section>
<section class="card">${cardHeading("About StudyWell", "Built to be useful without an account.")}<div class="between">
<span class="muted">Version</span>
<strong>1.0.0</strong>
</div>
<div class="between" style="margin-top:8px">
<span class="muted">Developer</span>
<strong>Luksh Kumar</strong>
</div>
<div class="between" style="margin-top:8px">
<span class="muted">Storage</span>
<strong>${SWStore.usingFallback ? "Local storage fallback" : "IndexedDB when available"}</strong>
</div>
</section>
</div>`;
    }
    function renderPage(data) {
        switch (state.page) {
            case "home": return renderHome(data);
            case "mission": return renderMission(data);
            case "exams": return renderExams(data);
            case "planner": return renderPlanner(data);
            case "focus": return renderFocus(data);
            case "cards": return renderCards(data);
            case "mood": return renderMood(data);
            case "journal": return renderJournal(data);
            case "breathing": return renderBreathing();
            case "insights": return renderInsights(data);
            case "settings": return renderSettings();
            default: return renderHome(data);
        }
    }
    async function render() {
        if (!state.unlocked && localStorage.getItem("sw_pin_verifier"))
            return;
        const data = await getData();
        $("#page-heading").textContent = PAGES[state.page] || "Overview";
        $("#today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
        $("#page-content").innerHTML = renderPage(data);
        $$('[data-page]').forEach((button) => button.classList.toggle("active", button.dataset.page === state.page));
        $("#quick-add").textContent = state.page === "planner" ? "+ Add task" : "+ Add task";
        if (state.page === "focus")
            updateTimerUI();
    }
    function openDialog(title, subtitle, body) {
        const dialog = $("#app-dialog");
        $("#dialog-content").innerHTML = `<div class="dialog-header">
<div>
<h2>${escapeHTML(title)}</h2>${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}</div>
${iconButton("close-dialog", "Close dialog", "close")}
</div>${body}`;
        if (!dialog.open)
            dialog.showModal();
    }
    function closeDialog() {
        const dialog = $("#app-dialog");
        if (dialog.open)
            dialog.close();
    }
    async function addTask(existing = null) {
        const task = existing || {};
        openDialog(existing ? "Edit task" : "Add a task", "Make the next action clear and manageable.", `<form id="task-form" class="form-stack">
<input type="hidden" id="task-id" value="${escapeHTML(task.id || "")}">
<label class="field">
<span class="field-label">Task title</span>
<input class="input" id="task-title" maxlength="140" required value="${escapeHTML(task.title || "")}" placeholder="e.g. Revise chapter 4">
</label>
<div class="form-grid">
<label class="field">
<span class="field-label">Subject</span>
<input class="input" id="task-subject" maxlength="60" value="${escapeHTML(task.subject || "")}" placeholder="e.g. Mathematics">
</label>
<label class="field">
<span class="field-label">Due date</span>
<input class="input" id="task-date" type="date" value="${escapeHTML(task.date || TODAY())}">
</label>
<label class="field">
<span class="field-label">Reminder (optional)</span>
<input class="input" id="task-reminder" type="datetime-local" value="${escapeHTML(task.reminderAt || "")}">
</label>
<label class="field">
<span class="field-label">Priority</span>
<select class="input" id="task-priority">
<option ${task.priority === "Low" ? "selected" : ""}>Low</option>
<option ${!task.priority || task.priority === "Medium" ? "selected" : ""}>Medium</option>
<option ${task.priority === "High" ? "selected" : ""}>High</option>
</select>
</label>
<label class="field">
<span class="field-label">Planned minutes</span>
<select class="input" id="task-minutes">${[10, 15, 20, 25, 30, 40, 45, 50, 60, 90, 120].map((m) => `<option value="${m}" ${(Number(task.minutes) || 25) === m ? "selected" : ""}>${m} minutes</option>`).join("")}</select>
</label>
</div>
<label class="field">
<span class="field-label">Notes (optional)</span>
<textarea class="input" id="task-notes" maxlength="1000" placeholder="Any detail you want to remember">${escapeHTML(task.notes || "")}</textarea>
</label>
<div class="form-actions">
<button class="button primary" type="submit">Save task</button>
<button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
</div>
</form>`);
    }
    async function addChapter(existing = null) {
        const chapter = existing || {};
        const subjects = [...new Set(state.data.chapter.map((c) => c.subject))];
        openDialog(existing ? "Edit chapter" : "Add a subject or chapter", "Each chapter can have its own difficulty and status.", `<form id="chapter-form" class="form-stack">
<input type="hidden" id="chapter-id" value="${escapeHTML(chapter.id || "")}">
<label class="field">
<span class="field-label">Subject</span>
<input class="input" id="chapter-subject" maxlength="60" required list="subject-list" value="${escapeHTML(chapter.subject || "")}" placeholder="e.g. Physics">
<datalist id="subject-list">${subjects.map((s) => `<option value="${escapeHTML(s)}">
</option>`).join("")}</datalist>
</label>
<label class="field">
<span class="field-label">Chapter or topic</span>
<input class="input" id="chapter-name" maxlength="100" required value="${escapeHTML(chapter.name || "")}" placeholder="e.g. Current electricity">
</label>
<div class="form-grid">
<label class="field">
<span class="field-label">Exam date</span>
<input class="input" id="chapter-exam" type="date" value="${escapeHTML(chapter.examDate || "")}">
</label>
<label class="field">
<span class="field-label">Difficulty</span>
<select class="input" id="chapter-difficulty">
<option ${chapter.difficulty === "Easy" ? "selected" : ""}>Easy</option>
<option ${!chapter.difficulty || chapter.difficulty === "Medium" ? "selected" : ""}>Medium</option>
<option ${chapter.difficulty === "Hard" ? "selected" : ""}>Hard</option>
</select>
</label>
<label class="field">
<span class="field-label">Preparation status</span>
<select class="input" id="chapter-state">
<option ${!chapter.status || chapter.status === "Not started" ? "selected" : ""}>Not started</option>
<option ${chapter.status === "Learning" ? "selected" : ""}>Learning</option>
<option ${chapter.status === "Revise" ? "selected" : ""}>Revise</option>
<option ${chapter.status === "Ready" ? "selected" : ""}>Ready</option>
</select>
</label>
</div>
<div class="form-actions">
<button class="button primary" type="submit">Save chapter</button>
<button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
</div>
</form>`);
    }
    function addCard(existing = null) {
        const card = existing || {};
        openDialog(existing ? "Edit flashcard" : "Create flashcard", "One clear question and one answer is enough.", `<form id="flashcard-form" class="form-stack">
<input type="hidden" id="flashcard-id" value="${escapeHTML(card.id || "")}">
<label class="field">
<span class="field-label">Subject (optional)</span>
<input class="input" id="flashcard-subject" maxlength="60" value="${escapeHTML(card.subject || "")}" placeholder="e.g. Biology">
</label>
<label class="field">
<span class="field-label">Question</span>
<textarea class="input" id="flashcard-question" maxlength="1200" required placeholder="What do you want to recall?">${escapeHTML(card.question || "")}</textarea>
</label>
<label class="field">
<span class="field-label">Answer</span>
<textarea class="input" id="flashcard-answer" maxlength="2000" required placeholder="Write the answer in your own words">${escapeHTML(card.answer || "")}</textarea>
</label>
<div class="form-actions">
<button class="button primary" type="submit">Save card</button>
<button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
</div>
</form>`);
    }
    function addJournal(existing = null) {
        const entry = existing || {};
        const draft = readSetting("sw_journal_draft", {});
        openDialog(existing ? "Edit journal entry" : "New journal entry", "This entry is saved locally on this device.", `<form id="journal-form" class="form-stack">
<input type="hidden" id="journal-id" value="${escapeHTML(entry.id || "")}">
<label class="field">
<span class="field-label">Title</span>
<input class="input" id="journal-title" maxlength="100" value="${escapeHTML(entry.title || draft.title || "")}" placeholder="A thought, a win, a question">
</label>
<label class="field">
<span class="field-label">Entry</span>
<textarea class="input" id="journal-text" maxlength="10000" required placeholder="Write freely. It does not need to be perfect.">${escapeHTML(entry.text || draft.text || "")}</textarea>
</label>
<label class="field">
<span class="field-label">Tags (optional)</span>
<input class="input" id="journal-tags" maxlength="120" value="${escapeHTML(entry.tags || "")}" placeholder="school, ideas, reflection">
</label>
<p class="helper">Draft is saved locally while you type.</p>
<div class="form-actions">
<button class="button primary" type="submit">Save entry</button>
<button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
</div>
</form>`);
    }
    function addTaskFromQuick() { addTask(); }
    function startTimer() {
        const settings = readSetting("sw_timer_settings", { focus: 25, short: 5, long: 15, cycles: 4 });
        const goal = $("#focus-goal")?.value.trim() || state.timer?.goal || "Focused study session";
        const subject = $("#focus-subject")?.value.trim() || state.timer?.subject || "";
        const previous = state.timer || readSetting("sw_timer_state", null);
        const mode = state.timerMode || "focus";
        const duration = Number(settings[mode] || settings.focus || 25) * 60;
        state.timer = { id: previous?.id || uid(), mode, goal, subject, durationSeconds: previous && previous.remainingSeconds < previous.durationSeconds ? previous.durationSeconds : duration, remainingSeconds: previous && previous.remainingSeconds < previous.durationSeconds ? previous.remainingSeconds : duration, startedAt: previous?.startedAt || null, endAt: null, running: true, pausedSeconds: 0, date: TODAY() };
        state.timer.endAt = Date.now() + state.timer.remainingSeconds * 1000;
        state.timer.startedAt = state.timer.startedAt || Date.now();
        writeSetting("sw_timer_state", state.timer);
        scheduleNativeReminder(`timer-${state.timer.id}`, state.timer.endAt, state.timer.mode === "focus" ? "Focus session complete" : "Break complete", state.timer.mode === "focus" ? "Your focus session has finished." : "Your break has finished.", false);
        ensureTimerTick();
        updateTimerUI();
        toast("Focus session started. Keep the goal small and specific.");
    }
    function ensureTimerTick() {
        if (state.timerInterval)
            clearInterval(state.timerInterval);
        state.timerInterval = setInterval(() => {
            const timer = state.timer || readSetting("sw_timer_state", null);
            if (!timer || !timer.running)
                return;
            const left = Math.ceil((timer.endAt - Date.now()) / 1000);
            if (left <= 0)
                finishTimer(true);
            else
                updateTimerUI();
        }, 500);
    }
    function updateTimerUI() {
        if (state.page !== "focus")
            return;
        const timer = state.timer || readSetting("sw_timer_state", null);
        if (!timer)
            return;
        const left = Math.max(0, timer.running ? Math.ceil((timer.endAt - Date.now()) / 1000) : timer.remainingSeconds);
        const timeNode = $("#timer-time");
        const ring = $(".timer-ring");
        if (timeNode)
            timeNode.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
        if (ring)
            ring.style.setProperty("--timer-progress", `${Math.max(0, Math.min(100, (1 - left / timer.durationSeconds) * 100))}%`);
        const label = $("#timer-label");
        if (label)
            label.textContent = timer.running ? "Session in progress" : left < timer.durationSeconds ? "Session paused" : "Ready when you are";
        const toggle = $('[data-action="timer-toggle"]');
        if (toggle)
            toggle.textContent = timer.running ? "Pause session" : left < timer.durationSeconds ? "Resume session" : "Start focus";
        const goal = $("#focus-goal");
        if (goal && document.activeElement !== goal)
            goal.value = timer.goal || "";
        const subject = $("#focus-subject");
        if (subject && document.activeElement !== subject)
            subject.value = timer.subject || "";
    }
    async function finishTimer(completed = false) {
        const timer = state.timer || readSetting("sw_timer_state", null);
        if (!timer)
            return;
        const left = Math.max(0, timer.running ? Math.ceil((timer.endAt - Date.now()) / 1000) : timer.remainingSeconds);
        const elapsed = Math.max(0, Math.round((timer.durationSeconds - left) / 60));
        cancelNativeReminder(`timer-${timer.id}`);
        if (completed) {
            showAppNotification(timer.mode === "focus" ? "Focus session complete" : "Break complete", timer.mode === "focus" ? "Your focus session has finished." : "Your break has finished.", `timer-${timer.id}`);
        }
        if (timer.mode && timer.mode !== "focus") {
            state.timer = null;
            localStorage.removeItem("sw_timer_state");
            if (state.timerInterval)
                clearInterval(state.timerInterval);
            toast(completed ? "Break finished. Return when you are ready." : "Break ended.");
            await render();
            return;
        }
        if (!completed && elapsed === 0) {
            state.timer = null;
            localStorage.removeItem("sw_timer_state");
            if (state.timerInterval)
                clearInterval(state.timerInterval);
            await render();
            return;
        }
        const outcome = completed ? "Complete" : "Partial";
        await SWStore.put("session", { id: uid(), goal: timer.goal || "Focus session", subject: timer.subject || "", plannedMinutes: Math.round(timer.durationSeconds / 60), actualMinutes: elapsed, outcome, date: timer.date || TODAY(), createdAt: Date.now() });
        state.timer = null;
        localStorage.removeItem("sw_timer_state");
        if (state.timerInterval)
            clearInterval(state.timerInterval);
        toast(completed ? "Session completed and recorded." : `Session recorded as partial · ${fmtMinutes(elapsed)}.`, "success");
        await render();
    }
    function pauseTimer() {
        const timer = state.timer || readSetting("sw_timer_state", null);
        if (!timer)
            return;
        if (timer.running) {
            timer.remainingSeconds = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
            timer.running = false;
            timer.endAt = null;
            cancelNativeReminder(`timer-${timer.id}`);
            state.timer = timer;
            writeSetting("sw_timer_state", timer);
            toast("Session paused.");
        }
        else if (timer.remainingSeconds > 0) {
            timer.running = true;
            timer.endAt = Date.now() + timer.remainingSeconds * 1000;
            scheduleNativeReminder(`timer-${timer.id}`, timer.endAt, timer.mode === "focus" ? "Focus session complete" : "Break complete", timer.mode === "focus" ? "Your focus session has finished." : "Your break has finished.", false);
            state.timer = timer;
            writeSetting("sw_timer_state", timer);
            ensureTimerTick();
            toast("Session resumed.");
        }
        else
            startTimer();
        updateTimerUI();
    }
    function resetTimer() {
        if (state.timer?.id)
            cancelNativeReminder(`timer-${state.timer.id}`);
        state.timer = null;
        localStorage.removeItem("sw_timer_state");
        if (state.timerInterval)
            clearInterval(state.timerInterval);
        render();
        toast("Timer reset. No session was recorded.");
    }
    function timerSettings() {
        const settings = readSetting("sw_timer_settings", { focus: 25, short: 5, long: 15, cycles: 4 });
        openDialog("Timer settings", "Set session lengths that suit your schedule.", `<form id="timer-settings-form" class="form-stack">
<div class="form-grid">
<label class="field">
<span class="field-label">Focus minutes</span>
<input class="input" id="timer-focus" type="number" min="5" max="180" value="${settings.focus}" required>
</label>
<label class="field">
<span class="field-label">Short break</span>
<input class="input" id="timer-short" type="number" min="1" max="60" value="${settings.short}" required>
</label>
<label class="field">
<span class="field-label">Long break</span>
<input class="input" id="timer-long" type="number" min="1" max="90" value="${settings.long}" required>
</label>
<label class="field">
<span class="field-label">Sessions before long break</span>
<input class="input" id="timer-cycles" type="number" min="2" max="8" value="${settings.cycles}" required>
</label>
</div>
<p class="helper">Choose Focus, Short break or Long break above. Break sessions do not count toward study analytics.</p>
<div class="form-actions">
<button class="button primary" type="submit">Save settings</button>
<button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
</div>
</form>`);
    }
    async function toggleTask(id) {
        const task = (await SWStore.all("task")).find((item) => item.id === id);
        if (!task)
            return;
        task.done = !task.done;
        task.completedDate = task.done ? TODAY() : null;
        await SWStore.put("task", task);
        if (task.done)
            cancelTaskReminder(task.id);
        else
            scheduleTaskReminder(task);
        await render();
        toast(task.done ? "Task completed." : "Task reopened.");
    }
    async function deleteRecord(type, id, label = "item") {
        if (!confirm(`Delete this ${label}? This cannot be undone.`))
            return;
        if (type === "task")
            cancelTaskReminder(id);
        await SWStore.remove(id);
        await render();
        toast(`${label[0].toUpperCase()}${label.slice(1)} deleted.`);
    }
    function setupPin(existing = false) {
        openDialog(existing ? "Change your PIN" : "Set up app lock", "Choose a PIN you can remember. Do not reuse an important account PIN.", `<form id="pin-form" class="form-stack">${existing ? `<label class="field">
<span class="field-label">Current PIN</span>
<input class="input pin-input" id="pin-current" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="off" placeholder="••••">
</label>` : ""}<label class="field">
<span class="field-label">New 4-digit PIN</span>
<input class="input pin-input" id="pin-new" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="off" placeholder="••••">
</label>
<label class="field">
<span class="field-label">Confirm new PIN</span>
<input class="input pin-input" id="pin-confirm" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="off" placeholder="••••">
</label>
<p id="pin-form-error" class="form-message" role="status">
</p>
<div class="notice">This is a local access barrier, not full data encryption. Use your phone's screen lock too.</div>
<div class="form-actions">
<button class="button primary" type="submit">${existing ? "Update PIN" : "Enable app lock"}</button>
<button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
</div>
</form>`);
    }
    async function derivePin(pin, salt) {
        const encoder = new TextEncoder();
        const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, material, 256);
        return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    const fromBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    const toBase64 = (value) => btoa(String.fromCharCode(...value));
    async function pinMatches(pin) {
        const record = readSetting("sw_pin_verifier", null);
        if (!record)
            return false;
        return (await derivePin(pin, fromBase64(record.salt))) === record.hash;
    }
    async function savePin(pin) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await derivePin(pin, salt);
        writeSetting("sw_pin_verifier", { salt: toBase64(salt), hash, version: 1 });
    }
    async function handlePinForm(event) {
        event.preventDefault();
        const error = $("#pin-form-error");
        const oldPin = $("#pin-current")?.value || "";
        const pin = $("#pin-new").value;
        const confirmPin = $("#pin-confirm").value;
        if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) {
            error.textContent = "Enter exactly four digits in both fields.";
            return;
        }
        if (pin !== confirmPin) {
            error.textContent = "The new PINs do not match.";
            return;
        }
        if (localStorage.getItem("sw_pin_verifier") && !await pinMatches(oldPin)) {
            error.textContent = "Current PIN is incorrect.";
            return;
        }
        if (!window.crypto?.subtle) {
            error.textContent = "Secure PIN hashing is not supported in this browser context. Open the hosted HTTPS app.";
            return;
        }
        await savePin(pin);
        localStorage.removeItem("sw_pin_attempts");
        localStorage.removeItem("sw_pin_wait_until");
        state.unlocked = true;
        closeDialog();
        await render();
        toast("App lock updated.");
    }
    async function disablePin() {
        if (!localStorage.getItem("sw_pin_verifier"))
            return;
        openDialog("Disable app lock", "Confirm your current PIN to disable the lock.", `<form id="disable-pin-form" class="form-stack">
<label class="field">
<span class="field-label">Current PIN</span>
<input class="input pin-input" id="disable-pin-value" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="off">
</label>
<p id="disable-pin-error" class="form-message">
</p>
<div class="form-actions">
<button class="button danger" type="submit">Disable lock</button>
<button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
</div>
</form>`);
    }
    async function unlockSubmit(event) {
        event.preventDefault();
        const error = $("#unlock-error");
        const waitUntil = Number(localStorage.getItem("sw_pin_wait_until") || 0);
        if (Date.now() < waitUntil) {
            error.textContent = `Too many attempts. Try again in ${Math.ceil((waitUntil - Date.now()) / 1000)} seconds.`;
            return;
        }
        const pin = $("#unlock-pin").value;
        if (await pinMatches(pin)) {
            localStorage.removeItem("sw_pin_attempts");
            localStorage.removeItem("sw_pin_wait_until");
            state.unlocked = true;
            sessionStorage.setItem("sw_unlocked", "1");
            $("#app-lock").classList.add("hidden");
            $("#app-shell").classList.remove("hidden");
            await render();
            return;
        }
        const attempts = Number(localStorage.getItem("sw_pin_attempts") || 0) + 1;
        localStorage.setItem("sw_pin_attempts", String(attempts));
        if (attempts >= 5) {
            const delay = Math.min(30000, 2000 * (attempts - 3));
            localStorage.setItem("sw_pin_wait_until", String(Date.now() + delay));
            error.textContent = `Incorrect PIN. Try again in ${Math.ceil(delay / 1000)} seconds.`;
        }
        else
            error.textContent = `Incorrect PIN. ${5 - attempts} attempts before a short delay.`;
        $("#unlock-pin").value = "";
    }
    function lockApp(force = false) {
        if (!localStorage.getItem("sw_pin_verifier"))
            return;
        if (!force && !readSetting("sw_auto_lock", true))
            return;
        state.unlocked = false;
        sessionStorage.removeItem("sw_unlocked");
        $("#app-lock").classList.remove("hidden");
        $("#app-shell").classList.add("hidden");
        $("#unlock-pin").value = "";
    }
    function installHelp() {
        openDialog("Install StudyWell", "Add it to your home screen for an app-like window.", `<div class="stack">
<div class="notice">
<strong>Android Chrome</strong>
<ol>
<li>Open the hosted StudyWell page in Chrome.</li>
<li>Tap the three-dot menu in the top corner.</li>
<li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>, if available.</li>
<li>Confirm the browser's install prompt.</li>
</ol>
</div>
<div class="notice">
<strong>Important</strong>
<p style="margin:6px 0 0">The first visit must load the app files and register its service worker over HTTPS. Once cached, the core app can open offline. A ZIP file itself cannot register a service worker from a normal file:// address.</p>
</div>
<button class="button primary full" data-action="close-dialog">Understood</button>
</div>`);
    }
    async function exportData() {
        const data = await SWStore.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `studywell-backup-${TODAY()}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        toast("Backup exported. Keep the file private.");
    }
    function importData() { $("#backup-file").click(); }
    async function handleBackupFile(event) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        try {
            if (file.size > 20 * 1024 * 1024)
                throw new Error("Backup is larger than 20 MB.");
            const data = JSON.parse(await file.text());
            openDialog("Restore backup", `${Array.isArray(data.records) ? data.records.length : 0} records found.`, `<p class="muted" style="font-size:.86rem">Replacing data removes the current records before importing the backup. Export your current data first if you need a copy.</p>
<div class="form-actions">
<button class="button primary" data-action="restore-backup" data-mode="replace">Replace current data</button>
<button class="button secondary" data-action="restore-backup" data-mode="merge">Merge records</button>
<button class="button secondary" data-action="close-dialog">Cancel</button>
</div>`);
            state.pendingBackup = data;
        }
        catch (error) {
            toast(error.message || "This backup file could not be read.", "error");
        }
        event.target.value = "";
    }
    async function clearAll() {
        if (!confirm("Delete all StudyWell records and settings from this browser? This cannot be undone. Export a backup first if needed."))
            return;
        const savedTasks = await SWStore.all("task");
        savedTasks.forEach((task) => cancelTaskReminder(task.id));
        cancelNativeReminder("daily-study");
        if (state.timer?.id)
            cancelNativeReminder(`timer-${state.timer.id}`);
        state.reminderTimeouts.forEach(clearTimeout);
        state.reminderTimeouts = [];
        state.taskReminderTimeouts.forEach(clearTimeout);
        state.taskReminderTimeouts.clear();
        await SWStore.clear();
        for (const key of Object.keys(localStorage))
            if (key.startsWith("sw_") || key.startsWith("studywell_"))
                localStorage.removeItem(key);
        sessionStorage.removeItem("sw_unlocked");
        state.timer = null;
        state.unlocked = true;
        toast("All local app data was deleted.");
        go("home");
    }
    function startBreathing() {
        if (state.breathRunning) {
            stopBreathing();
            return;
        }
        state.breathRunning = true;
        state.breathPhase = 0;
        const pattern = readSetting("sw_breath_pattern", "box");
        const patterns = {
            box: [
                { label: "Inhale", seconds: 4, css: "inhale" },
                { label: "Hold", seconds: 4, css: "hold" },
                { label: "Exhale", seconds: 4, css: "exhale" },
                { label: "Hold", seconds: 4, css: "hold" }
            ],
            calm: [
                { label: "Inhale", seconds: 4, css: "inhale" },
                { label: "Exhale", seconds: 6, css: "exhale" }
            ],
            equal: [
                { label: "Inhale", seconds: 5, css: "inhale" },
                { label: "Exhale", seconds: 5, css: "exhale" }
            ]
        };
        const phases = patterns[pattern] || patterns.box;
        const step = () => {
            if (!state.breathRunning)
                return;
            const phase = phases[state.breathPhase % phases.length];
            const circle = $("#breath-circle");
            const label = $("#breath-label");
            if (circle && label) {
                circle.className = `breath-circle ${phase.css}`;
                label.textContent = `${phase.label}\n${phase.seconds}s`;
            }
            state.breathPhase += 1;
            state.breathTimeout = setTimeout(step, phase.seconds * 1000);
        };
        step();
        const button = $('[data-action="breath-toggle"]');
        if (button)
            button.textContent = "Stop breathing";
    }
    function stopBreathing() {
        state.breathRunning = false;
        clearTimeout(state.breathTimeout);
        const circle = $("#breath-circle");
        const label = $("#breath-label");
        if (circle)
            circle.className = "breath-circle";
        if (label)
            label.textContent = "Ready";
        const button = $('[data-action="breath-toggle"]');
        if (button)
            button.textContent = "Start breathing";
    }
    function nativeBridge() {
        return window.StudyWellNative || null;
    }
    function scheduleNativeReminder(id, timestamp, title, body, repeatsDaily = false) {
        const bridge = nativeBridge();
        if (bridge && typeof bridge.scheduleReminder === "function") {
            bridge.scheduleReminder(id, timestamp, title, body, repeatsDaily);
        }
    }
    function cancelNativeReminder(id) {
        const bridge = nativeBridge();
        if (bridge && typeof bridge.cancelReminder === "function") {
            bridge.cancelReminder(id);
        }
    }
    async function showAppNotification(title, body, tag = "studywell-notification") {
        const bridge = nativeBridge();
        if (bridge && typeof bridge.notifyNow === "function") {
            bridge.notifyNow(title, body);
            return;
        }
        if (!("Notification" in window) || Notification.permission !== "granted") {
            toast(body, "success");
            return;
        }
        try {
            if ("serviceWorker" in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, {
                    body,
                    icon: "./icons/icon-192.png",
                    badge: "./icons/icon-192.png",
                    tag,
                    renotify: false
                });
            }
            else {
                new Notification(title, { body, tag });
            }
        }
        catch {
            toast(body, "success");
        }
    }
    function scheduleTaskReminder(task) {
        const reminderKey = String(task.id);
        const existingTimeout = state.taskReminderTimeouts.get(reminderKey);
        if (existingTimeout)
            clearTimeout(existingTimeout);
        state.taskReminderTimeouts.delete(reminderKey);
        if (task.done || !task.reminderAt) {
            cancelNativeReminder(`task-${reminderKey}`);
            return;
        }
        const reminderTime = new Date(task.reminderAt).getTime();
        if (!Number.isFinite(reminderTime) || reminderTime <= Date.now()) {
            cancelNativeReminder(`task-${reminderKey}`);
            return;
        }
        const title = `Study task: ${task.title}`;
        const body = task.subject ? `Subject: ${task.subject}` : "Open StudyWell to review your task.";
        scheduleNativeReminder(`task-${reminderKey}`, reminderTime, title, body, false);
        if (!("Notification" in window) || Notification.permission !== "granted")
            return;
        const delay = reminderTime - Date.now();
        if (delay > 2147480000)
            return;
        const timeoutId = window.setTimeout(() => {
            showAppNotification(title, body, `task-${reminderKey}`);
            state.taskReminderTimeouts.delete(reminderKey);
        }, delay);
        state.taskReminderTimeouts.set(reminderKey, timeoutId);
    }
    async function scheduleAllTaskReminders() {
        const tasks = await SWStore.all("task");
        tasks.forEach(scheduleTaskReminder);
    }
    function scheduleReminder() {
        state.reminderTimeouts.forEach(clearTimeout);
        state.reminderTimeouts = [];
        const reminder = readSetting("sw_reminders", { enabled: false, time: "18:00" });
        if (!reminder.enabled) {
            cancelNativeReminder("daily-study");
            return;
        }
        const [hour, minute] = (reminder.time || "18:00").split(":").map(Number);
        const next = new Date();
        next.setHours(hour || 18, minute || 0, 0, 0);
        if (next <= new Date())
            next.setDate(next.getDate() + 1);
        scheduleNativeReminder("daily-study", next.getTime(), "StudyWell daily check-in", "Review your plan and choose one useful next step.", true);
        if (!("Notification" in window) || Notification.permission !== "granted")
            return;
        const delay = next.getTime() - Date.now();
        if (delay > 2147480000)
            return;
        state.reminderTimeouts.push(window.setTimeout(async () => {
            await showAppNotification("StudyWell daily check-in", "Review your plan and choose one useful next step.", "studywell-daily-reminder");
            scheduleReminder();
        }, delay));
    }
    async function requestNotifications() {
        const bridge = nativeBridge();
        if (bridge && typeof bridge.requestNotificationPermission === "function") {
            bridge.requestNotificationPermission();
            toast("Allow notifications in the Android permission prompt.");
            return;
        }
        if (!("Notification" in window)) {
            toast("This browser does not support notifications.", "error");
            return;
        }
        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                toast("Notification permission granted.");
                scheduleReminder();
                scheduleAllTaskReminders();
            }
            else {
                toast("Notifications were not enabled. Check browser site settings.", "error");
            }
        }
        catch {
            toast("Could not request notification permission.", "error");
        }
    }
    async function handleAction(button) {
        const action = button.dataset.action;
        const id = button.dataset.id;
        switch (action) {
            case "go-mission":
                go("mission");
                break;
            case "go-focus":
                go("focus");
                break;
            case "go-planner":
                go("planner");
                break;
            case "go-mood":
                go("mood");
                break;
            case "comeback-start":
                state.timerMode = "focus";
                writeSetting("sw_timer_settings", { ...readSetting("sw_timer_settings", { focus: 25, short: 5, long: 15, cycles: 4 }), focus: 10 });
                state.timer = null;
                localStorage.removeItem("sw_timer_state");
                go("focus");
                setTimeout(() => {
                    if ($("#focus-goal"))
                        $("#focus-goal").value = "A small restart session";
                }, 0);
                break;
            case "add-task":
                addTask();
                break;
            case "edit-task": {
                const task = (await SWStore.all("task")).find((t) => t.id === id);
                if (task)
                    addTask(task);
                break;
            }
            case "delete-task":
                deleteRecord("task", id, "task");
                break;
            case "toggle-task":
                toggleTask(id);
                break;
            case "add-chapter":
                addChapter();
                break;
            case "edit-chapter": {
                const chapter = (await SWStore.all("chapter")).find((c) => c.id === id);
                if (chapter)
                    addChapter(chapter);
                break;
            }
            case "delete-chapter":
                deleteRecord("chapter", id, "chapter");
                break;
            case "add-card":
                addCard();
                break;
            case "edit-card": {
                const card = (await SWStore.all("flashcard")).find((c) => c.id === id);
                if (card)
                    addCard(card);
                break;
            }
            case "delete-card":
                deleteRecord("flashcard", id, "flashcard");
                break;
            case "show-all-cards":
                openDialog("Manage flashcards", "Edit or delete cards you have created.", `<div class="item-list">${state.data.flashcard.length ? state.data.flashcard.map((card) => `<div class="list-item">
<div class="list-main">
<strong>${escapeHTML(card.question)}</strong>
<p>${escapeHTML(card.subject || "General")} · ${card.nextReview ? `Next: ${fmtDate(card.nextReview)}` : "Due now"}</p>
</div>
<div class="list-actions">${iconButton("edit-card", "Edit card", "edit", card.id)}${iconButton("delete-card", "Delete card", "delete", card.id)}</div>
</div>`).join("") : "<p class='muted'>No cards yet.</p>"}</div>
<button class="button primary full" style="margin-top:16px" data-action="add-card">Add another card</button>`);
                break;
            case "flip-card":
                state.cardFlipped = !state.cardFlipped;
                await render();
                break;
            case "rate-card":
                await rateCard(button.dataset.rating);
                break;
            case "add-journal":
                addJournal();
                break;
            case "edit-journal": {
                const entry = (await SWStore.all("journal")).find((e) => e.id === id);
                if (entry)
                    addJournal(entry);
                break;
            }
            case "delete-record": {
                const record = (await SWStore.all()).find((item) => item.id === id);
                if (record)
                    deleteRecord(record.type, id, record.type === "mood" ? "check-in" : record.type === "journal" ? "journal entry" : record.type);
                break;
            }
            case "set-theme":
                applyTheme(button.dataset.theme);
                await render();
                toast(`${button.dataset.theme} theme applied.`);
                break;
            case "build-mission":
                localStorage.setItem("sw_mission_minutes", $("#mission-minutes").value);
                writeSetting("sw_mission_energy", $("#mission-energy").value);
                await render();
                toast("Daily mission refreshed.");
                break;
            case "save-mission": {
                const plan = state.currentMission || [];
                if (!plan.length) {
                    toast("Build a mission first.", "error");
                    break;
                }
                await SWStore.put("mission", { id: uid(), date: TODAY(), energy: readSetting("sw_mission_energy", "Medium"), minutes: Number(readSetting("sw_mission_minutes", 90)), blocks: plan, createdAt: Date.now() });
                await render();
                toast("Mission snapshot saved.");
                break;
            }
            case "mission-focus": {
                state.timerMode = "focus";
                writeSetting("sw_timer_settings", { ...readSetting("sw_timer_settings", { focus: 25, short: 5, long: 15, cycles: 4 }), focus: Math.max(5, Math.min(180, Number(button.dataset.minutes) || 25)) });
                state.timer = null;
                localStorage.removeItem("sw_timer_state");
                go("focus");
                setTimeout(() => {
                    if ($("#focus-goal"))
                        $("#focus-goal").value = button.dataset.title || "";
                }, 0);
                break;
            }
            case "timer-mode": {
                if (state.timer || readSetting("sw_timer_state", null)) {
                    toast("Reset the current timer before switching modes.", "error");
                    break;
                }
                state.timerMode = button.dataset.mode || "focus";
                await render();
                break;
            }
            case "timer-toggle": {
                const goal = $("#focus-goal")?.value.trim();
                const subject = $("#focus-subject")?.value.trim();
                if (state.timer) {
                    state.timer.goal = goal || state.timer.goal;
                    state.timer.subject = subject || state.timer.subject;
                    writeSetting("sw_timer_state", state.timer);
                    pauseTimer();
                }
                else
                    startTimer();
                break;
            }
            case "timer-reset":
                resetTimer();
                break;
            case "timer-finish":
                finishTimer(false);
                break;
            case "timer-settings":
                timerSettings();
                break;
            case "select-mood":
                writeSetting("sw_mood_selected", Number(button.dataset.score));
                await render();
                break;
            case "breath-toggle":
                state.breathRunning ? stopBreathing() : startBreathing();
                break;
            case "toggle-auto-lock":
                writeSetting("sw_auto_lock", button.getAttribute("aria-checked") !== "true");
                await render();
                break;
            case "setup-pin":
                setupPin(false);
                break;
            case "change-pin":
                setupPin(true);
                break;
            case "disable-pin":
                disablePin();
                break;
            case "toggle-reminders": {
                const settings = readSetting("sw_reminders", { enabled: false, time: "18:00" });
                settings.enabled = button.getAttribute("aria-checked") !== "true";
                writeSetting("sw_reminders", settings);
                scheduleReminder();
                await render();
                break;
            }
            case "save-reminders": {
                const settings = { ...readSetting("sw_reminders", {}), enabled: readSetting("sw_reminders", {}).enabled || false, time: $("#reminder-time").value || "18:00" };
                writeSetting("sw_reminders", settings);
                scheduleReminder();
                toast("Reminder settings saved.");
                break;
            }
            case "request-notifications":
                requestNotifications();
                break;
            case "export-data":
                exportData();
                break;
            case "import-data":
                importData();
                break;
            case "restore-backup": {
                if (!state.pendingBackup)
                    break;
                try {
                    const count = await SWStore.importAll(state.pendingBackup, button.dataset.mode);
                    state.pendingBackup = null;
                    closeDialog();
                    toast(`${count} records restored.`);
                    await render();
                    await scheduleAllTaskReminders();
                }
                catch (error) {
                    toast(error.message || "Restore failed.", "error");
                }
                break;
            }
            case "install-help":
                installHelp();
                break;
            case "check-offline": {
                const status = $("#offline-status");
                if (status)
                    status.textContent = `Service worker: ${navigator.serviceWorker?.controller ? "controlling this page" : "not controlling yet"}. Browser online flag: ${navigator.onLine ? "online" : "offline"}. Reopen once after first load to confirm cached launch.`;
                break;
            }
            case "clear-all":
                clearAll();
                break;
            case "close-dialog":
                closeDialog();
                break;
            case "save-weekly-review": {
                await SWStore.put("journal", { id: uid(), title: `Weekly review · ${fmtDate(TODAY())}`, text: `What helped me focus:\n${$("#weekly-win")?.value || "(not written)"}\n\nOne change for next week:\n${$("#weekly-next")?.value || "(not written)"}`, tags: "weekly review", date: TODAY(), createdAt: Date.now() });
                await render();
                toast("Weekly review saved to your journal.");
                break;
            }
            default: break;
        }
    }
    async function rateCard(rating) {
        const card = state.data.flashcard.find((item) => item.id === state.currentCard);
        if (!card)
            return;
        const intervals = { again: 1, hard: 2, good: 4, easy: 7 };
        const next = new Date();
        next.setHours(12, 0, 0, 0);
        next.setDate(next.getDate() + intervals[rating]);
        card.nextReview = next.toISOString().slice(0, 10);
        card.lastReviewed = TODAY();
        card.lastRating = rating;
        card.reviewCount = (card.reviewCount || 0) + 1;
        await SWStore.put("flashcard", card);
        state.currentCard = null;
        state.cardFlipped = false;
        await render();
        toast(`Card scheduled for ${fmtDate(card.nextReview)}.`);
    }
    async function handleSubmit(event) {
        const form = event.target;
        event.preventDefault();
        try {
            if (form.id === "task-form") {
                const id = $("#task-id").value || uid();
                const old = (await SWStore.all("task")).find((task) => task.id === id) || {};
                const savedTask = await SWStore.put("task", {
                    ...old,
                    id,
                    title: $("#task-title").value.trim(),
                    subject: $("#task-subject").value.trim(),
                    date: $("#task-date").value,
                    reminderAt: $("#task-reminder").value,
                    priority: $("#task-priority").value,
                    minutes: Number($("#task-minutes").value),
                    notes: $("#task-notes").value.trim(),
                    done: old.done || false,
                    createdAt: old.createdAt || Date.now()
                });
                scheduleTaskReminder(savedTask);
                closeDialog();
                await render();
                toast("Task saved.");
            }
            else if (form.id === "chapter-form") {
                const id = $("#chapter-id").value || uid();
                const old = (await SWStore.all("chapter")).find((item) => item.id === id) || {};
                await SWStore.put("chapter", { ...old, id, subject: $("#chapter-subject").value.trim(), name: $("#chapter-name").value.trim(), examDate: $("#chapter-exam").value, difficulty: $("#chapter-difficulty").value, status: $("#chapter-state").value, createdAt: old.createdAt || Date.now() });
                closeDialog();
                await render();
                toast("Chapter saved.");
            }
            else if (form.id === "flashcard-form") {
                const id = $("#flashcard-id").value || uid();
                const old = (await SWStore.all("flashcard")).find((item) => item.id === id) || {};
                await SWStore.put("flashcard", { ...old, id, subject: $("#flashcard-subject").value.trim(), question: $("#flashcard-question").value.trim(), answer: $("#flashcard-answer").value.trim(), nextReview: old.nextReview || TODAY(), createdAt: old.createdAt || Date.now() });
                closeDialog();
                state.currentCard = id;
                state.cardFlipped = false;
                await render();
                toast("Flashcard saved.");
            }
            else if (form.id === "journal-form") {
                const id = $("#journal-id").value || uid();
                const old = (await SWStore.all("journal")).find((item) => item.id === id) || {};
                await SWStore.put("journal", { ...old, id, title: $("#journal-title").value.trim() || "Untitled entry", text: $("#journal-text").value.trim(), tags: $("#journal-tags").value.trim(), date: TODAY(), createdAt: old.createdAt || Date.now() });
                localStorage.removeItem("sw_journal_draft");
                closeDialog();
                await render();
                toast("Journal entry saved.");
            }
            else if (form.id === "mood-form") {
                await SWStore.put("mood", { id: uid(), score: Number(readSetting("sw_mood_selected", 3)), note: $("#mood-note").value.trim(), date: TODAY(), createdAt: Date.now() });
                await render();
                toast("Check-in saved.");
            }
            else if (form.id === "distraction-form") {
                await SWStore.put("distraction", { id: uid(), kind: $("#distraction-kind").value, note: $("#distraction-note").value.trim(), date: TODAY(), createdAt: Date.now() });
                await render();
                toast("Interruption recorded. Use it as information, not blame.");
            }
            else if (form.id === "timer-settings-form") {
                const settings = { focus: Math.max(5, Math.min(180, Number($("#timer-focus").value) || 25)), short: Math.max(1, Math.min(60, Number($("#timer-short").value) || 5)), long: Math.max(1, Math.min(90, Number($("#timer-long").value) || 15)), cycles: Math.max(2, Math.min(8, Number($("#timer-cycles").value) || 4)) };
                writeSetting("sw_timer_settings", settings);
                state.timer = null;
                localStorage.removeItem("sw_timer_state");
                closeDialog();
                await render();
                toast("Timer settings saved.");
            }
            else if (form.id === "pin-form")
                await handlePinForm(event);
            else if (form.id === "disable-pin-form") {
                const pin = $("#disable-pin-value").value;
                if (!await pinMatches(pin)) {
                    $("#disable-pin-error").textContent = "Current PIN is incorrect.";
                    return;
                }
                localStorage.removeItem("sw_pin_verifier");
                localStorage.removeItem("sw_pin_attempts");
                localStorage.removeItem("sw_pin_wait_until");
                state.unlocked = true;
                closeDialog();
                await render();
                toast("App lock disabled.");
            }
            else if (form.id === "profile-form") {
                const name = $("#profile-name").value.trim();
                writeSetting("studywell_name", name);
                await render();
                toast("Profile saved.");
            }
        }
        catch (error) {
            toast(error.message || "Something went wrong while saving.", "error");
        }
    }
    function onInput(event) {
        if (event.target.id === "journal-text")
            writeSetting("sw_journal_draft", { ...(readSetting("sw_journal_draft", {})), text: event.target.value });
        if (event.target.id === "journal-title")
            writeSetting("sw_journal_draft", { ...(readSetting("sw_journal_draft", {})), title: event.target.value });
        if (event.target.id === "journal-search") {
            writeSetting("sw_journal_search", event.target.value);
            render();
            const search = $("#journal-search");
            if (search) {
                search.focus();
                search.setSelectionRange(search.value.length, search.value.length);
            }
        }
    }
    async function init() {
        applyTheme();
        const hash = location.hash.replace(/^#/, "");
        if (PAGES[hash])
            state.page = hash;
        const pinIsConfigured = Boolean(localStorage.getItem("sw_pin_verifier"));
        sessionStorage.removeItem("sw_unlocked");
        if (pinIsConfigured) {
            state.unlocked = false;
            $("#app-lock").classList.remove("hidden");
            $("#app-shell").classList.add("hidden");
        }
        else {
            state.unlocked = true;
            $("#app-lock").classList.add("hidden");
            $("#app-shell").classList.remove("hidden");
        }
        if (state.unlocked) {
            await render();
            scheduleAllTaskReminders();
        }
        if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !nativeBridge()) {
            navigator.serviceWorker.register("./sw.js").then(() => {
                if (navigator.serviceWorker.controller)
                    $("#save-status").textContent = "Offline-ready";
            }).catch(() => { $("#save-status").textContent = "Offline setup unavailable"; });
        }
        scheduleReminder();
        if ("serviceWorker" in navigator && !nativeBridge())
            navigator.serviceWorker.addEventListener("controllerchange", () => { $("#save-status").textContent = "Offline-ready"; });
        document.addEventListener("visibilitychange", () => {
            if (document.hidden)
                lockApp();
        });
        window.addEventListener("pagehide", () => lockApp(true));
        window.addEventListener("pageshow", () => {
            if (localStorage.getItem("sw_pin_verifier"))
                lockApp(true);
        });
        const storedTimer = readSetting("sw_timer_state", null);
        if (storedTimer) {
            state.timer = storedTimer;
            state.timerMode = storedTimer.mode || "focus";
            if (storedTimer.running)
                ensureTimerTick();
        }
        if ("serviceWorker" in navigator && !nativeBridge())
            navigator.serviceWorker.ready.catch(() => { });
        const name = readSetting("studywell_name", null);
        if (state.unlocked && !localStorage.getItem("sw_onboarded"))
            showOnboarding();
    }
    function showOnboarding() {
        openDialog("Welcome to StudyWell", "A quieter way to organise your study — private and offline-first.", `<div class="onboarding-step">
<div class="onboarding-progress">
<span class="active">
</span>
<span>
</span>
<span>
</span>
</div>
<h2>Start with your own routine.</h2>
<p>No account, social feed, streak pressure or AI service. Your work is stored locally in this browser.</p>
<label class="field">
<span class="field-label">What should we call you? (optional)</span>
<input class="input" id="welcome-name" maxlength="40" placeholder="Your name">
</label>
<div class="form-actions">
<button class="button primary" data-action="onboarding-next">Continue</button>
<button class="button secondary" data-action="onboarding-skip">Skip setup</button>
</div>
</div>`);
    }
    function onboardingNext() {
        const name = $("#welcome-name")?.value.trim() || "";
        writeSetting("studywell_name", name);
        openDialog("Choose your starting point", "You can change everything later.", `<div class="onboarding-step">
<div class="onboarding-progress">
<span class="active">
</span>
<span class="active">
</span>
<span>
</span>
</div>
<h2>What would help most?</h2>
<p>Choose one. This only changes where StudyWell opens next.</p>
<div class="stack">
<button class="button secondary full" data-action="onboarding-choice" data-choice="planner">Planning tasks and exams</button>
<button class="button secondary full" data-action="onboarding-choice" data-choice="focus">Building a focus routine</button>
<button class="button secondary full" data-action="onboarding-choice" data-choice="cards">Remembering what I study</button>
<button class="button secondary full" data-action="onboarding-choice" data-choice="mood">Checking in and reflecting</button>
</div>
</div>`);
    }
    function finishOnboarding(page = "home") { localStorage.setItem("sw_onboarded", "1"); closeDialog(); go(page); }
    document.addEventListener("click", (event) => {
        const pageButton = event.target.closest("[data-page]");
        if (pageButton) {
            go(pageButton.dataset.page);
            return;
        }
        const actionButton = event.target.closest("[data-action]");
        if (actionButton) {
            if (actionButton.dataset.action === "onboarding-next") {
                onboardingNext();
                return;
            }
            if (actionButton.dataset.action === "onboarding-skip") {
                finishOnboarding("home");
                return;
            }
            if (actionButton.dataset.action === "onboarding-choice") {
                finishOnboarding(actionButton.dataset.choice);
                return;
            }
            handleAction(actionButton);
        }
    });
    document.addEventListener("submit", (event) => {
        if (event.target.id === "unlock-form")
            unlockSubmit(event);
        else
            handleSubmit(event);
    });
    document.addEventListener("keydown", (event) => {
        const card = event.target.closest("[data-action='flip-card'][role='button']");
        if (card && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            state.cardFlipped = !state.cardFlipped;
            render();
        }
    });
    document.addEventListener("input", onInput);
    document.addEventListener("change", async (event) => {
        if (event.target.id === "task-filter") {
            writeSetting("sw_task_filter", event.target.value);
            await render();
        }
        if (event.target.id === "breath-pattern") {
            writeSetting("sw_breath_pattern", event.target.value);
            stopBreathing();
            await render();
        }
        if (event.target.matches("[data-action='chapter-status']")) {
            const chapter = (await SWStore.all("chapter")).find((item) => item.id === event.target.dataset.id);
            if (chapter) {
                chapter.status = event.target.value;
                await SWStore.put("chapter", chapter);
                await render();
                toast("Chapter status updated.");
            }
        }
    });
    window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.installPrompt = event; $("#install-button").classList.remove("hidden"); });
    $("#install-button").addEventListener("click", async () => {
        if (!state.installPrompt) {
            installHelp();
            return;
        }
        state.installPrompt.prompt();
        await state.installPrompt.userChoice;
        state.installPrompt = null;
        $("#install-button").classList.add("hidden");
    });
    $("#quick-add").addEventListener("click", addTaskFromQuick);
    $("#app-dialog").addEventListener("click", (event) => {
        if (event.target === $("#app-dialog"))
            closeDialog();
    });
    $("#backup-file").addEventListener("change", handleBackupFile);
    window.addEventListener("hashchange", () => {
        const page = location.hash.replace(/^#/, "");
        if (PAGES[page]) {
            state.page = page;
            render();
        }
    });
    window.addEventListener("pageshow", () => {
        if (state.timer?.running)
            ensureTimerTick();
    });
    init().catch((error) => {
        console.error("StudyWell failed to start:", error);
        const content = $("#page-content");
        if (content) {
            content.innerHTML = `<section class="card">
<h2>StudyWell could not start</h2>
<p class="muted">Your saved data has not been intentionally deleted. Reload the app, or export a backup if the app opens again.</p>
<button class="button primary" type="button" onclick="location.reload()">Reload StudyWell</button>
</section>`;
        }
    });
})();
