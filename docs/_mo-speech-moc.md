---
type: moc
domain: mo-speech
status: active
summary: A map of content for Mo Speech docs
title: Mo Speech - Map of Content
date: 2026-07-24
tags:
  - moc
related:
aliases:
  - Mo Speech - MOC
---
---

# Mo Speech — Map
Mo Speech Home is a full AAC (Augmentative and Alternative Communication) platform for families. An instructor creates a student profile, builds a personalised symbol library organised into categories, lists, fluent sentences, block sentences and phrases. From the MVP we found there is a gap in the market of the SymbolStix library translated into languages that use non-romanised fonts. We heard from feedback that SLPs have been told this is not possible so a big part of this project was to prove that it is possible. We are starting with English, Hindi and Spanish and Mo Speech creates a backend pipeline that machine translates the entire SymbolStix library and the UI. Each language needs a specialised human pass to catch the literalness and miss-matches that machine translation causes

---
## 1-inbox
Raw capture — dump everything here first, process it later.
File naming: **IDEA_20260723_name-of-idea.md**

---
## 2-research
Processed research with context added. Source material that informs decisions. Competitor analysis and researched topics that relate to the product market fit
File naming: **COMPETITOR_20260723_name-of-competitor.md**

---
## 3-design
Design artefacts. Visual and UX intent before it becomes code. Sketches, ui notes, moodboards, wireframes, design systems and links to the working figma files.
File naming: **DESIGN_20260723_design-system.md, DESIGN_20260723_wireframes.md, DESIGN_20260723_moddboards.md** etc

---
## 4-builds
A technical record of what was built and why. This includes decisions, plans, features and explained code
File naming: CODE_20260723_language-system-explained.md, ADR_20260723_list-item-audio.md, FEAT_20260723_categories.md, PHASE-15.7_20260723_translate-revert.md

---
## 5-prd
Product requirements. What the product needs to do and for whom.

Put here:

- User stories: `As a [user], I want to [action] so that [outcome]`
- Acceptance criteria for features
- Roadmap items with priority and rationale
- Constraints: legal, technical, business

**Rule:** PRD is the source of truth for _what_ to build. It does not describe implementation — that's `4-builds/`. If a stakeholder asks why something works a certain way, the answer is in the PRD.

AI agents read this folder to understand scope and avoid building features that weren't requested.

As Mo Speech is our first major project we are kind of reverse engineering this. So using PRD as more of a final document of shipped features to drive marketing material

