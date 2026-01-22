# Automated PDF Signing (Acrobat-Style) — Implementation Plan

## What “Adobe Acrobat signing” can mean

Acrobat has two common signing behaviors:

1) **Fill & Sign / “Sign” (appearance-only)**  
   - Places a visible signature image/text on the page.  
   - **Not a cryptographic digital signature**; many workflows treat this like a stamp.

2) **Certificates / Digitally Sign (cryptographic, verifiable)**  
   - Creates a **PAdES / PDF digital signature** using a certificate/private key.  
   - Optionally adds a visible signature appearance (image, name, date).  
   - Can add **timestamping (RFC3161 TSA)** and **LTV** (OCSP/CRL embedding).

This plan targets the **cryptographic** version (like Acrobat’s “Digitally Sign”), with a visible appearance layer so it looks like your example.

## Requirements (current decisions)

- **Signing type:** Digital signature (cryptographic).  
- **Trigger:** Both automated (rule action) and manual UI placement.  
- **Placement:** You want a UI “place signature here” tool; for some docs the location is consistent (same page/box).  
- **Languages (first-class):** English + Simplified Chinese (affects appearance font and metadata).
- **Key source:** Not decided yet (likely PFX/P12 file import or OS cert store).

## Scope

### In scope

- Create **PAdES-compatible** signatures and optionally display a visible signature appearance (image + signer name + date/time).
- Manual UI placement (drag/resize box) + “remember this template” for repeatable automation.
- Rule action: “Sign PDF” with template selection + output strategy (new file vs overwrite).
- Background execution (non-blocking), progress, cancellation, and **persistence/resume**.
- Verification step after signing (ensure signature validates).

### Out of scope (initial)

- Enterprise remote signing providers (unless chosen).
- Complex multi-signer workflows (multiple signatures and countersignatures).
- Full legal compliance packaging (beyond baseline PAdES) unless required.

## Architecture overview

### Frontend (Tauri + React)

- **Manual signing flow**
  - Open a PDF preview, draw a signature rectangle (page number + x/y/w/h).
  - Choose certificate/key source.
  - Choose appearance: signature image, printed name, timestamp format.
  - Click “Sign” → creates a background job, shows progress, allows cancel.
- **Automation flow**
  - Rule action “Sign PDF” references:
    - a signing identity (certificate)
    - a placement template (or “use existing signature field”)
    - output behavior (overwrite vs `*-signed.pdf`)

### Backend (Rust)

- A “signing service” module that:
  - loads certificates/keys
  - applies a visible appearance (optional)
  - adds a PDF signature field (if not present)
  - computes and embeds cryptographic signature
  - optionally requests RFC3161 timestamping
  - verifies the resulting PDF signature
- A **background job runner** (persisted):
  - queue sign jobs
  - run off the rule engine thread
  - progress + cancel + resume after restart

## Plan

### 1) Choose key storage / signing identity strategy (blocking)

Support at least one of these first; design so the others can be added:

- **Option A: PFX/P12 import** (cross-platform, simplest to ship first)
  - User selects `.p12/.pfx` and enters password.
  - Store encrypted key material in app storage (or store path + prompt password each time).
- **Option B: OS cert store / keychain**
  - Windows cert store + macOS Keychain (Linux varies).
  - More secure; avoids exporting keys; more platform-specific.

Deliverable: a unified internal `SigningIdentity` interface:
- `sign(data) -> signature`
- `cert_chain() -> ...`
- `ui_label() -> ...`

### 2) Pick a PDF signing implementation strategy

Evaluate and pick the safest low-maintenance approach:

- Prefer a Rust crate that supports PDF signing end-to-end (candidate: `pdf_signing`).
- Add a verification pass (candidate: `trust_pdf`) to catch malformed outputs.
- If crate support is incomplete, fall back to:
  - generating a correct PDF signature dictionary + CMS/PKCS#7 with `openssl` crate
  - or a well-scoped sidecar tool (last resort; increases operational complexity)

Deliverable: a minimal “sign this PDF bytes with this cert” backend API.

### 3) Visible signature appearance (Acrobat-like)

Implement appearance as a page overlay that matches the placement rectangle:

- Render a signature appearance stream with:
  - signature image (handwritten) OR typed name
  - signing time/date (local time or chosen TZ format)
  - optional metadata line (reason/location)
- Ensure fonts support **English + Simplified Chinese** (bundle fonts if needed).

Deliverable: consistent, nice-looking visible signature that can be turned on/off.

### 4) Placement models (manual + automated)

Support multiple placement strategies; start with the one that matches your examples:

1) **Fixed template placement** (page + rectangle in PDF coordinates)  
   - Great when “the place to sign is always the same.”
2) **AcroForm signature field**  
   - If the PDF already contains a signature field, fill it.
3) **Anchor-based placement (future)**  
   - Find text like “Authorized Signature” and place relative to it.

UI should allow saving templates per document “type”:
- `templateId`, `pageIndex`, `rect`, optional doc matcher (filename regex / issuer text / page size).

Deliverable: “Place once, reuse forever” workflow.

### 5) Background signing jobs (persist + resume)

Implement a persisted job queue for signing:

- Job state stored in SQLite: `queued/running/completed/failed/canceled`, progress, error, timestamps.
- On startup, resume `queued/running` jobs safely (idempotent outputs).
- Provide Tauri commands:
  - `sign_job_start({ sourcePath, outputPath, templateId, identityId, options })`
  - `sign_job_status(jobId)`
  - `sign_job_cancel(jobId)`
- Emit events:
  - `sign:progress` (page, stage, percent)
  - `sign:completed` / `sign:failed`

Deliverable: signing never blocks watchers; the UI can track jobs.

### 6) Integrate as a rule action (“Sign PDF”)

- Add a new action type with minimal config:
  - identity
  - template / “use signature field”
  - output strategy (overwrite vs `*-signed.pdf`)
  - when to sign (e.g., only after OCR step, only if not already signed)
- Ensure idempotency:
  - avoid re-signing an already-signed file unless configured

Deliverable: automated signing in the existing rule pipeline.

### 7) Testing + validation

- Unit tests for:
  - signature dictionary structure / incremental updates
  - appearance placement geometry
  - ToUnicode + font embedding for Chinese characters in appearance
- Integration tests:
  - sign a small fixture PDF and verify signature validity using `trust_pdf` (or Acrobat/manual spot check).
  - verify output opens in common viewers and shows “valid signature” where supported.

## Security & compliance notes

- Treat signing keys as secrets:
  - prefer OS keystore where possible
  - never log key material or passwords
  - encrypt any stored key blobs at rest
- Consider adding **RFC3161 timestamping** if you need Acrobat-like long-term validation behavior.
- Decide on overwrite behavior carefully (use atomic temp write + rename).

## Open questions (need your choices)

1) **Key source:** Do you want to start with **P12/PFX import** or **OS cert store**?
2) **Appearance:** Do you always want a visible signature (image + date), or allow “invisible digital signature”?
3) **Timestamping:** Do you need RFC3161 timestamping (Acrobat often offers it; it improves long-term validity)?

