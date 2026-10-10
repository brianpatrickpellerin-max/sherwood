# Maps for the nine missions that used to reuse old layouts, redrawn from rh_ref/spec/missions/NN.md.
from mapkit import Map

def m03():
    # Leicester at night (original M3 "Scarlet Night"): a moated castle with one drawbridge (winch inside),
    # cabbage fields and a windmill to the south-west, a lone house with an officer, two patrols outside,
    # Scarlet in the west tower, gold in the north tower, a secret way out in the south-west woods.
    M = Map(32, 32); M.border('T')
    M.scatter(1, 1, 30, 30, 'T', 0.10, seed=301)
    M.rect(5, 1, 28, 19, '.')
    M.box(6, 1, 27, 19, 'w'); M.box(7, 2, 26, 18, 'w')            # double moat
    M.box(8, 3, 25, 17, '#', inner='f')                            # curtain wall + bailey
    M.box(8, 3, 13, 8, '#', inner='d'); M.put(13, 6, 'f')          # west tower (Scarlet)
    M.box(15, 3, 20, 7, '#', inner='d'); M.put(17, 7, 'f')         # north tower (the gold)
    M.rect(21, 10, 24, 12, 'r'); M.rect(10, 11, 12, 14, 'r')        # barracks, stores
    M.pts([(15, 12), (19, 14), (22, 15)], 'c'); M.pts([(14, 15)], 'h')
    M.pts([(16, 17), (17, 17)], 'f'); M.rect(16, 18, 17, 19, 'd')  # gate + drawbridge
    M.rect(1, 20, 30, 30, '.'); M.scatter(1, 20, 30, 30, 'T', 0.08, seed=302)
    M.line([(16, 20), (16, 30)], ',', 2); M.line([(2, 22), (29, 22)], ',')
    for y in (24, 26, 28):                                          # cabbage rows (hide in them)
        for x in range(3, 13, 2): M.put(x, y, 'b')
    M.rect(23, 25, 24, 26, 'r')                                     # windmill
    M.rect(26, 20, 28, 21, 'r')                                     # the officer's house
    M.rect(19, 27, 21, 28, 'r')
    M.rect(1, 27, 3, 30, '.'); M.pts([(1, 26), (2, 26)], 'T')       # secret way, south-west
    return M

def m04():
    # Nottingham at vespers (original M4 "Confessions of an Outlaw"): the town below the castle wall, the
    # prison and stockade in the west, the market square with its well, the church in the east with the
    # confessional, the Sheriff's brother-in-law's house, the town gate in the south.
    M = Map(32, 32); M.border('T')
    M.rect(1, 1, 30, 30, 'f')
    M.rect(1, 1, 30, 5, '#'); M.rect(9, 1, 22, 4, 'r'); M.pts([(15, 5), (16, 5)], 'f')   # castle wall + gate
    M.box(2, 9, 8, 14, '#', inner='d'); M.put(8, 11, 'f')          # prison
    M.pts([(4, 16), (6, 16)], 'c')                                  # stockade
    M.box(21, 9, 29, 17, '#', inner='d'); M.pts([(21, 13), (21, 14)], 'f')   # church
    M.rect(26, 10, 28, 11, 'c')                                     # vestry / confessional
    M.rect(13, 13, 18, 18, ','); M.pts([(15, 15), (16, 15)], 'c')   # square + well
    for (x, y, w, h) in [(10, 7, 3, 3), (17, 7, 3, 3), (2, 18, 3, 3), (10, 20, 3, 3), (19, 20, 4, 3), (25, 20, 4, 3),
                         (2, 24, 4, 3), (24, 25, 4, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(12, 11), (19, 12), (9, 17), (23, 19), (7, 23)], 'm'); M.pts([(5, 22), (20, 25)], 'h')
    M.rect(1, 27, 30, 27, '#'); M.rect(12, 27, 17, 27, 'f')         # town wall + south gate
    M.rect(1, 28, 30, 30, '.'); M.scatter(1, 28, 30, 30, 'T', 0.25, seed=401)
    M.line([(14, 28), (14, 30)], ',', 2)
    return M

