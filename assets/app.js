const form = document.getElementById('applicationForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitting...";

    try {
        const full_name = document.getElementById('full_name').value.trim();
        const age = parseInt(document.getElementById('age').value);
        const gender = document.getElementById('gender').value;
        const village = document.getElementById('village').value.trim();
        const community = document.getElementById('community').value.trim();
        const ward = document.getElementById('ward').value.trim();
        const lga = document.getElementById('lga').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const nin = document.getElementById('nin').value.trim();
        const account_name = document.getElementById('account_name').value.trim();
        const account_number = document.getElementById('account_number').value.trim();
        const bank_name = document.getElementById('bank_name').value.trim();
        const skill_type = document.getElementById('skill_type').value.trim();
        const empowerment_choice = document.getElementById('empowerment_choice').value;

        const skillFile = document.getElementById('skill_evidence').files[0];
        const passportFile = document.getElementById('passport').files[0];

        if (!skillFile || !passportFile) {
            throw new Error("Please upload all required files.");
        }

        if (nin.length !== 11) {
            throw new Error("NIN must be exactly 11 digits.");
        }

        if (age < 18 || age > 60) {
            throw new Error("Applicant must be between 18 and 60 years.");
        }

        // Check duplicate NIN
        const { data: existing } = await supabase
            .from('applications')
            .select('id')
            .eq('nin', nin)
            .maybeSingle();

        if (existing) {
            throw new Error("This NIN has already been used for an application.");
        }

        // Upload skill evidence
        const skillPath = `skill-${Date.now()}-${skillFile.name}`;
        const { error: skillError } = await supabase.storage
            .from('skill-evidence')
            .upload(skillPath, skillFile);

        if (skillError) throw skillError;

        // Upload passport
        const passportPath = `passport-${Date.now()}-${passportFile.name}`;
        const { error: passportError } = await supabase.storage
            .from('passport')
            .upload(passportPath, passportFile);

        if (passportError) throw passportError;

        // Get file URLs
        const skillUrl = supabase.storage
            .from('skill-evidence')
            .getPublicUrl(skillPath).data.publicUrl;

        const passportUrl = supabase.storage
            .from('passport')
            .getPublicUrl(passportPath).data.publicUrl;

        // Save application
        const { error: insertError } = await supabase
            .from('applications')
            .insert([{
                full_name,
                age,
                gender,
                village,
                community,
                ward,
                lga,
                phone,
                nin,
                account_name,
                account_number,
                bank_name,
                skill_type,
                empowerment_choice,
                skill_evidence_url: skillUrl,
                passport_url: passportUrl
            }]);

        if (insertError) throw insertError;

        form.reset();

        window.location.href = "success.html";

    } catch (error) {
        alert(error.message || "An error occurred. Please try again.");
    }

    submitBtn.disabled = false;
    submitBtn.innerText = "Submit Application";
});