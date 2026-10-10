# Builds js/missions.js: the 16 story missions in the original's order (see rh_ref/spec/missions/).
# New maps are drawn with mapkit (maps_a / maps_b); missions whose old maps already followed the original's
# layout are carried over from the previous campaign (rh_ref/spec/old_missions.json) and re-placed.
import json, math, copy
from maps_a import m01
from maps_b import m02, m06, m07, m08, m10, m15
S, W, N, E = math.pi / 2, math.pi, -math.pi / 2, 0.0
OLD = {m['id']: m for m in json.load(open('/workspace/rh_ref/spec/old_missions.json'))}
def old(k, **kw):
    m = copy.deepcopy(OLD[k]); m.pop('idx', None); m.update(kw); return m
def G(x, y, t=None, looks=None, route=None, **kw):
    d = {'route': route or [[x, y, 0]]}
    if t: d['type'] = t
    if looks is not None: d['looks'] = looks
    d.update(kw); return d
P = lambda pts: [list(p) for p in pts]
TOWN = {'York': [33, 30], 'Lincoln': [66, 33], 'Derby': [30, 50], 'Nottingham': [55, 56], 'Leicester': [64, 69], 'Sherwood': [47, 47]}
MS = []
# ---------------------------------------------------------------- 1 Lincoln, day: find the ally's servant, then his daughter
MS.append(dict(
    id='m1', rank=0, theme='castle', title='The Steward\u2019s Kitchen', place='Lincoln castle', town='Lincoln', kind='story', horn=False,
    type='Find an ally', climbs=[[14, 17, 14, 15]],
    intro='Home from the Crusade, Robin of Locksley finds his lands seized and his name on a warrant. His one friend in Lincoln, Sir Aldous, has not been seen for a week; only old Wat, his steward, might know why.\n\nWat works the castle kitchen now. Get over the wall, find him, and keep out of the guards\u2019 green sight. Beggars hear everything; a coin may loosen a tongue.',
    outro='Gisela wipes the flour from her hands. \u201cSir Aldous was taken in the night. And they will hang your old lieutenant, Will Stutely, at Nottingham\u2019s gallows cross on market day.\u201d\n\nRobin pulls up his hood. Sherwood, then, and Nottingham after.',
    heroes={'robin': [6, 18]}, need=['robin'],
    coach={'walk': [9, 18], 'bush': [11, 17], 'inside': [13, 2, 27, 15]},
    exit={'x': 19, 'y': 29, 'w': 4, 'h': 2},
    objectives=['meet:wat', 'meet:gisela', 'exit'],
    contacts=[
        {'id': 'wat', 'name': 'Old Wat', 'x': 20, 'y': 6, 'look': 2, 'say': '\u201cMaster Robin! They said you died in the Holy Land.\u201d Wat drops his voice. \u201cSir Aldous is gone, taken by the Sheriff\u2019s friends. My Gisela in the village below knows the rest. Go to her, and mind the drawbridge winch; it squeals.\u201d', 'reveals': ['gisela']},
        {'id': 'gisela', 'name': 'Gisela', 'x': 23, 'y': 23, 'look': 3, 'hidden': True, 'female': True, 'say': '\u201cSo you\u2019re the one Father talks about.\u201d'}],
    beggars=[{'id': 'b1', 'x': 16, 'y': 13, 'price': 10, 'pays': ['s1'], 'say': ['The steward? Feeds the guards in the kitchen, north side. The garden behind the hall has a purse in the roses, if you\u2019re quick.']}],
    scrolls=[{'id': 's1', 'x': 25, 'y': 10, 'hidden': True, 'gold': 20, 'text': 'Tucked in the rose bed: a purse and a note. \u201cThe drawbridge winch stands by the gate. Pull it and the bridge comes down.\u201d'}],
    props=[
        {'id': 't1', 'kind': 'target', 'x': 14, 'y': 8, 'lure': ['yard'], 'to': [24, 14], 'label': '\U0001F3AF Shoot the archery target', 'say': '\u201cOh, a lovely shot!\u201d The bowmen wander off to argue about it.'},
        {'id': 't2', 'kind': 'target', 'x': 14, 'y': 10, 'lure': ['yard'], 'to': [24, 14], 'label': '\U0001F3AF Shoot the archery target', 'say': '\u201cOh, a lovely shot!\u201d The bowmen wander off to argue about it.'},
        {'id': 'bridge', 'kind': 'lever', 'x': 22, 'y': 15, 'gate': [[20, 16], [21, 16], [20, 17], [21, 17], [20, 18], [21, 18]], 'say': 'The drawbridge thunders down over the moat.'}],
    guards=[
        G(17, 9, 'soldier', [W, W - 0.4, W + 0.3], tag='yard'),
        G(17, 11, 'archer', [W, W + 0.4, W], tag='yard'),
        G(0, 0, None, route=[[19, 7, 2], [26, 7, 2]]),
        G(0, 0, None, route=[[15, 22, 2], [19, 22, 1], [19, 27, 2], [15, 26, 1]]),
        G(24, 19, 'soldier', [S, S - 0.5, E, S]),
    ],
    civilians=[[16, 25], [8, 23], [26, 19]],
    gold=[[2, 23, 10], [27, 28, 15], [13, 14, 10]], clovers=[[27, 12]],
    reward=30,
    tips=[{'id': 'pause', 'when': 'time40', 'text': 'Tip: tap \u23F8 any time to stop the clock. You can still give orders while paused, then tap Resume.'}],
    map=m01().rows()))
