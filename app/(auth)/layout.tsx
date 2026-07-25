/**
 * app/(auth)/layout.tsx
 *
 * Centered layout wrapper for auth pages (login, signup).
 * Provides a full-height centred container with a card-like form area.
 *
 * Requirements: 19.1 (mobile-responsive at 320px+)
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
