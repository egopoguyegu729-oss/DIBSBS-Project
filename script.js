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
const FILE_BUCKET = "announcement-files";

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

    // Get temporary secure links for all attached files at once
    const paths = data.filter(i => i.file_path).map(i => i.file_path);
    const urls = {};
    if (paths.length) {
        const { data: signed } = await db.storage
            .from(FILE_BUCKET).createSignedUrls(paths, 3600);
        (signed || []).forEach(s => {
            if (s.signedUrl) urls[s.path] = s.signedUrl;
        });
    }

    data.forEach(item => {
        const card = document.createElement("article");
        card.className = "content-card";
        card.style.marginBottom = "12px";

        const title = document.createElement("h3");
        title.textContent = item.title;
        card.appendChild(title);

        if (item.body) {
            const body = document.createElement("p");
            body.textContent = item.body;
            card.appendChild(body);
        }

        const url = item.file_path && urls[item.file_path];
        if (url) {
            if ((item.file_type || "").startsWith("image/")) {
                const link = document.createElement("a");
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener";
                const img = document.createElement("img");
                img.src = url;
                img.alt = item.file_name || "Attached image";
                img.className = "attachment-img";
                link.appendChild(img);
                card.appendChild(link);
            } else {
                const link = document.createElement("a");
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener";
                link.className = "primary-btn attachment-link";
                link.textContent = "📎 " + (item.file_name || "Open file");
                card.appendChild(link);
            }
        }

        const meta = document.createElement("small");
        meta.style.display = "block";
        meta.textContent = (item.author || "School") + " · " +
            new Date(item.created_at).toLocaleDateString();
        card.appendChild(meta);

        list.appendChild(card);
    });
}

// ===== 5. Post form (announcements page, staff only) =====
const MAX_FILE_MB = 10;

function setupPostForm(account) {
    const form = document.getElementById("post-form");
    if (!form) return;

    form.hidden = !account.isStaff;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("post-msg");
        const title = document.getElementById("post-title");
        const body = document.getElementById("post-body");
        const fileInput = document.getElementById("post-file");
        const button = form.querySelector("button[type=submit]");
        const file = fileInput.files[0];

        if (file && file.size > MAX_FILE_MB * 1024 * 1024) {
            msg.textContent = "That file is too large. The limit is " + MAX_FILE_MB + " MB.";
            return;
        }

        button.disabled = true;
        msg.textContent = file ? "Uploading..." : "Posting...";

        let file_path = null, file_name = null, file_type = null;

        if (file) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            file_path = Date.now() + "-" + safeName;
            const { error: uploadError } = await db.storage
                .from(FILE_BUCKET)
                .upload(file_path, file, { contentType: file.type });

            if (uploadError) {
                msg.textContent = "Could not upload the file. Use a photo, PDF or Word/PowerPoint file under 10 MB.";
                button.disabled = false;
                return;
            }
            file_name = file.name;
            file_type = file.type;
        }

        const { error } = await db.from("announcements").insert({
            title: title.value.trim(),
            body: body.value.trim(),
            author: (account.profile && account.profile.full_name) || "School Administration",
            file_path, file_name, file_type
        });

        button.disabled = false;

        if (error) {
            msg.textContent = "Could not post. You may not have permission.";
            return;
        }
        msg.textContent = "Posted!";
        title.value = "";
        body.value = "";
        fileInput.value = "";
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

// ===== Library page =====
const LIBRARY_BUCKET = "library-files";
const MAX_LIBRARY_MB = 50;
const GRADES = ["9", "10", "11", "12"];
const SUBJECTS = [
    "Mathematics", "English", "Physics", "Chemistry", "Biology",
    "Geography", "History", "Civics", "Economics", "ICT",
    "Amharic", "Afaan Oromoo", "Other"
];

let libraryItems = [];
let libraryUrls = {};
let libraryIsAdmin = false;

function fillSelect(select, values, labelFn) {
    values.forEach(v => {
        const option = document.createElement("option");
        option.value = v;
        option.textContent = labelFn ? labelFn(v) : v;
        select.appendChild(option);
    });
}

async function loadLibrary() {
    const list = document.getElementById("library-list");
    const { data, error } = await db.from("resources")
        .select("*").order("created_at", { ascending: false });

    if (error) {
        list.textContent = "Could not load the library. Refresh and try again.";
        return;
    }

    libraryItems = data;
    libraryUrls = {};
    if (data.length) {
        const { data: signed } = await db.storage
            .from(LIBRARY_BUCKET)
            .createSignedUrls(data.map(i => i.file_path), 3600);
        (signed || []).forEach(s => {
            if (s.signedUrl) libraryUrls[s.path] = s.signedUrl;
        });
    }
    renderLibrary();
}

