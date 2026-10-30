// 生成自研场景：新月镇(900) / 地铁站台(901) / 二号道路(902)
// 图块编号经 tools/sheet.html 目视确认；站房外观复用原作地图 189 的街区块
import fs from 'node:fs';

const DATA = 'public/data';
const b64ToInt16 = (s) => {
  const b = Buffer.from(s, 'base64');
  return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
};
const toB64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64');

const tilesets = JSON.parse(fs.readFileSync(`${DATA}/tilesets.json`, 'utf8'));
const ex = (id) => {
  const ts = tilesets[id];
  return { passages: b64ToInt16(ts.passages), priorities: b64ToInt16(ts.priorities) };
};
const T17 = ex(17);
const T62 = ex(62);

const P = {
  grass: 1153,
  tree: 1305,
  canopy: 1274,
  flower: 408,
  shrub: 1268,
  sand: 753,
  water: 96,
  dark: 1300,
  floor: 555,
  floorAlt: 552,
  wall: 3337,
  wallTop: 3321,
  black: 58,
  machine: 3361,
};

function makeMap(id, name, tilesetId, rows, palette, pad, width) {
  const w = width ?? Math.max(...rows.map((r) => r.length));
  rows.forEach((r, y) => {
    if (r.length > w) throw new Error(`map ${id}: 第 ${y} 行过长 (${r.length} > ${w})`);
  });
  const h = rows.length;
  const data = new Int16Array(w * h * 3);
  const set = (x, y, z, v) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    data[(z * h + y) * w + x] = v;
  };
  rows.forEach((raw, y) => {
    const line = raw.padEnd(w, pad);
    for (let x = 0; x < w; x++) {
      const ch = line[x];
      const def = palette[ch];
      if (!def) throw new Error(`map ${id}: 未知字符 '${ch}' at ${x},${y}`);
      if (def.ground !== undefined) set(x, y, 0, def.ground);
      if (def.object !== undefined) set(x, y, 1, def.object);
    }
  });
  return { id, name, width: w, height: h, tilesetId, data, set, get: (x, y, z) => data[(z * h + y) * w + x] || 0 };
}

const cmd = (code, params, indent = 0) => ({ code, indent, params });

function page({ trigger = 0, list = [], graphic = {}, through = false }) {
  return {
    trigger,
    moveType: 0,
    moveSpeed: 3,
    moveFrequency: 3,
    walkAnime: true,
    stepAnime: false,
    directionFix: false,
    through,
    alwaysOnTop: false,
    condition: {
      switch1Valid: false,
      switch1: 1,
      switch2Valid: false,
      switch2: 1,
      variableValid: false,
      variable: 1,
      variableValue: 0,
      selfSwitch: '',
    },
    graphic: { tileId: 0, characterName: '', characterHue: 0, direction: 2, pattern: 0, opacity: 255, ...graphic },
    moveRoute: [],
    list: [...list, cmd(0, [])],
  };
}

const ev = (id, name, x, y, pages) => ({ id, name, x, y, pages });

const warp = (id, name, x, y, mapId, tx, ty, dir) =>
  ev(id, name, x, y, [page({ trigger: 1, through: true, list: [cmd(201, [0, mapId, tx, ty, dir, 0])] })]);

const talk = (id, name, x, y, charset, lines) => {
  const list = lines.map((text, i) => (i === 0 ? cmd(101, [text, '', 0, 0, 0, 1]) : cmd(401, [text])));
  return ev(id, name, x, y, [page({ trigger: 0, graphic: { characterName: charset }, list })]);
};

const pal17 = {
  '.': { ground: P.grass },
  ',': { ground: P.sand },
  '~': { ground: P.water },
  s: { ground: P.sand },
  M: { ground: P.dark },
  T: { ground: P.grass, object: P.tree },
  t: { ground: P.grass, object: P.canopy },
  '*': { ground: P.flower },
  b: { ground: P.grass, object: P.shrub },
};

// ---------------- 900 新月镇 (30x24) ----------------
function blank(w, h, ch) {
  return Array.from({ length: h }, () => Array(w).fill(ch));
}
function box(g, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] !== undefined) g[y][x] = ch;
}

