import { getOfficialExamples } from "@/app/actions/examples";
import { auth } from "@/auth";

import { ClientGallery } from "./ClientGallery";

export const revalidate = 3600; // Cache for 1 hour

export default async function ExamplesPage() {
  const session = await auth();
  const examples = await getOfficialExamples();

  return <ClientGallery examples={examples} isLoggedIn={!!session?.user} />;
}