# ---------------------------------------------------------------- 2 Nottingham, day: the gallows rescue
MS.append(dict(
    id='m2', rank=1, theme='town', title='The Gallows Cross', place='Nottingham market', town='Nottingham', kind='story',
    type='Public rescue', captive=[15, 12],
    intro='At noon the Sheriff hangs Will Stutely and two of Robin\u2019s old company at the gallows cross in Nottingham market.\n\nThe gate guards are lazy and one is asleep: walk in quietly. Five soldiers stand round the gallows. A purse thrown where they can all see it starts a brawl.',
    outro='Stutely rubs his neck. \u201cThat rope was tighter than my wife\u2019s purse strings.\u201d The freed men melt into the crowd and out through the gate.\n\nThat night the camp in Sherwood has two more mouths to feed, and every one of them can tie a knot.',
    heroes={'robin': [15, 30]}, need=['robin'],
    exit={'x': 12, 'y': 31, 'w': 6, 'h': 2},
    prisoners=[{'id': 'stutely', 'x': 14, 'y': 12}],
    objectives=['free:stutely', 'exit'],
    guards=[
        G(13, 24, 'soldier', [S, S - 0.6, S]), G(16, 24, 'soldier', [S, S + 0.6, S], watch=True),
        G(21, 11, 'soldier', [W, W - 0.5, S]),
        G(12, 11, None, [S, S - 0.4]), G(17, 11, None, [S, S + 0.4]), G(12, 14, None, [E, E + 0.4]), G(17, 14, None, [W, W - 0.4]),
        G(0, 0, None, route=[[11, 16, 1], [11, 9, 1]]),
        G(0, 0, 'officer', route=[[9, 8, 1], [20, 8, 1]]),
        G(14, 4, 'knight', [S, S - 0.5, S + 0.5], purse=25),
    ],
    nobles=[[16, 4]], civilians=[[13, 17], [18, 20], [7, 22], [24, 22], [4, 11]],
    beggars=[{'id': 'b1', 'x': 9, 'y': 27, 'price': 10, 'pays': ['s1'], 'say': ['Stutely? They\u2019ll string him up at noon. The guards round the gallows love money more than they love each other.']}],
    scrolls=[{'id': 's1', 'x': 4, 'y': 6, 'hidden': True, 'gold': 25, 'text': 'On the roof-ladder of a west-side house, a purse and a scrawl: \u201cThe church knight carries the Sheriff\u2019s tithe.\u201d'}],
    gold=[[25, 4, 15], [3, 22, 10], [26, 26, 10]], clovers=[[24, 3]],
    reward=40,
    tips=[{'id': 'purse', 'when': 'start', 'text': 'Robin fights with a sword, so a fight kills. Knock guards out from behind instead, or toss a \U0001F4B0 purse where several can see it: they brawl over it.'}],
    map=m02().rows()))
