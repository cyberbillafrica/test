const loginForm = document.getElementById("loginForm");

/* ===================================
   LOGIN
=================================== */
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            alert(error.message);
            return;
        }

        window.location.href = "dashboard.html";
    });
}

/* ===================================
   STAFF REGISTRATION
=================================== */

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const invite_code = document.getElementById("invite_code").value.trim();

        const { data: invite } = await supabase
            .from("staff_invites")
            .select("*")
            .eq("invite_code", invite_code)
            .eq("used", false)
            .single();

        if (!invite) {
            alert("Invalid or already used invite code.");
            return;
        }

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const full_name = document.getElementById("full_name").value.trim();
        const phone = document.getElementById("phone").value.trim();

        // Create Auth account
        const { data: authData, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            alert(error.message);
            return;
        }

        // Create Staff record
        await supabase
            .from("staff")
            .insert([{
                auth_id: authData.user.id,
                full_name,
                email,
                phone,
                role: invite.role,
                lga: invite.lga,
                ward: invite.ward,
                active: true
            }]);

        // Mark invite as used
        await supabase
            .from("staff_invites")
            .update({
                used: true
            })
            .eq("id", invite.id);

        alert("Registration successful. Please login.");

        window.location.href = "login.html";
    });
}


/* ===================================
   ROUTE PROTECTION
=================================== */
async function protectRoute() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const { data: staff } = await supabase
        .from("staff")
        .select("*")
        .eq("auth_id", user.id)
        .single();

    if (!staff || !staff.active) {
        await supabase.auth.signOut();
        window.location.href = "login.html";
        return;
    }

    window.currentStaff = staff;
}

/* ===================================
   ROLE GUARD
=================================== */
function requireSuperAdmin() {
    if (!window.currentStaff) {
        window.location.href = "login.html";
        return;
    }

    if (window.currentStaff.role !== "super_admin") {
        alert("Access denied. This area is for Super Admins only.");
        window.location.href = "dashboard.html";
    }
}

/* ===================================
   LOGOUT
=================================== */
window.logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
};

/* ===================================
   DASHBOARD
=================================== */
async function loadDashboard() {
    const { data } = await supabase
        .from("applications")
        .select("*");

    if (!data) return;

    const total = data.length;
    const shortlisted = data.filter(x => x.shortlisted).length;
    const selected = data.filter(x => x.selected).length;
    const rejected = data.filter(x => x.rejected).length;

    if (document.getElementById("totalApplications"))
        document.getElementById("totalApplications").innerText = total;

    if (document.getElementById("shortlistedCount"))
        document.getElementById("shortlistedCount").innerText = shortlisted;

    if (document.getElementById("selectedCount"))
        document.getElementById("selectedCount").innerText = selected;

    if (document.getElementById("rejectedCount"))
        document.getElementById("rejectedCount").innerText = rejected;

    const grouped = {};

    data.forEach(app => {
        if (!grouped[app.ward]) {
            grouped[app.ward] = {
                applications: 0,
                shortlisted: 0,
                selected: 0
            };
        }

        grouped[app.ward].applications++;

        if (app.shortlisted) grouped[app.ward].shortlisted++;
        if (app.selected) grouped[app.ward].selected++;
    });

    const wardTable = document.getElementById("wardAnalytics");

    if (wardTable) {
        wardTable.innerHTML = Object.entries(grouped).map(([ward, stats]) => `
            <tr>
                <td>${ward}</td>
                <td>${stats.applications}</td>
                <td>${stats.shortlisted}</td>
                <td>${stats.selected}</td>
            </tr>
        `).join("");
    }
}

