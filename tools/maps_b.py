from mapkit import Map
def m02():
    # Nottingham by day (original M2): walled town, gate on the south wall with two lax guards,
    # the gallows square in the middle, the church to the north, the keep yard north-east, beggar outside.
    M = Map(30, 34); M.border('T')
    M.box(1, 1, 28, 23, '#', inner=',')
    M.pts([(14, 23), (15, 23)], ',')
    M.rect(10, 10, 19, 15, 'f')
    M.box(9, 2, 20, 7, '#', inner='d'); M.pts([(14, 7), (15, 7)], 'f')
    M.box(22, 2, 27, 9, '#', inner='f'); M.pts([(24, 9)], 'f')
    for (x, y, w, h) in [(2, 2, 3, 3), (2, 7, 3, 3), (2, 12, 4, 3), (2, 17, 3, 3), (6, 17, 3, 3), (10, 17, 3, 3),
                         (17, 17, 3, 3), (22, 12, 3, 3), (26, 12, 2, 3), (22, 17, 3, 3), (26, 17, 2, 4), (6, 2, 2, 3), (6, 12, 3, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(13, 9), (16, 9)], 'x')
    M.pts([(21, 15), (21, 16), (9, 16), (5, 21), (25, 21)], 'c'); M.pts([(19, 21), (11, 21), (3, 21)], 'h')
    M.pts([(10, 9), (19, 9)], 'm')
    M.line([(14, 24), (14, 33)], ',', 2)
    M.scatter(1, 24, 28, 32, 'T', 0.12, seed=5); M.scatter(1, 24, 28, 32, 'b', 0.08, seed=6)
    M.rect(12, 30, 17, 32, '.'); M.line([(14, 24), (14, 33)], ',', 2)
    M.rect(8, 26, 11, 28, '.')
    return M
def m06():
    # The forest village (original M6 "Pillaging"): four roads meet in a clearing among huts; Little John is
    # tied up north by a shack; an execution in the north-east; five soldiers block the west road.
    M = Map(32, 32); M.border('T', 1)
    M.scatter(1, 1, 30, 30, 'T', 0.42, seed=11)
    M.scatter(1, 1, 30, 30, 'b', 0.10, seed=12)
    M.rect(9, 9, 22, 22, '.'); M.rect(12, 2, 20, 9, '.'); M.rect(21, 2, 28, 7, '.'); M.rect(2, 14, 9, 19, '.'); M.rect(13, 22, 19, 30, '.'); M.rect(22, 14, 30, 18, '.')
    M.line([(1, 16), (30, 16)], ',', 2); M.line([(16, 1), (16, 30)], ',', 2)
    for (x, y, w, h) in [(11, 11, 2, 2), (20, 11, 2, 2), (11, 19, 2, 2), (20, 20, 3, 2), (24, 10, 2, 2), (8, 12, 2, 2), (19, 3, 2, 2)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(13, 14), (19, 14), (13, 19), (24, 13), (22, 4), (27, 6)], 'h')
    M.pts([(14, 13), (18, 19), (25, 5)], 'l')
    M.pts([(21, 3), (23, 3), (25, 3), (27, 3)], 'x')
    M.scatter(9, 9, 22, 22, 'b', 0.05, seed=13)
    M.line([(1, 16), (30, 16)], ',', 2); M.line([(16, 1), (16, 30)], ',', 2)
    return M
