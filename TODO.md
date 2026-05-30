https://claude.com/cai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri=http://localhost:60661/callback&scope=org:create_api_key+user:profile+user:inference+user:sessions:claude_code+user:mcp_servers+user:file_upload&code_challenge=GubWJshMuXvG-wwCSq2C7k02x-dUC-Fx6FVn7hvXtbI&code_challenge_method=S256&state=w8f1B9zD0XM1dnT0W00ErQv48zWhXCgdwdxd2dquWMM

There are times, when all of a persons farms grow on their turn, even though they didnt land on a grow tile or get a dice roll number match with a revealed grow tile.

There are also times when a grow tile is triggered, the last farm to be grown during the grow chain effect, does not grow bananas. This usually happens when there is only one grow tile is active, and occurs usually in the second turn of each player, which is the first rolling turn.

To avoid these things from happening, here is a specific definition of the grow logic, and when grows should happen.

grow logic: a grow tile is triggered when stepped on, or when the number on it matches a players' dice roll. When a grow tile is triggered, it sends a chain of light, step by step, the same color as the player who is on their turn, until it hits a revealed grow tile, whether it is itself or another revealed grow tile. Farms that are revealed and hit by this light, and match the color as this light grow the amount that is shown on their tile aka 'their yield', which is represented by a counter known as the banana counter box.

Here is also the strict definitions of the collection and steal logic:

Collection rule/logic: You collect bananas that are on your farms merely by stepping on or through them.

Steal rule/logic: You can collect another persons bananas by stepping off of a tile that was owned by this other person and it had bananas in it before you stepped off.

small changes/updates:

changes/updates to make:

- improve the cell phone apps. The message app, the emote app, the log app, and the quick reference rule book.

- show a nice looking tool tip describing what each special item does when you hover over them in the special items section in the right hand side bar.

- improve the monkey poker notification/animation and make it match (lookwise and feelwise) with the rest of the game more.

- remove 'players' from the board variation page.

- swap the order of the public lobbies tab and the enter code tab in the join game page.

- make the super banana amount adjustable. 777 banana by default.
- make the free bananas (which is currently locked at +25) adjustable as well. 25 bananas by default

- add an option to adjust the bid timers for farm auctions as well. 15 seconds by default.

make the farms and the banana counts on the left side bard in the owned farms sections and the farm chart section larger and more visible. This may require you to make the left side bar wider overall. Consider enlarging the rest of what is in the side bar as well.

updates:

MAKE SURE THAT THIS IS CONSISTENT THROUGHOUT THE CODE:

banana loss/gain animations (what they are and when they should happen in game):

when a player LOSES bananas, the following must happen visually: The players score goes down (wheel style) while it is red color. The amount of bananas they lost is shown near their score with a floater showing how much they lost with a negative sign and red text. Lastly, whenever a player loses bananas, the amount of bananas they just lost should fly out of their piece (but only up to 7 banana emojis), aka the 'banana flying out animation'. IMPORTANT: All of these should happen simultaneously to when a player loses their bananas.

when a player GAINS bananas: The players score goes up (wheel style) while it is green color. The amount of bananas they gained is shown near their score with a floater showing how much they lost with a positive sign and green text. Lastly, whenever a player loses bananas, the amount of bananas they just lost should rain down on them (but only up to 7 bananas), aka the 'banana rain animation'. IMPORTANT: all of these animations should happen simultaneously to when a player gains bananas.

Also make sure that these animations never occur else where.

general tasks:

- make sure 2v2 is working

- make sure player leave functionality is working

- update and improve rule book

- play a game with no toggles on

specific tasks:

- allow players to switch teams in the 2v2 game lobby.

- for the item auction wheel spin, the wheel pegs should move with the wheel but they stay locked in place.

there was a case, early on in the game where one of my farms did not grow even though it was in the grow bounds of the grow tile i just triggered. This usually happens when there is only one grow tile revealed so far, and it is usually the last farm to be grown that doesnt grow anything at all, especially when it was recently bought. Look into this and try to fix it to the best of your ability. Remember that when there is only one grow tile revealed, it essentially acts as a global grow tile, which grows all of the farms of the person who triggered it on their turn.
