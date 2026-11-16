const SUPABASE_URL = "https://izzzjlmdazgybalsijps.supabase.co";
const SUPABASE_KEY = "sb_publishable_M1jQWmFZX_yQNZo9izhX-g_Io5MXEWG";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- Menu ----
const menuBtn = document.getElementById("menuBtn");
const navigation = document.getElementById("navigation");

menuBtn.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("active");
    menuBtn.textContent = isOpen ? "✕" : "☰";
    menuBtn.setAttribute("aria-expanded", isOpen);
});

navigation.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
        navigation.classList.remove("active");
        menuBtn.textContent = "☰";
        menuBtn.setAttribute("aria-expanded", "false");
    });
});

// ---- Announcements ----
async function loadAnnouncements() {
    const list = document.getElementById("announcement-list");
    const { data, error } = await db
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        list.textContent = "Could not load announcements.";
        return;
    }
    list.innerHTML = "";
    if (!data.length) {
        list.textContent = "No announcements yet.";
        return;
    }
    data.forEach(item => {
        const card = document.createElement("article");
        card.className = "content-card";
        const title = document.createElement("h3");
        title.textContent = item.title;
        const body = document.createElement("p");
        body.textContent = item.body;
        const author = document.createElement("small");
        author.textContent = item.author || "School";
        card.append(title, body, author);
        list.appendChild(card);
    });
}

// ---- Login ----
let currentProfile = null;

async function refreshAccount() {
    const { data: { session } } = await db.auth.getSession();
    const loginBox = document.getElementById("login-box");
    const userBox = document.getElementById("user-box");
    const postForm = document.getElementById("post-form");

    if (!session) {
        currentProfile = null;
        loginBox.hidden = false;
        userBox.hidden = true;
        postForm.hidden = true;
        return;
    }

    const { data: profile } = await db
        .from("profiles")
        .select("full_name, role, approved")
        .eq("id", session.user.id)
        .single();

    currentProfile = profile;
    loginBox.hidden = true;
    userBox.hidden = false;
    document.getElementById("user-label").textContent =
        "Signed in as " + session.user.email +
        (profile ? " (" + profile.role + ")" : "");

    const isStaff = profile && profile.approved &&
        (profile.role === "teacher" || profile.role === "admin");
    postForm.hidden = !isStaff;
}

document.getElementById("login-btn").addEventListener("click", async () => {
    const msg = document.getElementById("login-msg");
    msg.textContent = "Signing in...";
    const { error } = await db.auth.signInWithPassword({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value
    });
    msg.textContent = error ? "Wrong email or password." : "";
    if (!error) refreshAccount();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
    await db.auth.signOut();
    refreshAccount();
});

// ---- Post announcement ----
document.getElementById("post-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("post-msg");
    const title = document.getElementById("post-title");
    const body = document.getElementById("post-body");

    const { error } = await db.from("announcements").insert({
        title: title.value.trim(),
        body: body.value.trim(),
        author: (currentProfile && currentProfile.full_name) || "School Administration"
    });

    if (error) {
        msg.textContent = "Could not post. You may not have permission.";
        return;
    }
    msg.textContent = "Posted!";
    title.value = "";
    body.value = "";
    loadAnnouncements();
});

loadAnnouncements();
refreshAccount();