def m07():
    # Leicester at dusk (original M7): a dock on the river in the west, a lane of houses to a gatehouse,
    # the castle courtyard with a church and the lord's hall to the east; a windmill on the south edge.
    M = Map(30, 32); M.border('T')
    M.rect(1, 1, 3, 30, 'w'); M.rect(4, 13, 6, 15, 'd')
    M.line([(7, 14), (12, 14)], ',', 2)
    for (x, y, w, h) in [(5, 4, 3, 3), (9, 4, 3, 3), (5, 9, 3, 2), (9, 9, 3, 2), (5, 18, 3, 3), (9, 18, 3, 3), (5, 23, 3, 2), (9, 24, 3, 2)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.box(13, 2, 28, 26, '#', inner='f')
    M.pts([(13, 14), (13, 15)], 'f')               # the gatehouse passage
    M.box(16, 4, 21, 9, '#', inner='d'); M.pts([(18, 9), (19, 9)], 'f')   # the church
    M.box(23, 3, 27, 8, '#', inner='d'); M.put(25, 8, 'f')                 # the lord's hall
    M.box(14, 19, 18, 25, '#', inner='d'); M.put(16, 19, 'f')              # west tower (treasure)
    for (x, y, w, h) in [(22, 12, 3, 3), (25, 12, 3, 2), (20, 20, 3, 3), (24, 21, 3, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(15, 11), (15, 12), (27, 17)], 'c'); M.pts([(19, 15), (21, 17)], 'm'); M.pts([(26, 10), (14, 17)], 'h')
    M.rect(5, 27, 12, 30, '.'); M.rect(9, 28, 10, 29, 'r')   # the windmill
    M.scatter(4, 1, 12, 30, 'b', 0.06, seed=21, on='.')
    return M
def m08():
    # Lincoln castle at night (original M8): the same castle as mission 1, entered by the ivy on the north-east
    # wall; the drawbridge must be opened for Little John; Old Godric is in the cells under the west range.
    M = Map(32, 32); M.border('T')
    M.scatter(1, 1, 30, 30, 'T', 0.18, seed=31)
    M.box(5, 2, 26, 20, '#', inner=',')
    M.box(6, 3, 12, 8, '#', inner='d'); M.put(9, 8, 'f')          # the cells
    M.box(18, 3, 25, 8, '#', inner='d'); M.pts([(21, 8), (22, 8)], 'f')   # the chapel
    M.rect(14, 3, 16, 5, 'r')                                     # storeroom
    M.box(6, 15, 9, 19, '#', inner='d'); M.put(9, 17, 'f')         # west tower (locked guards)
    M.box(22, 15, 25, 19, '#', inner='d'); M.put(22, 17, 'f')      # east tower
    M.rect(13, 10, 19, 11, 'b'); M.rect(14, 10, 18, 10, '.')       # the garden walk
    M.pts([(11, 13), (12, 13), (19, 14)], 'c'); M.pts([(14, 18), (15, 18)], 'h')
    M.rect(5, 21, 26, 22, 'w'); M.rect(1, 21, 4, 21, 'w'); M.rect(27, 21, 30, 21, 'w')
    M.pts([(15, 20), (16, 20)], 'f'); M.rect(15, 21, 16, 22, 'd')  # gate + drawbridge
    M.rect(27, 2, 30, 20, '.'); M.scatter(27, 2, 30, 20, 'T', 0.2, seed=32)
    M.line([(15, 23), (15, 30)], ',', 2); M.line([(4, 26), (27, 26)], ',')
    for (x, y, w, h) in [(3, 23, 3, 2), (8, 28, 3, 2), (20, 28, 3, 2), (24, 23, 3, 2), (11, 23, 2, 2)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.scatter(1, 23, 30, 30, 'b', 0.07, seed=33, on='.')
    M.line([(15, 23), (15, 30)], ',', 2)
    return M
def m10():
    # Derby's black castle by day (original M10/11 siege): outer bailey, the north-east courtyard with archers
    # on its wall, the north courtyard and the high tower where the castellan waits.
    M = Map(30, 32); M.border('T')
    M.scatter(1, 1, 28, 30, 'T', 0.15, seed=41)
    M.box(3, 3, 26, 24, '#', inner=',')
    M.pts([(14, 24), (15, 24)], 'f')
    M.box(8, 4, 21, 12, '#', inner='f'); M.pts([(14, 12), (15, 12)], 'f')
    M.box(12, 5, 17, 8, '#', inner='d'); M.put(14, 8, 'f')        # the high tower room
    M.box(21, 13, 25, 20, '#', inner='f'); M.put(21, 16, 'f')      # NE courtyard
    for (x, y, w, h) in [(4, 14, 3, 3), (4, 19, 3, 3), (9, 15, 3, 2), (16, 15, 3, 2), (9, 19, 3, 3), (17, 20, 3, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(13, 18), (18, 18), (7, 13)], 'c'); M.pts([(22, 14), (24, 19), (4, 12)], 'h')
    M.rect(10, 25, 19, 30, '.'); M.line([(14, 25), (14, 31)], ',', 2)
    M.scatter(1, 25, 28, 30, 'b', 0.06, seed=42, on='.')
    return M
def m15():
    # York in snow (original M15): the Ouse runs across the middle with two guarded bridges; the minster
    # (church with the bell) in the north-west, the citadel with the standard in the north-east; the town
    # streets and the outer gate in the south, where the allied army waits in the woods.
    M = Map(32, 34); M.border('T')
    M.box(1, 1, 30, 26, '#', inner='f')
    M.rect(2, 13, 29, 14, 'w')
    M.rect(8, 13, 9, 14, 'd'); M.rect(22, 13, 23, 14, 'd')          # the two bridges
    M.box(3, 2, 12, 8, '#', inner='d'); M.pts([(7, 8), (8, 8)], 'f')  # minster
    M.box(19, 2, 28, 9, '#', inner='f'); M.pts([(23, 9)], 'f')         # citadel yard
    M.rect(24, 3, 27, 5, 'r')                                          # citadel keep
    for (x, y, w, h) in [(14, 3, 3, 3), (14, 8, 3, 3), (3, 10, 3, 2), (26, 10, 3, 2),
                         (3, 16, 3, 3), (8, 17, 3, 3), (14, 16, 3, 3), (19, 17, 3, 3), (25, 16, 3, 3), (3, 21, 3, 3), (12, 21, 3, 2), (19, 22, 3, 2), (25, 21, 3, 3)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(6, 11), (17, 11), (11, 20), (23, 20), (17, 24)], 'c'); M.pts([(12, 11), (28, 19), (2, 24)], 'h')
    M.pts([(15, 26), (16, 26)], 'f')                                  # outer gate
    M.rect(2, 27, 29, 32, '.'); M.scatter(2, 27, 29, 32, 'T', 0.18, seed=51); M.scatter(2, 27, 29, 32, 'b', 0.08, seed=52, on='.')
    M.line([(15, 27), (15, 33)], ',', 2)
    return M
