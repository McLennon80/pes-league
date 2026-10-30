// Vercel Serverless Function —— 实况足球联赛后端
// 路由：/api（前端统一 POST 到 /api，用 body.action 区分操作；GET /api 返回全部数据）
// 数据存储在 Upstash Redis（REST API），单个 key 保存整个联赛数据
const DATA_KEY = 'pes_league_data_v1';

function defaultData() {
  return {
    players: ['选手A', '选手B', '选手C', '选手D'],
    matches: []
  };
}

// ---- Upstash REST 调用 ----
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function redisGet(key) {
  return fetch(`${UPSTASH_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  }).then((r) => r.json()).then((j) => j.result);
}

function redisSet(key, value) {
  // 用 POST + body 方式；body 直接是原始字符串（Upstash 会原文存储）
  return fetch(`${UPSTASH_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'text/plain'
    },
    body: value
  }).then((r) => r.json()).then((j) => j.result);
}

async function loadData() {
  try {
    const raw = await redisGet(DATA_KEY);
    if (raw) {
      let parsed = raw;
      // 兼容可能存在的多层 JSON 编码：最多解析两次
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (e) { /* 保持原样 */ }
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (e) { /* 保持原样 */ }
      }
      if (parsed && Array.isArray(parsed.players) && Array.isArray(parsed.matches)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('读取数据失败：', e.message);
  }
  return defaultData();
}

function saveData(data) {
  return redisSet(DATA_KEY, JSON.stringify(data));
}

// ---- 响应工具 ----
function sendJSON(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// ---- 路由处理 ----
export default async function handler(req) {
  const method = req.method;

  try {
    // GET /api → 返回全部数据
    if (method === 'GET') {
      const data = await loadData();
      return sendJSON(200, data);
    }

    // POST /api → 通过 body.action 区分操作
    if (method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const action = body.action;

      // 添加比赛
      if (action === 'addMatch') {
        const { home, away, homeScore, awayScore, date, round, homeScorers, awayScorers } = body;
        if (!home || !away) return sendJSON(400, { error: '主队和客队不能为空' });
        if (home === away) return sendJSON(400, { error: '主队和客队不能相同' });

        const data = await loadData();
        const match = {
          id: Date.now(),
          home: String(home),
          away: String(away),
          homeScore: Math.max(0, parseInt(homeScore, 10) || 0),
          awayScore: Math.max(0, parseInt(awayScore, 10) || 0),
          date: date || '',
          round: (round || '友谊赛').toString(),
          homeScorers: Array.isArray(homeScorers) ? homeScorers.map(String) : [],
          awayScorers: Array.isArray(awayScorers) ? awayScorers.map(String) : []
        };
        data.matches.push(match);
        await saveData(data);
        return sendJSON(200, { ok: true, match });
      }

      // 删除比赛
      if (action === 'deleteMatch') {
        const id = Number(body.id);
        const data = await loadData();
        const before = data.matches.length;
        data.matches = data.matches.filter((m) => m.id !== id);
        if (data.matches.length === before) return sendJSON(404, { error: '未找到该比赛' });
        await saveData(data);
        return sendJSON(200, { ok: true });
      }

      // 添加选手
      if (action === 'addPlayer') {
        const name = String(body.name || '').trim();
        if (!name) return sendJSON(400, { error: '选手名不能为空' });
        const data = await loadData();
        if (data.players.includes(name)) return sendJSON(400, { error: '该选手已存在' });
        data.players.push(name);
        await saveData(data);
        return sendJSON(200, { ok: true, players: data.players });
      }

      // 删除选手
      if (action === 'deletePlayer') {
        const name = String(body.name || '');
        const data = await loadData();
        const before = data.players.length;
        data.players = data.players.filter((p) => p !== name);
        if (data.players.length === before) return sendJSON(404, { error: '未找到该选手' });
        await saveData(data);
        return sendJSON(200, { ok: true, players: data.players });
      }

      return sendJSON(400, { error: '未知操作：' + action });
    }

    return sendJSON(405, { error: 'Method Not Allowed' });
  } catch (e) {
    console.error('处理出错：', e.message);
    return sendJSON(500, { error: e.message || '服务器内部错误' });
  }
}
