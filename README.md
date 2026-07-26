# Trily - AI Website Builder

![Trily Banner](https://via.placeholder.com/1200x400/0A0A0F/FFFFFF?text=Trily+-+Design+at+the+speed+of+thought)

Trily is a premium, AI-powered website builder that allows users to generate beautiful, fully functional websites from a simple text prompt. Built with modern web technologies, Trily focuses on an exceptional user experience, blazing-fast performance, and a stunning glassmorphism design system.

## 🚀 Features

- **AI-Powered Generation**: Describe your ideal website in plain English, and Trily's AI engine generates the code instantly.
- **Real-Time Preview & Editing**: Edit your generated sites through an intuitive conversational interface.
- **Premium Glassmorphism UI**: A gorgeous, dark-themed interface built with Tailwind CSS and Framer Motion for buttery-smooth animations.
- **Secure Authentication**: Passwordless or traditional sign-ins powered by Firebase Authentication.
- **Credits System & Billing**: Integrated Stripe billing to manage generation and edit credits.
- **Project Management**: A clean dashboard to track, organize, and revisit your generated websites.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Database**: [Firebase Firestore](https://firebase.google.com/docs/firestore)
- **Authentication**: [Firebase Auth](https://firebase.google.com/docs/auth)
- **Payments**: [Stripe](https://stripe.com/)
- **Queues**: [BullMQ](https://docs.bullmq.io/) (Redis)

## 💻 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase Project
- Stripe Account (for payments)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/KrishMistry18/Trily.git
   cd Trily
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory and add your keys (Firebase, Stripe, OpenAI, etc.).

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## 🎨 Design System

Trily uses a custom design system tokenized in `globals.css` and `tailwind.config.ts`.

- **Colors**: Deep dark background (`#0A0A0F`) with vibrant indigo/fuchsia accents.
- **Effects**: Heavy use of backdrop-blur (glassmorphism), subtle glowing borders, and drop shadows.
- **Interactions**: Custom glowing cursor on desktop, smooth staggered scroll animations, and tactile button feedback.

## 📝 License

Copyright © 2026 Trily Inc. All rights reserved.
