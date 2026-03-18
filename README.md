# 🚀 Momentum Fade Trading Demo

A modern full-stack demo showcasing a **Momentum Fade Detection System** with real-time-style visualization, API tracing, and chart-based insights.

---

## 📌 Overview

This project demonstrates how a trading signal system works — from **data processing → API response → visualization**.

It includes:

* 📦 API response viewer (JSON)
* 📊 Chart visualization (Recharts)
* 🔁 Mock vs Live backend toggle
* ⚡ Fast demo mode (no API dependency)
* 🧪 Debug + Scanner + Signal APIs

---

## 🧠 Core Features

### 🔹 1. API Demo Panel

Test individual APIs independently:

* `/api/debug` → system health
* `/api/run-scanner` → market scan
* `/api/get-signals` → generated signals

Each API returns structured JSON and is displayed in the UI.

---

### 🔹 2. Mock + Backend Toggle

Switch between:

* 🧪 **Mock Mode**

  * Stable demo data
  * No API dependency
  * Instant response

* 🌐 **Backend Mode**

  * Real API execution
  * Live data processing
  * Scanner + signal pipeline

---

### 🔹 3. JSON Viewer

* Displays raw API responses
* Pretty formatted
* Helps debugging and validation

---

### 🔹 4. Chart Visualization

Charts are generated from processed JSON data:

* 📊 Scanner → Price chart
* 📈 Signals → Score chart

This demonstrates how backend data is transformed into visual insights.

---

### 🔹 5. Clean Demo Architecture

```
API / Mock Data
        ↓
   JSON Response
        ↓
 Data Processing Layer
        ↓
   UI + Charts
```

---

## 🛠 Tech Stack

* ⚛️ Next.js (React)
* 📊 Recharts (Charts)
* 🟦 TypeScript
* 🎨 Custom UI (Inline Styling)
* 🗄 Supabase (Backend - optional)

---

## 📂 Project Structure

```
src/
 ├── pages/
 │    ├── index.tsx       # Demo Panel
 │    ├── web.tsx         # Landing UI
 │    └── api/            # Backend APIs
 │
 ├── lib/
 │    ├── market/         # Scanner + signal logic
 │    ├── db/             # Database layer
 │    └── auth/           # Auth utilities
```

---

## ⚙️ Setup & Run

### 1️⃣ Install dependencies

```
npm install
```

---

### 2️⃣ Run development server

```
npm run dev
```

---

### 3️⃣ Open in browser

```
http://localhost:3000
```

---

## 🔐 Environment Variables (Optional)

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
FINNHUB_API_KEY=
```

---

## 🎯 Demo Usage

1. Select mode (Mock / Backend)
2. Click:

   * Run Debug
   * Run Scanner
   * Get Signals
3. View:

   * JSON response
   * Charts

---

## 💼 Use Case

This project is designed for:

* Client demos
* Trading dashboard prototypes
* API visualization systems
* Full-stack architecture showcase

---

## 🚀 Future Improvements

* 📈 Live streaming charts
* 🔔 Signal alerts
* 🤖 AI-based insights
* 📊 Advanced indicators

---

## ⚠️ Disclaimer

This project is for **demonstration purposes only** and does not provide financial advice.

---

## 👨‍💻 Author

Developed by **Sandip Dabhi**

---

## ⭐ Support

If you found this useful:

👉 Star the repo
👉 Share with others

---

# 🔥 Built for Real-Time Trading Insight Visualization
