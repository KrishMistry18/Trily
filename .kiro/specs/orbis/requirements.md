# Requirements Document

## Introduction

Orbis is a SaaS web application that enables users to generate complete, production-ready websites from natural language descriptions. Users describe their desired site via a single prompt or short conversation, and the platform orchestrates AI model calls to produce a structured site specification, then working front-end code (HTML/CSS/JS). Users can preview the result live, iteratively refine it via a chat interface, and export or deploy it. Access is gated by a credit/subscription billing model powered by Stripe. This document covers the MVP scope: no AI video or cinematic-scroll generation; focus on fast, reliable prompt-to-website generation using text models, with optional image generation as a stretch goal.

---

## Glossary

- **Orbis**: The SaaS platform described in this document.
- **User**: An authenticated human operating the Orbis web application.
- **Guest**: An unauthenticated visitor to the Orbis web application.
- **Project**: A named workspace owned by a User that contains one or more Versions of a generated website.
- **Version**: A point-in-time snapshot of the generated front-end code for a Project, stored with a sequential version number and a creation timestamp.
- **Prompt**: A natural-language string submitted by the User describing the website they want to generate or an edit they want to apply.
- **Site_Spec**: A structured JSON object produced by the Spec_Generator that describes a website's sections, copy, color palette, and layout.
- **Spec_Generator**: The backend service that calls an LLM API to convert a Prompt into a Site_Spec.
- **Code_Generator**: The backend service that calls an LLM API to convert a Site_Spec (or an edit instruction plus existing code) into working front-end code.
- **Image_Generator**: The backend service that calls an image-generation API to produce hero or section images for a Project.
- **Generation_Job**: An asynchronous background task managed by the Job_Queue that executes a Spec_Generator or Code_Generator or Image_Generator call.
- **Job_Queue**: The BullMQ + Redis queue that manages and processes Generation_Jobs.
- **Preview**: A sandboxed iframe rendered in the browser that displays the current Version's front-end code.
- **Chat_Interface**: The UI panel through which the User sends follow-up Prompts to iteratively edit a Project.
- **Credit**: The unit of account for AI usage on Orbis. Each Generation_Job deducts a defined number of Credits from the User's balance.
- **Credit_Ledger**: The append-only database table recording every Credit deduction and top-up event for a User.
- **Subscription**: A recurring billing relationship between the User and Orbis, managed via Stripe, that determines the User's monthly Credit allowance and feature access tier.
- **Tier**: One of three Subscription levels: Free, Pro, or Business.
- **Credit_Balance**: The current number of Credits available to a User, computed as the sum of all Credit_Ledger entries for that User.
- **ZIP_Export**: A downloadable archive containing the front-end code files of the current Version of a Project.
- **Vercel_Deploy**: The one-click action that pushes the current Version's code to Vercel via the Vercel API and returns a public URL.
- **Dashboard**: The authenticated landing page listing the User's Projects with metadata.
- **AI_Service_Layer**: The backend module that wraps all calls to external AI APIs, enforcing retries, timeouts, and token/cost logging.
- **Rate_Limiter**: The backend component that enforces per-User generation request frequency limits.
- **Token_Log**: The database record of token consumption and estimated cost for each AI_Service_Layer call.

---

## Requirements

---

### Requirement 1: User Authentication

**User Story:** As a Guest, I want to sign up and log in with email/password or Google OAuth, so that my projects and billing information are securely tied to my account.

#### Acceptance Criteria

1. THE Orbis SHALL provide an email/password sign-up flow that collects a unique email address and a password meeting a minimum of 8 characters.
2. THE Orbis SHALL provide a Google OAuth sign-in flow that creates or links a User account using the verified Google email address.
3. WHEN a Guest submits valid sign-up credentials, THE Orbis SHALL create a User record and issue an authenticated session.
4. WHEN a Guest submits invalid or duplicate sign-up credentials, THE Orbis SHALL return a descriptive error message identifying the specific field that failed validation.
5. WHEN a User submits valid login credentials, THE Orbis SHALL issue an authenticated session with a maximum idle timeout of 24 hours.
6. WHEN a User submits invalid login credentials, THE Orbis SHALL return an authentication failure message without disclosing which field (email or password) was incorrect.
7. WHEN an authenticated session expires or is invalidated, THE Orbis SHALL redirect the User to the login page and preserve the originally requested URL as a post-login redirect target.
8. IF a Guest attempts to access any authenticated route, THEN THE Orbis SHALL redirect the Guest to the login page.

