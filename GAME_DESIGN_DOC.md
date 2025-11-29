Cyberpunk Life Sim – Game Design Overview
1. Project Summary

A text-driven cyberpunk life simulation inspired by BitLife and Stick RPG 2.
The player lives month-by-month in a dystopian city, balancing stress, money, health, relationships, factions, and jobs while progressing toward unique careers, cyberware builds, and narrative events.

This project is built as a web-based game using React + TypeScript, with a long-term goal of adding InkJS for major branching story events.

2. Core Gameplay Loop

The game progresses in monthly turns.
Each month the player:

Receives a set of TODO tasks (jobs, bills, random events, responsibilities).

Clicks tasks to open choice-based narrative modals.

Choices modify stats, relationships, money, stress, or world state.

Once all required tasks are resolved, the player can Advance Month.

The flow resembles BitLife's year-by-year progression, but with more systems interacting per month.

3. Player Stats

The player maintains several key stats:

Primary Skills

STR – strength

INT – intelligence

REF – reflexes

CHR – charisma

Life Stats

Health

Humanity

Stress

Money

Lifestyle (lawful, risky, underground)

Stats influence:

job outcomes

random events

relationship checks

cyberware malfunctions

district dangers

faction interactions

4. Stress System

Stress is central to pacing.

Jobs, responsibilities, and dangerous tasks increase stress.

Leisure, nightlife, and drugs reduce stress slightly (risky).

Resting reduces stress the most, but consumes the whole month.

High stress triggers negative events, mistakes, and cyberware glitches.

5. District System

Each district has hidden stats:

security

civil unrest

economy

controlling faction

season/time of year

These influence:

random event pools

job quality

ambush rate

district-specific story hooks

6. Tasks

At the start of each month, the game generates a small set of tasks:

Types include:

job (earn money, gain stress)

bill/responsibility (mandatory payments)

randomEvent (choice-based narrative)

maintenance (cyberware repairs, upkeep)

world notifications (rent out properties, tax notices)

Each task is resolved with a click:
It opens a modal → shows a short story → offers 1–2 choices → applies effects → adds a log entry.

7. NPC System
Procedural NPCs

Generated with:

name

avatar

age

STR, INT, REF, CHR

trust %

relationship %

hidden info:

influence

karma

values/ambitions

occupation

affiliation

weapon

disposition (loyal, opportunistic, unstable, manipulative, etc.)

They appear in:

random events

job interactions

relationship scenes

district encounters

Hidden traits unlock as trust increases.

Unique NPCs

Handcrafted characters tied to factions or major quests (not implemented in micro prototype yet).
Include:

unique appearance descriptors

special cyberware

stat-specific missions

ally/enemy routes

unique rewards

8. Log System

Every action writes a line into the log panel:

task resolutions

event outcomes

month changes

major stat shifts

relationship developments

The log is the player’s “life history.”

9. Inventory and Assets

Initially minimal.
Future categories include:

vehicles

cyberware

weapons

utilities

clothing

properties

owned businesses

Each asset has upkeep, risk, or bonuses.

(Not implemented in micro prototype; placeholder inventory structure exists.)

10. Future Expansion Systems (Not in Micro Prototype Yet)

These are planned for later iterations:

lifestyle presets (lawful, risky, underground)

faction reputation and faction wars

Dead Zone scavenging

cyberpsychosis risk

businesses and passive income

unique NPC arcs (InkJS-driven)

district map UI

major careers and endings

achievements and collection items

The micro prototype should focus only on the core loop and basic data structures.

11. Technical Architecture
Frontend

React + TypeScript + Vite

Game UI consists of:

PlayerSummary

TaskList

LogPanel

AdvanceMonthButton

State Management

Single global gameState managed by:

React Context

Reducer (gameReducer.ts)

Data Separation

gameState = runtime state

/templates folder = static config (job templates, event templates)

NPC generator functions create procedural NPCs from templates.

Future Integration

InkJS for story scripting

localStorage saves

seeded RNG for reproducible worlds

12. Micro Prototype Goal

The goal of this first prototype is to verify:

monthly progression feels good

basic branching tasks work

stress affects gameplay

simple NPC interactions work

log system feels readable

reducer flow is manageable

No stylized UI or large content required yet.

13. Current Status

React + TypeScript project initialized

Game context and reducer implemented

Dummy tasks generate each month

Tasks can be resolved

Log updates

Next-month button works

Next priority:
Add stat effects, simple stress logic, basic NPC generation, and cloned content templates.

END OF DOCUMENT