const townGrid = blank(30, 24, '.');
box(townGrid, 0, 0, 29, 1, 'T');
box(townGrid, 0, 22, 29, 23, 'T');
box(townGrid, 0, 0, 1, 23, 'T');
box(townGrid, 28, 0, 29, 23, 'T');
// 中央广场 + 地铁口
box(townGrid, 9, 3, 17, 7, 's');
box(townGrid, 12, 4, 14, 4, 'M');
// 主路（东西贯通）+ 南北支路
box(townGrid, 0, 12, 29, 13, ',');
box(townGrid, 13, 8, 13, 11, ',');
box(townGrid, 13, 14, 13, 17, ',');
// 水池（西侧，避开道路）
box(townGrid, 4, 6, 7, 9, '~');
box(townGrid, 3, 7, 3, 8, 's');
// 树丛与花
for (const [x, y] of [[5, 3], [6, 3], [21, 4], [22, 4], [21, 5], [6, 15], [7, 16], [22, 15], [21, 16], [5, 18], [6, 18]]) townGrid[y][x] = 't';
for (const [x, y] of [[10, 10], [16, 10], [10, 15], [16, 15], [3, 10], [26, 10], [3, 15], [26, 15]]) townGrid[y][x] = '*';
for (const [x, y] of [[8, 5], [18, 5], [8, 19], [19, 19], [24, 8], [24, 17]]) townGrid[y][x] = 'b';
const townRows = townGrid.map((r) => r.join(''));
const town = makeMap(900, '新月镇', 17, townRows, pal17, 'T', 30);
const BX = 12;
const BY = 4;

const townEvents = [
  warp(1, '地铁口', BX, BY, 901, 10, 12, 8),
  warp(2, '西口', 1, 12, 902, 27, 12, 6),
  warp(3, '东口', 28, 12, 902, 2, 12, 4),
  talk(4, '村民', 8, 11, 'NPC 37', ['新月镇最近通了地铁，', '去二号道路再也不用绕远路了。']),
  talk(5, '站务员', 17, 8, 'NPC 39', ['地铁口就在北边广场，', '地上那个黑漆漆的洞口就是。']),
];

// ---------------- 901 地铁站台 (24x16, tileset 62) ----------------
const SW = 24;
const SH = 16;
const stationRows = [];
for (let y = 0; y < SH; y++) {
  let line = '';
  for (let x = 0; x < SW; x++) {
    const interior = x >= 4 && x <= 19 && y >= 2 && y <= 13;
    const wall = ((x === 3 || x === 20) && y >= 1 && y <= 14) || ((y === 1 || y === 14) && x >= 3 && x <= 20);
    const door = (x === 10 || x === 11) && (y === 1 || y === 14);
    if (interior || door) line += '.';
    else if (wall) line += y === 1 ? '=' : '#';
    else line += ' ';
  }
  stationRows.push(line);
}
const stationPal = {
  '#': { ground: P.floor, object: P.wall },
  '=': { ground: P.floor, object: P.wallTop },
  '.': { ground: P.floor },
  ' ': { ground: P.black },
};
const station = makeMap(901, '地铁站台', 62, stationRows, stationPal, ' ', SW);
// 站内装饰：自动售货机
for (const [x, y] of [[18, 6], [18, 7], [5, 6]]) station.set(x, y, 1, P.machine);

const stationEvents = [
  warp(1, '北出口', 10, 1, 900, BX, BY + 1, 2),
  warp(2, '南出口', 10, 14, 902, 2, 12, 6),
  talk(3, '站务员', 8, 7, 'NPC 61', ['欢迎乘坐先锋线。', '南边通往二号道路，北边回新月镇。']),
];

