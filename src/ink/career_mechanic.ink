// =============================================================
//  TASK STORIES — INK TEMPLATE
//  This file contains job/event/encounter-related interactive tasks.
//  JS/TS will call the entry knot by name, e.g. "mechanic_apprentice_shift".
//  All stories MUST set "outcome" before reaching -> END.
// =============================================================

// -------------------------------------------------------------
//  GLOBAL VARIABLES
// -------------------------------------------------------------

// JS will read this at the end of each story
VAR outcome = "" 
// External functions provided by the game engine
EXTERNAL hasStat (name, min)
EXTERNAL hasMoney (amount)

// =============================================================
//  MECHANIC APPRENTICE SHIFT (EXAMPLE)
// =============================================================

=== mechanic_apprentice_shift ===
The garage floor roars awake. Steam hisses through cracked vents. Which station do you grab?

+ Tune up cars
    -> tune

+ Handle diagnostics
    -> diagnostics

=== tune ===
Lifted groundcars hover above you, humming with unstable charge. Clients pace outside, impatient.

+ Keep a steady pace
    ~ outcome = "success"
    The shift ends smoothly. You finish on time with only minor burns.
    -> END

+ Overclock the lift to clear backlog
    The lift groans as you push it beyond safety tolerances.
    -> misfire

=== diagnostics ===
The Valkarna diagnostic console vomits error codes. The system flickers in neon-red warnings.

{ hasStat("int", 7):
    + Triple-check the firmware
        You dive deep into Valkarna firmware and catch a corrupted packet.
        ~ outcome = "great_success"
        -> END
- else:
    ~ outcome = "failure"
}

+ Rush the diagnostics
    The backlog is massive; corners are cut.
    ~ outcome = "failure"
    -> END

+ Trace the weird knocking noise
    You isolate the anomaly to a faulty injector coil.
    -> misfire

=== misfire ===
A Vulcamax engine misfires violently. Sparks scatter across the bay, and a client starts panicking.

{ hasStat("chr", 6):
    + Calm the client and stabilize wiring
        You stabilize the wiring and walk the client through your plan.
        ~ outcome = "success"
        -> END
}

{ hasStat("ref", 6):
    + Dive in and reroute power manually
        With lightning reflexes, you bypass the faulty regulators.
        ~ outcome = "great_success"
        -> END
}

+ Call the supervisor to take over
    You hand it off. No shame, but no glory either.
    ~ outcome = "failure"
    -> END

+ Panic and hit the wrong circuit
    Sparks explode; sensors scream.
    ~ outcome = "great_failure"
    -> END