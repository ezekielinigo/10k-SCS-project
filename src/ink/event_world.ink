
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
VAR ch_1 = false
VAR ch_2 = false
VAR ch_3 = false
VAR ch_4 = false
VAR ch_5 = false
VAR quit_1 = false
VAR quit_2 = false
// External functions provided by the game engine
EXTERNAL hasStat (name, min)
EXTERNAL hasMoney (amount)

=== chrome_spike_overload ===
Your neural implant spikes without warning. Vision blurs, HUD glitches, and your left arm twitches violently.

{ ch_1:
    + Run a self-diagnostic throttle
        { hasStat("int", "8,10"):
            ~ outcome = "success"
            ~ delta_stress = 4
            You reroute the spike and stabilize the implant.
            -> END
        - else:
            ~ outcome = "failure"
            ~ delta_stress = 10
            The script misfires and worsens the feedback.
            -> END
        }
}

{ ch_2:
    + Flush coolant through the port (50c)
        { hasMoney(50):
            ~ delta_money = -50
            ~ outcome = "success"
            ~ delta_health = -2
            A harsh coolant flush chills the spike; you recover.
            -> END
        - else:
            ~ outcome = "failure"
            ~ delta_stress = 6
            You fumble for funds as the spike keeps burning.
            -> END
        }
}

{ ch_3:
    + Clamp the surge manually
        ~ delta_health = -6
        ~ delta_stress = 8
        ~ outcome = "success"
        You pinch the channel shut with raw pain tolerance.
        -> END
}

{ ch_4:
    + Overload the channel to burn it out
        ~ outcome = "great_failure"
        ~ delta_health = -10
        ~ delta_stress = 12
        The spike arcs; your arm goes numb.
        -> END
}

{ ch_5:
    + Ride the wave with controlled breathing
        ~ outcome = "failure"
        ~ delta_stress = -4
        You weather the spike; it fades but leaves jitters.
        -> END
}

{ quit_1:
    + Step back and let it pass
        ~ delta_stress = 2
        You let the spike pass on its own.
        -> END
}
{ quit_2:
    + Retreat quickly, keeping distance
        ~ delta_stress = 1
        You back away, keeping an eye on things.
        -> END
}

=== street_brawl ===
You stumble into a quarrel in a dark alley — someone shoves you and a fist flies.

{ ch_1:
    + Counterstrike with a tight combo
        { hasStat("closeCombat", "27,30"):
            ~ delta_health = -4
            ~ delta_stress = 6
            ~ delta_closeCombat = 1
            You land solid hits and break their stance.
            -> END
        - else:
            ~ delta_health = -10
            ~ delta_stress = 10
            They counter faster than you can react.
            -> END
        }
}

{ ch_2:
    + Grapple and disarm
        { hasStat("ref", "0,7"):
            ~ delta_health = -6
            ~ delta_closeCombat = 1
            You twist the aggressor's wrist and shove them away.
            -> END
        - else:
            ~ delta_health = -12
            ~ delta_stress = 8
            The grapple slips and you get clipped hard.
            -> END
        }
}

{ ch_3:
    + Talk them down with bravado
        { hasStat("chr", "0,7"):
            ~ delta_stress = -2
            ~ delta_health = 0
            The crowd cools as your voice cuts through.
            -> END
        - else:
            ~ delta_stress = 5
            They jeer and lunge anyway.
            -> END
        }
}

{ ch_4:
    + Flash an improvised weapon
        ~ delta_stress = 4
        ~ delta_health = -2
        The threat buys you an opening to shove them off.
        -> END
}

{ ch_5:
    + Slip into the crowd and vanish
        ~ delta_stress = 1
        You sidestep between vendors and disappear.
        -> END
}

{ quit_1:
    + Back away slowly, palms open
        ~ delta_stress = 2
        You back away slowly, palms open.
        -> END
}
{ quit_2:
    + Step aside and avoid trouble
        ~ delta_stress = 1
        You step aside and let the fight pass.
        -> END
}

=== pickpocket_encounter ===
Someone brushes your pocket — you notice a sly hand moving over your belt.

{ ch_1:
    + Clamp their wrist and frisk them
        { hasStat("int", "0,7"):
            ~ delta_money = 20
            ~ delta_stress = -2
            You recover your credits and a little extra.
            -> END
        - else:
            ~ delta_money = -10
            ~ delta_stress = 4
            The thief twists free before you lock their arm.
            -> END
        }
}

