# BizInsight AI

BizInsight AI is a senior-project business intelligence dashboard. Users upload CSV/XLSX datasets, then the system generates KPI summaries, charts, insights, and simple AI-style business Q&A.

## Features

- CSV/XLSX dataset upload
- Dataset history
- Automatic summary analysis
- Revenue, quantity, product, region, and salesperson KPI detection
- Recharts visual dashboard
- AI chat page for common business questions
- MongoDB metadata storage with automatic local JSON fallback for easier demos

## Run the project locally

### 1) Start optional databases

The app can run without MongoDB because it falls back to `uploads/datasets.json`. For the full setup, start MongoDB and PostgreSQL:

```bash
docker compose up -d
```

### 2) Start the backend

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend URL: `http://127.0.0.1:8000`

Check it:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/db-check
```

### 3) Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Demo flow for presentation

1. Open the dashboard.
2. Upload a CSV or XLSX sales dataset.
3. Open the generated analysis page.
4. Show KPI cards, charts, and insights.
5. Open AI Chat and ask:
   - `What is the total revenue?`
   - `Show me the top region by revenue.`
   - `Who is the best salesperson?`
   - `Which product is selling the most?`

## Notes

- Keep `node_modules`, `.git`, and `.env` out of the final submitted ZIP.
- Use `.env.example` as the template for local environment variables.
- If MongoDB is unavailable, uploaded dataset metadata is saved locally in `uploads/datasets.json`.

## Included demo dataset

Use `sample_data/sales_demo.csv` during the presentation if you need a clean dataset for testing.
