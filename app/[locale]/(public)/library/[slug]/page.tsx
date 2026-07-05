import { permanentRedirect } from "next/navigation";

// Old pack detail pages are retired along with the packs catalogue (ADR-014).
// There is no per-pack module equivalent, so send every `/library/<slug>`
// permanently to the modules library (Phase 14.5, WS1.1).
type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function PackDetailPage({ params }: Props) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/library/modules`);
}
