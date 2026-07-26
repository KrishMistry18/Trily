"use client";

import { useState } from "react";

import Image from "next/image";
import Link from "next/link";

import {
  deleteProjectAction,
  duplicateProjectAction,
  renameProjectAction,
} from "@/app/actions/dashboard";

import { GlassCard } from "./ui/GlassCard";

interface ProjectCardProps {
  project: any;
  onRefresh: () => void;
}

export default function ProjectCard({ project, onRefresh }: ProjectCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [isProcessing, setIsProcessing] = useState(false);

  const formattedDate = new Date(project.updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim() === project.name || !newName.trim()) {
      setIsRenaming(false);
      return;
    }
    setIsProcessing(true);
    try {
      await renameProjectAction(project.projectId, newName.trim());
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to rename project");
    } finally {
      setIsProcessing(false);
      setIsRenaming(false);
    }
  }

  async function handleDuplicate() {
    setIsMenuOpen(false);
    if (confirm("Duplicate this project?")) {
      setIsProcessing(true);
      try {
        await duplicateProjectAction(project.projectId);
        onRefresh();
      } catch (e) {
        console.error(e);
        alert("Failed to duplicate");
      } finally {
        setIsProcessing(false);
      }
    }
  }

  async function handleDelete() {
    setIsMenuOpen(false);
    if (confirm("Move this project to trash?")) {
      setIsProcessing(true);
      try {
        await deleteProjectAction(project.projectId);
        onRefresh();
      } catch (e) {
        console.error(e);
        alert("Failed to delete");
      } finally {
        setIsProcessing(false);
      }
    }
  }

  return (
    <GlassCard
      className={`group relative flex flex-col h-[280px] transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* Thumbnail area */}
      <Link
        href={`/projects/${project.projectId}`}
        className="block h-[180px] relative overflow-hidden flex-shrink-0 rounded-t-2xl border-b border-white/5"
      >
        {project.thumbnailUrl ? (
          <Image
            src={project.thumbnailUrl}
            alt={project.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 flex items-center justify-center">
            <span className="text-white/40 font-display font-bold text-4xl uppercase tracking-widest">
              {project.name?.slice(0, 2) || "TR"}
            </span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-[10px] uppercase font-bold tracking-wider rounded-md text-white border border-white/10 shadow-lg">
          {project.status === "published" ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Draft
            </span>
          )}
        </div>

        {/* Hover Quick Actions overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <div
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md border border-white/20 transition-colors shadow-xl"
            title="Open Project"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </div>
        </div>
      </Link>

      {/* Info area */}
      <div className="p-5 flex-1 flex flex-col justify-center relative">
        <div className="flex items-start justify-between gap-2">
          {isRenaming ? (
            <form onSubmit={handleRename} className="flex-1 flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-sm font-semibold bg-black/50 border border-white/20 rounded-md px-2 py-1 text-white focus:outline-none focus:border-indigo-500"
                autoFocus
                onBlur={() => setIsRenaming(false)}
              />
            </form>
          ) : (
            <Link
              href={`/projects/${project.projectId}`}
              className="flex-1 hover:text-indigo-400 transition-colors truncate font-semibold text-white text-base"
            >
              {project.name}
            </Link>
          )}

          {/* Quick actions (visible on hover) */}
          {!isRenaming && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsRenaming(true);
                }}
                className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Rename"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDuplicate();
                }}
                className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Duplicate"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                className="p-1.5 rounded-md hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-white/40 mt-1 font-medium">Updated {formattedDate}</p>
      </div>
    </GlassCard>
  );
}