---

### Requirement 2: Subscription and Credit Billing

**User Story:** As a User, I want to subscribe to a plan or purchase credits, so that I can pay only for the AI generation capacity I need.

#### Acceptance Criteria

1. THE Orbis SHALL offer three Subscription Tiers: Free, Pro, and Business, each with a defined monthly Credit allowance and price, managed through Stripe.
2. THE Orbis SHALL offer one-off Credit top-up purchases through Stripe that add a fixed number of Credits to the User's Credit_Balance upon successful payment.
3. WHEN a Stripe payment event for a Subscription or top-up is received, THE Orbis SHALL update the Credit_Ledger and Credit_Balance within 10 seconds of the webhook delivery.
4. WHEN a User's Credit_Balance reaches zero, THE Orbis SHALL block any new Generation_Job from being enqueued and display a prompt to upgrade the Subscription or purchase a top-up.
5. THE Credit_Ledger SHALL record each event with: User ID, event type (deduction or top-up), Credit amount, timestamp, and the associated Generation_Job ID or Stripe payment intent ID.
6. THE Orbis SHALL display the User's current Tier, Credit_Balance, and Credit_Ledger history on the account/billing page.
7. WHEN a Subscription is downgraded or cancelled, THE Orbis SHALL retain all existing Projects and Versions but apply the new Tier's Credit allowance from the next billing cycle.
8. IF a Stripe webhook signature validation fails, THEN THE Orbis SHALL reject the webhook with a 400 response and log the failure without modifying the Credit_Ledger.

---

### Requirement 3: Project Creation and Prompt Input

**User Story:** As a User, I want to start a new project by describing my desired website in natural language and optionally selecting a style preset, so that I can quickly generate a site tailored to my needs.

#### Acceptance Criteria

1. THE Orbis SHALL provide a Prompt input UI containing a textarea that accepts between 10 and 2,000 characters of natural-language text.
2. THE Orbis SHALL provide an optional industry/style preset picker that, when a preset is selected, pre-fills the Prompt textarea with a template string for that preset.
3. WHEN a User submits a Prompt with a Credit_Balance greater than zero, THE Orbis SHALL create a Project record, enqueue a Generation_Job, and display the job's pending status to the User within 2 seconds.
4. WHEN a User submits a Prompt with a Credit_Balance of zero, THE Orbis SHALL reject the submission and display a credit-insufficiency message without creating a Project record.
5. WHEN a User submits a Prompt shorter than 10 characters or longer than 2,000 characters, THE Orbis SHALL reject the submission and display a validation error specifying the character limit.
6. THE Orbis SHALL assign each new Project a unique ID, the submitting User's ID, a creation timestamp, and the original Prompt text upon creation.

---

### Requirement 4: Site Spec Generation

**User Story:** As a User, I want the platform to convert my natural-language prompt into a structured site specification, so that a well-organised blueprint drives the code generation step.

#### Acceptance Criteria

1. WHEN a Generation_Job for spec generation is dequeued, THE Spec_Generator SHALL send the Prompt to the configured LLM API and return a Site_Spec JSON object containing: an ordered list of sections (each with a type, heading, copy, and layout hint), a color palette (primary, secondary, accent, background, text), and a page title.
2. THE Site_Spec SHALL conform to a documented JSON schema; WHEN the LLM response does not conform, THE Spec_Generator SHALL retry the call up to 3 times with a corrective instruction before marking the Generation_Job as failed.
3. WHEN the Spec_Generator receives a valid Site_Spec, THE Orbis SHALL persist the Site_Spec to the Project record and advance the Generation_Job to the code generation step.
4. WHEN the Spec_Generator call fails after 3 retries, THE Orbis SHALL mark the Generation_Job as failed, notify the User, and restore the deducted Credits to the Credit_Ledger.
5. THE AI_Service_Layer SHALL log a Token_Log record for every LLM API call containing: provider, model name, prompt token count, completion token count, and estimated cost in USD.

---

### Requirement 5: Front-End Code Generation

**User Story:** As a User, I want the platform to produce working front-end code from my site spec, so that I can immediately preview a real website.

#### Acceptance Criteria

