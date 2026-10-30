// 把原作中边缘相接的地图拼成一张无缝大地图
// 依据：地图事件里的 201 传送（源格贴边、落点贴对侧边），以及两侧尺寸/图块集一致
import fs from 'node:fs';

const DATA = 'public/data';
const b64ToInt16 = (s) => {
  const b = Buffer.from(s, 'base64');
  return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
};
const toB64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

// 拼接配置：dy=-69 表示 132 的第 68 行落在合并图的 -1 行（紧贴 12 的第 0 行）
const MERGED = {
  id: 1000,
  name: '亚伦市（无缝）',
  tilesetId: 7,
  parts: [
    { mapId: 12, dx: 0, dy: 0, idBase: 0 },
    { mapId: 132, dx: 0, dy: -69, idBase: 1000 },
  ],
};

const load = (id) => JSON.parse(fs.readFileSync(`${DATA}/maps/${id}.json`, 'utf8'));
const parts = MERGED.parts.map((p) => ({ ...p, map: load(p.mapId) }));

const minX = Math.min(...parts.map((p) => p.dx));
const minY = Math.min(...parts.map((p) => p.dy));
const maxX = Math.max(...parts.map((p) => p.dx + p.map.width));
const maxY = Math.max(...parts.map((p) => p.dy + p.map.height));
const W = maxX - minX;
const H = maxY - minY;

const out = new Int16Array(W * H * 3);
const set = (x, y, z, v) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  out[(z * H + y) * W + x] = v;
};
const get = (x, y, z) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : out[(z * H + y) * W + x]);

for (const p of parts) {
  const src = b64ToInt16(p.map.data);
  const { width: sw, height: sh } = p.map;
  for (let z = 0; z < 3; z++) {
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const v = src[(z * sh + y) * sw + x];
        if (!v) continue;
        const dx = x + p.dx - minX;
        const dy = y + p.dy - minY;
        // 只在目标为空时写入，避免把已拼好的部分覆盖掉
        if (get(dx, dy, z) === 0) set(dx, dy, z, v);
      }
    }
  }
}

// 事件迁移：坐标平移、重写指向合并体内的 201、去掉跨缝的传送
const partnerOf = (mapId) => MERGED.parts.find((p) => p.mapId !== mapId);
const offsetOf = (mapId) => MERGED.parts.find((p) => p.mapId === mapId);

let events = [];
let droppedSeam = 0;
let rewrittenWarp = 0;

for (const p of parts) {
  const partner = partnerOf(p.mapId);
  for (const ev of p.map.events) {
    const x = ev.x + p.dx - minX;
    const y = ev.y + p.dy - minY;
    const pages = ev.pages.map((page) => {
      const list = [];
      for (const cmd of page.list) {
        if (cmd.code !== 201) {
          list.push(cmd);
          continue;
        }
        const [mode, toMap, tx, ty, dir] = cmd.params;
        if (mode !== 0 || !toMap) {
          list.push(cmd);
          continue;
        }
        const destPart = MERGED.parts.find((q) => q.mapId === toMap);
        if (!destPart) {
          list.push(cmd);
          continue;
        }
        const destY = ty + destPart.dy - minY;
        // 跨缝传送（落点与出发格相邻）直接去掉，让玩家平滑走过去
        if (toMap === partner.mapId && Math.abs(destY - y) <= 2) {
          droppedSeam++;
          continue;
        }
        rewrittenWarp++;
        list.push({ ...cmd, params: [0, MERGED.id, tx + destPart.dx - minX, destY, dir, 0] });
      }
      return { ...page, list };
    });

    // 只剩“结束”指令的页面说明这个事件本来就是纯传送，去掉
    const useful = pages.some((pg) => pg.list.some((c) => c.code !== 0));
    if (!useful) continue;

    events.push({ ...ev, id: ev.id + p.idBase, x, y, pages });
  }
}

const merged = {
  id: MERGED.id,
  width: W,
  height: H,
  tilesetId: MERGED.tilesetId,
  displayName: MERGED.name,
  bgm: parts[0].map.bgm,
  data: toB64(out),
  events,
};
fs.writeFileSync(`${DATA}/maps/${MERGED.id}.json`, JSON.stringify(merged));

const infos = JSON.parse(fs.readFileSync(`${DATA}/mapinfos.json`, 'utf8'));
infos[String(MERGED.id)] = { name: MERGED.name, order: MERGED.id, parentId: 0 };
fs.writeFileSync(`${DATA}/mapinfos.json`, JSON.stringify(infos));

console.log(`合并完成: ${W}x${H}, 事件 ${events.length}, 去掉跨缝传送 ${droppedSeam} 条, 改写体内传送 ${rewrittenWarp} 条`);
console.log('来源:', parts.map((p) => `${p.mapId}(${p.map.width}x${p.map.height}) dy=${p.dy}`).join(' + '));
