// =============================================================
//  COURIER CAREER — SAMPLE INK
//  Entry knot: `courier_shift`
//  Keep story-local metadata minimal — global metadata lives in careers.ts
// =============================================================

// -------------------------------------------------------------
//  GLOBAL VARIABLES
// -------------------------------------------------------------

// JS will read this at the end of each story
VAR outcome = ""
// Local accumulators for stat deltas — set during the story and applied at the end
VAR delta_money = 0
VAR delta_stress = 0
VAR delta_health = 0
VAR delta_humanity = 0
VAR affiliationId = ""
// External functions provided by the game engine
EXTERNAL hasStat (name, min)
EXTERNAL hasMoney (amount)

// =============================================================
//  COURIER SHIFT
// =============================================================

=== courier_shift ===

{ affilationId:
	- "swift_runners":	
		The swift runner client greets you with a grin.
	- "night_owl_couriers":
		The night owl client whispers the delivery instructions.
	- else:
		The client gives you a generic route and a standard tip.
}

You push through a crowded alley with a satchel bouncing against your hip. The city smells like rain and frying oil.

{ hasStat("ref", 6):
    + Zip through a narrow gap and cut the route short
        ~ outcome = "great_success"
        ~ delta_money = 200
        ~ delta_stress = -5
        You make time and impress the client with your nimble handling.
        -> END
  - else:
    + Play it safe and follow traffic lanes
        ~ outcome = "success"
        ~ delta_money = 80
        ~ delta_stress = -2
        You arrive slightly late but the package is intact.
        -> END
}

+ Take the risky shortcut through the market
    The market is chaotic — stalls, cyclists, and a distracted vendor.
    -> market_mishap

=== market_mishap ===
You bump into a vendor's stack of crates.

{ hasStat("chr", 5):
    + Smooth things over with charm
        ~ outcome = "success"
        ~ delta_money = 50
        ~ delta_stress = -3
        The vendor accepts a small tip and lets you pass.
        -> END
}

{ hasStat("ref", 7):
    + Make a daring leap and keep the package secure
        ~ outcome = "great_success"
        ~ delta_money = 220
        ~ delta_stress = -7
        You clear the crates and sprint away unscathed.
        -> END
}

+ Drop the package in the scuffle
    ~ outcome = "failure"
    ~ delta_money = -100
    ~ delta_stress = 10
    The package rips open and the client is furious.
    -> END