import { permanentRedirect } from "next/navigation";

// The resource library moved from the old packs catalogue to content modules
// (ADR-014). `/library` is retired; send it permanently to `/library/modules`,
// the canonical URL. The dormant packs backend/admin is left in place for a
// later dedicated teardown (Phase 14.5, WS1.1).
type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LibraryPage({ params }: Props) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/library/modules`);
}
