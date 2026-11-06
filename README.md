# Organova

<p align="center">
  <strong>A Full-Stack Platform for Real-Time Organ Viability Tracking, Algorithmic Matching, and Emergency Blood Logistics</strong>
</p>

<p align="center">
  <a href="https://organova.vercel.app"><strong>Live Application</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/MySQL_8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
</p>

---

## Live Deployments

- **Web Application:** https://organova.vercel.app  
  The frontend application is deployed to Vercel.

- **Backend API Service:** https://organova.onrender.com  
  The backend API and real-time WebSocket service are deployed to Render.

- **Database:** TiDB  
  The relational database is hosted on TiDB Cloud, running MySQL in TiDB for structured data storage and transaction management.

---

## Platform Overview

Organova is a full-stack web application designed to demonstrate real-time organ viability tracking, automated recipient matching, and emergency blood requisition logistics between hospitals and donors.

In organ transplantation, timing is critical. Organs undergo cold ischemia degradation the moment they are retrieved, leaving medical teams only narrow hourly windows to match, allocate, transport, and surgically implant them into waiting recipients. Organova simulates and automates this lifecycle with an integrated digital registry, algorithmic allocation, and real-time alerts.

### What the Platform Offers

- Donor Pledges and Digital Cards: Users can pledge organs and tissues (kidneys, liver, heart, lungs, cornea, pancreas, bone marrow) and generate a digital donor card with QR verification.
- Real-Time Cold Ischemia Tracking: When an organ is logged at a hospital, the system initiates a live countdown timer reflecting medical viability preservation limits.
- Algorithmic Compatibility Matching: An automated matching engine calculates compatibility scores for waitlisted recipients by evaluating clinical urgency, waitlist tenure, transit proximity, and blood group compatibility.
- 20-Minute Match Acceptance Windows: When an organ match is proposed, the attending hospital receives a 20-minute decision window to review candidate compatibility and accept the allocation. If unaccepted, background sweepers automatically transition the offer to the next eligible candidate in the queue.
- Emergency Blood Requisitions and SOS Alerts: Hospitals and users can broadcast urgent blood requisitions. Nearby compatible donors receive instant notifications and digital walk-in passes.
- Hospital Blood Stock Management: Participating hospitals maintain live stock counts across blood components (Whole Blood, Packed RBC, Platelets, Plasma) with transfer coordination.
- Master Control Portal: Centralized administrative dashboard for approving hospital accounts, organizing donation camps, and viewing system transaction logs.

---

## How Frontend, Backend, and Database Work Together

Organova operates as a decoupled three-tier system:

### 1. Frontend (Next.js 16, React 19, Tailwind CSS 4)
- User Experience: Provides dedicated, responsive interfaces for Donors, Hospital Coordinators, and Administrators.
- Real-Time Notifications: Establishes a persistent WebSocket connection via Socket.IO to receive instant alerts (emergency blood requisitions, match proposals, and donor responses) without requiring manual page reloads.
- Client State and Theme: Manages authentication sessions, role-based routing, and persistent dark/light mode toggling.
- API Client: Communicates with backend REST endpoints using structured, typed API helpers with automatic token management and error boundaries.

### 2. Backend (Node.js, Express, TypeScript, Socket.IO)
- REST API Services: Serves endpoints for user authentication, donor registration, waitlist management, hospital administration, and blood inventory.
- Real-Time Socket Gateway: Manages WebSocket rooms, dispatching emergency SOS broadcasts to nearby registered donors and clinical match alerts to hospital coordinators.
- Matching Engine Service: Evaluates donor organ attributes against recipient clinical parameters to compute weighted multi-tier match rankings.
- Background Sweepers: Monitors active match proposals and automatically sweeps expired 20-minute offers, notifying attending hospitals in real time when allocations shift.
- Automated Schema Migrations: Verifies database schema integrity and automatically provisions administrative credentials on startup.

### 3. Database (MySQL 8.0 / Cloud TiDB)
- Relational Schema: Stores user accounts, hospital profiles, recipient waitlists, organ harvest records, match proposals, blood requests, and audit logs.
- Data Integrity: Enforces foreign keys, status enumerations, and indexed queries to ensure rapid lookups during high-frequency matching operations.
- Audit Trail: Persists records of platform transactions, including organ retrievals, allocation decisions, hospital acceptances, and emergency dispatches.

---

## Local Setup and Installation

### Prerequisites

- Node.js (version 20 or higher)
- MySQL (version 8.0 or higher)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Satyanarayana-Chittidi/Organova.git
cd Organova
```

### 2. Backend Setup

Ensure your local MySQL service is running. If your local MySQL root user has a password, create a `server/.env` file:

```env
DB_PASSWORD=your_mysql_password
```

*(If your local MySQL root has no password, no configuration is needed. The server automatically creates the database, loads the schema, and provisions the admin keys on startup.)*

```bash
cd server
npm install
npm run dev
```

### 3. Frontend Setup

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## License

Distributed under the MIT License. Designed and developed by [Satyanarayana Chittidi](https://github.com/Satyanarayana-Chittidi).
