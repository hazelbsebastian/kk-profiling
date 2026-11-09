(function () {
  "use strict";
  const CFG = window.KK_CONFIG;
  const DEMO = !CFG.SCRIPT_URL;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- helpers ----------
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const titleCase = (s) => clean(s).toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  // Same person = same last name + first name + birthday (ignores case, spaces, dots).
  const personKey = (r) =>
    [r.lastName, r.firstName, r.birthday].map((v) => String(v || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")).join("|");

  function ageOn(birthday, today = new Date()) {
    const b = new Date(birthday + "T00:00:00");
    if (isNaN(b)) return NaN;
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
    return age;
  }

  function displayName(r) {
    const mi = clean(r.middleName) ? " " + clean(r.middleName)[0].toUpperCase() + "." : "";
    const sfx = clean(r.suffix) ? " " + clean(r.suffix) : "";
    return `${clean(r.lastName).toUpperCase()}, ${clean(r.firstName)}${mi}${sfx}`;
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 4500);
  }

  // ---------- data layer ----------
  // Demo mode keeps records in this browser only, so you can try the site before connecting Google Sheets.
  const demo = {
    load() { try { return JSON.parse(localStorage.getItem("kk_demo") || "[]"); } catch { return []; } },
    save(rows) { try { localStorage.setItem("kk_demo", JSON.stringify(rows)); } catch {} },
  };

  async function fetchList() {
    if (DEMO) return demo.load().map((r) => ({ name: displayName(r), purok: r.purok }));
    const res = await fetch(CFG.SCRIPT_URL + "?action=list&t=" + Date.now());
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Could not load the masterlist.");
    return data.rows;
  }

  async function submitRecord(rec) {
    if (DEMO) {
      const rows = demo.load();
      if (rows.some((r) => personKey(r) === personKey(rec))) return { ok: false, duplicate: true };
      rows.push(rec);
      demo.save(rows);
      return { ok: true };
    }
    // text/plain avoids a CORS preflight, which Apps Script does not support.
    const res = await fetch(CFG.SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(rec),
    });
    return res.json();
  }

  // ---------- views ----------
  function go(view) {
    $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + view));
    window.scrollTo(0, 0);
    if (view === "home") loadList();
    if (location.hash !== "#" + view) history.replaceState(null, "", view === "home" ? location.pathname : "#" + view);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) { e.preventDefault(); go(b.dataset.go); }
  });

  // ---------- masterlist ----------
  let allRows = [];
  async function loadList() {
    const body = $("#list-body");
    try {
      allRows = await fetchList();
      allRows.sort((a, b) => a.name.localeCompare(b.name));
      renderList();
    } catch (err) {
      body.innerHTML = `<tr><td colspan="3" class="muted">Could not load the masterlist. Please refresh the page.</td></tr>`;
      console.error(err);
    }
  }
  function renderList() {
    const q = $("#list-search").value.trim().toLowerCase();
    const p = $("#list-purok").value;
    const rows = allRows.filter((r) => (!p || String(r.purok) === p) && (!q || r.name.toLowerCase().includes(q)));
    $("#list-count").textContent = `${rows.length} of ${allRows.length} registered`;
    const body = $("#list-body");
    body.textContent = "";
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="3" class="muted">${allRows.length ? "No match found." : "No one has registered yet."}</td></tr>`;
      return;
    }
    const frag = document.createDocumentFragment();
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      [i + 1, r.name, r.purok].forEach((v) => {
        const td = document.createElement("td");
        td.textContent = v; // textContent keeps user-entered names from running as HTML
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    body.appendChild(frag);
  }
  $("#list-search").addEventListener("input", renderList);
  $("#list-purok").addEventListener("change", renderList);

  // ---------- form ----------
  const form = $("#reg-form");
  CFG.PUROKS.forEach((p) => {
    $("#purok-select").add(new Option("Purok " + p, p));
    $("#list-purok").add(new Option("Purok " + p, p));
  });

  const bday = form.birthday;
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  bday.max = iso(new Date(today.getFullYear() - CFG.MIN_AGE, today.getMonth(), today.getDate()));
  bday.min = iso(new Date(today.getFullYear() - CFG.MAX_AGE - 1, today.getMonth(), today.getDate() + 1));
  bday.addEventListener("change", () => {
    const a = ageOn(bday.value);
    $("#age-hint").textContent = isNaN(a) ? "KK members must be 15 to 30 years old." : `Age: ${a} years old`;
  });
  form.contact.addEventListener("input", () => (form.contact.value = form.contact.value.replace(/\D/g, "")));

  function setErr(field, msg) {
    const box = (field instanceof RadioNodeList ? field[0] : field).closest(".q");
    box.classList.toggle("invalid", !!msg);
    $(".err", box).textContent = msg || "";
    return !msg;
  }

  function validate() {
    let ok = true;
    const need = (name, label) => { ok = setErr(form[name], clean(form[name].value) ? "" : `${label} is required.`) && ok; };
    need("lastName", "Last name");
    need("firstName", "First name");
    setErr(form.middleName, "");
    setErr(form.suffix, "");
    ["lastName", "firstName", "middleName"].forEach((n) => {
      if (clean(form[n].value) && !/^[\p{L}\s.'\-ñÑ]+$/u.test(clean(form[n].value))) ok = setErr(form[n], "Use letters only.") && false;
    });

    const a = ageOn(bday.value);
    if (!bday.value) ok = setErr(bday, "Birthday is required.") && false;
    else if (isNaN(a) || a < CFG.MIN_AGE || a > CFG.MAX_AGE) ok = setErr(bday, `KK members must be ${CFG.MIN_AGE} to ${CFG.MAX_AGE} years old (you are ${a}).`) && false;
    else setErr(bday, "");

    const c = form.contact.value;
    ok = setErr(form.contact, !c || /^09\d{9}$/.test(c) ? "" : "Enter an 11-digit number starting with 09.") && ok;

    [["sex", "Sex"], ["civilStatus", "Civil status"], ["youthClass", "Youth classification"], ["voter", "This"]].forEach(([n, l]) => {
      ok = setErr(form[n], form[n].value ? "" : `${l} is required.`) && ok;
    });
    ok = setErr(form.purok, form.purok.value ? "" : "Purok is required.") && ok;
    ok = setErr(form.consent, form.consent.checked ? "" : "Please agree to continue.") && ok;
    return ok;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#form-msg");
    msg.hidden = true;
    if (!validate()) {
      const first = $(".q.invalid");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const rec = {
      lastName: titleCase(form.lastName.value),
      firstName: titleCase(form.firstName.value),
      middleName: titleCase(form.middleName.value),
      suffix: form.suffix.value,
      birthday: bday.value,
      age: ageOn(bday.value),
      sex: form.sex.value,
      contact: form.contact.value,
      civilStatus: form.civilStatus.value,
      youthClass: form.youthClass.value,
      voter: form.voter.value,
      purok: form.purok.value,
    };

    const btn = $("#submit-btn");
    btn.disabled = true;
    btn.textContent = "Submitting…";
    try {
      const res = await submitRecord(rec);
      if (res.ok) {
        const name = `${rec.firstName} ${rec.lastName}`;
        $("#success-text").textContent = `${name}, you have been registered in Barangay Bantug's KK Profiling.`;
        toast("You have been registered!");
        form.reset();
        $("#age-hint").textContent = "KK members must be 15 to 30 years old.";
        go("success");
      } else if (res.duplicate) {
        msg.textContent = `${rec.firstName} ${rec.lastName} (born ${rec.birthday}) is already registered. You can find your name in the masterlist.`;
        msg.hidden = false;
        toast("This person is already registered.");
      } else {
        throw new Error(res.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      msg.textContent = "Something went wrong while submitting. Please check your internet connection and try again.";
      msg.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit";
    }
  });

  // ---------- start ----------
  if (DEMO) console.info("KK Profiling: DEMO MODE (no SCRIPT_URL in config.js). Data is saved in this browser only.");
  const start = location.hash.slice(1);
  go(["form", "home"].includes(start) ? start : "home");
})();
