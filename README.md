# DCF Valuation App

CFA-grade DCF intrinsic valuation platform — PANW pre-built model + generic DCF tool for any ticker.

**Stack:** Expo (web/iOS/Android) · Express · MongoDB · Financial Modeling Prep API

## Screens
- **Home** — dashboard with market overview
- **PANW Model** — pre-built Palo Alto Networks DCF (6 tabs: Overview, DCF Engine, WACC, Sensitivity, Scenarios, Bridge)
- **DCF Tool** — generic tool for any stock ticker
- **Sensitivity** — WACC × TGR and Margin × Growth heatmaps
- **Scenarios** — Bull / Base / Bear analysis

## Setup

### Backend
```bash
cd backend
cp .env.example .env   # fill in your keys
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npx expo start          # web: press W, iOS: press I, Android: press A
```

## Environment Variables

See `backend/.env.example` and `frontend/.env.example`.

## Deploy
- **Backend:** Render (Node/Express) — connect repo, set env vars, deploy `backend/`
- **Frontend Web:** Render Static Site or Expo EAS
- **Mobile:** Expo EAS Build
