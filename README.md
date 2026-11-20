# StandardRoofs Sign ⚡

> **Official Electronic Signature, Roofing Contracts & Document Approval Platform for Standard Roofs**

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.19-2d3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![Legal Compliance](https://img.shields.io/badge/Compliance-Section%2065B%20IT%20Act%202000-emerald?style=flat)]()
[![User Guide](https://img.shields.io/badge/User%20Guide-A--to--Z%20Manual-indigo?style=flat)](docs/USER_GUIDE.md)

---

## 🌟 Executive Overview

**Standard e-Sign** is a production-ready, bank-grade, multi-tenant B2B SaaS platform engineered for executing legally binding agreements with court-admissible evidence under **Section 65B of the Indian Evidence Act, 1872** and the **Information Technology Act, 2000**.

Unlike generic signing apps, Standard e-Sign combines visual document manipulation, real-time biometric webcam selfies, doorstep GPS landmark geocoding, official Aadhaar/PAN KYC document annexures, and automated WhatsApp Cloud API delivery into a single white-labeled software engine.

> 📖 **Looking for the everyday Operating Manual?**  
> Check out the complete [**Standard e-Sign A-to-Z User Guide**](docs/USER_GUIDE.md) for step-by-step instructions.

---

## 🚀 Key Feature Matrix

| Capability | Description | Status |
| :--- | :--- | :---: |
| **Section 65B Audit Trail** | Tamper-evident Certificates of Completion with cryptographic SHA-256 seal & scannable QR verification. | ✅ Ready |
| **Sign-on-Selfie & GPS** | Live camera facial verification with doorstep GPS geocoding and reverse street landmark lookup. | ✅ Ready |
| **Indian KYC Annexures** | Mandatory collection of UIDAI-masked Aadhaar, PAN card, GST, or Cheque proofs dynamically appended as full-page legal annexures. | ✅ Ready |
| **Confidential PIN Gate** | Access passcode lock preventing unauthorized document viewing before entering the secret PIN. | ✅ Ready |
| **Visual WYSIWYG Builder** | Drag-and-drop signatures, initials, dates, text inputs, checkboxes with 4-corner resizing and arrow-key precision nudging. | ✅ Ready |
| **Contract Lifecycle** | Signer delegation/reassignment, decline with mandatory reasons, and auto-expiration deadlines. | ✅ Ready |
| **Multi-Party Signing** | Sequential step-by-step or parallel simultaneous execution workflows. | ✅ Ready |
| **Bulk CSV Broadcast** | 1-click batch generation and personalized dispatch to 100+ signers at once. | ✅ Ready |
| **True White-Labeling** | Individual organization workspaces with isolated team roles, custom branding, custom SMTP, and custom WhatsApp headers. | ✅ Ready |
| **Super Admin Command Center** | Platform owner command portal (`/admin`) for tracking fleet MRR (₹), plan overrides, customer suspensions, and private database silos. | ✅ Ready |
| **Universal File Conversion** | Upload native PDFs or auto-convert Word (`.docx`) and Excel (`.xlsx`, `.xls`, `.csv`) files on the fly. | ✅ Ready |
| **Dual Storage Engine** | Seamless dual adapter supporting local disk storage and cloud **Cloudflare R2** / **AWS S3** object buckets. | ✅ Ready |

---

## 🏛️ System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │     SUPER ADMIN COMMAND CENTER (/admin)      │
                               │   Governs all customer accounts & SaaS MRR   │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
         ┌───────────────────────────┐                                 ┌───────────────────────────┐
         │ Standard & Pro Workspaces │                                 │  Enterprise Dedicated Silo│
         │   (Shared Tenant Fleet)   │                                 │ (Private DB / Bucket URL) │
         └─────────────┬─────────────┘                                 └─────────────┬─────────────┘
                       │                                                             │
         ┌─────────────▼─────────────┐                                 ┌─────────────▼─────────────┐
         │ Strict Foreign-Key & Row  │                                 │ Dedicated Private Database│
         │ Tenant Isolation Engine   │                                 │  (PostgreSQL / S3 Bucket) │
         └─────────────┬─────────────┘                                 └───────────────────────────┘
                       │
         ┌─────────────▼─────────────────────────────────────────────┐
         │  COURT-ADMISSIBLE EXECUTION & EVIDENCE ENGINE             │
         │  • Section 65B Certificate of Completion                  │
         │  • Biometric Webcam Selfie + Doorstep GPS Coordinates     │
         │  • Mandatory Aadhaar / PAN / GST Annexure Pages           │
         │  • Cryptographic SHA-256 Seal + Scannable QR Verification │
         └───────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

* **Frontend & Backend Framework:** Next.js 15 (App Router), React 19, TypeScript
* **Styling & UI:** Tailwind CSS v4, Lucide Icons
* **Database & ORM:** Prisma ORM (SQLite for local dev, PostgreSQL for production)
* **PDF & Graphics Engine:** `pdf-lib`, `pdfjs-dist`, `canvas`, `@aws-sdk/client-s3`, `qrcode`
* **File Converters:** `mammoth` (Word to PDF), `xlsx` (Excel to PDF)
* **Authentication & Security:** Salted `bcryptjs`, HMAC-SHA256 signed HTTP-only cookies, Session Token rotation
* **Dispatch & Messaging:** Nodemailer (Custom SMTP), Meta WhatsApp Cloud API, MSG91 Flow, Fast2SMS

---

## 📦 Directory Structure

```
standard-esign/
├── docs/
│   └── USER_GUIDE.md               # Complete A-to-Z End-to-End User Manual
├── prisma/
│   ├── schema.prisma               # Multi-tenant data models & indexes
│   ├── dev.db                      # Local SQLite development database
│   └── seed.mjs                    # Initial demo & admin seed script
├── public/                         # Static assets & public icons
├── storage/                        # Local file storage (uploads, signed PDFs)
│   ├── uploads/                    # Master unsigned template PDFs
│   └── signed/                     # Final sealed execution PDFs
├── src/
│   ├── app/
│   │   ├── (auth)/                 # Login & Signup routes
│   │   ├── admin/                  # Super Admin Command Center (/admin)
│   │   ├── dashboard/              # Main Agreements Fleet Dashboard
│   │   ├── drive/                  # Real Cloud Drive storage & Quota meters
│   │   ├── editor/                 # In-browser PDF Merger & Page Splitter
│   │   ├── requests/               # Create & View Signature Requests
│   │   ├── s/[token]/              # Mobile-first Signer Portal
│   │   ├── settings/               # Organization Branding & Custom SMTP
│   │   ├── templates/              # Reusable Document Templates Builder
│   │   ├── verify/                 # Public QR Code Audit Verification
│   │   └── api/                    # RESTful Next.js API endpoints
│   ├── components/                 # Reusable React client components
│   └── lib/                        # Core utilities (pdf, storage, auth, geocode, dispatch)
├── .env.example                    # Comprehensive production environment template
└── package.json
```

---

## ⚙️ Quick Start (Local Development)

### 1. Prerequisites
* **Node.js:** v18.18 or higher (Node 20+ recommended)
* **Git:** Installed on your system

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/Srimani26/standard-esign.git
cd standard-esign
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```

### 4. Push Database Schema & Seed Admin
```bash
npx prisma db push
node prisma/seed.mjs
```

### 5. Start the Server
```bash
npm run dev
```
Open **[http://localhost:3030](http://localhost:3030)** in your browser.

* **Super Admin Login:** `admin@standardesign.in` / `Welcome@2026` (or create your own on `/signup`).
* **Super Admin Command Center:** [http://localhost:3030/admin](http://localhost:3030/admin).

---

## 🚀 Commercial Production Deployment (4 Steps)

Deploying to production on **Vercel**, **Railway**, or **AWS** takes approximately 15 minutes:

### Step 1: Cloud Database (PostgreSQL)
1. Create a free hosted PostgreSQL database on **[Neon.tech](https://neon.tech)** or **[Supabase.com](https://supabase.com)**.
2. In `prisma/schema.prisma`, switch datasource to PostgreSQL:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Push your schema: `npx prisma db push`.

### Step 2: Cloud Object Storage (Cloudflare R2 / AWS S3)
In production, container filesystems are ephemeral. Standard e-Sign includes a built-in S3 adapter in `src/lib/storage.ts`:
1. Create a bucket in **Cloudflare R2** (e.g., `standard-esign-documents`).
2. Add the R2 keys to your environment variables:
   ```env
   STORAGE_DRIVER="r2"
   R2_ACCOUNT_ID="your_account_id"
   R2_ACCESS_KEY_ID="your_access_key"
   R2_SECRET_ACCESS_KEY="your_secret_key"
   R2_BUCKET_NAME="standard-esign-documents"
   ```

### Step 3: Connect to Vercel / Railway
1. Push your repository to GitHub.
2. Log in to **Vercel.com**, click **"Add New Project"**, and select your repo.
3. Add your environment variables (Database URL, App Secret, Storage credentials).
4. Click **Deploy**.

### Step 4: Live Payment Gateway (Razorpay)
1. In your **Razorpay Dashboard**, switch to **Live Mode**.
2. Copy `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` and paste them into your production environment variables.
3. Subscription billing (₹1,499/mo Business Pro and ₹4,999/mo Enterprise) will immediately deposit revenue into your corporate bank account.

---

## 💰 Commercial SaaS Pricing Tiers

Standard e-Sign comes pre-configured with 3 revenue tiers managed via Razorpay:

| Tier | Price | Monthly Docs | Cloud Storage | Key Features |
| :--- | :---: | :---: | :---: | :--- |
| **Starter Free** | ₹0 | 10 Docs/mo | 1 GB | Biometric Selfie, GPS Proof, Section 65B Certificate, WhatsApp 1-Click Delivery |
| **Business Pro** | ₹1,499 / mo | **Unlimited** | **100 GB** | All Free Features + In-Browser PDF Editor, Team Management, Custom Branding |
| **Enterprise 1TB** | ₹4,999 / mo | **Unlimited** | **1,024 GB (1 TB)** | All Pro Features + Dedicated Private Database Silo, Custom SMTP, Priority SLA |

---

## 🔒 Legal & Regulatory Admissibility

Documents executed through Standard e-Sign are fully admissible in court:
1. **Section 65B, Indian Evidence Act (1872):** Certificate of Completion generated for every document certifying computer output authenticity.
2. **Sections 3 & 3A, Information Technology Act (2000):** Validates electronic signatures and asymmetric crypto verification.
3. **UIDAI Aadhaar Masking Compliance:** Automatically prompts users to mask the first 8 digits of Aadhaar cards (`XXXX-XXXX-1234`) to comply with Indian privacy regulations.

---

## 📄 License & Intellectual Property

Proprietary and Confidential Commercial Software.  
Copyright © 2026 Standard Roofs (https://github.com/standardroofs-bot). All Rights Reserved.  
Unauthorized copying, reverse engineering, or redistribution of this repository is strictly prohibited.
