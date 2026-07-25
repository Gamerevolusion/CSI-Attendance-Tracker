# CSI Attendance Tracker

A full-stack web application for tracking committee attendance across 7 sub-teams. Replaces manual Excel-based tracking with a persistent roster, fast attendance marking, and PDF export with selectable date ranges.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Authentication**: Firebase Auth (Google Sign-In only)
- **Database**: Cloud Firestore
- **Server**: Firebase Admin SDK in Next.js Route Handlers
- **PDF Export**: @react-pdf/renderer (server-side)
- **Deployment**: Vercel

## Features

- 🔐 Google Sign-In with email allowlist (no unauthorized access)
- 👥 Team roster management (add/edit/deactivate members)
- ✅ Fast attendance marking with configurable lecture count (default: 6)
- 📊 Dashboard with monthly attendance overview
- 📋 Attendance history with date range & member filters
- 📄 PDF report generation (single or multi-team)
- 👤 Admin user management (add/remove authorized users)
- 📱 Mobile-responsive (mark attendance from your phone)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Firebase project
- A Google Cloud service account key

### 1. Clone the Repository

```bash
git clone https://github.com/Gamerevolusion/CSI-Attendance-Tracker.git
cd CSI-Attendance-Tracker
npm install
```

### 2. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. **Enable Authentication**:
   - Go to Authentication > Sign-in method
   - Enable **Google** as a sign-in provider
4. **Create Firestore Database**:
   - Go to Firestore Database > Create database
   - Choose **production mode**
   - Select a region close to your users
5. **Deploy Security Rules**:
   - Copy the contents of `firestore.rules` to Firestore > Rules
   - Publish the rules
6. **Deploy Indexes**:
   - Use the Firebase CLI: `firebase deploy --only firestore:indexes`
   - Or manually create the composite indexes from `firestore.indexes.json`
7. **Generate Service Account Key**:
   - Go to Project Settings > Service accounts
   - Click "Generate new private key"
   - Save the JSON file securely (never commit it!)

### 3. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Fill in all values from your Firebase project:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console > Project Settings > General > Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Same as above |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same as above |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Same as above |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Same as above |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Same as above |
| `FIREBASE_ADMIN_PROJECT_ID` | Service account JSON > `project_id` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account JSON > `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account JSON > `private_key` (keep the quotes!) |

### 4. Seed the Database

Run the seed script to create the 7 teams and your first admin user:

```bash
npx tsx scripts/seed.ts your-email@gmail.com "Your Name"
```

This creates:
- 7 teams: Core, PR and Documentation, Social Media, Design and Decor, Logistics, Technical, Event Management
- Your admin account in the `authorizedUsers` collection

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the Google account you used in the seed script.

## Deployment (Vercel)

1. Push the repo to GitHub
2. Go to [Vercel](https://vercel.com) and import the repository
3. Add all environment variables from `.env.local` to the Vercel project settings
4. Deploy — Next.js App Router works natively on Vercel, no extra config needed

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── layout.tsx                  # Root layout with AuthProvider
│   ├── login/page.tsx              # Google sign-in
│   ├── roster/page.tsx             # Member management (admin)
│   ├── attendance/
│   │   ├── mark/page.tsx           # Core: mark attendance
│   │   └── history/page.tsx        # View past records
│   ├── reports/page.tsx            # Generate & download reports
│   ├── admin/users/page.tsx        # Manage authorized users (admin)
│   └── api/
│       ├── reports/pdf/route.ts    # PDF generation endpoint
│       └── admin/users/route.ts    # User management API
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── layout/AppShell.tsx         # Sidebar + responsive nav
│   ├── attendance/AttendanceGrid.tsx
│   ├── roster/MemberForm.tsx
│   ├── ProtectedRoute.tsx
│   └── AdminRoute.tsx
├── contexts/AuthContext.tsx         # Firebase Auth + allowlist
├── lib/
│   ├── firebase.ts                 # Client SDK
│   ├── firebase-admin.ts           # Admin SDK (server only)
│   ├── date-utils.ts               # IST timezone utilities
│   └── actions/
│       ├── roster.ts               # Team/member Firestore ops
│       └── attendance.ts           # Attendance Firestore ops
└── types/index.ts                  # TypeScript interfaces
```

## Data Model

- **teams/{teamId}**: Team name, display order, whether it has a Role field
- **teams/{teamId}/members/{memberId}**: Name, role, year, department, active status
- **attendance/{teamId_memberId_date}**: Lectures missed (boolean array), deterministic doc ID for upsert
- **authorizedUsers/{email}**: Name, isAdmin flag, email as doc ID

## License

Private — for CSI committee use only.
