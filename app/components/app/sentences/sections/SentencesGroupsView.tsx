"use client";

import { GroupsView } from '@/app/components/app/shared/sections/GroupsView';

/** Sentence Groups root — the shared GroupsView bound to the Sentences tree. */
export function SentencesGroupsView() {
  return <GroupsView tree="sentences" namespace="sentences" />;
}