def m05():
    # Derby castle on its crag (original M5): the front yard before a gate that won't open, the broken tower
    # in the south-west that gives onto the walls, the southern ward, the north-east ward with its archers,
    # the inner gate and the keep where the Prince holds council.
    M = Map(32, 32); M.border('T')
    M.scatter(1, 1, 30, 30, 'T', 0.12, seed=501)
    M.box(3, 2, 28, 22, '#', inner='f')
    M.rect(4, 12, 27, 12, '#'); M.pts([(15, 12), (16, 12)], 'f')    # inner wall + gate
    M.box(19, 2, 28, 12, '#', inner='f'); M.put(22, 12, 'f')        # NE ward
    M.box(10, 3, 18, 9, '#', inner='d'); M.put(14, 9, 'f')          # the keep / council hall
    M.rect(4, 3, 8, 6, 'r')                                         # chapel
    for (x, y, w, h) in [(5, 14, 3, 3), (11, 15, 3, 2), (19, 14, 3, 3), (24, 15, 3, 3), (6, 19, 3, 2), (20, 19, 3, 2)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(13, 19), (17, 18), (24, 4), (21, 10)], 'c'); M.pts([(9, 18), (26, 20)], 'h')
    M.pts([(15, 22), (16, 22)], '#')                                # the main gate stays shut
    M.rect(4, 23, 27, 30, ','); M.scatter(4, 23, 27, 30, 'b', 0.05, seed=502, on=',')
    M.rect(1, 25, 3, 30, '.'); M.rect(28, 25, 30, 30, '.')
    M.rect(4, 22, 5, 22, ',')                                       # the broken tower: a gap at the foot
    M.line([(15, 23), (15, 30)], ',', 2)
    M.pts([(6, 27), (24, 28), (9, 30), (21, 24), (11, 25)], 'T')       # old trees on the crag below the walls
    return M

def m09():
    # Derby by night (original M9 "The Lock-up and the Friar"): the gatehouse yard where the band slips in,
    # the south courtyard with its patrol and beggar, a ditch crossed by a plank once its rope is shot,
    # the hanging cage in the north-east, the banquet hall and the council room in the north.
    M = Map(32, 30); M.border('T')
    M.box(2, 2, 29, 24, '#', inner='f')
    M.rect(3, 13, 28, 13, 'w'); M.rect(3, 14, 28, 14, 'w')          # ditch across the middle
    M.rect(7, 13, 8, 14, 'd')                                       # the west footbridge
    M.box(10, 3, 18, 8, '#', inner='d'); M.pts([(14, 8)], 'f')      # banquet hall
    M.box(21, 3, 28, 9, '#', inner='d'); M.pts([(21, 6)], 'f')      # council room
    M.rect(22, 10, 27, 12, ',')                                     # the cage yard
    M.rect(3, 3, 7, 6, 'r')
    for (x, y, w, h) in [(4, 16, 3, 3), (10, 17, 3, 2), (18, 16, 3, 3), (24, 17, 3, 3), (4, 21, 3, 2), (21, 21, 3, 2)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(14, 19), (16, 21), (9, 10), (19, 11)], 'c'); M.pts([(13, 16), (27, 22)], 'h')
    M.pts([(15, 24), (16, 24)], 'f')                                # gatehouse
    M.rect(3, 25, 28, 28, '.'); M.scatter(3, 25, 28, 28, 'T', 0.2, seed=901)
    M.line([(15, 25), (15, 28)], ',', 2)
    return M

def m10():
    # Nottingham tourney (original M10 "The Silver Arrow"): the lists with three butts in the middle of the
    # town, the stands, the keep in the north-west where John is held, the church in the east with Tuck,
    # the scaffold, and the town gate in the south.
    M = Map(32, 32); M.border('T')
    M.rect(1, 1, 30, 30, 'f')
    M.box(9, 4, 22, 13, 'x', inner='.'); M.pts([(15, 13), (16, 13)], '.')   # the lists
    M.rect(10, 3, 21, 3, 'm')                                       # stands
    M.box(2, 2, 7, 8, '#', inner='d'); M.put(7, 5, 'f')             # keep
    M.box(24, 8, 29, 15, '#', inner='d'); M.put(24, 11, 'f')        # church
    for (x, y, w, h) in [(2, 11, 3, 3), (2, 17, 3, 3), (9, 16, 3, 2), (19, 16, 3, 2), (25, 18, 4, 3), (5, 22, 3, 3), (22, 23, 4, 2), (25, 2, 4, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(14, 18), (15, 18)], 'd')                                # scaffold
    M.pts([(7, 11), (23, 19), (7, 25), (26, 6)], 'T')                 # trees on the green
    M.pts([(6, 15), (18, 20), (12, 23), (23, 6)], 'c'); M.pts([(8, 20), (27, 16)], 'h')
    M.rect(1, 27, 30, 27, '#'); M.rect(12, 27, 19, 27, 'f')
    M.rect(1, 28, 30, 30, '.'); M.scatter(1, 28, 30, 30, 'T', 0.2, seed=1001)
    M.line([(15, 28), (15, 30)], ',', 2)
    return M

