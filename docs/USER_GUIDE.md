# Standard e-Sign — Complete A-to-Z User Guide & Operating Manual

> **Welcome to Standard e-Sign!**  
> This guide explains everything you need to know about using the platform—from sending your very first agreement to managing multi-party contracts, biometric selfie signatures, Aadhaar/PAN KYC verifications, and downloading legally binding Section 65B court-admissible audit trails.

---

## 📑 Table of Contents
1. [Overview & What Standard e-Sign Does](#1-overview--what-standard-e-sign-does)
2. [Getting Started & Account Setup](#2-getting-started--account-setup)
3. [Company Branding & Workspace Settings](#3-company-branding--workspace-settings)
4. [Uploading Documents & Creating Templates](#4-uploading-documents--creating-templates)
5. [Using the Visual Drag-and-Drop Editor](#5-using-the-visual-drag-and-drop-editor)
6. [Security, Passcodes & Indian KYC Proofs](#6-security-passcodes--indian-kyc-proofs)
7. [Sending an Agreement for Signature](#7-sending-an-agreement-for-signature)
8. [The Signer Experience (What Your Client Sees)](#8-the-signer-experience-what-your-client-sees)
9. [Tracking Status, Reminders & Audit Trails](#9-tracking-status-reminders--audit-trails)
10. [Public QR Verification & Section 65B Certificates](#10-public-qr-verification--section-65b-certificates)
11. [Cloud Drive & File Storage](#11-cloud-drive--file-storage)
12. [In-Browser PDF Editor & Document Tools](#12-in-browser-pdf-editor--document-tools)
13. [Super Admin Command Center (Platform Owners Only)](#13-super-admin-command-center-platform-owners-only)
14. [Troubleshooting & Frequently Asked Questions (FAQ)](#14-troubleshooting--frequently-asked-questions-faq)

---

## 1. Overview & What Standard e-Sign Does

**Standard e-Sign** is a bank-grade, multi-tenant digital signature and contract automation software built specifically for modern enterprises, contractors, law firms, real estate developers, HR teams, and corporate organizations.

### Why It's More Secure Than Traditional e-Signatures:
* **Indian Evidence Act (Section 65B) Compliant:** Generates court-admissible Certificates of Completion with SHA-256 cryptographic sealing.
* **Sign-on-Selfie & GPS Proof:** Captures the signer's face via camera alongside doorstep GPS coordinates (accurate to street landmark).
* **Official KYC Annexures:** Collects and appends UIDAI-masked Aadhaar cards, PAN cards, GST certificates, or cancelled cheques directly to the final legal PDF.
* **Confidential Access PIN:** Protects sensitive documents behind an access code before any pages can be viewed.
* **Omnichannel 1-Click Delivery:** Delivers contracts straight to clients' WhatsApp, SMS, and Email.

---

## 2. Getting Started & Account Setup

### Step 1: Sign Up for an Account
1. Open your browser and go to `/signup` (e.g., `http://localhost:3030/signup` or your live domain).
2. Choose your account type:
   * **Business Organization:** For companies, agencies, contractors, and firms.
   * **Individual Workspace:** For solo professionals and freelancers.
3. Enter your **Full Name**, **Work Email**, **Phone Number**, and a secure **Password** (min 6 characters).
4. Click **Create Free Workspace**.

### Step 2: Signing In
1. Go to `/login`.
2. Enter your email and password.
3. You will be directed straight to your **Agreements Dashboard**.

---

## 3. Company Branding & Workspace Settings

Every organization has its own isolated, white-labeled environment. To customize your company details:

1. Click on **Settings** in the top navigation bar.
2. Under **Company Identity & Contact Details**, enter:
   * **Company Name:** (e.g., *Apex Construction Ltd* or *Sharma & Associates Legal*).
   * **Tagline:** Shown on signing pages (e.g., *Official Contracts & Authorizations*).
   * **Website & Official Email:** Displayed on audit certificates.
   * **Phone & Office Address:** Printed on legal verification pages.
3. **Custom Email (SMTP):** If you want invitation emails to come directly from your own corporate email server (e.g., `contracts@yourcompany.com` instead of the system default), enter your SMTP Host, Port, Username, and Password.
4. **Team Members & Access Control:**
   * Under **Team Members**, click **Invite Staff / Team Member**.
   * Enter their name, work email, and role:
     * **Admin:** Full access to send documents, edit templates, and change company settings.
     * **Member:** Can send documents and view agreement progress.
   * A temporary password will be assigned for their first login.
5. Click **Save Settings**.

---

## 4. Uploading Documents & Creating Templates

You can upload existing agreements or create reusable templates for contracts you send repeatedly.

### Supported File Formats:
* **PDF Files (`.pdf`):** Standard contracts, agreements, NDAs, drawing approvals.
* **Word Documents (`.docx`):** Automatically converted to pixel-perfect PDFs on upload.
* **Excel Spreadsheets (`.xlsx`, `.xls`, `.csv`):** Quotations, BOQs, fee schedules automatically converted into PDFs.

### Steps to Create a Template:
1. Click **Templates** in the top navigation menu.
2. In the **Upload New Document Template** box:
   * Enter a descriptive title (e.g., *Standard NDA 2026* or *Vendor Service Agreement*).
   * Select an Agreement Category (e.g., *Contract / Agreement*, *Quotation / BOQ*, *HR & Employee*).
   * Click the upload area or drag-and-drop your file.
3. Click **Upload & Open Field Builder**.
4. The visual drag-and-drop editor will open immediately.

---

## 5. Using the Visual Drag-and-Drop Editor

The visual field builder allows you to specify where each signer must sign, initial, enter their name, or type dates.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FIELD BUILDER TOOLBAR                           │
├──────────────┬──────────────┬──────────────┬─────────────┬─────────────┤
│ ✍️ Signature │ 🔤 Initials  │ 📅 Date      │ 📝 Text Box │ ☑️ Checkbox │
└──────────────┴──────────────┴──────────────┴─────────────┴─────────────┘
```

### Adding Fields:
1. **Select Signer Role:** In the top toolbar, select which role owns the field (e.g., *Client*, *Contractor*, *Director*).
2. **Click & Drag Field:**
   * **Signature Box:** Where the signer draws or types their signature.
   * **Initials Box:** For page-by-page sign-offs.
   * **Date Field:** Auto-populates with the exact date and timestamp upon signing.
   * **Text Input:** For custom text (e.g., Company Name, Designation, PAN Number).
   * **Checkbox:** For agreeing to terms, warranties, or payment milestones.
3. **Positioning & Resizing:**
   * Drag any field to position it anywhere on the page.
   * Use the 4 corner handles to scale the box up or down.
   * **Precision Nudging:** Click any field and use your keyboard arrow keys (`↑`, `↓`, `←`, `→`) to nudge pixel-by-pixel.
4. **Multi-Page Support:** Scroll smoothly across pages or use the page navigator on the left to jump between pages.
5. **Saving:** Click **Save Template** in the upper right corner.

---

## 6. Security, Passcodes & Indian KYC Proofs

Standard e-Sign provides bank-grade safeguards to protect confidential contracts and prevent fraud.

When creating a new signature request, look for the **🔒 Security, Confidentiality & KYC Proofs** section:

### 1. Confidential Document PIN / Passcode Protection
* Toggle **Require Access PIN to View Document**.
* Enter a 4 to 8 digit PIN (e.g., `482910`).
* **How it works:** When the recipient opens the link, the document pages are completely hidden behind a bank-grade lock screen. They cannot view or sign the contract until they enter the correct PIN.

### 2. Biometric Sign-on-Selfie & GPS Verification
* Enabled by default for all high-value agreements.
* **How it works:** When the client signs, their browser camera prompts for a real-time selfie snapshot and queries doorstep GPS coordinates with reverse-geocoded street landmarks. This prevents signers from claiming "someone else signed on my phone."

### 3. Mandatory Official KYC Document Annexures
You can require signers to submit government-issued proofs before submitting:
* **PAN Card:** For tax and high-value financial contracts.
* **Aadhaar Card:** Prompts the signer with the official UIDAI advisory: *"Please mask the first 8 digits of your Aadhaar card (e.g., XXXX-XXXX-1234) for privacy."*
* **GST Certificate:** For B2B vendor onboarding and corporate GST verification.
* **Cancelled Cheque:** For bank account and payment validation.

> **Where do these proofs go?**  
> All uploaded KYC files are automatically rendered as full-page court-admissible **ANNEXURE** pages at the very end of the finalized signed PDF!

### 4. Document Expiration Countdown
* Set an expiration window: **3 days**, **7 days**, **14 days**, **30 days**, or **60 days**.
* If the agreement is not signed before the deadline, the link automatically locks, marking the request as `EXPIRED`.

---

## 7. Sending an Agreement for Signature

You can send documents in two flexible ways: **Single Send** or **Bulk Broadcast**.

### Option A: Single Document Send
1. Click **Send** in the top navigation bar (or click *Send for Signature* on the dashboard).
2. Select your document template from the dropdown.
3. Review or customize the **Agreement Title** and **Project / Reference ID**.
4. **Signer Details:**
   * Enter the Signer's **Full Name**, **Email Address**, and/or **WhatsApp Phone Number** (e.g., `9876543210`).
   * Select their notification channels: **WhatsApp**, **Email**, and/or **SMS**.
5. **Multi-Party Signing Order:**
   * **Parallel (Simultaneous):** All signers receive the link at the same time and can sign in any order.
   * **Sequential (Step-by-Step):** Signer 2 only receives their invitation after Signer 1 has completed signing.
6. Configure security settings (PIN, KYC annexures, expiration).
7. Click **Send for Signature**.

### Option B: Bulk Send (Broadcast to 100+ Clients at Once)
* Perfect for sending offer letters, vendor NDAs, or site quotations to multiple parties.
1. In the Send screen, switch mode to **Bulk Broadcast**.
2. Upload a CSV file or paste recipient rows (`Name, Phone, Email, Reference`).
3. Standard e-Sign generates personalized, unique secure links for every single person automatically!

---

## 8. The Signer Experience (What Your Client Sees)

Your clients do **not** need to install any app or create an account. They can sign in 30 seconds from any smartphone, tablet, or desktop browser.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SIGNER 4-STEP FLOW                              │
│                                                                        │
│ 1. Open WhatsApp/Email ➜ 2. Enter PIN (if set) ➜ 3. Sign & Selfie ➜ 4. Download Sealed PDF │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Receiving Invitation:** The client receives a direct WhatsApp message or email with their secure signing link (e.g., `https://yourdomain.com/s/sr98a7bc`).
2. **Unlocking (If PIN Protected):** The client enters their access code to reveal the document.
3. **Reviewing Pages:** They can scroll through the contract, zoom in, and review all terms.
4. **Signing:**
   * Clicking a signature box lets them draw their signature with their finger/mouse, type their name in signature font, or upload an official signature image.
5. **Biometric Selfie & Location:**
   * The client clicks **Capture Selfie & GPS**.
   * The camera captures their live photo with zero lag.
   * GPS captures their latitude, longitude, and nearby street landmark.
6. **Uploading Required KYC Proofs (If Required):**
   * If Aadhaar/PAN was requested, they snap a photo of the ID card or choose an image from their phone gallery.
7. **Final Submit:** Clicking **Finish & Submit Document** locks the signature, computes the cryptographic SHA-256 seal, and allows immediate download of the signed copy.

### Signer Options: Reassign or Decline
* **Delegate / Reassign:** If the document was sent to a manager who wants their director to sign, they can click **Delegate / Reassign**, enter the new signer's name and contact, and the link automatically redirects.
* **Decline to Sign:** If there is a dispute in terms, they can click **Decline**, enter a mandatory reason, and the sender is instantly notified.

---

## 9. Tracking Status, Reminders & Audit Trails

In your **Agreements Dashboard (`/dashboard`)**, you have real-time visibility over every single document.

### Agreement Status Badges:
* 🟢 **Completed:** All signers have signed, biometric proofs captured, and final PDF sealed.
* 🟡 **Pending Signature:** Invitation sent; waiting for signer to open and execute.
* 🔵 **Partially Signed:** Signer 1 has signed; waiting for Signer 2 in sequential workflow.
* 🔴 **Declined:** A signer rejected the document with a documented reason.
* ⚪ **Voided / Expired:** Cancelled by admin or passed the deadline window.

### Inspecting an Agreement's Audit Trail:
1. Click on any document title to open the **Agreement Detail** screen.
2. Under **Audit Event Trail**, you will see a tamper-evident, timestamped log:
   * Document Created by Admin.
   * Dispatched via WhatsApp / Email.
   * Document Opened & Viewed (with exact IP address and device browser).
   * Confidential PIN Verified.
   * Signed by Party (with coordinates and signature timestamp).
   * Final PDF Sealed with SHA-256 Checksum.

---

## 10. Public QR Verification & Section 65B Certificates

Every signed agreement automatically includes an official **Certificate of Completion** generated under **Section 65B of the Indian Evidence Act**.

```
┌────────────────────────────────────────────────────────────────────────┐
│               CERTIFICATE OF COMPLETION (SECTION 65B)                  │
├────────────────────────────────────────────────────────────────────────┤
│ • Document Title & Unique Request ID                                   │
│ • Signer Names, Roles, Verified Email & Phone Numbers                  │
│ • Exact Signing Timestamps (UTC & IST)                                 │
│ • Signer IP Addresses & Device User-Agent Strings                      │
│ • Doorstep GPS Landmark Geocoding (Latitude & Longitude)               │
│ • Embedded Biometric Selfie Photo Proof                                │
│ • Cryptographic SHA-256 Digital Checksum                               │
│ • Live Scannable Verification QR Code                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### How to Verify Any Printed or Digital Document:
1. Anyone (a judge, auditor, bank officer, or client) can scan the QR code printed on the Certificate of Completion using any phone camera.
2. The browser instantly opens the **Public Verification Portal (`/verify`)**.
3. The system compares the file's SHA-256 cryptographic hash against the immutable database record:
   * ✅ **VERIFIED & AUTHENTIC:** Displays the official execution certificate confirming zero tampering.
   * ❌ **ALTERED / INVALID:** Alerts the user if even a single character or page was modified after signing.

---

## 11. Cloud Drive & File Storage

Click **Cloud Drive** in the navigation bar to access your organization's storage repository.

### What Is Stored:
* **Original Unsigned PDFs:** The master template files you uploaded.
* **Signed & Sealed PDFs:** The finalized execution copies with embedded signatures and biometric stamps.
* **Certificate Only PDFs:** Download lightweight 1-page court evidence certificates for filing without reprinting 100-page contracts.

### Real Physical Storage Metering:
* Your drive shows **true, byte-by-byte storage** consumed on disk or Cloudflare R2 / AWS S3.
* **Plan Quotas:**
  * **Starter Free:** 10 documents/month limit • 1 GB Cloud Storage.
  * **Business Pro:** Unlimited documents • 100 GB Cloud Storage (₹1,499/mo).
  * **Enterprise 1TB:** Unlimited documents • 1,024 GB Cloud Storage (₹4,999/mo).

---

## 12. In-Browser PDF Editor & Document Tools

Click **PDF Editor** in the navigation bar to use the built-in document manipulation suite without needing third-party software like Adobe Acrobat:

* **Merge PDFs:** Combine multiple contract annexures, engineering drawings, and quotation sheets into a single unified PDF.
* **Delete Unwanted Pages:** Remove blank pages or confidential appendixes before sending.
* **Reorder Pages:** Drag pages into any sequence.
* **Add Watermarks:** Apply confidential or draft watermarks across all pages.

---

## 13. Super Admin Command Center (Platform Owners Only)

If your user account has the `SUPER_ADMIN` role (e.g., `admin@standardroofs.in`), an exclusive **👑 Super Admin** badge appears in the top navigation bar, linking to `/admin`.

### What the Platform Owner Can Do:
1. **Fleet Overview & Revenue KPIs:**
   * View total registered customer companies.
   * Real-time **Monthly Recurring Revenue (MRR)** calculation in Indian Rupees (₹).
   * Total executed documents across all organizations.
   * Total cloud storage consumed across the entire server cluster.
2. **Customer Governance:**
   * Search and filter customer companies by tier or status.
   * **Plan Overrides:** Manually upgrade or downgrade any customer between Free, Pro, and Enterprise tiers.
   * **Instant Suspension:** Suspend non-paying or compromised accounts with 1 click, instantly freezing their document dispatches.
   * **Usage Resets:** Reset monthly document counters back to `0`.
   * **Private Database & Storage Silos:** For enterprise VIP clients requiring strict data localization (banks, defense, law firms), attach a dedicated PostgreSQL database URL or private S3 bucket specifically for that organization.

---

## 14. Troubleshooting & Frequently Asked Questions (FAQ)

#### Q1: Can signers sign on mobile phones without installing any app?
**A:** Yes! The signing portal is 100% responsive and works on Chrome, Safari, Firefox, and Samsung Internet on Android and iOS devices.

#### Q2: What if the client's camera shows a black screen during selfie capture?
**A:** Standard e-Sign includes an automatic camera auto-rebind safeguard. If a browser delays opening the video stream, the system automatically cycles the stream and provides an instant "Retake" button. Ensure the user granted camera permissions in their mobile browser.

#### Q3: How is this legally valid in Indian courts?
**A:** Under Section 65B of the Indian Evidence Act, 1872 and the Information Technology Act, 2000, electronic records with verified audit trails, IP addresses, timestamps, biometric proofs, and cryptographic hashes are fully admissible as primary electronic evidence.

#### Q4: What happens if an organization exceeds its monthly document limit?
**A:** On the Free tier (10 documents/month), once the 10th document is sent, the system displays an upgrade prompt. Subscribing to Business Pro or Enterprise via Razorpay unlocks unlimited documents immediately.

#### Q5: Can I change my company name, logo, or accent color?
**A:** Yes! Navigate to **Settings** and update your company name, website, and branding. All subsequent documents, emails, and certificates will immediately use your updated information.

---

*Standard e-Sign — Enterprise Digital Signatures, Biometric KYC Proofs & Section 65B Audit Trails.*  
*Copyright © 2026. All Rights Reserved.*
