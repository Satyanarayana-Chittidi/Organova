# Organova

> **National Digital Healthcare Platform for Real-Time Organ Viability Tracking, 20-Minute Algorithmic Matching, and Emergency Blood Logistics.**

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/Database-MySQL%208.0-orange?style=flat-square&logo=mysql)](https://www.mysql.com/)
[![Socket.IO](https://img.shields.io/badge/Realtime-Socket.IO-010101?style=flat-square&logo=socket.io)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%204-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

## 📌 Executive Summary

Every year, thousands of life-saving organs are lost due to cold ischemia expiration and fragmented inter-hospital communication. In parallel, critical trauma centers struggle with real-time blood stock visibility during emergencies.

**Organova** is a high-availability digital health infrastructure engineered to bridge the critical gap between organ retrieval and surgical implantation. It combines:
1. **Dynamic Cold Ischemia Countdown Timers** based on organ-specific viability degradation curves.
2. **Deterministic 20-Minute Algorithmic Match Engine** balancing clinical urgency, waitlist tenure, transit proximity, and HLA/ABO immunocompatibility.
3. **Emergency Blood Supply Matrix & SOS Broadcasts** enabling instant inter-hospital requisition, stock transfers, and citizen walk-in donor mobilization.
4. **Master Control Governance Gateway** ensuring hospital accreditation, clinical auditability, and tamper-resistant medical ledgers.

---

## 🏗️ System Architecture

Organova is structured as a distributed, decoupled full-stack platform:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Organova Client (Next.js 16)                    │
│   Citizen Portal   │   Hospital Clinical Suite   │   Master Control    │
│  (Donor Pledges,   │  (Harvest viabilities,      │  (Facility audit,   │
│   Blood Requests)  │   Leaderboard matching)     │   Node telemetry)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST & WebSockets (WSS)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Organova Core API (Express / Node.js)                 │
│  ┌───────────────────────┬──────────────────────┬───────────────────┐  │
│  │ Match Engine Worker   │ Cold Ischemia Watch  │ Socket.IO Server  │  │
│  │ (Multi-factor scoring)│ (Auto-decay sweeper) │ (Real-time SOS)   │  │
│  └───────────────────────┴──────────────────────┴───────────────────┘  │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
                    ▼                               ▼
       ┌────────────────────────┐      ┌─────────────────────────┐
       │   MySQL 8.0 Database   │      │   Redis In-Memory Cache │
       │  (Clinical records &   │      │  (Transient session &   │
       │   audited transactions)│      │   geo-proximity caches) │
       └────────────────────────┘      └─────────────────────────┘
```

---

## 🚀 Key Modules & Capabilities

### 1. National Organ Harvest & Cold Ischemia Ledger
- Real-time viability tracking with dynamic progress bars and countdown timers per harvested asset.
- Strict clinical enforcement of cold ischemia preservation limits:
  - **Heart & Lungs:** 4 – 6 Hours
  - **Liver:** 12 Hours
  - **Kidneys:** 24 – 36 Hours
  - **Cornea (Tissue):** Up to 14 Days
  - **Bone Marrow:** 72 Hours

### 2. Algorithmic Matching Engine (Multi-Tier Scoring)
When an organ is harvested, the engine prioritizes waiting recipients using a weighted composite formula:
$$\text{Score} = (W_{\text{urgency}} \times 0.35) + (W_{\text{tenure}} \times 0.25) + (W_{\text{distance}} \times 0.20) + (W_{\text{hla\_abo}} \times 0.20)$$
- **20-Minute Match Offers:** Hospitals receive a strict 20-minute review window to accept an allocation. If unaccepted, an automated background sweeper declines the offer and elevates the next candidate in the queue.
- **ABO/HLA Immunocompatibility:** Strict validation preventing incompatible cross-matches.

### 3. Emergency Blood Supply Matrix & Citizen SOS Broadcasts
- Live stock availability across authorized hospitals broken down by ABO/Rh groups and components (`Whole Blood`, `Packed RBC`, `Platelets`, `Plasma`).
- Real-time emergency blood requests triggering instant WebSocket notifications to nearby accredited medical hubs.
- Walk-in donor passes featuring QR verification and clinical eligibility pre-checks.

### 4. Citizen Registry & Digital Donor Card
- Advance legal directives for organ donation with deceased vs living donation consent selections.
- Instant generation of verified digital organ donor identity credentials.
- Real-time waitlist status and transplant passport tracking.

### 5. Master Control Governance Gateway
- Centralized administrative console for hospital facility verification and license accreditation.
- Comprehensive system audit logs tracking logins, entity updates, allocations, and emergency dispatches.
- Donation camp coordination engine with geolocation mapping.

---

## 🛠️ Technology Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | [Next.js 16 (App Router)](https://nextjs.org/) | Server-side rendering, React 19, partial prerendering, and optimized client bundles. |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) | Atomic responsive design with dark mode and zero-overflow layout guards. |
| **Icons & UI** | [Lucide React](https://lucide.dev/) | Consistent iconography across clinical and citizen interfaces. |
| **Backend API** | [Node.js](https://nodejs.org/) & [Express 4](https://expressjs.com/) | Modular TypeScript REST services and asynchronous task orchestration. |
| **Real-time Engine** | [Socket.IO](https://socket.io/) | Full-duplex WebSocket channels for instant clinical alerts and stock updates. |
| **Database** | [MySQL 8.0](https://www.mysql.com/) | Relational store with foreign-key constraints, enum enforcements, and audit trails. |
| **Cache & Queue** | [Redis (ioredis)](https://redis.io/) | Memory cache for fast lookups with automated offline database fallback. |
| **Authentication** | JWT (`jsonwebtoken`) & `bcryptjs` | HTTP-only session cookies and role-based access control (`USER`, `HOSPITAL`, `ADMIN`). |

---

## 📁 Repository Structure

```
Organova/
├── client/                      # Next.js 16 Web Application
│   ├── public/                  # Static assets & organ anatomy visuals
│   │   ├── images/              # Organ badges, logos & illustrations
│   │   └── favicon.ico          # Application favicon
│   ├── src/
│   │   ├── app/                 # Next.js App Router (Citizen, Hospital, Admin)
│   │   │   ├── blood-finder/    # Public blood inventory search
│   │   │   ├── camps/           # Blood donation drives & camps
│   │   │   ├── citizen/         # Profile & donation history
│   │   │   ├── donor/           # Organ pledge form & digital donor card
│   │   │   ├── hospital/        # Harvest, matching engine, inventory, waitlist
│   │   │   ├── master-control/  # System administration, audit logs, facilities
│   │   │   └── transplant/      # Transplant passport & recipient records
│   │   ├── components/          # Reusable UI components, navbars, and dialogs
│   │   ├── context/             # ThemeContext, AuthContext, SocketContext
│   │   └── lib/                 # REST API client & centralized endpoints
│   ├── package.json
│   └── tsconfig.json
│
├── server/                      # Node.js + Express TypeScript API
│   ├── database/
│   │   └── init.sql             # Complete database schema, tables & indexes
│   ├── scripts/
│   │   ├── seed-admin.ts        # Root administrator account initializer
│   │   ├── seedOrganMocks.ts    # Seed script for realistic clinical demo assets
│   │   └── test-*.ts            # Automated test suites for all major flows
│   ├── src/
│   │   ├── config/              # Database pool, Redis client & Socket setup
│   │   ├── controllers/         # REST API route handlers
│   │   ├── middlewares/         # JWT verification, roles & upload parsers
│   │   ├── models/              # Relational SQL query helpers & queries
│   │   ├── routes/              # Centralized route definitions
│   │   ├── services/            # Matching engine, ischemia tracker & business logic
│   │   ├── sockets/             # Real-time event dispatchers & room listeners
│   │   ├── types/               # TypeScript data interfaces & DTOs
│   │   └── utils/               # Encryption, distance calculators & token helpers
│   ├── package.json
│   └── tsconfig.json
│
├── start-mysql.bat              # Windows helper to launch MySQL service
├── .gitignore                   # Multi-tier git exclusion rules
└── README.md                    # Platform documentation
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **MySQL**: `8.0+`
- **Redis** *(Optional)*: Server gracefully falls back to database queries if Redis is offline.

---

### Step 1: Database Setup

1. Start your local MySQL service.
2. Execute the initialization script located at `server/database/init.sql`:
   ```bash
   mysql -u root -p < server/database/init.sql
   ```
   *This creates the database `organ_donation_db` with all required tables, foreign keys, triggers, and organ type reference tables.*

---

### Step 2: Configure Environment Variables

#### Backend (`server/.env`):
Copy `server/.env.example` to `server/.env` and update credentials:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=organ_donation_db

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_EXPIRE_TIME=3600

JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:3000
```

#### Frontend (`client/.env.local`):
Copy `client/.env.example` to `client/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

### Step 3: Install & Start Backend

```bash
cd server
npm install
npm run build
npm start
```
*For development mode with hot reload:*
```bash
npm run dev
```

#### Seed Admin & Test Datasets:
```bash
# Seed the Master Control Administrator
npx ts-node scripts/seed-admin.ts

# Seed realistic mock organs, matches, and clinical requests
npx ts-node scripts/seedOrganMocks.ts
```

---

### Step 4: Install & Start Frontend

In a separate terminal:
```bash
cd client
npm install
npm run build
npm start
```
*For development mode:*
```bash
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 🔑 Default Credentials (Seed Data)

| Role | Portal / Destination | Email | Password |
| :--- | :--- | :--- | :--- |
| **System Admin** | `/master-control` | `admin@organdonation.gov.in` | `AdminSecurePass@2026` |
| **Hospital Coordinator** | `/hospital/login` | *Registered facility email* | *Specified during registration* |
| **Citizen / Patient** | `/auth/login` | *Registered user email* | *Specified during registration* |

---

## 🧪 Verification & Test Suites

The backend includes test scripts to validate core clinical flows:

```bash
cd server
npm run test:auth       # User authentication and JWT lifecycle
npm run test:hubs       # Hospital registration and verification
npm run test:citizen    # Pledge submission and citizen profile
npm run test:blood      # Emergency blood requisition workflow
npm run test:organs     # Organ harvest entry and cold ischemia timers
npm run test:matching   # 20-minute match algorithm execution
npm run test:socket     # WebSocket event propagation
```

---

## 📄 License & Attribution

Distributed under the **MIT License**. See `LICENSE` for more information.

Designed and developed by [Satyanarayana Chittidi](https://github.com/Satyanarayana-Chittidi).
