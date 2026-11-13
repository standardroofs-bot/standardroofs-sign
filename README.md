# Standard e-Sign (Commercial Multi-Tenant SaaS)

A full-featured, enterprise-grade, multi-tenant electronic signature and document verification platform.

---

## Highlights & Features

- **Multi-Tenant SaaS Architecture:** Organizations can create their own workspaces, invite team members (Admin, Manager, Member), configure custom branding, and manage storage quotas.
- **DocuSeal-style WYSIWYG Template Builder:** Drag-and-drop interactive signature boxes, initials, company stamps, dates, and text inputs onto any document. Includes 4-corner resizing, arrow-key precision nudging, and deadzone protection for tablets.
- **Universal File Conversion:** Native PDF upload plus real-time server-side conversion for Word documents (`.docx`), Excel sheets (`.xlsx`, `.xls`), and CSV files into standard PDFs.
- **Photo + GPS Location Verification:** Capture signer identity via browser webcam and exact geographic coordinates (Latitude / Longitude) embedded onto an official Certificate of Completion.
- **Tamper-Evident SHA-256 Audit Trail:** Hard-flattens signatures using `pdf-lib` and generates a cryptographic SHA-256 hash validating document integrity.
- **Short Mobile Signing URLs:** Clean, lightweight `/s/[token]` portal tailored for seamless signing on mobile devices.
- **Omnichannel Delivery:** 1-click delivery via WhatsApp Web, WhatsApp Desktop App, SMS deep links, and automated SMTP email dispatch.
- **Built-in PDF Editor & Merger:** Merge multiple PDF files, delete unwanted pages, and apply custom security watermarks.
- **Storage Drive Management:** Tracks disk usage per organization with tiered plans (10 GB Free Tier, 100 GB Pro, 1 TB Enterprise).

---

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS, Lucide Icons
- **Database & ORM:** Prisma ORM with SQLite (dev) / PostgreSQL (production)
- **PDF Engine:** `pdf-lib`, `pdfjs-dist`, `canvas`, `mammoth`, `xlsx`
- **Security:** Salted `bcryptjs` password hashing, signed HTTP-only cookies

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy the environment template:
```bash
cp .env.example .env
```

### 3. Initialize Database
```bash
npx prisma db push
node prisma/seed.mjs
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3030](http://localhost:3030) in your browser.

---

## License

Proprietary and Confidential Commercial Software License.  
Copyright © 2026 Standard Roofs & Invi Creation. All Rights Reserved.  
See the [LICENSE](LICENSE) file for complete terms.
