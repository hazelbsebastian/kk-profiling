# Barangay Bantug's KK Profiling

A Google-Form-style registration website for the Katipunan ng Kabataan (KK) of Barangay Bantug.

- **Website** → hosted free on **GitHub Pages**
- **Database** → a free **Google Sheet** (the SK officers open it like Excel and can download it as .xlsx)
- Youth do **not** need accounts. They open the link, fill out the form, and submit.
- The same person (same last name + first name + birthday) cannot register twice.
- The public masterlist shows **only name and purok**. Birthday, contact number, etc. stay private in the Google Sheet.

## Files

| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | The public website |
| `admin.html`, `admin.js` | Password-protected admin page with full details |
| `config.js` | Settings: Google Script link, list of puroks, age limits |
| `apps-script/Code.gs` | Backend code you paste into Google Sheets |
| `existing-data.csv` | The 84 people from `SK-PROFILING.xlsx`, ready to import |

---

## Step 1 — Make the Google Sheet (database)

1. Go to <https://sheets.google.com> using the SK's Google account and create a blank spreadsheet. Name it `KK Profiling Database`.
2. Click **Extensions → Apps Script**.
3. Delete the sample code, paste everything from `apps-script/Code.gs`, and click **Save**.
4. Click **Deploy → New deployment**.
   - Click the gear icon → choose **Web app**
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**, then **Authorize access** and allow it (if it says "Google hasn't verified this app", click **Advanced → Go to project**).
5. Copy the **Web app URL** (it ends in `/exec`).

## Step 2 — Import your existing 84 records (optional)

1. Open the website once after Step 3 (or submit one test entry) so the `KK Profiles` tab is created — or create a tab named exactly `KK Profiles` yourself.
2. In the sheet, go to the `KK Profiles` tab → **File → Import → Upload** → choose `existing-data.csv`.
3. Choose **Replace current sheet**, and **uncheck "Convert text to numbers, dates, and formulas"** (keeps the 0 at the start of phone numbers).
4. Note: **Anjilyn Venancio Amuto** has a typo in the birthday in the Excel (`12/`0/2006`). Fix it in the sheet as `2006-12-XX`.

## Step 3 — Connect the website

Open `config.js` and paste the URL:

```js
SCRIPT_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
```

Also update `PUROKS` if Barangay Bantug has a different list of puroks.

## Step 3b — Set up the admin page

The admin page (`admin.html`) shows **all** details, with search, filters, totals and a download button.

1. In Apps Script, paste the **updated** `apps-script/Code.gs` and click **Save**.
2. Click **Project Settings** (gear icon, left side) → scroll to **Script Properties** → **Add script property**:
   - Property: `ADMIN_PASSWORD`
   - Value: a strong password (only share it with SK officers)
   - **Save script properties**
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** (The link stays the same.)
4. Open `https://YOUR-USERNAME.github.io/kk-profiling/admin.html` and sign in.

The password is checked by Google, not stored in the website, so it can't be found by viewing the site's code.
After 8 wrong tries, sign-in is locked for 10 minutes. To change the password, just edit the Script Property.

## Step 4 — Put it on GitHub Pages

1. Create a free account at <https://github.com> (only the SK admin needs one).
2. Click **New repository** → name it e.g. `kk-profiling` → **Public** → **Create**.
3. Click **uploading an existing file** and drag in: `index.html`, `admin.html`, `style.css`, `app.js`, `admin.js`, `config.js`.
   **Do not upload** `SK-PROFILING.xlsx` or `existing-data.csv` — they contain private information and a public repo can be seen by anyone.
4. Go to **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → **Save**.
5. After a minute your site is live at `https://YOUR-USERNAME.github.io/kk-profiling/`. Share this link (or make a QR code of it).

---

## Testing before connecting

If `SCRIPT_URL` is empty, the site runs in **demo mode**: submissions are saved only in your own browser. Just double-click `index.html` to try it.

## Changing the backend code later

After editing the Apps Script, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** so the URL stays the same.

## Limits

- GitHub Pages: handles thousands of visitors easily.
- Google Apps Script (free account): ~20,000 requests/day and up to 30 people submitting at the same moment. 300+ youth is well within this.
