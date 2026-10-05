# TUTUBA web slice

Scope: browser-only TypeScript/Vite/Three.js, WebGL by default. One playable guardian (Aster), Bramble melee wardens and Rune Archers, four small encounters including an introductory encounter. Target first-time run: 10–15 minutes; pacing remains a playtest hypothesis. Restart any battle or start a new run. No Unreal runtime, physics, backend or external art.

The deterministic value model is ported from `Source/Tutuba/Private/TutubaCombatModel.cpp`. It owns integer cells, HP, shields, AP, fixed intents and Echoes. Three.js only presents snapshots/events. Every living actor starts/reset at 2 AP; no carry. Move, strike, shove, guard and Echo shift cost 1 AP. Guard adds 4 shield up to 6. Strike/shove deal 6; shove moves one adjacent enemy after damage if destination is free and on board. No collision damage or chains.

Valid attacks include empty cells and friendly areas. Each creates one fixed zone, replaying once at the next round start for max(1, floor(base damage/2)); shields never reduce recorded base damage. Echoes hit every faction, retain dead owners, do not push and do not create more Echoes. One team shift per round translates one entire Echo by one orthogonal cell; occupied cells are valid destinations. Due time and damage stay unchanged.

Round order: execute frozen enemy intents in ID order, increment round, consume due Echoes, accumulate damage using a shared position snapshot, apply damage/deaths, determine result, reset AP/shift quota and plan new intents. Both teams dying together means defeat. A terminal result clears pending Echoes/intents and rejects further actions. Enemy attacks keep their marked area after movement; a shove only succeeds if the enemy is still adjacent at execution. UI previews account for that.

Presentation: moss/stone floating diorama, ivory/cyan guardian with cape and staff, squat coral Brambles and tall violet Archers. Cyan hero, coral intent, lilac Echo zones. Mouse picking plus accessible coordinate buttons, orbit/zoom/reset camera, readable health/AP cards, explicit damage/owner/deadline/friendly-fire preview. Brief cues and animation are cosmetic. Experimental WebGPU is opt-in and falls back to WebGL on failure.

Milestones: (1) port rules and equivalent tests, (2) arena/HUD/input and complete encounter loop, (3) production build and Chrome victory/defeat/restart, (4) 1080p performance and size evidence. Completion depends on executed checks, never estimates.
