// 实况足球联赛 - 后端服务（纯 Node.js，无第三方依赖）
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// ---- 数据持久化（JSON 文件，避免外部数据库依赖）----
function defaultData() {
  return {
    players: ['选手A', '选手B', '选手C', '选手D'],
    matches: []
  };
}

let data = defaultData();
let dataLoaded = false;

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players) && Array.isArray(parsed.matches)) {
        data = parsed;
        dataLoaded = true;
        return;
      }
    }
  } catch (e) {
    console.error('读取数据失败，使用默认数据：', e.message);
  }
  data = defaultData();
  dataLoaded = true;
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('保存数据失败：', e.message);
  }
}

// ---- HTTP 工具 ----
function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('JSON 解析失败'));
      }
    });
    req.on('error', reject);
  });
}

// ---- 路由 ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const method = req.method;

  try {
    // API：获取全部数据
    if (pathname === '/api/data' && method === 'GET') {
      return sendJSON(res, 200, data);
    }

    // API：添加比赛
    if (pathname === '/api/matches' && method === 'POST') {
      const body = await readBody(req);
      const { home, away, homeScore, awayScore, date, round, homeScorers, awayScorers } = body;
      if (!home || !away) return sendJSON(res, 400, { error: '主队和客队不能为空' });
      if (home === away) return sendJSON(res, 400, { error: '主队和客队不能相同' });

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
      saveData();
      return sendJSON(res, 200, { ok: true, match });
    }

    // API：删除比赛
    if (pathname === '/api/matches/delete' && method === 'POST') {
      const body = await readBody(req);
      const id = Number(body.id);
      const before = data.matches.length;
      data.matches = data.matches.filter((m) => m.id !== id);
      if (data.matches.length === before) return sendJSON(res, 404, { error: '未找到该比赛' });
      saveData();
      return sendJSON(res, 200, { ok: true });
    }

    // API：添加选手
    if (pathname === '/api/players' && method === 'POST') {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      if (!name) return sendJSON(res, 400, { error: '选手名不能为空' });
      if (data.players.includes(name)) return sendJSON(res, 400, { error: '该选手已存在' });
      data.players.push(name);
      saveData();
      return sendJSON(res, 200, { ok: true, players: data.players });
    }

    // API：删除选手
    if (pathname === '/api/players/delete' && method === 'POST') {
      const body = await readBody(req);
      const name = String(body.name || '');
      const before = data.players.length;
      data.players = data.players.filter((p) => p !== name);
      if (data.players.length === before) return sendJSON(res, 404, { error: '未找到该选手' });
      saveData();
      return sendJSON(res, 200, { ok: true, players: data.players });
    }

    // 静态文件：只允许 index.html
    if (pathname === '/' || pathname === '/index.html') {
      const file = path.join(__dirname, 'index.html');
      const content = fs.readFileSync(file, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(content);
    }

    return sendJSON(res, 404, { error: 'Not Found' });
  } catch (e) {
    console.error('请求处理出错：', e.message);
    return sendJSON(res, 500, { error: e.message || '服务器内部错误' });
  }
});

loadData();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`实况足球联赛服务已启动：http://0.0.0.0:${PORT}`);
});
