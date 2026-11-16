setTimeout(() => document.body.classList.add("ready"), 4000);
// ===== 1. Supabase connection (paste YOUR values here) =====
const SUPABASE_URL = "https://izzzjlmdazgybalsijps.supabase.co";
const SUPABASE_KEY = "sb_publishable_M1jQWmFZX_yQNZo9izhX-g_Io5MXEWG";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. Menu (works on every page) =====
const menuBtn = document.getElementById("menuBtn");
const navigation = document.getElementById("navigation");

menuBtn.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("active");
    menuBtn.textContent = isOpen ? "✕" : "☰";
    menuBtn.setAttribute("aria-expanded", isOpen);
});

// Highlight the link of the page you are on
const currentPage = location.pathname.split("/").pop() || "index.html";
navigation.querySelectorAll("a").forEach(link => {
    if (link.getAttribute("href") === currentPage) link.classList.add("current");
});

// ===== 3. Who is signed in? =====
async function getAccount() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return { session: null, profile: null, isStaff: false };

    const { data: profile } = await db
        .from("profiles")
        .select("full_name, role, approved")
        .eq("id", session.user.id)
        .single();

    const isStaff = !!profile && profile.approved &&
        (profile.role === "teacher" || profile.role === "admin");

    return { session, profile, isStaff };
}

// ===== 4. Announcements list =====
async function loadAnnouncements() {
    const list = document.getElementById("announcement-list");
    if (!list) return;

    let query = db.from("announcements").select("*")
        .order("created_at", { ascending: false });
    if (list.dataset.limit) query = query.limit(Number(list.dataset.limit));

    const { data, error } = await query;

    if (error) {
        list.textContent = "Could not load announcements. Check your connection and refresh.";
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
        card.style.marginBottom = "12px";

        const title = document.createElement("h3");
        title.textContent = item.title;
        const body = document.createElement("p");
        body.textContent = item.body;
        const meta = document.createElement("small");
        meta.textContent = (item.author || "School") + " · " +
            new Date(item.created_at).toLocaleDateString();

        card.append(title, body, meta);
        list.appendChild(card);
    });
}