# ---------------------------------------------------------------- 3 Leicester, night: Will Scarlet (old map: castle, moat, fields)
m = old('m3', rank=2, theme='castle', place='Leicester castle', town='Leicester', title='Lanterns at Leicester')
m['heroes'] = {('stutely' if k == 'john' else k): v for k, v in m['heroes'].items()}
m['need'] = ['robin']
MS.append(m)
# ---------------------------------------------------------------- 4 Nottingham, night: the confessional (beggar chain)
m = old('m4', rank=3, theme='town', place='Nottingham, St Mary\u2019s', town='Nottingham')
m['heroes'] = {('stutely' if k == 'john' else k): v for k, v in m['heroes'].items()}
for c in m['contacts']: c.pop('joins', None)
m['outro'] = m['outro'] + '\n\nMarian will not come to Sherwood, not yet: she is more use to the band with the Sheriff\u2019s ear.'
MS.append(m)
# ---------------------------------------------------------------- 5 Derby, fog: Prince and outlaw (Marian joins for the night)
m = old('m5', rank=4, theme='castle', place='Derby castle', town='Derby')
m['heroes'] = {('stutely' if k == 'john' else k): v for k, v in m['heroes'].items()}
m['need'] = ['robin', 'marian']
MS.append(m)
def retext(m, pairs):
    for k in ('intro', 'outro', 'title', 'place'):
        if k in m:
            for a, b in pairs: m[k] = m[k].replace(a, b)
    for t in m.get('tips', []):
        for a, b in pairs: t['text'] = t['text'].replace(a, b)
    for lst in ('props', 'contacts', 'scrolls'):
        for p in m.get(lst, []):
            for f in ('say', 'text', 'wait'):
                if isinstance(p.get(f), str):
                    for a, b in pairs: p[f] = p[f].replace(a, b)
    return m
retext(MS[2], [('Ravenscar', 'Leicester'), ('rope down for John', 'rope down for Stutely')])
retext(MS[3], [('Blackmere keep', 'Derby castle')])
retext(MS[4], [('Blackmere keep', 'Derby castle'), ('Blackmere', 'Derby'), ('Tuck\u2019s cousin', 'a friar\u2019s cousin')])
# ---------------------------------------------------------------- 6 Forest village, day: free Little John (staff, no swords)
MS.append(dict(
    id='m6', rank=5, theme='forest', title='Smoke over Wychwood', place='Wychwood village', town='Sherwood', kind='story', staff=True,
    type='Village liberation',
    intro='The Sheriff\u2019s men are burning Wychwood for unpaid taxes. They have caught a giant of a man who tried to stop them, and they mean to hang him at the crossroads.\n\nThis is forest work: Robin carries a quarterstaff today, so every blow knocks out instead of killing. Five soldiers block the west road where the old folk want to flee, and an execution is being readied in the north-east.',
    outro='The giant shakes off the last rope. \u201cJohn Little, they call me, or Little John to wits like you.\u201d He grins. \u201cYou fight well for a small man.\u201d\n\nSherwood has its strongest arm. And the villagers of Wychwood will remember who came when the smoke rose.',
    heroes={'robin': [13, 29], 'stutely': [14, 29], 'scarlet': [12, 29]}, need=['robin'],
    exit={'x': 15, 'y': 29, 'w': 3, 'h': 2},
    prisoners=[{'id': 'john', 'x': 16, 'y': 6}], captive=[25, 4],
    objectives=['free:john', 'exit'],
    triggers=[{'id': 'shack', 'x': 14, 'y': 4, 'w': 5, 'h': 4, 'reinforce': [[19, 6, 'knight']], 'say': 'A knight bursts out of the shack!'}],
    guards=[
        G(5, 17, None, [E, E + 0.4]), G(6, 15, None, [E, E - 0.3]), G(7, 18, None, [E]), G(4, 16, 'archer', [E, E + 0.5]), G(8, 16, 'officer', [E, E - 0.6, E + 0.6]),
        G(15, 14, None, [S, S - 0.5]), G(18, 15, None, [W, W + 0.4]), G(15, 18, 'archer', [S, E]),
        G(15, 8, 'archer', [S, S + 0.4]), G(17, 8, None, [S, S - 0.4]), G(16, 4, None, [S, S + 0.5]),
        G(23, 4, 'archer', [E, E + 0.3]), G(24, 6, 'archer', [N, N + 0.4]), G(26, 6, 'officer', [W, N]),
        G(0, 0, None, route=[[20, 16, 2], [29, 16, 2]]),
        G(0, 0, 'knight', route=[[16, 19, 3], [16, 22, 3]], purse=20),
    ],
    civilians=[[14, 25], [12, 22], [20, 23], [10, 14], [27, 15]],
    beggars=[{'id': 'b1', 'x': 28, 'y': 17, 'price': 10, 'pays': ['s1'], 'say': ['They\u2019ve got a giant tied by the old shack, north road. Mind the archers either side of him, they\u2019d shoot their own mothers.']}],
    scrolls=[{'id': 's1', 'x': 25, 'y': 11, 'hidden': True, 'gold': 30, 'text': 'Under the woodpile: the reeve\u2019s hidden rent money, and a note in his hand: \u201cThe giant\u2019s staff is on the shack roof.\u201d'}],
    gold=[[19, 4, 25], [3, 14, 10], [27, 8, 15], [12, 28, 10]], clovers=[[28, 26]],
    reward=50,
    tips=[{'id': 'staff', 'when': 'start', 'text': 'Forest work: Robin carries a staff today, so his blows knock out instead of killing. Clear the five soldiers on the west road to let the old folk escape.'}],
    map=m06().rows()))