def york(seed=1201):
    # York (originals M12 and M14): the Ouse across the middle with two bridges, the minster in the
    # north-west, the citadel with its flagpole in the north-east, docks on the east bank, the southern town
    # and its gate. M14 plays the same streets at night in the snow.
    M = Map(32, 34); M.border('T')
    M.rect(1, 1, 30, 32, 'f')
    M.rect(1, 15, 30, 16, 'w'); M.rect(8, 15, 9, 16, 'd'); M.rect(22, 15, 23, 16, 'd')
    M.box(2, 2, 12, 11, '#', inner='d'); M.pts([(7, 11), (8, 11)], 'f')        # minster
    M.box(19, 2, 29, 11, '#', inner='f'); M.put(24, 11, 'f')                    # citadel yard
    M.rect(25, 3, 28, 6, 'r')                                                   # citadel keep
    M.rect(14, 3, 16, 5, 'r'); M.rect(14, 8, 16, 10, 'r')
    M.pts([(27, 13), (28, 13), (29, 13), (27, 18), (28, 18)], 'd')              # docks
    for (x, y, w, h) in [(2, 18, 3, 3), (7, 19, 3, 3), (13, 18, 3, 3), (18, 19, 3, 3), (24, 20, 3, 3),
                         (2, 24, 3, 3), (10, 24, 3, 2), (19, 25, 3, 2), (25, 25, 3, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(6, 13), (17, 13), (12, 22), (22, 23), (6, 28)], 'c'); M.pts([(16, 28), (28, 23)], 'h')
    M.pts([(5, 23), (16, 23)], 'm')
    M.rect(1, 30, 30, 30, '#'); M.rect(12, 30, 18, 30, 'f')
    M.rect(1, 31, 30, 32, '.'); M.scatter(1, 31, 30, 32, 'T', 0.2, seed=seed)
    M.line([(14, 31), (14, 32)], ',', 2)
    return M

def nottingham(north=False):
    # Nottingham castle (originals M13 and M16): the village south of the gate, the prison in the south-west,
    # the gate with its halberdiers, the bailey with the brother-in-law's house and the ramp up to the inner
    # keep in the north-west where the cells and the Sheriff's chamber are. M16 adds the north gate and street.
    M = Map(32, 32); M.border('T')
    M.scatter(1, 1, 30, 30, 'T', 0.08, seed=1301)
    M.box(4, 2, 27, 18, '#', inner='f'); M.pts([(15, 18), (16, 18)], 'f')
    M.box(4, 2, 13, 9, '#', inner='d'); M.pts([(9, 9)], 'f')                    # inner keep
    M.rect(10, 10, 11, 11, ',')                                                 # the ramp
    for (x, y, w, h) in [(17, 4, 3, 3), (22, 4, 4, 3), (6, 12, 3, 3), (17, 12, 3, 3), (22, 12, 4, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(14, 13), (13, 6), (20, 9), (25, 16)], 'c'); M.pts([(15, 4), (8, 16)], 'h')
    if north: M.pts([(20, 2), (21, 2)], 'f')                                    # north gate
    M.rect(1, 19, 30, 30, '.')
    M.box(2, 21, 7, 25, '#', inner='d'); M.put(7, 23, 'f')                      # prison
    for (x, y, w, h) in [(10, 21, 3, 2), (19, 21, 3, 3), (24, 22, 3, 2), (10, 26, 3, 3), (21, 27, 3, 2), (26, 26, 3, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.line([(15, 19), (15, 30)], ',', 2); M.line([(2, 20), (29, 20)], ',')
    M.scatter(1, 19, 30, 30, 'b', 0.05, seed=1302, on='.')
    M.pts([(13, 24), (18, 25)], 'c')
    M.pts([(4, 28), (12, 30), (24, 30), (19, 29), (28, 24)], 'T')    # village trees
    if north:
        M.rect(19, 1, 22, 1, ',')
    return M
