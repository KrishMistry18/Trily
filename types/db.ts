/**
 * types/db.ts
 *
 * Firestore data models for Trily.
 */

// A generic timestamp type to accommodate Firebase's Timestamp objects
export type FirestoreTimestamp = any;

export type SubscriptionTier = "free" | "pro" | "business";

export interface User {
  uid: string;
  email: string;
  displayName: string;
  createdAt: FirestoreTimestamp;
  subscriptionTier: SubscriptionTier;
  creditsBalance: number;
  creditsResetDate: FirestoreTimestamp;
  hasSeenOnboarding?: boolean;
  stripeCustomerId?: string;
}

export type ProjectStatus = "draft" | "published";

export interface Project {
  projectId: string;
  ownerId: string;
  name: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  status: ProjectStatus;
  currentVersionId: string;
  thumbnailUrl: string;
  deletedAt?: FirestoreTimestamp;
  isPublic?: boolean;
  customDomain?: string;
}

export interface ProjectVersion {
  versionId: string;
  projectId: string;
  prompt: string;
  generatedCode: string;
  createdAt: FirestoreTimestamp;
  createdBy: string;
  parentVersionId: string | null; // For edit history/rollback
}

export type TransactionType = "generation" | "edit" | "purchase" | "refund";

export interface CreditTransaction {
  txId: string;
  userId: string;
  amount: number;
  type: TransactionType;
  relatedProjectId?: string;
  timestamp: FirestoreTimestamp;
}

export interface OfficialExample {
  id: string;
  title: string;
  industryTag: string;
  patternTag: string;
  description: string;
  prompt: string;
  generatedCode: string;
  slug: string;
  createdAt: FirestoreTimestamp;
}
