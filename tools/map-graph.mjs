// 从所有地图的事件里抽取传送关系，还原原作的连接图
import fs from 'node:fs';

const DATA = 'public/data';
const infos = JSON.parse(fs.readFileSync(`${DATA}/mapinfos.json`, 'utf8'));
const files = fs.readdirSync(`${DATA}/maps`);

const edges = new Map(); // "a->b" -> [{fromX,fromY,toX,toY}]
for (const f of files) {
  const map = JSON.parse(fs.readFileSync(`${DATA}/maps/${f}`, 'utf8'));
  for (const ev of map.events) {
    for (const page of ev.pages) {
      for (const cmd of page.list) {
        if (cmd.code !== 201) continue;
        const [mode, toMap, tx, ty] = cmd.params;
        if (mode !== 0 || !toMap || !infos[toMap]) continue;
        const key = `${map.id}->${toMap}`;
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push({ fx: ev.x, fy: ev.y, tx, ty });
      }
    }
  }
}

const row = (id) => {
  const m = JSON.parse(fs.readFileSync(`${DATA}/maps/${id}.json`, 'utf8'));
  return { w: m.width, h: m.height, name: infos[id]?.name ?? '' };
};

const pairs = new Map();
for (const [key, list] of edges) {
  const [a, b] = key.split('->').map(Number);
  const pk = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (!pairs.has(pk)) pairs.set(pk, { a: Math.min(a, b), b: Math.max(a, b), ab: [], ba: [] });
  const p = pairs.get(pk);
  if (a < b) p.ab.push(...list);
  else p.ba.push(...list);
}

const rows = [];
for (const p of pairs.values()) {
  const A = row(p.a);
  const B = row(p.b);
  // 判断是否“边缘相接”：出发格贴边，且落点贴对侧边
  const edge = (list, from, to) => {
    const m = list.filter((s) => {
      const nearRight = s.fx >= from.w - 3;
      const nearLeft = s.fx <= 2;
      const nearBottom = s.fy >= from.h - 3;
      const nearTop = s.fy <= 2;
      const landLeft = s.tx <= 3;
      const landRight = s.tx >= to.w - 4;
      const landTop = s.ty <= 3;
      const landBottom = s.ty >= to.h - 4;
      return (nearRight && landLeft) || (nearLeft && landRight) || (nearBottom && landTop) || (nearTop && landBottom);
    });
    return m;
  };
  const eab = edge(p.ab, A, B);
  const eba = edge(p.ba, B, A);
  rows.push({
    pair: `${p.a}<->${p.b}`,
    names: `${A.name}(${p.a},${A.w}x${A.h}) <-> ${B.name}(${p.b},${B.w}x${B.h})`,
    a2b: p.ab.length,
    b2a: p.ba.length,
    edgeA2B: eab.length,
    edgeB2A: eba.length,
    sample: eab[0] || p.ab[0] || eba[0] || p.ba[0] || null,
  });
}

rows.sort((x, y) => y.edgeA2B + y.edgeB2A - (x.edgeA2B + x.edgeB2A) || y.a2b + y.b2a - (x.a2b + x.b2a));
console.log('总传送边:', edges.size, '| 无向对:', rows.length);
for (const r of rows.slice(0, 18)) {
  console.log(
    `${r.pair.padEnd(9)} ${r.names}  双向传送 ${r.a2b}/${r.b2a}  贴边 ${r.edgeA2B}/${r.edgeB2A}  ${r.sample ? `样例 (${r.sample.fx},${r.sample.fy})->(${r.sample.tx},${r.sample.ty})` : ''}`,
  );
}
