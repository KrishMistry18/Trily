/**
 * app/(dashboard)/dashboard/new/page.tsx
 *
 * Prompt input landing page for creating a new project.
 * Requirements: 3.1, 3.2, 3.5, 19.1
 */
import PromptInput from "@/components/PromptInput";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create a new site</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Describe your website and Trily will generate it for you in seconds.
        </p>
      </div>
      <PromptInput />
    </div>
  );
}