{ ch_2:
    + Call out the thief to the crowd
        { hasStat("chr", "0,7"):
            ~ delta_stress = 1
            ~ delta_money = 10
            Public shame makes them drop a pouch as they bolt.
            -> END
        - else:
            ~ delta_stress = 3
            ~ delta_money = -5
            The crowd shrugs and the thief melts away.
            -> END
        }
}

{ ch_3:
    + Shadow them to their stash
        { hasStat("stealth", "27,30"):
            ~ delta_money = 30
            ~ delta_stress = 3
            You trail them and lift more than you lost.
            -> END
        - else:
            ~ delta_stress = 2
            You lose them in a side alley and gain nothing.
            -> END
        }
}

{ ch_4:
    + Bump back and lift their wallet
        { hasStat("ref", "0,7"):
            ~ delta_money = 15
            ~ delta_stress = -1
            A quick bump returns your cash with interest.
            -> END
        - else:
            ~ delta_money = -5
            ~ delta_stress = 2
            They notice the move and shove you off balance.
            -> END
        }
}

{ ch_5:
    + Let it go but mark their face
        ~ delta_money = -10
        ~ delta_stress = 0
        You eat the loss and memorize their look for later.
        -> END
}

{ quit_1:
    + Shrug it off and move on
        ~ delta_money = -25
        ~ delta_stress = 4
        You shrug and move on, lighter by a purse.
        -> END
}
{ quit_2:
    + Let it go and blend into the crowd
        ~ delta_money = -25
        ~ delta_stress = 3
        You let it go and melt back into the people.
        -> END
}

=== street_tutoring ===
A tired old mechanic offers to show you a trick if you help with a bolt.

{ ch_1:
    + Help and learn the trick
        ~ delta_stress = -3
        ~ delta_engineering = 1
        The mechanic grins — you picked up a handy corner of the craft.
        -> END
}

{ ch_2:
    + Record the torque sequence for later
        { hasStat("int", "0,7"):
            ~ delta_engineering = 1
            ~ delta_stress = -1
            You log the pattern for future builds.
            -> END
        - else:
            ~ delta_stress = 2
            The sequence blurs in your head; nothing sticks.
            -> END
        }
}

{ ch_3:
    { hasMoney(20):
        + Offer to buy a spare part (20c)
            ~ delta_money = -20
            ~ delta_engineering = 1
            ~ delta_stress = -2
            The mechanic swaps you a clean component and a tip.
            -> END
    - else:
            ~ delta_stress = 3
            You come up short and feel awkward.
            -> END
    }
}

{ ch_4:
    + Share your own shortcut
        { hasStat("engineering", "27,30"):
            ~ delta_engineering = 1
            ~ delta_stress = -2
            They laugh and adopt your trick on the spot.
            -> END
        - else:
            ~ delta_stress = 2
            Your idea fizzles; the mechanic shrugs.
            -> END
        }
}

{ ch_5:
    + Fix their tool on the fly
        { hasStat("ref", "0,7"):
            ~ delta_engineering = 1
            ~ delta_stress = -1
            You tighten a loose linkage and win some respect.
            -> END
        - else:
            ~ delta_stress = 2
            The tool slips and clatters; no harm done.
            -> END
        }
}

{ quit_1:
    + Move on, toolbox closed
        You move on, toolbox closed.
        -> END
}
{ quit_2:
    + Thank them and walk away
        You thank them and keep moving.
        -> END
}

=== meditation_session ===
You find a quiet courtyard with a monk offering breathing guidance.

{ ch_1:
    + Sit and meditate
        ~ delta_stress = -12
        ~ delta_humanity = 2
        You feel calmer and more humane.
        -> END
}

{ ch_2:
    + Trade a mantra with the monk
        { hasStat("chr", "0,7"):
            ~ delta_humanity = 1
            ~ delta_stress = -6
            You share words and leave lighter.
            -> END
        - else:
            ~ delta_stress = -2
            The exchange is brief but still calms you.
            -> END
        }
}

{ ch_3:
    { hasMoney(10):
        + Donate 10c for incense
            ~ delta_money = -10
            ~ delta_stress = -8
            The scent helps you settle deeply.
            -> END
    }
}