1. WHEN the code generation step of a Generation_Job is reached, THE Code_Generator SHALL send the Site_Spec to the configured LLM API and return a complete, self-contained static HTML/CSS/JS file set implementing the specified sections, copy, color palette, and layout.
2. THE Code_Generator SHALL instruct the LLM to produce output that passes HTML5 validation and is mobile-responsive using CSS that targets viewport widths of 320px and above.
3. WHEN the Code_Generator receives valid front-end code, THE Orbis SHALL create a Version record containing the code, a version number (starting at 1 for each Project), and a creation timestamp.
4. WHEN the code generation LLM API call fails after 3 retries, THE Orbis SHALL mark the Generation_Job as failed, notify the User, and restore the deducted Credits to the Credit_Ledger.
5. THE AI_Service_Layer SHALL log a Token_Log record for the code generation LLM API call with the same fields specified in Requirement 4, Acceptance Criterion 5.

---

### Requirement 6: Generation Job Queue and Status

**User Story:** As a User, I want to see real-time progress of my generation job, so that I know when my site is ready without having to refresh the page.

#### Acceptance Criteria

1. THE Job_Queue SHALL process Generation_Jobs using BullMQ with a Redis backend, with a maximum concurrency limit configurable via an environment variable.
2. WHEN a Generation_Job is enqueued, THE Orbis SHALL assign it one of the following statuses: pending, processing, completed, or failed.
3. WHILE a Generation_Job is in the pending or processing status, THE Orbis SHALL provide the client with a status update mechanism (polling endpoint or server-sent events) that reflects the current status within 3 seconds of a status change.
4. WHEN a Generation_Job transitions to the completed status, THE Orbis SHALL deliver the completed Version's code to the client and render the Preview.
5. WHEN a Generation_Job transitions to the failed status, THE Orbis SHALL display an error message to the User describing the failure reason.
6. IF a Generation_Job remains in the processing status for longer than 120 seconds, THEN THE Job_Queue SHALL mark the job as failed with a timeout reason, and THE Orbis SHALL restore the deducted Credits to the Credit_Ledger.

---

### Requirement 7: Live Preview

**User Story:** As a User, I want to see my generated site rendered in real time inside the application, so that I can evaluate the result before editing or exporting.

#### Acceptance Criteria

1. WHEN a Version is available, THE Orbis SHALL render the Version's HTML/CSS/JS code inside a sandboxed iframe using the `sandbox` attribute with the minimum set of permissions required for the page to render correctly (allow-scripts, allow-same-origin disabled).
2. THE Orbis SHALL never execute AI-generated JavaScript on the server; all AI-generated script execution SHALL occur exclusively within the client-side sandboxed iframe.
3. WHEN the User switches to a different Version, THE Orbis SHALL reload the Preview iframe with the selected Version's code within 1 second.
4. THE Preview iframe SHALL render at a minimum viewport width of 320px and SHALL be resizable by the User to simulate desktop and mobile viewports.

---

### Requirement 8: Iterative Editing via Chat

**User Story:** As a User, I want to send natural-language edit instructions after my site is generated, so that I can refine the result without starting over.

#### Acceptance Criteria

1. THE Orbis SHALL provide a Chat_Interface panel that accepts a Prompt of between 5 and 1,000 characters describing an edit to apply to the current Version.
2. WHEN the User submits an edit Prompt with a sufficient Credit_Balance, THE Orbis SHALL enqueue a Generation_Job of type "edit" and deduct the applicable Credit cost from the Credit_Ledger.
3. WHEN an edit Generation_Job is dequeued, THE Code_Generator SHALL send the current Version's full code plus the edit Prompt to the configured LLM API and return updated front-end code incorporating the requested change.
4. WHEN the Code_Generator returns updated code for an edit job, THE Orbis SHALL create a new Version record with an incremented version number and update the Preview to show the new Version.
5. THE Chat_Interface SHALL display each Prompt submitted by the User and the corresponding status (pending, applied, or failed) in chronological order.
6. WHEN the edit Generation_Job fails after 3 retries, THE Orbis SHALL restore the deducted Credits to the Credit_Ledger and display the failure reason in the Chat_Interface.

---

### Requirement 9: Version History and Revert

**User Story:** As a User, I want to view and revert to any previous version of my project, so that I can undo edits that did not turn out as expected.

#### Acceptance Criteria

1. THE Orbis SHALL display the complete ordered list of Versions for the current Project, each showing its version number, creation timestamp, and the Prompt that produced it.
2. WHEN the User selects a previous Version from the version history list, THE Orbis SHALL update the Preview to display that Version's code without creating a new Version record.
3. WHEN the User confirms a revert action on a selected previous Version, THE Orbis SHALL create a new Version record with an incremented version number whose code is identical to the selected Version, making it the current active Version.
4. THE Orbis SHALL retain all Version records for a Project indefinitely unless the User explicitly deletes the Project.

