# Re-placement of the nine missions whose maps used to be carried over from the old campaign. Each now gets
# the map drawn from its spec (maps_c) and every guard, prop, contact and pickup is placed anew on it.
import maps_c
WALK = set(".,fdbh")
def apply(MS, G, S, W, N, E):
    byid = {m['id']: m for m in MS}
    def place(lst, pos):
        for e in lst:
            assert e['id'] in pos, (e['id'], 'unplaced'); e['x'], e['y'] = pos[e['id']]
    def put(mid, M, **kw):
        m = byid[mid]; m['map'] = M.rows()
        for k in ('contacts', 'beggars', 'scrolls', 'props', 'prisoners'):
            if k in kw:
                if isinstance(kw[k], list): m[k] = kw.pop(k)
                else: place(m[k], kw.pop(k))
        if 'captive' not in kw: m.pop('captive', None)
        kw.setdefault('climbs', []); m.pop('clovers', None)
        if 'treasure_xy' in kw: m['treasure']['x'], m['treasure']['y'] = kw.pop('treasure_xy')
        m.update(kw)
        # guard posts must stand on walkable ground (props and torches may sit on walls)
        R = m['map']
        def nudge(what, x, y):
            if R[y][x] in WALK: return x, y
            for r in range(1, 4):
                for dy in range(-r, r + 1):
                    for dx in range(-r, r + 1):
                        X, Y = x + dx, y + dy
                        if 0 <= Y < len(R) and 0 <= X < len(R[0]) and R[Y][X] in WALK:
                            print('  nudge', mid, what, (x, y), R[y][x], '->', (X, Y)); return X, Y
            raise AssertionError((mid, what, x, y))
        for g in m['guards']:
            for p in g['route']: p[0], p[1] = nudge('guard', p[0], p[1])
        for e in m.get('contacts', []) + m.get('prisoners', []) + m.get('beggars', []):
            e['x'], e['y'] = nudge(e['id'], e['x'], e['y'])
        for k, v in m['heroes'].items(): v[0], v[1] = nudge(k, v[0], v[1])
        return m

    # ---- 3 Leicester by night
    put('m3', maps_c.m03(),
        heroes={'robin': [8, 30], 'stutely': [9, 30]},
        exit={'x': 1, 'y': 28, 'w': 3, 'h': 3},
        climbs=[[11, 20, 11, 16]], captive=[29, 8],
        prisoners={'scarlet': [10, 5]},
        props=[{'id': 'bridge', 'kind': 'lever', 'x': 18, 'y': 15, 'gate': [[16, 18], [17, 18], [16, 19], [17, 19]], 'say': 'The drawbridge creaks down over the moat. The rest of the band can come in by the gate.'}],
        guards=[
            G(15, 20, 'soldier', [S - 0.9, S - 1.2]), G(18, 20, 'soldier', [S + 0.9, S + 1.2]),
            G(0, 0, None, route=[[3, 22, 2], [28, 22, 2]]),
            G(0, 0, None, route=[[22, 24, 1], [27, 24, 1], [27, 29, 1], [22, 29, 1]]),
            G(25, 22, 'officer', [W, W + 0.5, N]),
            G(0, 0, None, route=[[10, 9, 1], [23, 9, 1], [23, 15, 1], [13, 16, 1]]),
            G(16, 16, 'soldier', [N, N + 0.5, N - 0.5]),
            G(12, 5, 'soldier', [W, S]), G(17, 5, 'soldier', [S, S + 0.5, S - 0.5]),
            G(20, 14, 'archer', [S, W, E]),
        ],
        torches=[[15, 20], [18, 20], [16, 15], [10, 9], [23, 9], [25, 21], [17, 8], [12, 7]],
        gold=[[18, 4, 40], [2, 10, 15], [29, 28, 15], [22, 13, 15]])

    # ---- 4 Nottingham at vespers
    put('m4', maps_c.m04(),
        heroes={'robin': [14, 29], 'stutely': [15, 29], 'scarlet': [14, 30]},
        exit={'x': 11, 'y': 28, 'w': 8, 'h': 3}, captive=[4, 11],
        contacts={'marian': [26, 13]},
        beggars={'b1': [11, 25], 'b2': [15, 7], 'b3': [24, 18]},
        scrolls={'s1': [5, 19]}, treasure_xy=[27, 16],
        guards=[
            G(15, 6, 'halberd', [S, S + 0.4, S - 0.4]), G(16, 6, 'soldier', [S, S - 0.4]),
            G(13, 8, 'officer', [E, S]),
            G(0, 0, None, route=[[19, 14, 1], [19, 19, 1], [12, 19, 1], [12, 12, 1]]),
            G(9, 12, 'soldier', [E, E + 0.4, S]),
            G(20, 15, 'soldier', [W, S]),
            G(13, 25, 'soldier', [N, N + 0.5, E]),
            G(0, 0, None, route=[[23, 23, 1], [29, 23, 1]]),
        ],
        nobles=[[16, 10], [8, 21]],
        torches=[[15, 7], [13, 9], [9, 13], [20, 16], [16, 19], [13, 26], [24, 22]],
        gold=[[2, 23, 10], [29, 8, 15], [28, 26, 10]])

    # ---- 5 Derby castle in fog
    put('m5', maps_c.m05(),
        heroes={'robin': [15, 29], 'stutely': [16, 29], 'marian': [14, 29], 'scarlet': [17, 29]},
        exit={'x': 12, 'y': 28, 'w': 8, 'h': 3}, captive=[26, 10],
        climbs=[[27, 23, 27, 21]],
        props={'gallery': [14, 5]}, treasure_xy=[26, 4],
        guards=[
            G(0, 0, None, route=[[6, 25, 1], [25, 25, 1]]),
            G(13, 23, 'halberd', [W, W + 0.4]), G(18, 23, 'halberd', [E, E - 0.4]),
            G(4, 24, 'archer', [E, N]),
            G(8, 17, 'soldier', [S, E]),
            G(0, 0, None, route=[[6, 21, 1], [26, 21, 1]]),
            G(15, 13, 'halberd', [S]), G(16, 13, 'halberd', [S]),
            G(14, 10, 'knight', [S, W, E]),
            G(22, 5, 'archer', [W, S]), G(26, 9, 'soldier', [W]),
            G(0, 0, 'officer', route=[[5, 10, 1], [18, 10, 1]]),
            G(12, 8, 'knight', [N, E]),
        ],
        nobles=[[12, 5], [16, 6], [13, 7]],
        gold=[[27, 9, 20], [5, 10, 20], [5, 7, 25], [24, 18, 15]])

    # ---- 9 Derby by night: the hanging cage
    put('m9', maps_c.m09(),
        heroes={'robin': [15, 27], 'john': [16, 27], 'stutely': [14, 27], 'scarlet': [17, 27]},
        exit={'x': 12, 'y': 26, 'w': 8, 'h': 3},
        prisoners={'tuck': [25, 11]},
        props={'plankT': [21, 11], 'winch': [27, 10], 'council': [24, 5]},
        guards=[
            G(14, 22, 'soldier', [N, W]), G(17, 22, 'soldier', [N, E]),
            G(5, 26, 'officer', [N, W]), G(25, 26, 'archer', [N, E]),
            G(0, 0, None, route=[[4, 20, 1], [27, 20, 1]]),
            G(7, 15, 'soldier', [S, S + 0.4]), G(8, 15, 'halberd', [S, S - 0.4]),
            G(13, 10, 'soldier', [S, E, W]),
            G(22, 11, 'soldier', [W, S]), G(27, 12, 'archer', [W, N]),
            G(20, 6, 'halberd', [W, S]), G(12, 5, 'officer', [S, E]),
        ],
        torches=[[15, 23], [7, 15], [22, 15], [14, 9], [24, 10], [5, 9]],
        gold=[[4, 11, 15], [28, 15, 15], [16, 4, 20]])
    m = byid['m9']; [p.update(plank=[[20, 13], [20, 14]]) for p in m['props'] if p['id'] == 'plankT']

    # ---- 10 the Sheriff's tourney
    put('m10', maps_c.m10(),
        heroes={'robin': [15, 10]},
        exit={'x': 12, 'y': 28, 'w': 8, 'h': 3}, captive=[29, 3],
        props={'t1': [12, 6], 't2': [15, 6], 't3': [18, 6]},
        prisoners={'john': [4, 5], 'tuck': [27, 12]}, treasure_xy=[15, 5],
        guards=[
            G(8, 5, None, [E], watch=True), G(23, 5, None, [W], watch=True),
            G(8, 12, None, [E], watch=True), G(23, 12, None, [W], watch=True),
            G(15, 14, 'officer', [N], watch=True), G(5, 14, 'archer', [E, N], watch=True),
            G(5, 6, 'soldier', [E]), G(23, 11, 'knight', [E, S]),
            G(0, 0, None, route=[[3, 21, 1], [28, 21, 1]]),
            G(15, 26, 'soldier', [N, N + 0.4]), G(12, 24, 'halberd', [E, N]),
        ],
        civilians=[[11, 2], [14, 2], [18, 2], [21, 2], [8, 10], [23, 9], [8, 7], [23, 7]], nobles=[],
        gold=[[1, 22, 15], [29, 22, 15], [2, 16, 10]])

    # ---- 12 York: bells for a bride
    put('m12', maps_c.york(),
        heroes={'robin': [14, 32], 'john': [15, 32], 'tuck': [13, 32], 'scarlet': [16, 32]},
        exit={'x': 11, 'y': 31, 'w': 8, 'h': 2}, captive=[28, 19],
        prisoners={'marian': [4, 4]},
        props={'banner': [26, 9]},
        guards=[
            G(6, 5, 'boss', [S], boss=True, name='Sir Hugo de Vane', hp=12), G(9, 4, 'knight', [W, S]),
            G(6, 12, None, [S], tag='sq'), G(9, 12, None, [S], tag='sq'), G(7, 13, 'officer', [S, E], tag='sq'),
            G(4, 9, None, [E], tag='sq'), G(12, 13, 'halberd', [S, W], tag='sq'), G(10, 9, None, [S], tag='sq'),
            G(24, 12, 'soldier', [S, W]), G(21, 8, 'archer', [E, S]),
            G(8, 17, 'soldier', [S, E]), G(22, 17, 'soldier', [S, W]),
            G(0, 0, None, route=[[3, 22, 1], [28, 22, 1]]), G(24, 28, 'archer', [W, N]),
        ],
        nobles=[[16, 7], [3, 13], [20, 13], [20, 23]], civilians=[[12, 12], [18, 18], [21, 24], [6, 22]],
        gold=[[5, 17, 15], [29, 20, 15], [2, 9, 15]])
    m = byid['m12']; [p.update(to=[24, 8]) for p in m['props'] if p['id'] == 'banner']

    # ---- 13 Nottingham in fog: the captain taken
    put('m13', maps_c.nottingham(),
        heroes={'john': [15, 30], 'marian': [16, 30], 'tuck': [14, 30], 'scarlet': [17, 30]},
        exit={'x': 12, 'y': 29, 'w': 8, 'h': 2}, captive=[3, 22], climbs=[],
        prisoners={'robin': [6, 4]}, treasure_xy=[22, 8],
        guards=[
            G(14, 19, 'halberd', [W, S - 0.6]), G(17, 19, 'halberd', [E, S + 0.6]),
            G(16, 16, 'officer', [S, E], name='the sergeant', check=[10, 11, 'gate']),
            G(10, 11, None, [N, E], tag='gate'), G(8, 10, 'soldier', [S, E]),
            G(0, 0, None, route=[[14, 10, 1], [26, 10, 1], [26, 16, 1], [14, 16, 1]]),
            G(10, 5, 'soldier', [W, S]), G(25, 8, 'archer', [W, S]),
            G(4, 23, 'black', [E]), G(22, 25, 'soldier', [W, N]),
        ],
        nobles=[[20, 25]], civilians=[[9, 24], [18, 19]],
        gold=[[25, 4, 20], [2, 19, 10], [28, 29, 15]])

    # ---- 14 York at night in the snow: the letter
    put('m14', maps_c.york(1401),
        heroes={'robin': [3, 28], 'john': [4, 28], 'marian': [2, 28], 'tuck': [5, 29], 'scarlet': [3, 29]},
        exit={'x': 1, 'y': 27, 'w': 5, 'h': 3}, captive=[22, 5], weather='snow',
        chest={'x': 6, 'y': 29, 'letter': True},
        contacts={'boatman': [28, 13]},
        guards=[
            G(8, 17, 'soldier', [S, E]), G(9, 14, 'soldier', [N, W]),
            G(22, 17, 'halberd', [S]), G(23, 14, 'soldier', [N, E]),
            G(0, 0, None, route=[[8, 22, 1], [28, 22, 1]]),
            G(26, 12, 'officer', [E, S]), G(28, 17, 'archer', [N, W]),
            G(0, 0, None, route=[[2, 12, 1], [25, 12, 1]]),
            G(20, 24, 'soldier', [W, S]), G(14, 13, 'knight', [S, E]), G(16, 27, 'soldier', [W, N]),
        ],
        torches=[[8, 17], [22, 17], [26, 12], [13, 22], [24, 13], [7, 12], [18, 28]],
        gold=[[17, 6, 20], [9, 22, 15], [27, 29, 20]])

    # ---- 16 Nottingham castle by night: the last arrow (split start)
    put('m16', maps_c.nottingham(north=True),
        heroes={'robin': [20, 1], 'marian': [21, 1], 'scarlet': [19, 1], 'john': [15, 30], 'tuck': [16, 30]},
        exit={'x': 12, 'y': 29, 'w': 8, 'h': 2},
        chest={'x': 6, 'y': 3}, sheriff={'x': 10, 'y': 5},
        reinforce=[[15, 17, 'knight'], [16, 17, 'soldier'], [14, 16, 'archer']],
        guards=[
            G(20, 3, 'soldier', [S, S + 0.5]), G(22, 3, 'archer', [S, E]),
            G(8, 5, 'knight', [E, S]), G(11, 7, 'black', [N, W]), G(9, 10, 'black', [S]), G(16, 8, 'black', [S, W]),
            G(14, 19, 'halberd', [W, S - 0.6]), G(17, 19, 'halberd', [E, S + 0.6]),
            G(0, 0, None, route=[[14, 10, 1], [26, 10, 1], [26, 16, 1], [14, 16, 1]]),
            G(20, 15, 'officer', [W, S]),
            G(0, 0, None, route=[[3, 20, 1], [28, 20, 1]]),
            G(25, 7, 'archer', [W, N]), G(6, 16, 'soldier', [E, N]),
        ],
        torches=[[20, 3], [9, 10], [15, 17], [16, 17], [13, 7], [22, 15], [10, 20], [20, 20]],
        gold=[[25, 4, 20], [5, 17, 20], [16, 4, 25], [28, 28, 15]])