// ---------------- 902 二号道路 (30x24) ----------------
const routeGrid = blank(30, 24, '.');
box(routeGrid, 0, 0, 29, 1, 'T');
box(routeGrid, 0, 22, 29, 23, 'T');
box(routeGrid, 0, 0, 1, 23, 'T');
box(routeGrid, 28, 0, 29, 23, 'T');
// 主路：两端连接，中途向南北拐出两个小空地
box(routeGrid, 0, 12, 29, 13, ',');
box(routeGrid, 7, 8, 6, 11, ',');
box(routeGrid, 7, 8, 12, 8, ',');
box(routeGrid, 20, 14, 20, 18, ',');
box(routeGrid, 20, 18, 25, 18, ',');
// 池塘
box(routeGrid, 15, 15, 18, 18, '~');
box(routeGrid, 14, 16, 14, 17, 's');
// 树林与花丛
for (const [x, y] of [[4, 4], [5, 4], [4, 5], [24, 4], [25, 4], [25, 5], [4, 19], [5, 19], [24, 20], [25, 20]]) routeGrid[y][x] = 'T';
for (const [x, y] of [[9, 6], [10, 6], [9, 7], [20, 6], [21, 6], [21, 7], [9, 15], [10, 15], [10, 16]]) routeGrid[y][x] = 't';
for (const [x, y] of [[8, 5], [11, 5], [19, 10], [22, 10], [8, 17], [22, 16], [6, 10], [26, 8]]) routeGrid[y][x] = '*';
for (const [x, y] of [[3, 10], [26, 10], [3, 15], [26, 15], [13, 10], [17, 10]]) routeGrid[y][x] = 'b';
const routeRows = routeGrid.map((r) => r.join(''));
const route = makeMap(902, '二号道路', 17, routeRows, pal17, 'T', 30);
const routeEvents = [
  warp(1, '西口', 1, 12, 901, 10, 13, 8),
  warp(2, '东口', 28, 12, 900, 2, 12, 4),
  talk(3, '旅行者', 9, 11, 'NPC 23', ['这条路上草丛很密，', '走夜路要小心野生宝可梦。']),
];

// ---------------- 校验：连通性 + 传送落点 ----------------
function walkable(map, ts, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  for (const z of [2, 1, 0]) {
    const id = map.get(x, y, z);
    if (!id) continue;
    const passage = ts.passages[id] ?? 0;
    if ((passage & 0x0f) === 0x0f) return false;
    if ((ts.priorities[id] ?? 0) === 0) return true;
  }
  return true;
}

function reachable(map, ts, start) {
  const seen = new Set([`${start[0]},${start[1]}`]);
  const queue = [start];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !walkable(map, ts, nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

function report(map, ts, label) {
  let total = 0;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (walkable(map, ts, x, y)) total++;
  const reach = reachable(map, ts, [map.width >> 1, map.height >> 1]);
  const ok = total === reach.size;
  console.log(`${label}: 可走 ${total} 格 / 从中心可达 ${reach.size} 格 ${ok ? '✓' : '✗ 有孤岛'}`);
  return reach;
}

const townReach = report(town, T17, '900 新月镇');
const stationReach = report(station, T62, '901 地铁站台');
const routeReach = report(route, T17, '902 二号道路');

const spots = [
  ['900 地铁口事件格', town, T17, BX, BY, true],
  ['900 西口事件格', town, T17, 1, 12, true],
  ['900 东口事件格', town, T17, 28, 12, true],
  ['901 北出口事件格', station, T62, 10, 1, true],
  ['901 南出口事件格', station, T62, 10, 14, true],
  ['902 西口事件格', route, T17, 1, 12, true],
  ['902 东口事件格', route, T17, 28, 12, true],
  ['901 落点(10,12)', station, T62, 10, 12, true],
  ['901 落点(10,13)', station, T62, 10, 13, true],
  ['900 落点(BX,BY+1)', town, T17, BX, BY + 1, true],
  ['900 落点(2,12)', town, T17, 2, 12, true],
  ['902 落点(2,12)', route, T17, 2, 12, true],
  ['902 落点(27,12)', route, T17, 27, 12, true],
];
for (const [label, map, ts, x, y] of spots) {
  if (!walkable(map, ts, x, y)) console.log(`  ✗ ${label} 不可走`);
}

// ---------------- 写盘 ----------------
function write(map, events) {
  fs.writeFileSync(
    `${DATA}/maps/${map.id}.json`,
    JSON.stringify({
      id: map.id,
      width: map.width,
      height: map.height,
      tilesetId: map.tilesetId,
      displayName: map.name,
      bgm: null,
      data: toB64(map.data),
      events,
    }),
  );
}
write(town, townEvents);
write(station, stationEvents);
write(route, routeEvents);

const infos = JSON.parse(fs.readFileSync(`${DATA}/mapinfos.json`, 'utf8'));
infos['900'] = { name: '新月镇', order: 900, parentId: 0 };
infos['901'] = { name: '地铁站台', order: 901, parentId: 0 };
infos['902'] = { name: '二号道路', order: 902, parentId: 0 };
fs.writeFileSync(`${DATA}/mapinfos.json`, JSON.stringify(infos));

console.log('written: 900 新月镇 / 901 地铁站台 / 902 二号道路');
