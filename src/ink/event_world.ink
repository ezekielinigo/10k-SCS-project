// JS will read this at the end of each story
VAR outcome = "" 
// External functions provided by the game engine
EXTERNAL hasStat (name, min)
EXTERNAL hasMoney (amount)

// =============================================================
//  EXAMPLE — CHROME SPIKE OVERLOAD (Random Event)
// =============================================================

=== chrome_spike_overload ===
Your neural implant spikes without warning. Vision blurs, HUD glitches, and your left arm twitches violently.

+ Brace yourself and ride it out
    ~ outcome = "failure"
    The surge passes, but damage lingers.
    -> END

{ hasStat("int", 8):
    + Override the safety limiter
        You manually re-route the implant's spike channel.
        ~ outcome = "great_success"
        -> END
}

{ hasMoney(200):
    + Trigger emergency auto-stabilizer (200c)
        ~ outcome = "success"
        -> END
- else:
    ~ outcome = "failure"
}

+ Smash the emergency shutdown button
    The implant hard-reboots. Everything goes dark.
    ~ outcome = "great_failure"
    -> END
