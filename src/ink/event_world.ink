// JS will read this at the end of each story
VAR outcome = "" 
// VARIABLES
VAR delta_money = 0
VAR delta_stress = 0
VAR delta_health = 0
VAR delta_humanity = 0
VAR delta_closeCombat = 0
VAR delta_engineering = 0
VAR delta_hacking = 0
// External functions provided by the game engine
EXTERNAL hasStat (name, min)
EXTERNAL hasMoney (amount)

=== chrome_spike_overload ===
Your neural implant spikes without warning. Vision blurs, HUD glitches, and your left arm twitches violently.

+ Brace yourself and ride it out
    ~ outcome = "failure"
    The surge passes, but damage lingers.
    -> END

=== street_brawl ===
You stumble into a quarrel in a dark alley — someone shoves you and a fist flies.

+ Try to fight them off
    ~ delta_health = -8
    ~ delta_stress = 10
    ~ delta_closeCombat = 1
    The scuffle leaves you bruised but your reflexes feel sharper.
    -> END

+ Avoid and walk away
    ~ delta_stress = 2
    You slip away into the crowd, heart pounding but unhurt.
    -> END

=== pickpocket_encounter ===
Someone brushes your pocket — you notice a sly hand moving over your belt.

{ hasStat("int", 7):
    + Spot the thief and stop them
        ~ delta_money = 20
        ~ delta_stress = -2
        You catch the pickpocket and recover some of their loot.
        -> END
}

+ Lose the coin purse
    ~ delta_money = -25
    ~ delta_stress = 6
    You fumble and lose a few coins before you notice.
    -> END

=== street_tutoring ===
A tired old mechanic offers to show you a trick if you help with a bolt.

+ Help and learn the trick
    ~ delta_stress = -3
    ~ delta_engineering = 1
    The mechanic grins — you picked up a handy corner of the craft.
    -> END

+ Politely decline
    You move on, toolbox closed.
    -> END

=== meditation_session ===
You find a quiet courtyard with a monk offering breathing guidance.

+ Sit and meditate
    ~ delta_stress = -12
    ~ delta_humanity = 2
    You feel calmer and more humane.
    -> END

+ Ignore and leave
    Nothing changes.
    -> END

=== risky_hack ===
An opportunity to hack a small kiosk presents itself — payoffs vary.

{ hasStat("int", 8):
    + Attempt a clean exploit
        ~ delta_money = 80
        ~ delta_stress = 5
        ~ delta_hacking = 1
        You slip past the kiosk guards and extract some credits.
        -> END
}

+ Bruteforce it
    ~ delta_money = 150
    ~ delta_stress = 18
    ~ delta_hacking = 2
    It works, but the alarm chirps — you run.
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
