---
title: Features docs — owner brief
type: note
domain: mo-speech
status: absorbed
created: 2026-09-10
summary: Owner's human-readable account of how each Mo Speech feature works today; the source brief for the M1 features docs rewrite and the PRD
tags:
  - features
related:
  - "[[01-final-straight]]"
aliases:
  - mo speech - features
  - Create features docs
linear: https://linear.app/mo-intelligence/issue/MOS-54
---
# Features docs — owner brief

> **Absorbed (2026-09-27, MOS-54).** Everything in this brief now lives in the
> feature specs. Start at [`README.md`](README.md): the layered index, FEAT-101
> to FEAT-408. This file is kept only as the record of the owner's original
> intent. Don't use it as a source. The specs are the truth.
> Source brief for **M1 — Docs truth pass** ([01-final-straight](../../01-final-straight.md)). Rewrite `4-builds/features/` as one `FEAT-NNN` spec per capability from this brief + the ADRs, then add `features/README.md` as the index (readable by marketing), then seed `5-prd/`.

The app was started from features that were mass dumped into 1-inbox/ideas and screens from figma in 3-designs. This helped us with a starting point. During building the we underwent many pivots in architecture and functionality. The ADRs clearly document this and they are best kept folder of our documentation system. Because of the journey we have been on now Mo Speech works and looks far beyond it's preconceived conceptualisation. With a mid-way conversation with a real SLT supporter from India we starter implementing GLP features. Many of these are scheduled for the next phase of development after the initial launch due to data we need to collect on the relationship of individual words in different languages from professionals that adopt Mo Speech as their go to AAC [[01-glp-introduction]].

## The problem
The problem we face from this developmental journey is that our documentation has become out of sync with reality. 1-inbox/ideas is ok to stay as is as a reference point but the 4-builds/features is where I want to define the new improved version of Mo Speech born from the wisdom of the ADRs in /decisions. Keep with the file naming convention. An attempted start has been made with the files already in features unfortunately these are corrupted by the agent as they try to explain features during a transition or wrongly using stale features from 1-inbox/ideas.

## Proposed solution
Rather than deep code based reviews of the feature or where they came from I want these docs to be descriptive, human readable accounts of how the feature works with more emphasis on the UX/UI journey and why this benefits the user as an instructor or a student. I think the first paragraph should be a bullet point index so who ever can quickly scan the feature to see what it already contains. A main reason for establishing a well documented features list is to feed truthful information into the PDR which will become our go to document for promotional and marketing material. Below are some main features that I want to start with:

**Instructor, student and Admin views**
These view are set by a dropdown on the top bar. They are a way of gating certain feature from different types of users. 
The main default view is instructor. This is view is considered the parental controller that governs what the student view can see. The instructor view comes with all UI elements and editing surfaces as visible. They can create multiple student profiles and control their viewable UI elements and the degree of editing capabilities they want on each student profile.
A student view is the result of an instructors student profile settings that are accessed from the instructor settings page. On the student's device you log in as normal and select student view in the top bar. You can then lock it so students can't get on to the instructor view and accidentally change controls. It is a know fact that some autistic AAC users ingenuitive ways of re organising their AAC set up that leaves instructors bewildered and often stuck on retrieving the previous set up. This solves that and allows instructors to slowly give their students more control the further they progress. It also allows the instructor to force concentration on particular features in the UI. For example the instructor can set the student profile to only see the sentences page.
The admin view is not customer facing. It can only be chosen on a profile that has role: admin at clerk Auth level. This is the instructor view but with extra admin features. Admin view shows extra publish features in the edit mode of the module groups. Here admin can create or update modules to become part of the default setup for new sign ups or tier specific modules that can be installed from the resource library as starter, pro and Max tiers.

**Search**
The search page is the search algorithm from the MVP. We have kept the search results displaying as you type. Each search result can be added to the [talker] and can be saved into a category. It is a simple page design to find symbols quickly in the spur of the moment.

**Categories**
Categories are a way of grouping symbols into logical relationships. By going into categories you see a list of all the categories as a tiled grid with a chosen color and thumbnail. These can be moved and edited but once personalised they should be kept in the same place so the student can build strong motor skills in navigating the app. 
The banner of each category page has 2 different modes which are toggled by the to talker toggle on the top bar. When the talker is off we have edit mode features in the category banner and when the toggle is on we have the talker visible so every symbol press gets added to the Talker so users can build sentences for communication.

**Lists**
Lists are ordered sequences of symbols with accompanying audio. Their main purpose is to assist student with task analysis. The user can view them as rows columns or grids. They can also be numbered, Frist thens and or checkboxed. Again the same universal create, edit and move function exist for content authoring. Items can be edited via the symbol editor which allows for any type of image to be used.

**Sentences**
Sentences are many symbols arranged in a particular sequence with accompanying audio to that represents a real sentence. Clicking on a sentence plays it in the play modal where it will play displaying the symbols with accompanying audio. There are 2 types of sentences:
1. Fluent sentences - This is a continuous row of single symbols combined to make one fully formed sentence. In the play modal the a block containing all the symbols highlights and the audio plays fluently. These fluent sentences can only be made from the sentence group on the sentences page.
2. Block sentences - These derive from the saved sentences from the [talker]. It is a way of combining [phrases] with single symbols. Creating sentences this way highlights and plays each block (unit in the talker) individually with a slight pause in between. This is designed to teach students how to break up and form sentences in blocks showing them how the same phrase can be reused in different sentences.
The sentences play modal also have 3 mood tts generator - angry, calm and excited. These convert both types of sentences into more expressive language.

**The talker**
The talker is an interactive interface to order symbols into sentences. It can be turned off or on by a toggle switch in the top bar. It appears in the banner of the search and category pages. When it is turned off the banner of these pages revert to standard editing options. When the talker is on any press from within the search or category page results into the pressed symbol being added to the talker as a unit which can be ordered or removed within the talker. 
The talker has a dropdown with 2 tabs: [core words] and [phrases] The idea here is to provide the user with fast access to build sentences with minimal search time.  Reusable core words and phrases are available when they are most needed regardless of in a particular category or just exploring the symbols via the search page. You have what you need to make a sentence any time the talker is on.

**Core words**
This is a tab in the [talker] and it contains the most used little words that are used to make up sentences. These have been carefully selected from research and refined from the MVP. 

**Phrases**
This is the second tab of the talker drop down. It comes with some default phrases but instructors are encouraged to make their own according to the level of their student. 
Phrases are like mini sentences. They are customisable block of one or more symbols with accompanying audio. These are added to the talk in a block and can exist among single symbols. In the play modal the phrases get highlighted in one block and moves to the next block after the audio finishes.

**Edit mode**
This is a universal concept within the app. It is located above all editable content surfaces. Pressing it turns the surface in a editable plane, where  order, images and audio can all be customised. It is available within a category, sentence, list, core word or phrase surface. After editing you must click exit edit to return the surface back to click and play mode.




## Feature index (merged: this brief + final-straight M1 list)
Start the index simple, readable for marketing as well as devs.

- Instructor / student / admin views
- Search
- Categories
- Lists
- Sentences (fluent + block)
- Phrases
- Core words
- The talker (dropdown → core words + phrases)
- Edit mode (universal)
- Symbol editor (five tabs)
- Image library (FEAT-009, requested by MOS-53)
- Modelling mode
- Languages — switching, translating user content, admin translation pipeline (UI + symbols)
- Themes
- Library modules / admin authoring / backup and restore
- Resource library
- Settings + billing — pricing and tier system
- Admin

## Links

