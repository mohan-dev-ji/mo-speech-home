"use client";

import { GroupsView } from '@/app/components/app/shared/sections/GroupsView';

/** List Groups root — the shared GroupsView bound to the Lists tree. */
export function ListsGroupsView() {
  return <GroupsView tree="lists" namespace="lists" />;
}
