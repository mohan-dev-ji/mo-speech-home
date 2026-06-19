"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tag, ListChecks, AlignJustify, Search } from "lucide-react";
import { HomeCard } from "@/app/components/app/home/ui/HomeCard";

/** Nav-card row (Figma `row1`) — links to the four existing pages via Next Link. */
export function HomeNavCards() {
  const t = useTranslations("home");
  const params = useParams();
  const locale = params.locale as string;

  const cards = [
    { title: t("navCategories"), icon: <Tag />, path: "categories" },
    { title: t("navLists"), icon: <ListChecks />, path: "lists" },
    { title: t("navSentences"), icon: <AlignJustify />, path: "sentences" },
    { title: t("navSearch"), icon: <Search />, path: "search" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-theme-gap">
      {cards.map((c) => (
        <HomeCard
          key={c.path}
          title={c.title}
          icon={c.icon}
          href={`/${locale}/${c.path}`}
        />
      ))}
    </div>
  );
}