// ===== 5. Post form (announcements page, staff only) =====
function setupPostForm(account) {
    const form = document.getElementById("post-form");
    if (!form) return;

    form.hidden = !account.isStaff;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("post-msg");
        const title = document.getElementById("post-title");
        const body = document.getElementById("post-body");

        const { error } = await db.from("announcements").insert({
            title: title.value.trim(),
            body: body.value.trim(),
            author: (account.profile && account.profile.full_name) || "School Administration"
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
}

// ===== 6. Login page =====
async function renderLoginPage() {
    const account = await getAccount();
    const loginBox = document.getElementById("login-box");
    const userBox = document.getElementById("user-box");

    if (!account.session) {
        loginBox.hidden = false;
        userBox.hidden = true;
        return;
    }

    loginBox.hidden = true;
    userBox.hidden = false;

    const p = account.profile;
    document.getElementById("user-name").textContent =
        (p && p.full_name) || "Welcome";
    document.getElementById("user-email").textContent = account.session.user.email;

    const status = document.getElementById("user-status");
    const note = document.getElementById("user-note");
    if (p && p.approved) {
        status.textContent = p.role;
        note.textContent = "Your account is approved.";
    } else {
        status.textContent = "waiting for approval";
        note.textContent = "A school admin needs to approve your account before you can use all features.";
    }
}

function setupLoginPage() {
    if (!document.getElementById("login-box")) return;

    document.getElementById("login-btn").addEventListener("click", async () => {
        const msg = document.getElementById("login-msg");
        msg.textContent = "Signing in...";
        const { error } = await db.auth.signInWithPassword({
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value
        });
        if (error) {
            msg.textContent = "Wrong email or password.";
            return;
        }
        window.location.href = "index.html";
    });

    document.getElementById("signup-btn").addEventListener("click", async () => {
        const msg = document.getElementById("login-msg");
        const name = document.getElementById("signup-name").value.trim();
        if (!name) {
            msg.textContent = "Enter your full name to create an account.";
            return;
        }
        msg.textContent = "Creating account...";
        const { error } = await db.auth.signUp({
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value,
            options: { data: { full_name: name } }
        });
        if (error) {
            msg.textContent = error.message;
            return;
        }
        msg.textContent = "";
        renderLoginPage();
    });

    document.getElementById("logout-btn").addEventListener("click", async () => {
        await db.auth.signOut();
        renderLoginPage();
    });

    renderLoginPage();
}
// ===== Admin page =====
let adminUserId = null;

function makeButton(label, cls, onClick) {
    const b = document.createElement("button");
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
}

async function updateProfile(id, changes) {
    const { error } = await db.from("profiles").update(changes).eq("id", id);
    if (error) alert("Could not update this account.");
    loadPeople();
}

function personCard(p, buttons) {
    const card = document.createElement("article");
    card.className = "content-card";
    card.style.marginBottom = "12px";

    const name = document.createElement("h3");
    name.textContent = p.full_name || "(no name)";
    const email = document.createElement("p");
    email.textContent = p.email || "";
    const pill = document.createElement("span");
    pill.className = "status-pill";
    pill.textContent = p.approved ? p.role : "pending";

    const row = document.createElement("div");
    row.style.marginTop = "10px";
    buttons.forEach(b => row.appendChild(b));

    card.append(name, email, pill, row);
    return card;
}

async function loadPeople() {
    const pendingList = document.getElementById("pending-list");
    const approvedList = document.getElementById("approved-list");

    const { data, error } = await db.from("profiles")
        .select("id, full_name, email, role, approved, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        pendingList.textContent = "Could not load people.";
        return;
    }

    pendingList.innerHTML = "";
    approvedList.innerHTML = "";
    const pending = data.filter(p => !p.approved);
    const approved = data.filter(p => p.approved);
    document.getElementById("pending-count").textContent = pending.length;
    document.getElementById("approved-count").textContent = approved.length;

    if (!pending.length) pendingList.textContent = "No one is waiting.";

    pending.forEach(p => {
        pendingList.appendChild(personCard(p, [
            makeButton("Approve as student", "primary-btn",
                () => updateProfile(p.id, { approved: true, role: "student" })),
            makeButton("Approve as teacher", "secondary-btn",
                () => updateProfile(p.id, { approved: true, role: "teacher" }))
        ]));
    });

    approved.forEach(p => {
        const buttons = [];
        if (p.id !== adminUserId && p.role !== "admin") {
            buttons.push(makeButton(
                p.role === "student" ? "Make teacher" : "Make student",
                "secondary-btn",
                () => updateProfile(p.id, { role: p.role === "student" ? "teacher" : "student" })
            ));
            buttons.push(makeButton("Remove access", "secondary-btn",
                () => updateProfile(p.id, { approved: false, role: "student" })));
        }
        approvedList.appendChild(personCard(p, buttons));
    });
}

function setupAdminPage(account) {
    if (!document.getElementById("pending-list")) return;
    const isAdmin = account.profile && account.profile.role === "admin" && account.profile.approved;
    if (!isAdmin) {
        window.location.replace("index.html");
        return;
    }
    adminUserId = account.session.user.id;
    loadPeople();
}
// ===== 7. Start =====
(async function init() {
    const account = await getAccount();
    const onLoginPage = currentPage === "login.html";
    const approved = account.profile && account.profile.approved;

    if (!onLoginPage && (!account.session || !approved)) {
        window.location.replace("login.html");
        return;
    }

    document.body.classList.add("ready");
    loadAnnouncements();
    setupLoginPage();
    document.getElementById("account-link").textContent =
        account.session ? "My account" : "Sign in";
    setupPostForm(account);

    const isAdmin = account.profile && account.profile.role === "admin" && approved;
    if (isAdmin) {
        const link = document.createElement("a");
        link.href = "admin.html";
        link.textContent = "Admin";
        if (currentPage === "admin.html") link.classList.add("current");
        navigation.appendChild(link);
    }
    setupAdminPage(account);
})();
