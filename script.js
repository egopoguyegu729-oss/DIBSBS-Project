
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

const SUPABASE_URL = "https://izzzjlmdazgybalsijps.supabase.co";
const SUPABASE_KEY = "sb_publishable_M1jQWmFZX_yQNZo9izhX-g_Io5MXEWG";

async function loadAnnouncements() {
    const list = document.getElementById("announcement-list");

    try {
        const response = await fetch(
            SUPABASE_URL + "/rest/v1/announcements?select=*&order=created_at.desc",
            { headers: { apikey: SUPABASE_KEY } }
        );
        const items = await response.json();

        list.innerHTML = "";

        if (!items.length) {
            list.textContent = "No announcements yet.";
            return;
        }

        items.forEach(item => {
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
    } catch (error) {
        list.textContent = "Could not load announcements.";
    }
}

loadAnnouncements();