/* ===================================
   LOAD APPLICATIONS
=================================== */
async function loadApplications(filters = {}) {
    let query = supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });

    if (window.currentStaff.role === "ward_officer") {
        query = query.eq("ward", window.currentStaff.ward);
    }

    if (window.currentStaff.role === "lga_officer") {
        query = query.eq("lga", window.currentStaff.lga);
    }

    if (filters.name) {
        query = query.ilike("full_name", `%${filters.name}%`);
    }

    if (filters.ward) {
        query = query.ilike("ward", `%${filters.ward}%`);
    }

    if (filters.lga) {
        query = query.ilike("lga", `%${filters.lga}%`);
    }

    const { data } = await query;

    const table = document.getElementById("applicationsTable");

    if (!table || !data) return;

    table.innerHTML = data.map(app => `
        <tr>
            <td>${app.full_name}</td>
            <td>${app.ward}</td>
            <td>${app.lga}</td>
            <td>${app.skill_type}</td>
            <td>${app.empowerment_choice}</td>
            <td>
                <a href="${app.skill_evidence_url}" target="_blank">Skill</a><br>
                <a href="${app.passport_url}" target="_blank">Passport</a>
            </td>
            <td>${app.status || "pending"}</td>
            <td>
                <button class="btn btn-sm btn-primary mb-1" onclick="shortlist('${app.id}')">Shortlist</button>
                <button class="btn btn-sm btn-success mb-1" onclick="selectApplicant('${app.id}','${app.ward}')">Select</button>
                <button class="btn btn-sm btn-danger" onclick="rejectApplicant('${app.id}')">Reject</button>
            </td>
        </tr>
    `).join("");
}

/* ===================================
   AUDIT LOG
=================================== */
async function logAction(applicationId, action) {
    await supabase
        .from("audit_logs")
        .insert([{
            staff_id: window.currentStaff.id,
            application_id: applicationId,
            action
        }]);
}

/* ===================================
   APPLICATION ACTIONS
=================================== */
window.shortlist = async (id) => {
    await supabase
        .from("applications")
        .update({
            shortlisted: true,
            rejected: false,
            status: "shortlisted",
            reviewed_by: window.currentStaff.id
        })
        .eq("id", id);

    await logAction(id, "shortlisted");

    location.reload();
};

window.rejectApplicant = async (id) => {
    await supabase
        .from("applications")
        .update({
            rejected: true,
            shortlisted: false,
            selected: false,
            status: "rejected",
            reviewed_by: window.currentStaff.id
        })
        .eq("id", id);

    await logAction(id, "rejected");

    location.reload();
};

window.selectApplicant = async (id, ward) => {
    const { count } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("ward", ward)
        .eq("selected", true);

    if (count >= 2) {
        alert("This ward already has 2 selected beneficiaries.");
        return;
    }

    await supabase
        .from("applications")
        .update({
            selected: true,
            shortlisted: true,
            rejected: false,
            status: "selected",
            reviewed_by: window.currentStaff.id
        })
        .eq("id", id);

    await logAction(id, "selected");

    location.reload();
};

/* ===================================
   STAFF INVITES
=================================== */
function generateInviteCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "CSDA-";

    for (let i = 0; i < 6; i++) {
        code += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );
    }

    return code;
}

const inviteForm = document.getElementById("inviteForm");

if (inviteForm) {
    inviteForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const invite_code = generateInviteCode();

        const { error } = await supabase
            .from("staff_invites")
            .insert([{
                invite_code,
                role: document.getElementById("invite_role").value,
                lga: document.getElementById("invite_lga").value,
                ward: document.getElementById("invite_ward").value,
                created_by: window.currentStaff.id
            }]);

        if (error) {
            alert(error.message);
            return;
        }

        alert("Invite created: " + invite_code);

        inviteForm.reset();

        loadInvites();
    });
}

async function loadInvites() {
    const { data } = await supabase
        .from("staff_invites")
        .select("*")
        .order("created_at", { ascending: false });

    const table = document.getElementById("inviteTable");

    if (!table || !data) return;

    table.innerHTML = data.map(invite => `
        <tr>
            <td>${invite.invite_code}</td>
            <td>${invite.role}</td>
            <td>${invite.lga || ""}</td>
            <td>${invite.ward || ""}</td>
            <td>${invite.used ? "Used" : "Unused"}</td>
        </tr>
    `).join("");
}

