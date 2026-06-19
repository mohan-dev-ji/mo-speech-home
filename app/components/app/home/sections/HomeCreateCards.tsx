"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { HomeCard } from "@/app/components/app/home/ui/HomeCard";

type Props = {
  onCreateSymbol: () => void;
  onCreateCategory: () => void;
  onCreateList: () => void;
  onCreateSentence: () => void;
};

/** Create-card row (Figma `row2`) — each "+" card opens the matching create modal. */
export function HomeCreateCards({
  onCreateSymbol,
  onCreateCategory,
  onCreateList,
  onCreateSentence,
}: Props) {
  const t = useTranslations("home");

  const cards = [
    { title: t("createSymbol"), onActivate: onCreateSymbol },
    { title: t("createCategory"), onActivate: onCreateCategory },
    { title: t("createList"), onActivate: onCreateList },
    { title: t("createSentence"), onActivate: onCreateSentence },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-theme-gap">
      {cards.map((c) => (
        <HomeCard key={c.title} title={c.title} icon={<Plus />} onActivate={c.onActivate} />
      ))}
    </div>
  );
}