# ---------------------------------------------------------------- 7 Leicester, dusk: warn the lord (no killing; Marian joins for the night)
MS.append(dict(
    id='m7', rank=6, theme='castle', title='A Word at Dusk', place='Leicester castle', town='Leicester', kind='story', night=True,
    type='Courier, no killing',
    intro='Prince John means to have Lord Aubrey of Leicester quietly murdered: the old lord is too loyal to the King. Marian has learned it, and she will take Robin to him.\n\nNo blood tonight. If a single soldier dies, the lord will never trust an outlaw. Marian can walk among guards, and she can listen at a door to learn who waits inside.',
    outro='Lord Aubrey hears them out in silence, then unbuckles his sword and lays it on the table. \u201cWhen the King\u2019s men march, Leicester marches with them.\u201d\n\nMarian slips back to her father\u2019s house before the bells. Robin takes the river road home, richer by a friend.',
    heroes={'robin': [5, 14], 'marian': [6, 14], 'stutely': [5, 15], 'scarlet': [6, 15]}, need=['robin', 'marian'],
    exit={'x': 4, 'y': 13, 'w': 3, 'h': 3},
    contacts=[{'id': 'aubrey', 'name': 'Lord Aubrey', 'x': 25, 'y': 5, 'look': 2, 'needs': 'robin', 'say': '\u201cRobin of Locksley? In my own hall?\u201d The old lord listens, then grips Robin\u2019s arm. \u201cThen the Prince is a traitor, and I am the King\u2019s man.\u201d'}],
    objectives=['meet:aubrey', 'nokill', 'exit'],
    treasure={'id': 'roll', 'name': 'the Shire Roll', 'x': 16, 'y': 23},
    torches=[[13, 13], [13, 16], [18, 10], [25, 9], [16, 18], [22, 15], [8, 12], [8, 17]],
    guards=[
        G(12, 13, None, [0, 0.5, -0.5]), G(0, 0, None, route=[[8, 2, 2], [8, 8, 2]]),
        G(15, 13, 'soldier', [W, S]), G(15, 16, 'halberd', [W, N]),
        G(0, 0, None, route=[[17, 11, 1], [26, 11, 1], [26, 18, 1], [17, 18, 1]]),
        G(18, 7, 'knight', [S, S + 0.5]), G(19, 6, 'soldier', [S]),
        G(25, 9, 'halberd', [S, S - 0.4, S + 0.4]),
        G(16, 21, None, [S, E]), G(17, 23, 'archer', [N, E]),
        G(23, 17, 'officer', [W, S, N]),
    ],
    civilians=[[20, 14], [24, 16], [19, 19], [26, 22], [21, 24], [9, 27]], nobles=[[22, 10]],
    beggars=[{'id': 'b1', 'x': 21, 'y': 16, 'price': 15, 'pays': ['s1', 's2'], 'say': ['The old lord sups alone in the east hall. Soldiers drink in the chapel, mind. And the west tower holds something the Prince wants badly.']}],
    scrolls=[{'id': 's1', 'x': 27, 'y': 24, 'hidden': True, 'gold': 40, 'text': 'A steward\u2019s strongbox, badly hidden. \u201cThe chapel is full of the Prince\u2019s soldiers: go round it.\u201d'},
             {'id': 's2', 'x': 15, 'y': 18, 'hidden': True, 'gold': 0, 'text': 'Chalked on the tower door: \u201cThe Roll of the Shire, by order of the Prince, to be kept under guard.\u201d'}],
    gold=[[11, 21, 15], [27, 13, 20], [6, 28, 10]], clovers=[[10, 29]],
    reward=60,
    tips=[{'id': 'nokill', 'when': 'start', 'text': 'No killing tonight: swords strike with the flat of the blade. Marian walks freely among guards, so send her ahead to look.'}],
    map=m07().rows()))
