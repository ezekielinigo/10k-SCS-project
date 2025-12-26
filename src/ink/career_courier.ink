// =============================================================
//  COURIER CAREER — POPULATED STORIES
//  Entry knot: `courier_shift`
//  Keep story-local metadata minimal — global metadata lives in careers.ts
// =============================================================

// -------------------------------------------------------------
//  GLOBAL VARIABLES
// -------------------------------------------------------------

// JS will read deltas at the end of each story
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

{ affiliationId:
	- "swift_runners":
		The swift runner client greets you with a grin.
	- "night_owl_couriers":
		The night owl client whispers the delivery instructions.
	- else:
		The client gives you a generic route and a standard tip.
}

You push through a crowded alley with a satchel bouncing against your hip. The city smells like rain and frying oil.

~ temp _pick = RANDOM(1,6)

{
	- _pick == 1: -> courier_narrow_escape
	- _pick == 2: -> courier_rainy_delivery
	- _pick == 3: -> courier_high_value_package
	- _pick == 4: -> courier_late_night_run
	- _pick == 5: -> courier_traffic_jam
	- _pick == 6: -> courier_special_run
}

// -------------------------------------------------------------
//  Story knots
// -------------------------------------------------------------

=== courier_narrow_escape ===
The alley narrows; a gang springs from shadow. You have seconds to choose how to handle it.

~ delta_stress += 1

+ Try to run past them.
	~ delta_health -= 1
	~ delta_money += 5
	-> courier_finish

+ Throw a smoke flare to create cover.
	~ delta_money -= 2
	~ delta_stress -= 1
	~ delta_humanity += 1
	-> courier_finish

+ Stand and bargain.
	~ delta_money += 8
	~ delta_stress += 2
	-> courier_finish

=== courier_rainy_delivery ===
The rain soaks everything. Your package is wrapped, but water finds a way.

~ delta_stress += 1

+ Rush and deliver immediately.
	~ delta_money += 10
	~ delta_humanity += 0
	-> courier_finish

+ Stop and rewrap the package carefully.
	~ delta_stress += 2
	~ delta_money += 5
	~ delta_humanity += 1
	-> courier_finish

+ Toss the package in a locker to dry.
	~ delta_money += 0
	~ delta_humanity -= 1
	-> courier_finish

=== courier_high_value_package ===
You carry something that radiates importance. Two uniformed guards check IDs at the stairwell.

~ delta_stress += 2

+ Present legitimate credentials.
	{ hasStat("bribery", 1):
		~ delta_money += 15
	- else:
		~ delta_stress += 1
		~ delta_money += 5
	}
	-> courier_finish

+ Ask the client for a courier escort.
	~ delta_money += 5
	~ delta_stress -= 1
	-> courier_finish

=== courier_late_night_run ===
The city at night has different rules — quieter streets, louder bargains. A shadowed figure offers you extra coin for a side-delivery.

~ delta_stress += 1

+ Accept the side-delivery.
	~ delta_money += 20
	~ delta_humanity -= 1
	-> courier_finish

+ Decline and stick to the manifest.
	~ delta_money += 8
	~ delta_humanity += 1
	-> courier_finish

+ Take it but replace the package with a decoy.
	~ delta_stress += 2
	~ delta_money += 15
	~ delta_humanity -= 1
	-> courier_finish

=== courier_traffic_jam ===
Your hover-bike stalls in a congested thoroughfare. A crowd gathers; tempers flare.

~ delta_stress += 1

+ Push the bike to the side and walk the last mile.
	~ delta_health -= 1
	~ delta_money += 5
	-> courier_finish

+ Wait and try to finesse traffic with a bribe.
	~ delta_money -= 3
	~ delta_stress -= 1
	-> courier_finish

+ Offload the package to a nearby vendor for short-term keeping.
	~ delta_humanity += 1
	~ delta_money += 2
	-> courier_finish

=== courier_special_run ===
You stumble into a run that smells like trouble: coded labels, nervous clients, and a hidden compartment in the satchel.

~ delta_stress += 2

+ Inspect the hidden compartment.
	~ delta_humanity -= 1
	{ hasMoney(100):
		~ delta_money += 30
	- else:
		~ delta_money += 10
	}
	-> courier_finish

+ Deliver without looking.
	~ delta_money += 12
	-> courier_finish

++ Turn it in to an authority.
	~ delta_humanity += 2
	~ delta_stress += 1
	-> courier_finish

// -------------------------------------------------------------
//  Finish knot — apply results and exit to engine
// -------------------------------------------------------------

=== courier_finish ===
// The engine will read `delta_money`, `delta_stress`, `delta_health`, `delta_humanity`.

-> END