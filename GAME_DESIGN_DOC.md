# GUIDE ON HOW TO ADD NEW INK ENCOUNTERS/STORIES

1. Write the story inside the .ink files

	players should have about equal chance to succeed with a stat check
	this is done by giving them multiple ways to tackle the problem via skills/subskills/held items
	to keep encounters fresh:

		5-10 hidden solutions
		3-5 only are randomly chosen to be shown
		1 fallback/abort option to skip the encounter safely or with minimal losses

	example solutions:

		STR - physical force / tool use
		INT - logic solutions
		REF - finesse / flexibility / mobility
		CHR - social / bribe / work arounds
		SKIP - abort / partial reward / escape (always shown)
		item, cyberware, consumable based - 
			if has_item:
				always show this option
			else:
				equal random chance of being shown (but locked/unclickable)

	each of these solutions also use this guide when randomly choosing DC:

		DIFFICULTY			DC RANGE
		trivial				[0, 7]
		easy				[8, 10]
		standard			[11, 14]
		challenging			[15, 18]
		hard				[19, 22]
		very hard			[23, 26]
		near impossible		[27, 30]

2. Compile to .json

	node ./compileInk.js

3. add record to corresponding .ts file

	randomEvents.ts		random world events, encounters
	careers.ts		 	monthly work and job tasks
	TBA					more to come!

