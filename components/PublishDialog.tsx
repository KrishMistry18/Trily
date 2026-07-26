"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
  getPublishSettingsAction,
  togglePublishAction,
  updateCustomDomainAction,
} from "@/app/actions/publish";

interface PublishDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PublishDialog({ projectId, isOpen, onClose }: PublishDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [tier, setTier] = useState<string>("free");
  const [isPublic, setIsPublic] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getPublishSettingsAction(projectId)
        .then((data) => {
          setTier(data.tier);
          setIsPublic(data.isPublic);
          setCustomDomain(data.customDomain);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setIsLoading(false);
        });
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  async function handleTogglePublish() {
    setIsSaving(true);
    try {
      const res = await togglePublishAction(projectId, !isPublic);
      if (res.success) {
        setIsPublic(!isPublic);
      } else if (res.error === "upgrade_required") {
        alert("Publishing requires a Pro or Business subscription.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update publish settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDomain(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await updateCustomDomainAction(projectId, customDomain);
      if (res.success) {
        setCustomDomain(res.cleanedDomain);
        alert("Domain updated successfully");
      } else if (res.error === "upgrade_required") {
        alert("Custom domains require a Pro or Business subscription.");
      } else if (res.error === "domain_in_use") {
        alert("This domain is already in use by another project.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update custom domain");
    } finally {
      setIsSaving(false);
    }
  }

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/sites/${projectId}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-foreground/10 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-foreground/10">
          <h2 className="text-lg font-semibold text-foreground">Publish Settings</h2>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {isLoading ? (
            <div className="py-8 text-center text-foreground/50">Loading settings...</div>
          ) : tier === "free" ? (
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg text-foreground">Upgrade to Publish</h3>
              <p className="text-sm text-foreground/60 px-4">
                Publishing your site to a live URL and connecting a custom domain are available on
                Pro and Business plans.
              </p>
              <Link
                href="/billing"
                className="inline-block mt-4 px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition"
              >
                View Plans
              </Link>
            </div>
          ) : (
            <>
              {/* Publish Toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Live URL</h3>
                    <p className="text-xs text-foreground/60">
                      Make your site accessible to the world.
                    </p>
                  </div>
                  <button
                    onClick={handleTogglePublish}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isPublic ? "bg-primary" : "bg-foreground/20"} ${isSaving ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPublic ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>
                {isPublic && (
                  <div className="bg-muted p-3 rounded-md flex items-center justify-between text-sm">
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline truncate mr-2"
                    >
                      {publicUrl}
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(publicUrl)}
                      className="shrink-0 text-foreground/50 hover:text-foreground"
                      title="Copy link"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>

              <div className="h-px bg-foreground/10" />

              {/* Custom Domain */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-foreground">Custom Domain</h3>
                  <p className="text-xs text-foreground/60">
                    Connect your own domain (e.g. www.startup.com)
                  </p>
                </div>

                <form onSubmit={handleSaveDomain} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="yourdomain.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="flex-1 text-sm bg-background border border-foreground/20 rounded-md px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save
                  </button>
                </form>

                {customDomain && (
                  <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mt-2 text-sm space-y-2">
                    <p className="font-medium text-primary">DNS Instructions:</p>
                    <p className="text-foreground/70">
                      To connect your domain, log in to your domain registrar and create a{" "}
                      <strong>CNAME</strong> record:
                    </p>
                    <div className="bg-background border rounded p-2 font-mono text-xs text-foreground">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="font-semibold">Type:</span> <span>CNAME</span>
                        <span></span>
                        <span className="font-semibold">Name:</span> <span>@ (or www)</span>
                        <span></span>
                        <span className="font-semibold">Value:</span>{" "}
                        <span>cname.vercel-dns.com</span>
                      </div>
                    </div>
                    <p className="text-xs text-foreground/50">
                      It may take up to 24 hours for DNS changes to propagate.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
