/* ============================================================
   store.js — 数据层
   职责：默认数据、读写 localStorage、导入导出、统计计算
   全局导出 window.Store，无第三方依赖
   ============================================================ */

(function (global) {
  'use strict';

  var KEY = 'workspace_state_v1';
  var VERSION = 1;

  /* ---------- 工具 ---------- */

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function isoDate(d) {
    var t = d ? new Date(d) : new Date();
    var m = String(t.getMonth() + 1).padStart(2, '0');
    var day = String(t.getDate()).padStart(2, '0');
    return t.getFullYear() + '-' + m + '-' + day;
  }

  function addDays(base, n) {
    var d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  }

  /* ---------- 示例数据 ---------- */

  function seed() {
    var today = new Date();
    var d = function (n) { return isoDate(addDays(today, n)); };

    return {
      meta: {
        name: '个人工作台',
        version: VERSION,
        createdAt: new Date().toISOString()
      },
      tasks: [
        {
          id: uid('t'), title: '搭建工作台基础框架',
          desc: '完成六个视图的骨架与路由切换',
          status: 'done', priority: 'high', tag: '基础建设',
          due: d(-2), createdAt: d(-3), doneAt: d(-2), order: 0
        },
        {
          id: uid('t'), title: '设计数据模型与持久化方案',
          desc: 'localStorage 存储 + JSON 导入导出',
          status: 'done', priority: 'high', tag: '基础建设',
          due: d(-1), createdAt: d(-3), doneAt: d(-1), order: 1
        },
        {
          id: uid('t'), title: '任务看板拖拽交互',
          desc: '三列流转：待开始 → 进行中 → 已完成，支持拖动改变状态',
          status: 'doing', priority: 'high', tag: '交互',
          due: d(1), createdAt: d(-2), doneAt: null, order: 0
        },
        {
          id: uid('t'), title: '补充移动端响应式样式',
          desc: '窄屏下侧边栏折叠为顶部图标栏，看板单列展示',
          status: 'doing', priority: 'mid', tag: '界面',
          due: d(2), createdAt: d(-1), doneAt: null, order: 1
        },
        {
          id: uid('t'), title: '接入 GitHub 仓库版本管理',
          desc: '代码托管到私有仓库，便于多机同步与回溯',
          status: 'doing', priority: 'mid', tag: '工程',
          due: d(3), createdAt: d(-1), doneAt: null, order: 2
        },
        {
          id: uid('t'), title: '增加全文搜索',
          desc: '顶栏搜索框支持跨任务、待办、收藏、笔记筛选',
          status: 'todo', priority: 'mid', tag: '功能',
          due: d(4), createdAt: d(-1), doneAt: null, order: 0
        },
        {
          id: uid('t'), title: '周报视图',
          desc: '按周聚合完成任务与新增笔记，自动生成摘要',
          status: 'todo', priority: 'low', tag: '功能',
          due: d(7), createdAt: d(-1), doneAt: null, order: 1
        },
        {
          id: uid('t'), title: '数据加密与多端同步',
          desc: '评估 WebDAV / 对象存储方案，注意密钥不入库',
          status: 'todo', priority: 'low', tag: '工程',
          due: d(14), createdAt: d(-1), doneAt: null, order: 2
        }
      ],
      todos: [
        { id: uid('d'), text: '整理本周工作项，补齐看板卡片', done: false, createdAt: new Date().toISOString() },
        { id: uid('d'), text: '核对笔记中的技术方案结论', done: false, createdAt: new Date().toISOString() },
        { id: uid('d'), text: '导出一次 JSON 备份留档', done: false, createdAt: new Date().toISOString() },
        { id: uid('d'), text: '创建 GitHub 私有仓库并完成首次推送', done: true, createdAt: new Date().toISOString() }
      ],
      links: [
        {
          id: uid('l'), title: 'GitHub 仓库', url: 'https://github.com/DX8060',
          desc: '代码托管与版本回溯入口', category: '开发'
        },
        {
          id: uid('l'), title: 'GitHub Docs', url: 'https://docs.github.com',
          desc: 'GitHub 官方文档：仓库、Actions、Pages', category: '文档'
        },
        {
          id: uid('l'), title: 'MDN Web Docs', url: 'https://developer.mozilla.org',
          desc: 'HTML / CSS / JavaScript 权威参考', category: '文档'
        },
        {
          id: uid('l'), title: 'Can I use', url: 'https://caniuse.com',
          desc: '浏览器特性兼容性查询，落地前必查', category: '工具'
        },
        {
          id: uid('l'), title: 'Excalidraw', url: 'https://excalidraw.com',
          desc: '手绘风格白板，快速画架构草图', category: '工具'
        }
      ],
      notes: [
        {
          id: uid('n'), title: '工作台设计说明',
          content: '定位：单人使用、离线优先的个人工作台。\n\n三条设计原则：\n1. 数据自治 —— 全部数据存在本地，随时可导出为标准 JSON，不绑定任何平台。\n2. 零依赖 —— 不引入任何前端框架与 CDN，双击 index.html 即可运行，断网可用。\n3. 结构清晰 —— 任务看板负责「推进」，待办清单负责「当日执行」，笔记负责「沉淀」，三者不混用。\n\n取舍：放弃服务端同步，换取部署零成本与数据隐私；同步需求通过 Git 提交代码、JSON 备份迁移数据来满足。',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: uid('n'), title: '数据模型草案',
          content: 'state = { meta, tasks[], todos[], links[], notes[] }\n\n任务 tasks：status ∈ {todo, doing, done}；priority ∈ {high, mid, low}；doneAt 用于统计完成量。\n待办 todos：扁平结构，仅 done 布尔位，不参与看板流转。\n收藏 links：带 category 字段，用于顶部筛选条。\n笔记 notes：title + content 纯文本，updatedAt 用于排序。\n\n统计口径：近 7 日完成量 = tasks 中 doneAt 落在区间内的数量。',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };
  }

  /* ---------- 存储 ---------- */

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalize(state) {
    var s = state || {};
    return {
      meta: s.meta || { name: '个人工作台', version: VERSION },
      tasks: Array.isArray(s.tasks) ? s.tasks : [],
      todos: Array.isArray(s.todos) ? s.todos : [],
      links: Array.isArray(s.links) ? s.links : [],
      notes: Array.isArray(s.notes) ? s.notes : []
    };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return seed();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return seed();
      return normalize(parsed);
    } catch (e) {
      console.warn('[store] 读取失败，回退到示例数据', e);
      return seed();
    }
  }

  function save(state) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('[store] 写入失败', e);
      return false;
    }
  }

  function clear() {
    global.localStorage.removeItem(KEY);
  }

  function reset() {
    clear();
    return seed();
  }

  /* ---------- 导入导出 ---------- */

  function exportJSON(state) {
    var payload = {
      app: 'personal-workspace',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      data: state
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'workspace-backup-' + isoDate() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    var data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object') throw new Error('文件格式不正确');
    if (!Array.isArray(data.tasks) && !Array.isArray(data.todos) &&
        !Array.isArray(data.links) && !Array.isArray(data.notes)) {
      throw new Error('文件中未找到有效的数据字段');
    }
    return normalize(data);
  }

  /* ---------- 统计 ---------- */

  function last7Days() {
    var out = [];
    var now = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = addDays(now, -i);
      out.push({ date: isoDate(d), weekday: '日一二三四五六'[d.getDay()], count: 0 });
    }
    return out;
  }

  function completionSeries(state) {
    var series = last7Days();
    var index = {};
    series.forEach(function (p) { index[p.date] = p; });

    state.tasks.forEach(function (t) {
      if (t.status === 'done' && t.doneAt && index[t.doneAt]) {
        index[t.doneAt].count += 1;
      }
    });
    return series;
  }

  function stats(state) {
    var openTodos = state.todos.filter(function (t) { return !t.done; }).length;
    var doing = state.tasks.filter(function (t) { return t.status === 'doing'; }).length;
    var todoTasks = state.tasks.filter(function (t) { return t.status === 'todo'; }).length;
    var done = state.tasks.filter(function (t) { return t.status === 'done'; }).length;
    var total = state.tasks.length;
    var series = completionSeries(state);
    var week = series.reduce(function (n, p) { return n + p.count; }, 0);
    var rate = total ? Math.round((done / total) * 100) : 0;

    return {
      openTodos: openTodos,
      doing: doing,
      todoTasks: todoTasks,
      done: done,
      total: total,
      week: week,
      rate: rate,
      links: state.links.length,
      notes: state.notes.length,
      series: series
    };
  }

  /* ---------- 导出 ---------- */

  global.Store = {
    KEY: KEY,
    VERSION: VERSION,
    uid: uid,
    isoDate: isoDate,
    addDays: addDays,
    seed: seed,
    clone: clone,
    load: load,
    save: save,
    clear: clear,
    reset: reset,
    exportJSON: exportJSON,
    importJSON: importJSON,
    stats: stats,
    completionSeries: completionSeries
  };

})(window);