# ---------------------------------------------------------------- 8 Lincoln, night: the godfather in the cells, then clear the castle
MS.append(dict(
    id='m8', rank=7, theme='castle', title='Old Godric\u2019s Cell', place='Lincoln castle', town='Lincoln', kind='story', night=True,
    type='Dungeon rescue, then clear', climbs=[[27, 12, 25, 12]],
    intro='Sir Aldous\u2019s men found him at last: in the cells under Lincoln castle, with Old Godric, Robin\u2019s godfather, beside him.\n\nThe north-east wall is thick with ivy: everyone but Little John can climb it. Lower the drawbridge for John from inside. Free Godric, and his household guard will rise. Then knock out every one of the Prince\u2019s men in the castle.',
    outro='Lincoln is taken without a single trumpet. Godric\u2019s men bar the gates, and the Prince\u2019s captain is sent home on a mule, facing backwards.\n\nBut the Prince will want Lincoln back. Scouts say his men are already on the road.',
    heroes={'robin': [15, 28], 'john': [16, 28], 'stutely': [14, 28], 'scarlet': [17, 28], 'marian': [13, 28]}, need=['robin'],
    exit={'x': 14, 'y': 29, 'w': 4, 'h': 2},
    contacts=[{'id': 'godric', 'name': 'Old Godric', 'x': 8, 'y': 5, 'look': 1, 'say': '\u201cRobin, lad! I knew you would come.\u201d Godric beats on the wall: \u201cUp, my lads! For Lincoln!\u201d His men break out of the west range.', 'allies': [[9, 9], [10, 9], [11, 10], [20, 9], [21, 9]], 'reinforce': [[21, 7, 'knight'], [22, 7, 'knight']], 'reinforceSay': 'Two knights come out of the chapel!'}],
    objectives=['meet:godric', {'k': 'clear', 'after': 'godric', 'text': 'Knock out every one of the Prince\u2019s men'}],
    props=[{'id': 'bridge', 'kind': 'lever', 'x': 17, 'y': 19, 'gate': [[15, 20], [16, 20], [15, 21], [16, 21], [15, 22], [16, 22]], 'say': 'The drawbridge comes down. Little John can come in.'}],
    triggers=[{'id': 'walk', 'x': 13, 'y': 10, 'w': 7, 'h': 2, 'reinforce': [[8, 17, 'soldier'], [7, 17, 'archer'], [23, 17, 'soldier'], [24, 17, 'soldier']], 'say': 'Guy the castellan spots you from the hall and runs, shouting for the tower guards!'}],
    torches=[[15, 19], [9, 9], [21, 9], [13, 13], [19, 16], [24, 12], [6, 12]],
    guards=[
        G(15, 19, None, [S, S - 0.4]), G(17, 18, 'halberd', [S, S + 0.4]),
        G(0, 0, None, route=[[7, 12, 2], [24, 12, 2]]),
        G(9, 9, 'soldier', [S, E]), G(11, 6, 'archer', [W, S]),
        G(16, 13, 'officer', [N, S, E, W]),
        G(0, 0, None, route=[[11, 16, 1], [20, 16, 1]]),
        G(23, 10, 'archer', [W, S]), G(16, 7, 'soldier', [S, S + 0.6]),
    ],
    gold=[[24, 4, 30], [7, 4, 20], [28, 4, 10], [3, 28, 10]], clovers=[[19, 6]],
    reward=70,
    tips=[{'id': 'ivy', 'when': 'start', 'text': 'Climb the ivy on the north-east wall (Little John is too heavy). Pull the drawbridge winch inside the gate to let him in.'}],
    map=m08().rows()))
