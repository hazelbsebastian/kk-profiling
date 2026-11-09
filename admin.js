(function () {
  "use strict";
  const CFG = window.KK_CONFIG;
  const $ = (s) => document.querySelector(s);
  const PW_KEY = "kk_admin_pw";
  let rows = [];
  let sortKey = "lastName";
  let sortDir = 1;

  const getPw = () => { try { return sessionStorage.getItem(PW_KEY) || ""; } catch { return ""; } };
  const setPw = (v) => { try { v ? sessionStorage.setItem(PW_KEY, v) : sessionStorage.removeItem(PW_KEY); } catch {} };

  async function fetchAdmin(password) {
    const res = await fetch(CFG.SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "admin", password }),
    });
    return res.json();
  }

  function showDashboard(data) {
    rows = data;
    $("#login-view").hidden = true;
    $("#admin-view").hidden = false;
    render();
  }

  // ---------- login ----------
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#pw").value;
    const btn = $("#login-btn");
    $("#login-err").textContent = "";
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      const res = await fetchAdmin(pw);
      if (!res.ok) throw new Error(res.error || "Sign in failed.");
      setPw(pw);
      $("#pw").value = "";
      showDashboard(res.rows);
    } catch (err) {
      $("#login-err").textContent = err.message === "Failed to fetch" ? "No internet connection." : err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });

  $("#logout-btn").addEventListener("click", () => {
    setPw("");
    rows = [];
    $("#a-body").textContent = "";
    $("#admin-view").hidden = true;
    $("#login-view").hidden = false;
  });

  $("#refresh-btn").addEventListener("click", async () => {
    const btn = $("#refresh-btn");
    btn.disabled = true;
    btn.textContent = "Refreshing…";
    try {
      const res = await fetchAdmin(getPw());
      if (!res.ok) throw new Error(res.error);
      rows = res.rows;
      render();
    } catch (err) {
      alert("Could not refresh: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Refresh";
    }
  });

  // ---------- table ----------
  const fullName = (r) =>
    `${r.lastName.toUpperCase()}, ${r.firstName}${r.middleName ? " " + r.middleName : ""}${r.suffix ? " " + r.suffix : ""}`;

  function filtered() {
    const q = $("#f-search").value.trim().toLowerCase();
    const f = { purok: $("#f-purok").value, sex: $("#f-sex").value, youthClass: $("#f-class").value, voter: $("#f-voter").value };
    return rows
      .filter((r) => Object.entries(f).every(([k, v]) => !v || r[k] === v))
      .filter((r) => !q || fullName(r).toLowerCase().includes(q) || r.contact.includes(q))
      .sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        const n = sortKey === "age" || sortKey === "purok" ? (Number(x) || 0) - (Number(y) || 0) : String(x).localeCompare(String(y));
        return (n || fullName(a).localeCompare(fullName(b))) * sortDir;
      });
  }

  function render() {
    const list = filtered();
    renderStats(list);
    $("#f-count").textContent = `Showing ${list.length} of ${rows.length} records`;
    const body = $("#a-body");
    body.textContent = "";
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="11" class="muted">No records found.</td></tr>`;
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((r, i) => {
      const tr = document.createElement("tr");
      [i + 1, fullName(r), r.birthday, r.age, r.sex, r.contact, r.civilStatus, r.youthClass, r.voter, r.purok, r.timestamp]
        .forEach((v) => {
          const td = document.createElement("td");
          td.textContent = v;
          tr.appendChild(td);
        });
      frag.appendChild(tr);
    });
    body.appendChild(frag);
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.sort === sortKey);
      th.dataset.dir = th.dataset.sort === sortKey ? (sortDir > 0 ? "▲" : "▼") : "";
    });
  }

  function renderStats(list) {
    const count = (k, v) => list.filter((r) => r[k] === v).length;
    const tiles = [
      ["Total", list.length],
      ["Male", count("sex", "M")],
      ["Female", count("sex", "F")],
      ["Registered voters", count("voter", "Yes")],
      ["In-school", count("youthClass", "In-school Youth")],
      ["Out of school", count("youthClass", "Out of School Youth")],
      ["Working", count("youthClass", "Working Youth")],
      ["Unemployed", count("youthClass", "Unemployed")],
    ];
    const box = $("#stats");
    box.textContent = "";
    tiles.forEach(([label, n]) => {
      const d = document.createElement("div");
      d.className = "stat card";
      d.innerHTML = `<span class="stat-n"></span><span class="stat-l"></span>`;
      d.firstChild.textContent = n;
      d.lastChild.textContent = label;
      box.appendChild(d);
    });
  }

  document.querySelectorAll("th[data-sort]").forEach((th) =>
    th.addEventListener("click", () => {
      if (sortKey === th.dataset.sort) sortDir *= -1;
      else { sortKey = th.dataset.sort; sortDir = 1; }
      render();
    })
  );
  ["#f-search", "#f-purok", "#f-sex", "#f-class", "#f-voter"].forEach((s) =>
    $(s).addEventListener(s === "#f-search" ? "input" : "change", render)
  );
  CFG.PUROKS.forEach((p) => $("#f-purok").add(new Option("Purok " + p, p)));

  // ---------- export ----------
  $("#export-btn").addEventListener("click", () => {
    const head = ["Last Name", "First Name", "Middle Name", "Suffix", "Birthday", "Age", "Sex", "Contact Number",
      "Civil Status", "Youth Classification", "Registered Voter", "Purok", "Registered On"];
    const keys = ["lastName", "firstName", "middleName", "suffix", "birthday", "age", "sex", "contact",
      "civilStatus", "youthClass", "voter", "purok", "timestamp"];
    const esc = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [head.join(",")].concat(
      filtered().map((r) => keys.map((k) => (k === "contact" && r[k] ? `="${r[k]}"` : esc(r[k]))).join(","))
    );
    // BOM so Excel reads ñ and other characters correctly
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `KK-Profiling-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- auto sign-in for this browser tab ----------
  const saved = getPw();
  if (saved) {
    fetchAdmin(saved).then((res) => (res.ok ? showDashboard(res.rows) : setPw(""))).catch(() => {});
  }
})();