---

### Requirement 10: ZIP Export

**User Story:** As a User, I want to download the current version of my site as a ZIP file, so that I can host or modify it outside of Orbis.

#### Acceptance Criteria

1. WHEN the User requests a ZIP_Export, THE Orbis SHALL package the current Version's code files into a ZIP archive and initiate a browser download within 5 seconds.
2. THE ZIP_Export SHALL include all files required to open the site locally in a browser without an internet connection (excluding external CDN resources already referenced in the code).
3. THE Orbis SHALL store generated ZIP_Export archives in the configured S3-compatible storage bucket and serve them via a pre-signed URL with a minimum expiry of 1 hour.
4. THE ZIP_Export action SHALL NOT deduct Credits from the User's Credit_Ledger.

---

### Requirement 11: Vercel Deployment

**User Story:** As a User, I want to deploy my site to a live URL with one click, so that I can share it without any manual hosting setup.

#### Acceptance Criteria

1. WHEN the User initiates a Vercel_Deploy, THE Orbis SHALL call the Vercel API using the configured Vercel API token to create or update a deployment with the current Version's code files.
2. WHEN the Vercel API responds with a successful deployment URL, THE Orbis SHALL persist the URL to the Version record and display it to the User as a clickable link within the UI.
3. WHEN the Vercel API returns an error response, THE Orbis SHALL display a descriptive error message to the User and retain the Version without a deployment URL.
4. THE Vercel_Deploy action SHALL NOT deduct Credits from the User's Credit_Ledger.
5. THE Orbis SHALL never expose the Vercel API token to the client; all Vercel API calls SHALL be made exclusively from the server-side AI_Service_Layer.

---

### Requirement 12: User Dashboard

**User Story:** As a User, I want a dashboard listing all my projects, so that I can quickly find and continue working on any of them.

#### Acceptance Criteria

1. THE Orbis SHALL display on the Dashboard an ordered list of the User's Projects sorted by last-edited date descending, showing for each: project name, thumbnail image (or a placeholder if none exists), last-edited date, and total Credit usage to date.
2. WHEN the User clicks a Project on the Dashboard, THE Orbis SHALL navigate to the project editor showing the latest Version's Preview and Chat_Interface.
3. WHEN the User has no Projects, THE Orbis SHALL display an empty-state message and a prominent call-to-action to create a new Project.
4. THE Orbis SHALL render the Dashboard as a mobile-responsive layout functional at viewport widths of 320px and above.

---

### Requirement 13: Account and Billing Page

**User Story:** As a User, I want a dedicated account page showing my plan, credit balance, and usage history, so that I can monitor and manage my spending.

#### Acceptance Criteria

1. THE Orbis SHALL display on the account/billing page: the User's current Tier name, Credit_Balance, renewal date (for paid Tiers), and a list of Credit_Ledger events in reverse chronological order.
2. THE Orbis SHALL provide a button to upgrade, downgrade, or cancel the Subscription that redirects the User to a Stripe-hosted billing portal.
3. THE Orbis SHALL provide a button to purchase a one-off Credit top-up that initiates a Stripe Checkout session.
4. WHEN a Stripe payment completes, THE Orbis SHALL reflect the updated Credit_Balance on the account/billing page within 10 seconds of the webhook delivery, without requiring a manual page refresh.

---

### Requirement 14: AI Service Layer and Cost Controls

**User Story:** As an operator, I want all AI API calls to run through a governed service layer, so that I can track costs, enforce retries, and protect against runaway spend.

#### Acceptance Criteria

1. THE AI_Service_Layer SHALL route all LLM and image-generation API calls; no AI API calls SHALL originate directly from client-side code or from route handlers outside the AI_Service_Layer.
2. THE AI_Service_Layer SHALL apply a configurable timeout (default 60 seconds) to each outbound AI API call and treat a timeout as a retriable error.
3. THE AI_Service_Layer SHALL retry failed AI API calls up to 3 times using exponential backoff with an initial delay of 1 second, a multiplier of 2, and a maximum delay of 16 seconds.
4. THE AI_Service_Layer SHALL support a configurable LLM provider (Anthropic Claude or OpenAI) selectable via an environment variable without requiring code changes.
5. THE AI_Service_Layer SHALL write a Token_Log record for every API call containing: call timestamp, provider, model name, prompt token count, completion token count, and estimated cost in USD computed from the provider's published per-token pricing.

