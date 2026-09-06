"""Toronto Parking — deck pipeline core (python3 prototype of the TS build script).

parse()      36-char Fogleman board -> pieces + walls (group by letter; 'x' = pylon)
solve()      BFS over the whole cluster; returns min moves, cluster size, optimal path,
             number of optimal first moves, root branching factor
colour()     deterministic, adjacency-aware letter -> physical piece mapping
name()       read-aloud piece names: colour + kind + cell address (A-F, 1-6)
"""
from collections import deque

N = 6
HERO_ROW = 2
CAR_CAP = {"blue": 4, "yellow": 4, "green": 4}
TRUCK_CAP = {"yellow": 2, "blue": 1, "green": 1}
COLOUR_ORDER = ("blue", "yellow", "green")
TIERS = ["beginner", "intermediate", "advanced", "expert", "grandmaster"]


class BadBoard(ValueError):
    pass


def parse(board: str):
    """Returns (pieces, walls). pieces are dicts in letter order; hero first ('A')."""
    if len(board) != 36:
        raise BadBoard("board must be 36 chars")
    pos = {}
    for i, ch in enumerate(board):
        if ch in ".o":
            continue
        if not (ch == "x" or "A" <= ch <= "Z"):
            raise BadBoard(f"bad char {ch!r}")
        pos.setdefault(ch, []).append(i)
    pieces, walls = [], []
    for label in sorted(pos):
        ps = pos[label]
        if label == "x":
            for k, p in enumerate(ps):
                walls.append(dict(id=f"x{k+1}", letter="x", kind="pylon", colour="yellow",
                                  row=p // N, col=p % N, orientation=None, length=1, cells=[p]))
            continue
        if len(ps) not in (2, 3):
            raise BadBoard(f"piece {label} has {len(ps)} cells")
        stride = ps[1] - ps[0]
        if stride not in (1, N):
            raise BadBoard(f"piece {label} invalid shape")
        for i in range(2, len(ps)):
            if ps[i] - ps[i - 1] != stride:
                raise BadBoard(f"piece {label} not contiguous")
        if stride == 1 and ps[0] // N != ps[-1] // N:
            raise BadBoard(f"piece {label} wraps a row")
        orient = "h" if stride == 1 else "v"
        kind = "hero" if label == "A" else ("car" if len(ps) == 2 else "truck")
        pieces.append(dict(id=label, letter=label, kind=kind, colour=None,
                           row=ps[0] // N, col=ps[0] % N, orientation=orient,
                           length=len(ps), cells=list(ps)))
    if not pieces or pieces[0]["letter"] != "A":
        raise BadBoard("no hero")
    h = pieces[0]
    if h["orientation"] != "h" or h["row"] != HERO_ROW or h["length"] != 2:
        raise BadBoard("hero must be horizontal, length 2, on row 2")
    return pieces, walls


def unparse(pieces, walls) -> str:
    s = ["o"] * 36
    for p in pieces:
        for c in p["cells"]:
            s[c] = p["letter"]
    for w in walls:
        s[w["cells"][0]] = "x"
    return "".join(s)


def counts(pieces, walls):
    cars = sum(1 for p in pieces if p["kind"] == "car")
    trucks = sum(1 for p in pieces if p["kind"] == "truck")
    return cars, trucks, len(walls)


def inventory_ok(cars, trucks, walls):
    return cars <= 12 and trucks <= 4 and walls <= 2


def wall_blocks_exit(pieces, walls):
    hero_end = pieces[0]["col"] + 1
    return any(w["row"] == HERO_ROW and w["col"] > hero_end for w in walls)


# ---------------------------------------------------------------- solver
def _lane_masks(p):
    """All masks for piece p at every offset along its lane, indexed by offset."""
    L = p["length"]
    masks = []
    if p["orientation"] == "h":
        for off in range(N - L + 1):
            m = 0
            for k in range(L):
                m |= 1 << (p["row"] * N + off + k)
            masks.append(m)
    else:
        for off in range(N - L + 1):
            m = 0
            for k in range(L):
                m |= 1 << ((off + k) * N + p["col"])
            masks.append(m)
    return masks


def solve(board: str, full_cluster=True):
    """BFS. Returns dict(moves, cluster, path, optimal_first_moves, branching).
    path = [(letter, dir, cells)]; a move is one piece sliding 1..k cells = ONE move."""
    pieces, walls = parse(board)
    wall_mask = 0
    for w in walls:
        wall_mask |= 1 << w["cells"][0]
    lanes = [_lane_masks(p) for p in pieces]
    start = tuple(p["col"] if p["orientation"] == "h" else p["row"] for p in pieces)
    goal_off = N - 2  # hero occupies cols 4-5
    n = len(pieces)

    def occ(state):
        m = wall_mask
        for i in range(n):
            m |= lanes[i][state[i]]
        return m

    def neighbours(state):
        m = occ(state)
        out = []
        for i in range(n):
            lane = lanes[i]
            me = lane[state[i]]
            free = ~(m & ~me)
            k = state[i]
            # negative direction
            j = k - 1
            while j >= 0 and (lane[j] & ~free) == 0:
                out.append((i, j))
                j -= 1
            j = k + 1
            while j < len(lane) and (lane[j] & ~free) == 0:
                out.append((i, j))
                j += 1
        return out

    dist = {start: 0}
    parent = {start: None}
    q = deque([start])
    goal_state, goal_dist = None, None
    root_nb = neighbours(start)
    while q:
        s = q.popleft()
        d = dist[s]
        if goal_state is None and s[0] == goal_off:
            goal_state, goal_dist = s, d
            if not full_cluster:
                break
        for i, j in (root_nb if s == start else neighbours(s)):
            t = s[:i] + (j,) + s[i + 1:]
            if t not in dist:
                dist[t] = d + 1
                parent[t] = (s, i, j)
                q.append(t)
    if goal_state is None:
        return None
    # path
    path = []
    s = goal_state
    while parent[s] is not None:
        prev, i, j = parent[s]
        p = pieces[i]
        delta = j - prev[i]
        if p["orientation"] == "h":
            d = "right" if delta > 0 else "left"
        else:
            d = "down" if delta > 0 else "up"
        path.append((p["letter"], d, abs(delta)))
        s = prev
    path.reverse()
    # optimal first moves: root neighbours whose dist-to-goal == moves-1.
    # The move graph is undirected (every slide reverses), so a reverse BFS from all
    # goal states gives dist-to-goal for every state in the cluster.
    goals = [t for t in dist if t[0] == goal_off]
    dg = {t: 0 for t in goals}
    q = deque(goals)
    while q:
        s = q.popleft()
        d = dg[s]
        for i, j in neighbours(s):
            t = s[:i] + (j,) + s[i + 1:]
            if t not in dg:
                dg[t] = d + 1
                q.append(t)
    ofm = sum(1 for i, j in root_nb if dg.get(start[:i] + (j,) + start[i + 1:]) == goal_dist - 1)
    branching = len({(i, j > start[i]) for i, j in root_nb})
    return dict(moves=goal_dist, cluster=len(dist), path=path,
                optimal_first_moves=ofm, branching=branching)


def branching(board: str) -> int:
    """Root branching factor = distinct (piece, direction) pairs with a legal slide. Cheap."""
    pieces, walls = parse(board)
    m = 0
    for w in walls:
        m |= 1 << w["cells"][0]
    for p in pieces:
        for c in p["cells"]:
            m |= 1 << c
    b = 0
    for p in pieces:
        a, z = p["cells"][0], p["cells"][-1]
        if p["orientation"] == "h":
            if a % N > 0 and not (m >> (a - 1)) & 1:
                b += 1
            if z % N < N - 1 and not (m >> (z + 1)) & 1:
                b += 1
        else:
            if a >= N and not (m >> (a - N)) & 1:
                b += 1
            if z < 30 and not (m >> (z + N)) & 1:
                b += 1
    return b


# ---------------------------------------------------------------- colours
def _adjacent(p, q):
    a, b = set(p["cells"]), set(q["cells"])
    for c in a:
        r, k = divmod(c, N)
        for dr, dk in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            rr, kk = r + dr, k + dk
            if 0 <= rr < N and 0 <= kk < N and (rr * N + kk) in b:
                return True
    return False


def _lane_mates(p, q):
    if p["kind"] != q["kind"] or p["orientation"] != q["orientation"] or p["kind"] == "pylon":
        return False
    return (p["row"] == q["row"]) if p["orientation"] == "h" else (p["col"] == q["col"])


def colour(pieces, walls):
    """Assigns p['colour'] in place. Deterministic from the board alone.
    Hero = red, pylons = yellow (fixed). Movable pieces: most-constrained first;
    pick the colour with capacity and the lowest conflict score, where a conflict is a
    cell-adjacent piece (weight 1) or a same-kind lane-mate (weight 2, it breaks the
    'blue car in column 3' name). Ties: most remaining capacity, then blue/yellow/green."""
    pieces[0]["colour"] = "red"
    nodes = pieces[1:] + walls
    edges = {p["id"]: [] for p in nodes}
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            p, q = nodes[i], nodes[j]
            w = 0
            if _adjacent(p, q):
                w += 1
            if _lane_mates(p, q):
                w += 2
            if w:
                edges[p["id"]].append((q, w))
                edges[q["id"]].append((p, w))
    # hero adjacency counts too (nothing is red, so it never conflicts; skipped)
    cap = {"car": dict(CAR_CAP), "truck": dict(TRUCK_CAP)}
    order = sorted((p for p in pieces[1:]),
                   key=lambda p: (-sum(w for _, w in edges[p["id"]]), p["letter"]))
    conflicts = 0
    for p in order:
        best = None
        for c in COLOUR_ORDER:
            if cap[p["kind"]][c] <= 0:
                continue
            score = sum(w for q, w in edges[p["id"]] if q["colour"] == c)
            key = (score, -cap[p["kind"]][c], COLOUR_ORDER.index(c))
            if best is None or key < best[0]:
                best = (key, c)
        assert best is not None, "caps exhausted — impossible when inventory_ok"
        p["colour"] = best[1]
        cap[p["kind"]][best[1]] -= 1
        conflicts += best[0][0]
    return conflicts


def addr(cell: int) -> str:
    """Cell address in the canonical exit-right frame: columns A-F, rows 1-6 (the labels printed on the
    diagram frame turn with the board, so an address is true in every orientation)."""
    return "ABCDEF"[cell % N] + str(cell // N + 1)


def name(p, pieces=None):
    """Read-aloud name: 'red car' for the hero, else colour + kind + ' at ' + the address of the piece's
    first (top-left) cell, e.g. 'blue car at C3'. Re-derived per move while replaying a solution."""
    if p["kind"] == "hero":
        return "red car"
    return f'{p["colour"]} {p["kind"]} at {addr(p["cells"][0])}'


INVENTORY = {"car": {"blue": 4, "yellow": 4, "green": 4},
             "truck": {"blue": 1, "yellow": 2, "green": 1}, "pylon": 2}


def needs(pieces, walls):
    """Typed counts of physical pieces this card uses (hero excluded: always 1)."""
    out = {"car": {"blue": 0, "yellow": 0, "green": 0},
           "truck": {"blue": 0, "yellow": 0, "green": 0}, "pylon": len(walls)}
    for p in pieces[1:]:
        out[p["kind"]][p["colour"]] += 1
    return out


def stays_in_box(pieces, walls):
    used = needs(pieces, walls)
    return {"car": {c: INVENTORY["car"][c] - used["car"][c] for c in COLOUR_ORDER},
            "truck": {c: INVENTORY["truck"][c] - used["truck"][c] for c in COLOUR_ORDER},
            "pylon": INVENTORY["pylon"] - used["pylon"]}


def grid(board: str, pieces=None) -> str:
    """Text rendering: letters, '.' empty, '#' pylon, '>' marks the exit."""
    rows = []
    for r in range(N):
        line = "".join("." if ch == "o" else ("#" if ch == "x" else ch) for ch in board[r * N:(r + 1) * N])
        rows.append(line + (" > EXIT" if r == HERO_ROW else ""))
    return "\n".join(rows)


def footprint(pieces, walls):
    s = {(p["row"], p["col"], p["orientation"], p["length"]) for p in pieces}
    s |= {(w["row"], w["col"], "x", 1) for w in walls}
    return s


def similarity(f1, f2) -> float:
    return len(f1 & f2) / len(f1 | f2)