# ---------------------------------------------------------------- 9 Derby, night: the hanging cage, then eavesdrop
m = old('m6', id='m9', rank=8, place='Derby inner yard', town='Derby')
retext(m, [('Ravenscar', 'Derby')])
m['heroes'] = {('stutely' if k == 'marian' else k): v for k, v in m['heroes'].items()}
m['objectives'] = ['free:tuck', 'listen:council', 'exit']
m['props'].append({'id': 'council', 'kind': 'listen', 'x': 22, 'y': 3, 'dur': 5, 'say': 'Behind the shutters the Prince\u2019s steward counts aloud: \u201cA hundred thousand marks for the King\u2019s ransom, and not a penny of it raised. Let Austria keep him.\u201d'})
MS.append(m)
# ---------------------------------------------------------------- 10 Nottingham, day: the silver arrow tournament (trap, Robin alone)
m = old('m7', id='m10', rank=9, town='Nottingham')
m['nobles'] = []  # a public tourney: the crowd cheers the archers, nobody runs to the guards
retext(m, [('Blackmere church', 'York minster'), ('Blackmere', 'York')])
MS.append(m)
# ---------------------------------------------------------------- 11 Derby, day: the black castle (siege by blazons, castellan duel)
MS.append(dict(
    id='m11', rank=10, theme='castle', title='The Black Castle', place='Derby castle', town='Derby', kind='story',
    type='Siege: take the blazons',
    intro='Lord Aubrey\u2019s men are camped in the woods below Derby\u2019s black walls, but they will not throw themselves at the gate. Every banner you pull down tells them the way is clear, and they advance.\n\nTake each blazon point (stand on it with no enemy near). The castellan, Sir Roger Mallory, holds the high tower and will not come down: beat him in a duel there. If it goes badly, step out, heal and go back in.',
    outro='Sir Roger yields his sword on the tower stair. Aubrey\u2019s banner goes up over Derby, and the townsfolk, who hated Sir Roger rather more than they loved anybody, cheer the outlaws in the street.\n\nThe Prince will try to take it back. He always does.',
    heroes={'robin': [14, 29], 'john': [15, 29], 'stutely': [13, 29], 'scarlet': [16, 29], 'tuck': [12, 29]}, need=['robin'],
    exit={'x': -9, 'y': -9, 'w': 1, 'h': 1},
    blazons=[[14, 22, 'The outer gate'], [23, 17, 'The north-east yard'], [14, 10, 'The north yard'], [14, 6, 'The high tower']],
    allies=[[13, 27], [14, 27], [15, 27], [13, 26], [15, 26], [14, 25], [12, 26], [16, 26], [13, 25], [15, 25], [12, 27], [16, 27]], allyWave=3,
    objectives=['blazons', 'boss'],
    guards=[
        G(13, 23, 'halberd', [S, S - 0.4]), G(16, 23, 'halberd', [S, S + 0.4]),
        G(0, 0, None, route=[[5, 18, 2], [19, 18, 2]]),
        G(0, 0, 'officer', route=[[6, 13, 1], [18, 13, 1]]),
        G(8, 21, 'archer', [S, E]), G(20, 21, 'archer', [S, W]),
        G(22, 14, 'archer', [W, S]), G(24, 19, 'archer', [W, N]), G(23, 15, 'soldier', [W]),
        G(10, 9, None, [S, E]), G(19, 9, None, [S, W]), G(14, 11, 'officer', [S, S - 0.6, S + 0.6]),
        G(10, 5, 'knight', [E, S]), G(19, 5, 'black', [W, S]),
        G(14, 7, 'boss', [S, S - 0.5, S + 0.5], boss=True, name='Sir Roger Mallory'),
    ],
    gold=[[4, 4, 25], [25, 4, 25], [24, 20, 20], [13, 6, 40]], clovers=[[5, 23]],
    treasure={'id': 'orb', 'name': 'the Orb of Derby', 'x': 16, 'y': 6},
    reward=80,
    tips=[{'id': 'blazon', 'when': 'start', 'text': 'Stand on a blazon (gold shield) with no enemy close by to raise our colours. Each one brings three of Aubrey\u2019s men up to help.'}],
    map=m10().rows()))