async function deleteResource(item) {
    if (!confirm('Delete "' + item.title + '" from the library?')) return;
    const { error } = await db.from("resources").delete().eq("id", item.id);
    if (error) {
        alert("Could not delete this item.");
        return;
    }
    await db.storage.from(LIBRARY_BUCKET).remove([item.file_path]);
    loadLibrary();
}

function renderLibrary() {
    const list = document.getElementById("library-list");
    const grade = document.getElementById("filter-grade").value;
    const subject = document.getElementById("filter-subject").value;
    const search = document.getElementById("lib-search").value.trim().toLowerCase();

    const shown = libraryItems.filter(i =>
        (!grade || i.grade === grade) &&
        (!subject || i.subject === subject) &&
        (!search || i.title.toLowerCase().includes(search))
    );

    document.getElementById("lib-count").textContent =
        shown.length + (shown.length === 1 ? " item" : " items");
    list.innerHTML = "";

    if (!shown.length) {
        list.textContent = libraryItems.length
            ? "Nothing matches your filters."
            : "The library is empty. Teachers can add the first material.";
        return;
    }

    shown.forEach(item => {
        const card = document.createElement("article");
        card.className = "content-card";
        card.style.marginBottom = "12px";

        const tag = document.createElement("span");
        tag.className = "category";
        tag.textContent = item.subject + " · Grade " + item.grade;

        const title = document.createElement("h3");
        title.textContent = item.title;
        card.append(tag, title);

        if (item.description) {
            const desc = document.createElement("p");
            desc.textContent = item.description;
            card.appendChild(desc);
        }

        const row = document.createElement("div");
        const url = libraryUrls[item.file_path];
        if (url) {
            const open = document.createElement("a");
            open.href = url;
            open.target = "_blank";
            open.rel = "noopener";
            open.className = "primary-btn attachment-link";
            open.textContent = "📎 " + item.file_name;
            row.appendChild(open);
        }
        if (libraryIsAdmin) {
            row.appendChild(makeButton("Delete", "secondary-btn",
                () => deleteResource(item)));
        }
        card.appendChild(row);
        list.appendChild(card);
    });
}

function setupLibrary(account) {
    if (!document.getElementById("library-list")) return;

    libraryIsAdmin = !!account.profile && account.profile.role === "admin" &&
        account.profile.approved;

    fillSelect(document.getElementById("filter-grade"), GRADES, g => "Grade " + g);
    fillSelect(document.getElementById("filter-subject"), SUBJECTS);
    fillSelect(document.getElementById("lib-grade"), GRADES, g => "Grade " + g);
    fillSelect(document.getElementById("lib-subject"), SUBJECTS);

    ["filter-grade", "filter-subject"].forEach(id =>
        document.getElementById(id).addEventListener("change", renderLibrary));
    document.getElementById("lib-search").addEventListener("input", renderLibrary);

    const form = document.getElementById("library-form");
    form.hidden = !account.isStaff;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("lib-msg");
        const button = form.querySelector("button[type=submit]");
        const fileInput = document.getElementById("lib-file");
        const file = fileInput.files[0];

        if (!file) {
            msg.textContent = "Choose a file to upload.";
            return;
        }
        if (file.size > MAX_LIBRARY_MB * 1024 * 1024) {
            msg.textContent = "That file is too large. The limit is " + MAX_LIBRARY_MB + " MB.";
            return;
        }

        button.disabled = true;
        msg.textContent = "Uploading... please keep this page open.";

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const file_path = Date.now() + "-" + safeName;

        const { error: uploadError } = await db.storage
            .from(LIBRARY_BUCKET)
            .upload(file_path, file, { contentType: file.type });

        if (uploadError) {
            msg.textContent = "Could not upload. Use a PDF, Word, PowerPoint or image under 50 MB.";
            button.disabled = false;
            return;
        }

        const { error } = await db.from("resources").insert({
            title: document.getElementById("lib-title").value.trim(),
            subject: document.getElementById("lib-subject").value,
            grade: document.getElementById("lib-grade").value,
            description: document.getElementById("lib-desc").value.trim() || null,
            file_path,
            file_name: file.name,
            file_type: file.type
        });

        button.disabled = false;

        if (error) {
            msg.textContent = "Could not save. You may not have permission.";
            return;
        }
        msg.textContent = "Added to the library!";
        form.reset();
        loadLibrary();
    });

    loadLibrary();
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
    setupLibrary(account);
})();