/* ===================================
   STAFF DIRECTORY
=================================== */
async function loadStaff() {
    const { data } = await supabase
        .from("staff")
        .select("*")
        .order("created_at", { ascending: false });

    const table = document.getElementById("staffTable");

    if (!table || !data) return;

    table.innerHTML = data.map(staff => `
        <tr>
            <td>${staff.full_name}</td>
            <td>${staff.email}</td>
            <td>${staff.phone || ""}</td>
            <td>${staff.role}</td>
            <td>${staff.lga || ""}</td>
            <td>${staff.ward || ""}</td>
            <td>${staff.active ? "Active" : "Inactive"}</td>
            <td>
                <button onclick="toggleStaff('${staff.id}', ${staff.active})">
                    ${staff.active ? "Deactivate" : "Activate"}
                </button>
            </td>
        </tr>
    `).join("");
}

window.toggleStaff = async (id, active) => {
    await supabase
        .from("staff")
        .update({
            active: !active
        })
        .eq("id", id);

    location.reload();
};

/* ===================================
   FILTERS
=================================== */
const filterBtn = document.getElementById("applyFilter");

if (filterBtn) {
    filterBtn.addEventListener("click", () => {
        loadApplications({
            name: document.getElementById("searchName").value.trim(),
            ward: document.getElementById("filterWard").value.trim(),
            lga: document.getElementById("filterLGA").value.trim()
        });
    });
}


function addAdminPanelButton() {
    const quickActionsContainer = document.querySelector('.d-flex.flex-wrap.gap-2');
    
    if (quickActionsContainer) {
        const adminBtn = document.createElement('a');
        adminBtn.href = "admin.html";
        adminBtn.className = "btn btn-info flex-fill flex-sm-grow-0";
        adminBtn.innerHTML = `<i class="bi bi-gear-fill"></i> Admin Panel`;
        quickActionsContainer.appendChild(adminBtn);
    }
}

function showWelcomeMessage() {
    const welcomeCard = document.getElementById('welcomeCard');
    if (welcomeCard && window.currentStaff) {
        document.getElementById('staffName').textContent = window.currentStaff.full_name || "Admin";
        document.getElementById('staffRole').textContent = 
            window.currentStaff.role === "super_admin" ? "Super Administrator" : "Staff";
        
        welcomeCard.classList.remove('d-none');
    }
}

/* ===================================
   INIT
=================================== */
(async () => {
    const pathname = window.location.pathname.toLowerCase();
    const currentPage = pathname.split("/").pop() || "dashboard.html";

    // Protect all authenticated pages
    if (!pathname.includes("login.html") && !pathname.includes("register.html")) {
        await protectRoute();
    }

    // ADMIN PAGE - Super Admin Only
    if (currentPage === "admin.html") {
        requireSuperAdmin();
        if (document.getElementById("staffTable")) {
            loadStaff();
            loadInvites();
        }
        return;
    }

    // DASHBOARD - Accessible by ALL staff (including Super Admin)
    if (currentPage === "dashboard.html" || currentPage === "") {
        if (document.getElementById("wardAnalytics")) {
            loadDashboard();
        }
        if (document.getElementById("applicationsTable")) {
            loadApplications();
        }

        // Show Admin Panel button for Super Admin only
        if (window.currentStaff?.role === "super_admin") {
            addAdminPanelButton();
        }
        return;
    }

    if (currentPage === "dashboard.html" || currentPage === "") {
    if (document.getElementById("wardAnalytics")) loadDashboard();
    if (document.getElementById("applicationsTable")) loadApplications();

    if (window.currentStaff) {
        showWelcomeMessage();
        if (window.currentStaff.role === "super_admin") {
            addAdminPanelButton();
        }
    }
}

    // Other pages
    if (document.getElementById("staffTable")) {
        requireSuperAdmin();
        loadStaff();
        loadInvites();
    }
})();