# ---------------------------------------------------------------- 12 York, day: the wedding (flag, rescue, duel)
m = old('m8', id='m12', rank=11, town='York', place='York minster')
m['nobles'] = [[8, 5], [3, 5], [19, 3], [20, 13]]
retext(m, [('Blackmere', 'York')])
for g in m['guards']:
    r = g.get('route') or []
    if r and r[0][:2] == [8, 21]: g['route'] = [[8, 20, 2], [19, 20, 2]]
    if r and r[0][:2] == [13, 25]: g['route'] = [[13, 23, 0]]; g['looks'] = [W, N, E, N]
MS.append(m)
# ---------------------------------------------------------------- 13 Nottingham, fog: the escape (Robin is the prisoner)
m = old('m9', id='m13', rank=12, town='Nottingham')
retext(m, [('Blackmere docks', 'York\u2019s river stairs'), ('Blackmere', 'York')])
m['need'] = ['marian']
MS.append(m)
# ---------------------------------------------------------------- 14 York, night: the letter
m = old('m10', id='m14', rank=13, town='York', place='York river stairs')
retext(m, [('Blackmere docks', 'York\u2019s river stairs'), ('Blackmere', 'York')])
m['objectives'] = [o for o in m['objectives'] if o != 'nokill']
m['tips'] = [t for t in m['tips'] if 'No killing' not in t['text']]
MS.append(m)
# ---------------------------------------------------------------- 15 York, snow: the march (bell / standard, allies wait)
m = old('m11', id='m15', rank=14, town='York', title='The March on York', place='York, in the snow')
retext(m, [('Blackmere', 'York')])
m['intro'] = 'Snow on the road, and two hundred of Aubrey\u2019s men waiting in the woods south of York. They will not march on the walls until they see a sign.\n\nRing the minster bell, or raise the King\u2019s standard on the citadel, and they will come. The river splits the city: both bridges are guarded. Soldiers never search a house unless they see you go in, so a house is a fine place to wait out a patrol. Beat the Prince\u2019s general in the citadel.'
m['heroes'] = {'robin': [15, 31], 'john': [16, 31], 'marian': [15, 32], 'tuck': [16, 32], 'scarlet': [16, 30]}
m['captive'] = [17, 6]
m['treasure']['x'], m['treasure']['y'] = 27, 7
m['exit'] = {'x': -9, 'y': -9, 'w': 1, 'h': 1}
m['blazons'] = []
m['props'] = [{'id': 'bell', 'kind': 'bell', 'x': 6, 'y': 4, 'say': 'The minster bell rings out over the snow! Aubrey\u2019s men march on York.'},
              {'id': 'standard', 'kind': 'bell', 'x': 21, 'y': 4, 'label': '\u2691 Raise the King\u2019s standard', 'say': 'The King\u2019s standard flies over the citadel!'}]
