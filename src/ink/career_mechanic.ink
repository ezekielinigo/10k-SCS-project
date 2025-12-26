// =============================================================
//  TASK STORIES — INK TEMPLATE
//  This file contains job/event/encounter-related interactive tasks.
//  JS/TS will call the entry knot by name, e.g. "mechanic_apprentice_shift".
// =============================================================

// -------------------------------------------------------------
//  GLOBAL VARIABLES
// -------------------------------------------------------------

// JS will read deltas at the end of each story
// Local accumulators for stat deltas — set these during the story and the app will apply them once at the end
VAR delta_money = 0
VAR delta_stress = 0
VAR delta_health = 0
VAR delta_humanity = 0
VAR delta_engineering = 0
VAR delta_hacking = 0
VAR delta_mobility = 0
// External functions provided by the game engine
EXTERNAL hasStat (name, min)
EXTERNAL hasMoney (amount)

// =============================================================
//  MECHANIC APPRENTICE SHIFT (EXAMPLE)
// =============================================================

=== mechanic_apprentice_shift ===
The garage floor roars awake. Steam hisses through cracked vents. As the junior on duty, you get pulled to the next urgent task.

~ temp _pick = RANDOM(1,3)

{
    - _pick == 1: -> apprentice_tune
    - _pick == 2: -> apprentice_diag
    - _pick == 3: -> apprentice_quickfix
}

=== apprentice_tune ===
// A noisy tune-up station with a balky carburetor — hands-on work.
{ hasStat("engineering", "11,14"):
 	 ~ delta_money = 100
 	 ~ delta_engineering = 1
 	 ~ delta_stress = -3
 	 You methodically reflow connectors, recalibrate the timing, and the engine sings again.
 	 -> END
 - else:
 	 ~ delta_money = -20
 	 ~ delta_stress = 6
 	 You miss a worn gasket and the car coughs; the client grumbles.
 	 -> END
}

=== apprentice_diag ===
// Diagnostic console throwing cryptic error codes — logic and pattern matching.
{ hasStat("int", "8,10"):
 	 ~ delta_money = 180
 	 ~ delta_hacking = 1
 	 ~ delta_stress = -6
 	 You trace a corrupted packet, patch the firmware and extract bonus billable time.
 	 -> END
 - else:
 	 ~ delta_money = -40
 	 ~ delta_stress = 8
 	 The fix stalls and you reboot the module; the issue lingers.
 	 -> END
}

=== apprentice_quickfix ===
// A frantic client demands instant action — fast hands and steady nerves.
{ hasStat("ref", "0,7"):
 	 ~ delta_money = 80
 	 ~ delta_mobility = 1
 	 ~ delta_stress = -2
 	 You improvise a quick bypass and the vehicle limps out with a grateful nod.
 	 -> END
 - else:
 	 ~ delta_money = -120
 	 ~ delta_stress = 14
 	 ~ delta_health = -5
 	 Your quick attempt backfires; sparks fly and the client is furious.
 	 -> END
}