---

### Requirement 15: Rate Limiting

**User Story:** As an operator, I want per-user generation request rate limits, so that no single user can exhaust the platform's AI API budget through rapid repeated submissions.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a configurable maximum number of Generation_Job enqueue requests per User per rolling 60-second window (default: 5 requests per 60 seconds).
2. WHEN a User exceeds the rate limit, THE Orbis SHALL reject the request with a 429 response and display a message to the User stating the time remaining before the next request is permitted.
3. THE Rate_Limiter SHALL track request counts in Redis using a sliding window algorithm keyed by User ID.
4. WHEN the rate-limit configuration value is changed, THE Rate_Limiter SHALL apply the new limit to subsequent requests without requiring a server restart.

---

### Requirement 16: Security and Sandboxing

**User Story:** As an operator, I want AI-generated code to be safely sandboxed, so that malicious or erroneous AI output cannot compromise the platform or its users.

#### Acceptance Criteria

1. THE Orbis SHALL render all AI-generated HTML/CSS/JS exclusively inside a client-side iframe using the HTML `sandbox` attribute; AI-generated scripts SHALL NOT execute in the main browsing context.
2. THE Orbis SHALL set a Content Security Policy header on all application pages that prohibits inline script execution outside the sandboxed iframe.
3. THE Orbis SHALL never pass AI-generated code through `eval()`, `Function()`, or equivalent dynamic code execution mechanisms on the server.
4. THE Orbis SHALL store all Vercel API tokens, AI API keys, and Stripe secret keys exclusively in server-side environment variables; these values SHALL NOT be included in any client-side bundle.
5. WHEN user-supplied input is persisted to the database, THE Orbis SHALL use parameterised queries or an ORM with built-in parameterisation to prevent SQL injection.

---

### Requirement 17: Storage for Generated Assets

**User Story:** As a User, I want my generated site assets and exports to be reliably stored, so that I can access them whenever I return to the platform.

#### Acceptance Criteria

1. THE Orbis SHALL store the front-end code for each Version and all generated ZIP_Export archives in a configured S3-compatible storage bucket (Cloudflare R2 or AWS S3).
2. WHEN a Version is created, THE Orbis SHALL write the Version's code files to the storage bucket under a path structured as `{userId}/{projectId}/{versionId}/` within 5 seconds of the Generation_Job completing.
3. WHEN the User requests a file from storage, THE Orbis SHALL serve it via a pre-signed URL with a minimum expiry of 1 hour.
4. THE Orbis SHALL never expose storage bucket credentials to the client; all signed URL generation SHALL occur server-side.

---

### Requirement 18: Optional Hero Image Generation

**User Story:** As a User, I want to optionally generate an AI image for my site's hero section, so that my site has a visual that matches its theme without requiring me to source one manually.

#### Acceptance Criteria

1. WHERE the User opts in to image generation, THE Image_Generator SHALL call the configured image-generation API (Replicate or fal.ai) with a prompt derived from the Site_Spec's hero section copy and color palette.
2. WHERE the User opts in to image generation, THE Orbis SHALL deduct an additional configurable Credit cost from the Credit_Ledger for the image generation call.
3. WHEN the Image_Generator returns a successful image URL, THE Orbis SHALL embed the image URL into the generated front-end code for the hero section and store the image in the storage bucket.
4. WHEN the Image_Generator call fails after 3 retries, THE Orbis SHALL complete the Generation_Job without the hero image, restore the image-generation Credit cost to the Credit_Ledger, and notify the User that image generation was skipped.
5. THE AI_Service_Layer SHALL log a Token_Log record (or equivalent cost record) for each image generation API call containing: call timestamp, provider, model name, and estimated cost in USD.

---

### Requirement 19: Mobile-Responsive UI

**User Story:** As a User, I want the Orbis application itself to be usable on mobile devices, so that I can manage and review projects from any device.

#### Acceptance Criteria

1. THE Orbis SHALL render all primary UI views — Dashboard, project editor, Chat_Interface, and account/billing page — as mobile-responsive layouts functional at viewport widths of 320px and above.
2. THE Orbis SHALL use Tailwind CSS responsive utility classes to implement layout breakpoints; custom CSS media queries SHALL only be used where Tailwind utilities are insufficient.
3. THE Preview iframe within the project editor SHALL be resizable by the User between a minimum width of 320px (mobile simulation) and the full available editor panel width (desktop simulation).
