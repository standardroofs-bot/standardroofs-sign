# Standard e-Sign Commercial SaaS — System Architecture & Specification

## 1. Executive Summary
**Standard e-Sign** is a full-featured, multi-tenant electronic signature and document verification commercial software suite. Built from the ground up as an original, clean-room SaaS implementation using Next.js 15, React 19, TypeScript, Tailwind CSS, Prisma ORM, and `pdf-lib`.

## 2. Core Capabilities
- **Multi-Tenant Architecture:** Independent organizations, user roles (Admin, Manager, Member), isolated audit trails, and configurable storage quotas.
- **WYSIWYG Template Builder:** Drag-and-drop signature, initials, date, and text fields on PDF documents with keyboard nudge and responsive alignment.
- **Universal Document Support:** Automatic server-side conversion of `.docx`, `.xlsx`, `.xls`, and `.csv` into standardized PDFs ready for signature tagging.
- **Mobile-First Signing Portal:** Clean, frictionless signing interface supporting draw, type, and image upload with progress validation.
- **Tamper-Evident Security & Verification:** SHA-256 cryptographic document checksums, browser webcam photo capture, and GPS coordinates embedded into an audit certificate.
- **Multi-Channel Delivery:** Instant 1-click links for WhatsApp Web, WhatsApp Desktop App, SMS deep links, and automated SMTP email dispatch.
- **PDF Editor & Merger:** Built-in PDF page reordering, page removal, merging multiple documents, and applying security watermarks.
- **Storage Quota Engine:** Tracks organization storage consumption across templates and signed documents from 10 GB up to 1 TB.

## 3. Technology Stack
- **Frontend & Server:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Database:** Prisma ORM, SQLite (local development) / PostgreSQL (production target)
- **PDF Processing:** `pdf-lib`, `pdfjs-dist`, `canvas`, `mammoth`, `xlsx`
- **Security & Authentication:** Salted `bcryptjs` password hashing, signed HTTP-only session cookies
- **License:** Proprietary Commercial Software License (All Rights Reserved)
