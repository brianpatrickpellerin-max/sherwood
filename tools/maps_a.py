from mapkit import Map
def m01():
    # Lincoln castle by day (original M1): castle NE with archery yard, kitchen block and garden;
    # shed + ladder spot outside the west wall where Robin starts safe; moat and drawbridge on the south front;
    # a stream with a footbridge and the village to the south-west, the exit road at the bottom.
    M = Map(30, 32)
    M.border('T')
    M.scatter(1, 1, 11, 16, 'T', 0.45, seed=3)        # wooded crag west of the castle
    M.rect(1, 17, 11, 18, '.')
    M.box(12, 1, 28, 16, '#', inner=',')               # curtain wall + dirt courtyard
    M.rect(13, 2, 27, 2, '#')                          # thick north wall
    M.rect(20, 3, 26, 5, 'r')                          # kitchen + hall block (door south)
    M.rect(14, 3, 16, 5, 'r')                          # storeroom
    M.rect(13, 13, 15, 15, 'd')                        # timber yard by the west wall
    M.pts([(13, 12), (13, 11)], 'h')
    M.rect(24, 9, 27, 11, 'b'); M.pts([(25, 10)], '.')  # the garden
    M.pts([(26, 13), (27, 13), (27, 14)], 'c')
    M.rect(17, 17, 28, 17, 'w'); M.rect(17, 18, 29, 18, 'w')   # moat along the front
    M.pts([(20, 16), (21, 16)], 'f'); M.pts([(20, 17), (21, 17), (20, 18), (21, 18)], 'd')  # gate + drawbridge
    M.rect(9, 15, 10, 16, 'r')                         # the shed by the west wall
    M.pts([(11, 17), (12, 17)], 'b')
    # the road from the drawbridge down to the village and out
    M.line([(20, 19), (20, 30)], ',', 2)
    M.line([(4, 24), (19, 24)], ',')
    M.rect(12, 19, 12, 30, 'w'); M.put(12, 24, 'd')    # stream + footbridge
    for (x, y, w, h) in [(2, 20, 3, 2), (6, 26, 3, 2), (2, 28, 2, 2), (15, 20, 3, 2), (24, 21, 3, 2), (24, 26, 3, 2), (15, 27, 3, 2)]:
        M.rect(x, y, x + w - 1, y + h - 1, 'r')
    M.pts([(8, 21), (9, 22), (14, 26), (18, 23), (23, 24), (27, 29), (5, 30), (9, 19), (10, 20)], 'b')
    M.pts([(22, 25), (27, 24)], 'h'); M.pts([(17, 25)], 'm')
    M.rect(1, 31, 28, 31, 'T'); M.rect(20, 31, 21, 31, ',')
    return M
