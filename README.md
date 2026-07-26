# Trily

Trily is an AI-powered website builder that allows users to instantly generate, preview, edit, and publish modern websites using plain English prompts.

## Features

- **AI Generation**: Type what you want, and Trily writes the code in seconds.
- **Instant Preview**: Live side-by-side preview of your generated site with fully functional HTML, CSS, and JS.
- **Chat to Edit**: Not quite right? Chat with the AI to make instant visual tweaks.
- **One-Click Publish**: Deploy your site instantly to a custom subdomain or connect your own domain.
- **Version History**: Automatic version control. Rollback to any previous iteration of your site with one click.
- **Secure Backend**: Powered by Firebase Auth, Firestore, and Firebase Storage for robust, scalable infrastructure.
- **Credit System**: Integrated Stripe billing for generation and edit credits.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage (via Admin SDK)
- **Auth**: Firebase Auth
- **AI Models**: Integration with advanced LLMs for code generation
- **Queue**: BullMQ with Redis for asynchronous job processing
- **Payments**: Stripe Checkout and Billing Portal

## Getting Started

### Prerequisites

- Node.js 18+
- Redis (running locally or via a provider like Upstash)
- Firebase Project (Firestore, Storage, Auth enabled)
- Stripe Account

### Environment Variables

Create a `.env.local` file in the root directory and configure the following variables:

```env
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Redis (for BullMQ)
REDIS_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# AI Provider (e.g. OpenAI/Anthropic)
AI_API_KEY=
```

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Run the queue worker (in a separate terminal) if required for background processing:
   ```bash
   npm run worker
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

- `/app`: Next.js App Router pages and API routes.
- `/components`: Reusable React components (UI, Chat, Hero, etc.).
- `/lib`: Core utilities (Firebase Admin, AI generation logic, Queue handlers, Billing).
- `/public`: Static assets.

## License

All rights reserved.