m['allies'] = [[14, 28], [15, 28], [16, 28], [14, 29], [16, 29], [15, 27]]
m['objectives'] = [{'k': 'use', 'id': 'bell', 'text': 'Ring the minster bell'}, {'k': 'use', 'id': 'standard', 'text': 'Raise the standard on the citadel'}, 'boss']
m['torches'] = []
m['weather'] = 'snow'
m['guards'] = [
    G(14, 25, 'halberd', [S, S - 0.4]), G(17, 25, 'halberd', [S, S + 0.4]),
    G(0, 0, 'archer', route=[[3, 19, 2], [28, 19, 2]]), G(0, 0, None, route=[[3, 15, 1], [12, 15, 1], [12, 24, 1], [3, 24, 1]]),
    G(0, 0, 'archer', route=[[18, 15, 1], [29, 15, 1], [29, 24, 1], [18, 24, 1]]),
    G(8, 15, 'knight', [S, S - 0.5]), G(9, 15, None, [S]), G(7, 12, 'archer', [S, E]), G(10, 12, 'officer', [S, W]),
    G(22, 15, 'knight', [S, S + 0.5]), G(23, 15, None, [S]), G(21, 12, 'archer', [S, W]), G(24, 12, 'soldier', [S, E]),
    G(7, 6, 'halberd', [S, E]), G(10, 4, 'black', [W, S]), G(5, 3, 'black', [E, S]),
    G(23, 8, 'halberd', [S, S + 0.4]), G(0, 0, 'black', route=[[20, 6, 1], [27, 6, 1]]), G(20, 3, 'officer', [S, E]),
    G(26, 7, 'boss', [S, W], boss=True, name='Lord Fitzwalter'),
]
m['gold'] = [[3, 3, 30], [28, 8, 30], [2, 20, 15], [29, 23, 15], [15, 6, 25]]
m['clovers'] = [[11, 3]]
m['tips'] = [{'id': 'houses', 'when': 'start', 'text': 'Patrols with crossbows notice missing friends. Duck into a house when one passes: they won\u2019t search it unless they saw you go in.'}]
m['map'] = m15().rows()
MS.append(m)
# ---------------------------------------------------------------- 16 Nottingham: the last challenge (split start, the Sheriff)
m = old('m12', id='m16', rank=15, town='Nottingham')
retext(m, [('Blackmere', 'York')])
MS.append(m)
WALK = set('.,fdbh')
def snap(rows, x, y):
    if 0 <= y < len(rows) and 0 <= x < len(rows[0]) and rows[y][x] in WALK: return x, y
    for r in range(1, 6):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                X, Y = x + dx, y + dy
                if 0 <= Y < len(rows) and 0 <= X < len(rows[0]) and rows[Y][X] in WALK: return X, Y
    return x, y
for i, m in enumerate(MS):
    m['mapPos'] = TOWN[m['town']]
    R = m['map']
    for k in ('gold', 'civilians', 'nobles', 'clovers'):
        for p in m.get(k, []): p[0], p[1] = snap(R, p[0], p[1])
    for p in m.get('scrolls', []): p['x'], p['y'] = snap(R, p['x'], p['y'])
    for k in list(m.get('heroes', {})): m['heroes'][k] = list(snap(R, *m['heroes'][k]))
    if m.get('exit') and m['exit']['x'] >= 0: m['exit']['x'], m['exit']['y'] = snap(R, m['exit']['x'], m['exit']['y'])
    m.setdefault('kind', 'story')
HEAD = """// The story campaign: sixteen missions in the order of the original game's campaign
// (see rh_ref/spec/missions/). GENERATED by tools/campaign.py: edit that, then run `python3 tools/campaign.py`.
// All mission names, maps and text are original. Legend figures and English towns are public domain.
'use strict';
(function (RH) {
  RH.MISSIONS = """
TAIL = """;
  RH.MISSIONS.forEach((m, i) => { m.idx = i; });
})(window.RH);
"""
if __name__ == '__main__':
    out = json.dumps(MS, ensure_ascii=False, indent=1)
    open('/workspace/sherwood/js/missions.js', 'w').write(HEAD + out + TAIL)
    json.dump(MS, open('/workspace/rh_ref/spec/missions16.json', 'w'), ensure_ascii=False, indent=1)
    print('wrote', len(MS), 'missions')
