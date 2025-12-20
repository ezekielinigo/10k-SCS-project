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
// Local accumulators for stat deltas — set these during the story and the app will apply them once at the end
VAR delta_money = 0
VAR delta_stress = 0
VAR delta_health = 0
VAR delta_humanity = 0
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
    ~ delta_money = 120
    ~ delta_stress = -5
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
    ~ delta_money = 250
    ~ delta_stress = -15
    ~ delta_humanity = 3
    -> END
- else:
    ~ outcome = "failure"
    ~ delta_money = -60
    ~ delta_stress = 12
}

+ Rush the diagnostics
    The backlog is massive; corners are cut.
    ~ outcome = "failure"
    ~ delta_money = -60
    ~ delta_stress = 12
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
    ~ delta_money = 120
    ~ delta_stress = -5
    -> END
}

{ hasStat("ref", 6):
    + Dive in and reroute power manually
        With lightning reflexes, you bypass the faulty regulators.
    ~ outcome = "great_success"
    ~ delta_money = 250
    ~ delta_stress = -15
    ~ delta_humanity = 3
    -> END
}

+ Call the supervisor to take over
    You hand it off. No shame, but no glory either.
    ~ outcome = "failure"
    ~ delta_money = -60
    ~ delta_stress = 12
    -> END

+ Panic and hit the wrong circuit
    Sparks explode; sensors scream.
    ~ outcome = "great_failure"
    ~ delta_money = -150
    ~ delta_stress = 20
    ~ delta_health = -10
    -> END


// =============================================================
//  MECHANIC SENIOR SHIFT
// =============================================================

=== mechanic_senior_shift ===
The garage is buzzing with activity. Junior mechanics look to you for guidance.
+ Oversee engine repairs
    -> engine_repairs
+ Manage customer relations
    -> customer_relations

=== engine_repairs ===
A high-profile client's vehicle has a critical engine failure. Time is ticking.
{ hasStat("int", 8):
    + Diagnose the engine personally
        You identify a rare fuel injector fault.
    ~ outcome = "great_success"
    ~ delta_money = 400
    ~ delta_stress = -10
    ~ delta_humanity = 5
    -> END
- else:
    ~ outcome = "failure"
    ~ delta_money = -100
    ~ delta_stress = 15
}
+ Delegate to a junior mechanic
    The junior fumbles the repair under pressure.
    ~ outcome = "failure"
    ~ delta_money = -100
    ~ delta_stress = 15
    -> END
+ Rush the repair to meet the deadline
    Mistakes are made in the haste.
    ~ outcome = "great_failure"
    ~ delta_money = -250
    ~ delta_stress = 25
    ~ delta_health = -5
    -> END
=== customer_relations ===
A disgruntled customer storms in, furious about a previous repair.
{ hasStat("chr", 7):
    + Calm the customer with empathy
        You listen and address their concerns sincerely.
    ~ outcome = "great_success"
    ~ delta_money = 300
    ~ delta_stress = -10
    ~ delta_humanity = 5
    -> END
- else:
    ~ outcome = "failure"
    ~ delta_money = -80
    ~ delta_stress = 10
}
+ Offer a discount on future services
    The customer grudgingly accepts.
    ~ outcome = "success"
    ~ delta_money = -50
    ~ delta_stress = -5
    -> END
+ Stand your ground and refuse to budge
    The customer leaves, vowing never to return.
    ~ outcome = "great_failure"
    ~ delta_money = -150
    ~ delta_stress = 15
    -> END 