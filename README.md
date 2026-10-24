# WarDaddy HiCapa Builds — IPSC Action Air Hit Factor Calculator

> Precision scoring system and Hit Factor calculator built for IPSC Action Air competitors and match directors.

---

## 🎯 Features
- **Official IPSC Action Air Scoring Engine**:
  - All divisions scored as Minor:
    - Alpha = 5 pts, Charlie = 3 pts, Delta = 1 pt
    - Miss = -10 pts, No Shoot = -10 pts, Procedural = -10 pts
  - Automatic zero-clamp rule (negative stage points are recorded as 0)
  - Hit Factor formatted to 4 decimal places: `Score Points ÷ Time`
- **Competition Shot Timer Buzzer**:
  - High-output 2850Hz piezo tone synthesizer with dynamic range compression.
  - Test buzzer button + Range Mode volume booster.
- **Match Log & Stage Ranking**:
  - Auto-identifies Stage Winner (100.00%) and computes relative stage percentages for all competitors.
- **Export & Print Ready**:
  - Formatted print view that fits A4/Letter perfectly for saving directly to PDF.
  - Instant CSV export for match archives.
- **Responsive Tactical UI**:
  - High-contrast carbon & red aesthetic based on WarDaddy HiCapa Builds race pistols.
  - Scales fluidly across mobile, tablet, and high-DPI desktop screens.

---

## 🚀 Deploy to Vercel

This repository is **100% Vercel-ready** with zero build configuration needed.

### Method 1: Deploy with Vercel CLI
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy directly from this directory
vercel
```

### Method 2: Deploy with GitHub / GitLab / Bitbucket
1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import the repository.
4. Framework Preset: **Other / None** (Static Site).
5. Click **Deploy**. Vercel will build and deploy instantly with global edge CDN caching!

---

## 💻 Local Development
Run with Python:
```bash
python -m http.server 8199
```
Or with Node / npx:
```bash
npx serve .
```
Open [http://localhost:8199](http://localhost:8199) in your browser.
