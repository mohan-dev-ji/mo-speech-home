---
title: Admin symbol editor
type: idea
domain: mo-speech
status: shaping
created: 2026-07-26
summary: To manually search for and update symbols translations
tags:
  - "#q"
related:
  - "[[ADR-012-language-operations-console]]"
  - "[[ADR-013-translator-editing-and-staging-area]]"
aliases:
  - Admin symbol editor
---
# Admin symbol editor
We need a way to search the symbols table and to receive the actual symbol itself with all the translations. It should use the search page and symbol editor search algorithm showing the best symbols for the search term while typin. When selected we go to the slug page of that symbol where we can see the details such as translations for all the languages. In this page we will then have the power to edit the different language fields and save which will then take effect across the whole app and for all the users. We maybe have to build a seeding script that gets implemented on save that finds all instances of the symbol in profile symbols so all users already using the app get the change.

## The problem
We have no way of accessing the master symbols table with all the MT of all languages while viewing the symbol image at the same time. We can search in convex but I find this clunky and I rarely find what I am looking for using the filters. More so we have no way of editing metadata for our master symbols when our humanised pass turns in to customised fixes.

It creates a problem in the future when we will have localisation expert checking the translations and reporting corrections for particular symbols from the master table and also from the default and tier modules created by admin who has used our MT in app authoring surface.

We already have good authoring surface for the modules. Now we need something as equally good to edit the master symbols set

## Proposed solution
First we need to brainstorm this idea. The agent and founder need to engage in constructive discourse to find out what needs to get built. There are 2 possioble milestones here: design and build.

Brainstorming the design specs for this will dictate whether we need to jump into figma and design the components and screens for this. My experience with this is links to figma for these always help the agent when building.

ATM I envision a section on the admin dashboard where we can search the whole symbolstix library using the search page search engine. When we pick a symbol all the metadata from the symbols table for this symbol is laid out in a clear and concise way. Here we can edit and customise the data from the symbols table. This also comes with the different audio in all the languages. We might have to generate new audio and eventually save and seed the changes to profileSymbols so the changes will be seen in existing users profiles. A lot of the features here can use already existing infrastructure from the symbol editor.

[[ADR-013-translator-editing-and-staging-area]] suggests a surface where translators can log on to make these changes and worth having a look at when creating a spec for me to design components and screens in figma.