{ ch_4:
    + Use biofeedback breathing
        { hasStat("int", "0,7"):
            ~ delta_stress = -9
            ~ delta_humanity = 1
            Sensors hum as your mind quiets.
            -> END
        - else:
            ~ delta_stress = -4
            The technique half-works, easing you a bit.
            -> END
        }
}

{ ch_5:
    + Watch the plaza while calming yourself
        { hasStat("stealth", "27,30"):
            ~ delta_stress = -5
            ~ delta_humanity = 0
            You stay aware yet serene.
            -> END
        - else:
            ~ delta_stress = -3
            You fail to stay unseen but still slow your pulse.
            -> END
        }
}

{ quit_1:
    + Sit and leave quietly
        Nothing changes.
        -> END
}
{ quit_2:
    + Stand and walk away
        Nothing changes.
        -> END
}

=== risky_hack ===
An opportunity to hack a small kiosk presents itself — payoffs vary.

{ ch_1:
    + Attempt a clean exploit
        { hasStat("int", "8,10"):
            ~ delta_money = 80
            ~ delta_stress = 5
            ~ delta_hacking = 1
            You slip past the kiosk guards and extract some credits.
            -> END
        - else:
            ~ delta_stress = 12
            ~ outcome = "failure"
            Your script stalls; an alarm light blinks.
            -> END
        }
}

{ ch_2:
    + Bruteforce it
        ~ delta_money = 150
        ~ delta_stress = 18
        ~ delta_hacking = 2
        It works, but the alarm chirps — you run.
        -> END
}

{ ch_3:
    + Override the safety limiter
        { hasStat("int", "8,10"):
            You manually re-route the implant's spike channel.
            ~ outcome = "great_success"
            -> END
        - else:
            ~ outcome = "failure"
            ~ delta_stress = 10
            The override fails and heat builds dangerously.
            -> END
        }
}

{ ch_4:
    { hasMoney(200):
        + Trigger emergency auto-stabilizer (200c)
            ~ outcome = "success"
            -> END
    - else:
            ~ outcome = "failure"
    }
}

{ ch_5:
    + Smash the emergency shutdown button
        The implant hard-reboots. Everything goes dark.
        ~ outcome = "great_failure"
        -> END
}

{ quit_1:
    + Skip the kiosk and keep walking
        ~ delta_stress = 2
        You skip the kiosk and keep walking.
        -> END
}
{ quit_2:
    + Walk away quickly
        ~ delta_stress = 1
        You walk away before anyone notices.
        -> END
}

=== datacache_encounter ===
You stumble upon a locked drone data cache humming behind a plex barrier.

{ ch_1:
    + Pick the lock carefully
        { hasStat("hacking", "8,10"):
            ~ delta_money = 60
            ~ delta_hacking = 1
            ~ delta_stress = -2
            The crack opens cleanly and you filch data worth several credits.
            -> END
        - else:
            ~ delta_stress = 8
            ~ delta_money = -15
            The shimmer lock spikes you with a warning pulse and security arrives.
            -> END
        }
}

{ ch_2:
    + Slip a forged access key under the seam
        ~ delta_money = 30
        ~ delta_hacking = 0
        You buy time with a fake key; the cache coughs up a small packet.
        -> END
}

{ ch_3:
    { hasMoney(50):
        + Bribe a nearby courier (50c)
            ~ delta_money = -50
            ~ delta_stress = -1
            The courier unlocks it for a cut.
            -> END
    - else:
            ~ delta_stress = 3
            The courier laughs and walks away.
            -> END
    }
}

{ ch_4:
    + Force the panel open
        ~ delta_health = -4
        ~ delta_money = 20
        You pry it open; it's noisy but effective.
        -> END
}

{ ch_5:
    + Scan for a vendor backdoor (longer, risky)
        { hasStat("hacking", "0,7"):
            ~ delta_money = 40
            ~ delta_hacking = 1
            You find a backdoor and siphon some data.
            -> END
        - else:
            ~ delta_stress = 6
            The scan trips a tamper alarm.
            -> END
        }
}

{ quit_1:
    + Let the cache blink and move on
        ~ delta_stress = -1
        You let the cache blink quietly and move along.
        -> END
}
{ quit_2:
    + Ignore it and leave
        ~ delta_stress = 0
        You ignore it and leave the area.
        -> END
}
