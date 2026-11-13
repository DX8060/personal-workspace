/* ============================================================
   app.js — 交互层
   视图渲染、事件绑定、看板拖拽、弹窗、搜索、笔记编辑
   ============================================================ */

(function () {
  'use strict';

  var S = window.Store;

  /* ---------------- 状态 ---------------- */

  var state = S.load();
  var ui = {
    view: 'overview',
    query: '',
    activeNote: null,
    linkFilter: '全部',
    dragId: null
  };

  /* ---------------- 工具 ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function persist() {
    var ok = S.save(state);
    $('#storage-label').textContent = ok ? '本地存储已启用' : '存储空间不足';
    return ok;
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-show');
      setTimeout(function () { el.hidden = true; }, 220);
    }, 1900);
  }

  function cnDate(dateStr) {
    if (!dateStr) return '';
    var p = String(dateStr).split('-');
    return Number(p[1]) + '月' + Number(p[2]) + '日';
  }

  function todayCn() {
    var d = new Date();
    var w = '日一二三四五六'[d.getDay()];
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + w;
  }

  function relTime(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    var min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    var h = Math.floor(min / 60);
    if (h < 24) return h + ' 小时前';
    var d = Math.floor(h / 24);
    if (d < 30) return d + ' 天前';
    return cnDate(S.isoDate(iso));
  }

  function match(text) {
    if (!ui.query) return true;
    return String(text || '').toLowerCase().indexOf(ui.query.toLowerCase()) > -1;
  }

  function dueBadge(task) {
    if (!task.due) return '';
    var today = S.isoDate();
    var cls = 'badge due';
    if (task.status !== 'done' && task.due < today) cls += ' overdue';
    return '<span class="' + cls + '">' + esc(cnDate(task.due)) + '</span>';
  }

  /* ---------------- 视图框架 ---------------- */

  var VIEW_META = {
    overview: { title: '总览' },
    board: { title: '任务看板' },
    todo: { title: '待办清单' },
    links: { title: '链接收藏' },
    notes: { title: '笔记' },
    data: { title: '数据与设置' }
  };

  function switchView(view) {
    if (!VIEW_META[view]) return;
    ui.view = view;
    $$('.nav-item').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.view === view);
    });
    $$('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + view);
    });
    render();
    $('.main').scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setHeader() {
    $('#page-title').textContent = VIEW_META[ui.view].title;

    var st = S.stats(state);
    var sub = todayCn();
    if (ui.query) {
      var n = countMatches();
      sub = '搜索「' + ui.query + '」· 命中 ' + n + ' 项';
    } else if (ui.view === 'board') {
      sub = '共 ' + st.total + ' 个任务 · 进行中 ' + st.doing + ' · 已完成 ' + st.done;
    } else if (ui.view === 'todo') {
      sub = '未完成 ' + st.openTodos + ' 条 · 已完成 ' + (state.todos.length - st.openTodos) + ' 条';
    } else if (ui.view === 'links') {
      sub = '共收藏 ' + st.links + ' 个链接';
    } else if (ui.view === 'notes') {
      sub = '共 ' + st.notes + ' 篇笔记 · 本地保存';
    } else if (ui.view === 'data') {
      sub = '数据存于本机浏览器 · 支持 JSON 备份';
    }
    $('#page-sub').textContent = sub;
  }

  function countMatches() {
    if (!ui.query) return 0;
    var q = ui.query;
    var n = 0;
    state.tasks.forEach(function (t) { if (match(t.title) || match(t.desc) || match(t.tag)) n++; });
    state.todos.forEach(function (t) { if (match(t.text)) n++; });
    state.links.forEach(function (l) { if (match(l.title) || match(l.desc) || match(l.url)) n++; });
    state.notes.forEach(function (x) { if (match(x.title) || match(x.content)) n++; });
    return n;
  }

  /* ---------------- 总览 ---------------- */

  function renderOverview() {
    var st = S.stats(state);

    var cards = [
      { label: '未完成待办', value: st.openTodos, foot: '共 ' + state.todos.length + ' 条待办', tone: 'is-warn' },
      { label: '进行中任务', value: st.doing, foot: '待开始 ' + st.todoTasks + ' 个', tone: '' },
      { label: '近 7 日完成', value: st.week, foot: '累计完成 ' + st.done + ' 个任务', tone: 'is-success' },
      { label: '任务完成率', value: st.rate + '%', foot: st.done + ' / ' + st.total + ' 已完成', tone: 'is-plain' }
    ];

    $('#stat-grid').innerHTML = cards.map(function (c) {
      return '<div class="stat-card ' + c.tone + '">' +
        '<div class="stat-label">' + esc(c.label) + '</div>' +
        '<div class="stat-value">' + esc(c.value) + '</div>' +
        '<div class="stat-foot">' + esc(c.foot) + '</div>' +
        '</div>';
    }).join('');

    renderChart(st.series);
    renderTodayTodos();
    renderDoingTasks();
    renderRecentNotes();
  }

  function renderChart(series) {
    var W = 640, H = 172, padX = 10, baseY = 132, areaH = 96;
    var max = Math.max.apply(null, series.map(function (s) { return s.count; }).concat([1]));
    var slot = (W - padX * 2) / series.length;
    var barW = Math.min(44, slot * 0.5);

    var bars = series.map(function (p, i) {
      var h = Math.round((p.count / max) * areaH);
      if (p.count > 0) h = Math.max(h, 6);
      var x = padX + slot * i + (slot - barW) / 2;
      var y = baseY - h;
      var isToday = i === series.length - 1;

      return '' +
        '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(h, 2) + '" rx="5" fill="var(--accent)" fill-opacity="' + (isToday ? '1' : '0.28') + '"></rect>' +
        '<text class="chart-value" x="' + (x + barW / 2) + '" y="' + (y - 7) + '" text-anchor="middle">' + (p.count || '') + '</text>' +
        '<text class="chart-label" x="' + (x + barW / 2) + '" y="' + (baseY + 20) + '" text-anchor="middle">' +
        (isToday ? '今天' : '周' + p.weekday) + '</text>';
    }).join('');

    $('#activity-chart').innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="近 7 日完成任务数量">' +
      '<line x1="' + padX + '" y1="' + baseY + '" x2="' + (W - padX) + '" y2="' + baseY + '" stroke="var(--border)" stroke-width="1"></line>' +
      bars +
      '</svg>';
  }

  function renderTodayTodos() {
    var list = state.todos.filter(function (t) { return !t.done; }).slice(0, 6);
    var box = $('#today-todos');
    if (!list.length) {
      box.innerHTML = '<li><span class="empty" style="padding:0">待办已清空，保持节奏。</span></li>';
      return;
    }
    box.innerHTML = list.map(function (t) {
      return '<li>' +
        '<button class="check" data-check="' + t.id + '" aria-label="完成待办"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></button>' +
        '<span class="txt">' + esc(t.text) + '</span>' +
        '</li>';
    }).join('');
  }

  function renderDoingTasks() {
    var list = state.tasks.filter(function (t) {
      return t.status === 'doing' && (match(t.title) || match(t.desc));
    }).slice(0, 6);
    var box = $('#doing-tasks');
    if (!list.length) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1">暂无进行中的任务，去看板挑一个开始。</div>';
      return;
    }
    box.innerHTML = list.map(function (t) {
      return '<div class="mini-card">' +
        '<h4>' + esc(t.title) + '</h4>' +
        '<p>' + esc(t.desc || '无描述') + '</p>' +
        '<div class="task-meta">' + (t.tag ? '<span class="badge">' + esc(t.tag) + '</span>' : '') + dueBadge(t) + '</div>' +
        '</div>';
    }).join('');
  }

  function renderRecentNotes() {
    var list = state.notes.slice().sort(function (a, b) {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    }).slice(0, 4);
    var box = $('#recent-notes');
    if (!list.length) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1">还没有笔记。</div>';
      return;
    }
    box.innerHTML = list.map(function (n) {
      return '<div class="note-card" data-open-note="' + n.id + '">' +
        '<h4>' + esc(n.title || '无标题笔记') + '</h4>' +
        '<p>' + esc((n.content || '').replace(/\n/g, ' ').slice(0, 90)) + '</p>' +
        '<time>' + esc(relTime(n.updatedAt)) + '</time>' +
        '</div>';
    }).join('');
  }

  /* ---------------- 看板 ---------------- */

  var COLUMNS = [
    { key: 'todo', name: '待开始', color: 'var(--muted)' },
    { key: 'doing', name: '进行中', color: 'var(--accent)' },
    { key: 'done', name: '已完成', color: 'var(--success)' }
  ];

  function renderBoard() {
    var html = COLUMNS.map(function (col) {
      var items = state.tasks.filter(function (t) {
        return t.status === col.key && (match(t.title) || match(t.desc) || match(t.tag));
      }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

      var cards = items.map(function (t) {
        return '<article class="task-card" draggable="true" data-id="' + t.id + '">' +
          '<div class="task-card-top">' +
          '<i class="prio ' + esc(t.priority || 'mid') + '"></i>' +
          '<h4>' + esc(t.title) + '</h4>' +
          '<div class="task-actions">' +
          '<button class="icon-mini" data-edit="' + t.id + '" title="编辑"><svg viewBox="0 0 24 24"><path d="M3 17.2V21h3.8L17.9 9.9l-3.8-3.8L3 17.2zM20.7 7.1a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.9 1.9 3.8 3.8 1.9-1.9z"/></svg></button>' +
          '<button class="icon-mini danger" data-del="' + t.id + '" title="删除"><svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
          '</div></div>' +
          (t.desc ? '<p class="desc">' + esc(t.desc) + '</p>' : '') +
          '<div class="task-meta">' +
          (t.tag ? '<span class="badge">' + esc(t.tag) + '</span>' : '') +
          '<span class="badge">' + ({ high: '高优先', mid: '中优先', low: '低优先' }[t.priority] || '中优先') + '</span>' +
          dueBadge(t) +
          '</div></article>';
      }).join('');

      return '<section class="column" data-status="' + col.key + '">' +
        '<div class="column-head">' +
        '<span class="dot" style="background:' + col.color + '"></span>' +
        '<h3>' + col.name + '</h3>' +
        '<span class="count">' + items.length + '</span>' +
        '</div>' +
        cards +
        '<button class="add-task-btn" data-add="' + col.key + '">+ 添加任务</button>' +
        '</section>';
    }).join('');

    $('#board').innerHTML = html;
    bindBoardDnD();
  }

  function bindBoardDnD() {
    $$('.task-card').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        ui.dragId = card.dataset.id;
        card.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', card.dataset.id); } catch (err) { /* noop */ }
      });
      card.addEventListener('dragend', function () {
        card.classList.remove('is-dragging');
        ui.dragId = null;
        $$('.column').forEach(function (c) { c.classList.remove('is-over'); });
      });
    });

    $$('.column').forEach(function (col) {
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('is-over');
      });
      col.addEventListener('dragleave', function (e) {
        if (!col.contains(e.relatedTarget)) col.classList.remove('is-over');
      });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('is-over');
        var id = ui.dragId || e.dataTransfer.getData('text/plain');
        if (!id) return;
        moveTask(id, col.dataset.status);
      });
    });
  }

  function moveTask(id, status) {
    var t = state.tasks.filter(function (x) { return x.id === id; })[0];
    if (!t || t.status === status) return;
    t.status = status;
    if (status === 'done') {
      t.doneAt = S.isoDate();
      toast('已完成：' + t.title);
    } else {
      t.doneAt = null;
    }
    t.order = state.tasks.filter(function (x) { return x.status === status; }).length;
    persist();
    render();
  }

  /* ---------------- 待办 ---------------- */

  function renderTodos() {
    var list = state.todos.filter(function (t) { return match(t.text); });
    var undone = list.filter(function (t) { return !t.done; });
    var done = list.filter(function (t) { return t.done; });
    var ordered = undone.concat(done);
    var pct = list.length ? Math.round((done.length / list.length) * 100) : 0;

    $('#todo-meta').innerHTML =
      '<span>已完成 ' + done.length + ' / ' + list.length + '（' + pct + '%）</span>' +
      '<span class="progress-bar"><i style="width:' + pct + '%"></i></span>';

    var box = $('#todo-list');
    if (!ordered.length) {
      box.innerHTML = '<li><span class="empty" style="padding:6px 0">' + (ui.query ? '没有匹配的待办。' : '暂无待办，在上方输入框添加。') + '</span></li>';
      return;
    }

    box.innerHTML = ordered.map(function (t) {
      return '<li>' +
        '<button class="check ' + (t.done ? 'is-checked' : '') + '" data-toggle="' + t.id + '" aria-label="切换完成状态">' +
        '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></button>' +
        '<span class="txt ' + (t.done ? 'is-done' : '') + '">' + esc(t.text) + '</span>' +
        '<button class="icon-mini danger" data-del-todo="' + t.id + '" title="删除">' +
        '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
        '</li>';
    }).join('');
  }

  /* ---------------- 收藏 ---------------- */

  function renderLinks() {
    var cats = ['全部'];
    state.links.forEach(function (l) {
      var c = l.category || '其他';
      if (cats.indexOf(c) === -1) cats.push(c);
    });

    $('#link-filters').innerHTML = cats.map(function (c) {
      return '<button class="chip ' + (ui.linkFilter === c ? 'is-active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');

    var list = state.links.filter(function (l) {
      var okCat = ui.linkFilter === '全部' || (l.category || '其他') === ui.linkFilter;
      return okCat && (match(l.title) || match(l.desc) || match(l.url));
    });

    var box = $('#link-grid');
    if (!list.length) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1">没有符合条件的收藏。</div>';
      return;
    }

    box.innerHTML = list.map(function (l) {
      var host = '';
      try { host = new URL(l.url).hostname.replace(/^www\./, ''); } catch (e) { host = l.url; }
      var letter = (host || '?').charAt(0).toUpperCase();
      return '<a class="link-card" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
        '<div class="favicon">' + esc(letter) + '</div>' +
        '<h3>' + esc(l.title) + '</h3>' +
        '<div class="url">' + esc(host) + '</div>' +
        (l.desc ? '<div class="desc">' + esc(l.desc) + '</div>' : '') +
        '<div class="foot">' +
        '<span class="badge">' + esc(l.category || '其他') + '</span>' +
        '<button class="icon-mini danger del" data-del-link="' + l.id + '" title="删除收藏">' +
        '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
        '</div></a>';
    }).join('');
  }

  /* ---------------- 笔记 ---------------- */

  function renderNotes() {
    var list = state.notes.slice().sort(function (a, b) {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    }).filter(function (n) { return match(n.title) || match(n.content); });

    if (!ui.activeNote || !state.notes.some(function (n) { return n.id === ui.activeNote; })) {
      ui.activeNote = list.length ? list[0].id : null;
    }

    $('#notes-list').innerHTML = list.length ? list.map(function (n) {
      return '<li class="' + (n.id === ui.activeNote ? 'is-active' : '') + '" data-note="' + n.id + '">' +
        '<strong>' + esc(n.title || '无标题笔记') + '</strong>' +
        '<span>' + esc(relTime(n.updatedAt)) + '</span>' +
        '</li>';
    }).join('') : '<li><span class="empty" style="padding:6px 0">没有笔记</span></li>';

    var cur = state.notes.filter(function (n) { return n.id === ui.activeNote; })[0];
    $('#note-title').value = cur ? cur.title : '';
    $('#note-body').value = cur ? cur.content : '';
    $('#note-status').textContent = cur ? '最后更新：' + relTime(cur.updatedAt) : '未选择笔记';
    $('#note-title').disabled = !cur;
    $('#note-body').disabled = !cur;
  }

  /* ---------------- 数据页 ---------------- */

  function renderData() {
    var bytes = new Blob([JSON.stringify(state)]).size;
    var size = bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB';
    $('#kv-size').textContent =
      state.tasks.length + ' 任务 · ' + state.todos.length + ' 待办 · ' +
      state.links.length + ' 收藏 · ' + state.notes.length + ' 笔记（' + size + '）';
  }

  /* ---------------- 渲染入口 ---------------- */

  function render() {
    setHeader();
    if (ui.view === 'overview') renderOverview();
    if (ui.view === 'board') renderBoard();
    if (ui.view === 'todo') renderTodos();
    if (ui.view === 'links') renderLinks();
    if (ui.view === 'notes') renderNotes();
    if (ui.view === 'data') renderData();
  }

  /* ---------------- 弹窗 ---------------- */

  var modalSubmit = null;

  function openModal(opts) {
    $('#modal-title').textContent = opts.title;
    $('#modal-body').innerHTML = opts.body;
    $('#modal-foot').innerHTML = opts.foot || '';
    $('#modal-backdrop').hidden = false;
    modalSubmit = opts.onSubmit || null;

    var first = $('#modal-body input, #modal-body textarea, #modal-body select');
    if (first) setTimeout(function () { first.focus(); }, 40);

    if (opts.onMount) opts.onMount();
  }

  function closeModal() {
    $('#modal-backdrop').hidden = true;
    modalSubmit = null;
  }

  function submitModal() {
    if (typeof modalSubmit === 'function') {
      if (modalSubmit() === false) return;
    }
    closeModal();
  }

  function taskModal(task, presetStatus) {
    var isEdit = !!task;
    var t = task || {
      id: null, title: '', desc: '', status: presetStatus || 'todo',
      priority: 'mid', tag: '', due: ''
    };

    var body =
      '<div class="field"><label for="f-title">任务标题</label>' +
      '<input id="f-title" type="text" value="' + esc(t.title) + '" placeholder="要做什么？"></div>' +
      '<div class="field"><label for="f-desc">描述</label>' +
      '<textarea id="f-desc" placeholder="补充背景、验收标准（可选）">' + esc(t.desc) + '</textarea></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="f-status">状态</label><select id="f-status">' +
      COLUMNS.map(function (c) {
        return '<option value="' + c.key + '"' + (t.status === c.key ? ' selected' : '') + '>' + c.name + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label for="f-prio">优先级</label><select id="f-prio">' +
      '<option value="high"' + (t.priority === 'high' ? ' selected' : '') + '>高</option>' +
      '<option value="mid"' + (t.priority === 'mid' ? ' selected' : '') + '>中</option>' +
      '<option value="low"' + (t.priority === 'low' ? ' selected' : '') + '>低</option>' +
      '</select></div></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="f-tag">标签</label>' +
      '<input id="f-tag" type="text" value="' + esc(t.tag) + '" placeholder="如：界面 / 工程"></div>' +
      '<div class="field"><label for="f-due">截止日期</label>' +
      '<input id="f-due" type="date" value="' + esc(t.due) + '"></div></div>';

    openModal({
      title: isEdit ? '编辑任务' : '新建任务',
      body: body,
      foot: '<button class="btn btn-ghost" data-close>取消</button>' +
            '<button class="btn btn-primary" data-submit>' + (isEdit ? '保存' : '创建') + '</button>',
      onSubmit: function () {
        var title = $('#f-title').value.trim();
        if (!title) { $('#f-title').focus(); toast('请填写任务标题'); return false; }

        var status = $('#f-status').value;
        var payload = {
          title: title,
          desc: $('#f-desc').value.trim(),
          status: status,
          priority: $('#f-prio').value,
          tag: $('#f-tag').value.trim(),
          due: $('#f-due').value
        };

        if (isEdit) {
          Object.keys(payload).forEach(function (k) { t[k] = payload[k]; });
          if (status === 'done' && !t.doneAt) t.doneAt = S.isoDate();
          if (status !== 'done') t.doneAt = null;
          toast('任务已更新');
        } else {
          state.tasks.push({
            id: S.uid('t'),
            title: payload.title,
            desc: payload.desc,
            status: status,
            priority: payload.priority,
            tag: payload.tag,
            due: payload.due,
            createdAt: S.isoDate(),
            doneAt: status === 'done' ? S.isoDate() : null,
            order: state.tasks.filter(function (x) { return x.status === status; }).length
          });
          toast('任务已创建');
        }
        persist();
        render();
      }
    });
  }

  function linkModal() {
    openModal({
      title: '添加收藏',
      body:
        '<div class="field"><label for="l-title">标题</label>' +
        '<input id="l-title" type="text" placeholder="例如：GitHub Docs"></div>' +
        '<div class="field"><label for="l-url">链接</label>' +
        '<input id="l-url" type="text" placeholder="https://..."></div>' +
        '<div class="field"><label for="l-desc">说明</label>' +
        '<input id="l-desc" type="text" placeholder="这条链接解决什么问题（可选）"></div>' +
        '<div class="field"><label for="l-cat">分类</label>' +
        '<input id="l-cat" type="text" placeholder="开发 / 文档 / 工具" value="工具"></div>',
      foot: '<button class="btn btn-ghost" data-close>取消</button>' +
            '<button class="btn btn-primary" data-submit>添加</button>',
      onSubmit: function () {
        var url = $('#l-url').value.trim();
        var title = $('#l-title').value.trim();
        if (!url) { toast('请填写链接'); return false; }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        if (!title) {
          try { title = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { title = url; }
        }
        state.links.unshift({
          id: S.uid('l'), title: title, url: url,
          desc: $('#l-desc').value.trim(),
          category: $('#l-cat').value.trim() || '其他'
        });
        persist();
        render();
        toast('收藏已添加');
      }
    });
  }

  function confirmModal(title, text, onYes) {
    openModal({
      title: title,
      body: '<p style="font-size:13px;line-height:1.7;color:var(--text-2)">' + esc(text) + '</p>',
      foot: '<button class="btn btn-ghost" data-close>取消</button>' +
            '<button class="btn btn-primary" data-submit>确认</button>',
      onSubmit: onYes
    });
  }

  /* ---------------- 新建（上下文） ---------------- */

  function quickAdd() {
    if (ui.view === 'notes') { newNote(); return; }
    if (ui.view === 'links') { linkModal(); return; }
    if (ui.view === 'todo') { $('#todo-input').focus(); return; }
    if (ui.view === 'data') { S.exportJSON(state); return; }
    taskModal(null, ui.view === 'board' ? 'todo' : 'todo');
  }

  function newNote() {
    var n = {
      id: S.uid('n'),
      title: '',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.notes.unshift(n);
    ui.activeNote = n.id;
    persist();
    if (ui.view !== 'notes') switchView('notes'); else render();
    setTimeout(function () { $('#note-title').focus(); }, 60);
  }

  function saveNote() {
    var cur = state.notes.filter(function (n) { return n.id === ui.activeNote; })[0];
    if (!cur) { toast('请先选择或新建笔记'); return; }
    cur.title = $('#note-title').value.trim();
    cur.content = $('#note-body').value;
    cur.updatedAt = new Date().toISOString();
    persist();
    render();
    toast('笔记已保存');
  }

  /* ---------------- 事件绑定 ---------------- */

  function bind() {
    // 导航
    $('#nav').addEventListener('click', function (e) {
      var btn = e.target.closest('.nav-item');
      if (btn) switchView(btn.dataset.view);
    });

    document.addEventListener('click', function (e) {
      var goto = e.target.closest('[data-goto]');
      if (goto) switchView(goto.dataset.goto);

      var openNote = e.target.closest('[data-open-note]');
      if (openNote) {
        ui.activeNote = openNote.dataset.openNote;
        switchView('notes');
      }
    });

    // 主题
    $('#theme-toggle').addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('workspace_theme', next); } catch (e) { /* noop */ }
    });

    // 搜索
    var searchInput = $('#search-input');
    searchInput.addEventListener('input', function () {
      ui.query = searchInput.value.trim();
      render();
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { searchInput.value = ''; ui.query = ''; render(); searchInput.blur(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === 'Escape' && !$('#modal-backdrop').hidden) closeModal();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && ui.view === 'notes') {
        e.preventDefault(); saveNote();
      }
    });

    // 弹窗
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', function (e) {
      if (e.target === $('#modal-backdrop')) closeModal();
    });
    $('#modal-foot').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeModal();
      if (e.target.closest('[data-submit]')) submitModal();
    });
    $('#modal-body').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !/^(TEXTAREA)$/.test(e.target.tagName)) {
        e.preventDefault(); submitModal();
      }
    });

    // 总览：勾选待办
    $('#today-todos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-check]');
      if (!b) return;
      var t = state.todos.filter(function (x) { return x.id === b.dataset.check; })[0];
      if (t) { t.done = true; persist(); render(); toast('已完成一条待办'); }
    });

    // 看板：新增 / 编辑 / 删除
    $('#board').addEventListener('click', function (e) {
      var add = e.target.closest('[data-add]');
      if (add) { taskModal(null, add.dataset.add); return; }

      var edit = e.target.closest('[data-edit]');
      if (edit) {
        var t = state.tasks.filter(function (x) { return x.id === edit.dataset.edit; })[0];
        if (t) taskModal(t);
        return;
      }

      var del = e.target.closest('[data-del]');
      if (del) {
        var target = state.tasks.filter(function (x) { return x.id === del.dataset.del; })[0];
        if (!target) return;
        confirmModal('删除任务', '将永久删除「' + target.title + '」，此操作不可撤销。', function () {
          state.tasks = state.tasks.filter(function (x) { return x.id !== target.id; });
          persist(); render(); toast('任务已删除');
        });
      }
    });

    // 待办
    $('#todo-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#todo-input');
      var text = input.value.trim();
      if (!text) { input.focus(); return; }
      state.todos.unshift({ id: S.uid('d'), text: text, done: false, createdAt: new Date().toISOString() });
      input.value = '';
      persist(); render();
    });

    $('#todo-list').addEventListener('click', function (e) {
      var tg = e.target.closest('[data-toggle]');
      if (tg) {
        var t = state.todos.filter(function (x) { return x.id === tg.dataset.toggle; })[0];
        if (t) { t.done = !t.done; persist(); render(); }
        return;
      }
      var del = e.target.closest('[data-del-todo]');
      if (del) {
        state.todos = state.todos.filter(function (x) { return x.id !== del.dataset.delTodo; });
        persist(); render();
      }
    });

    $('#clear-done').addEventListener('click', function () {
      var n = state.todos.filter(function (t) { return t.done; }).length;
      if (!n) { toast('没有已完成的待办'); return; }
      confirmModal('清除已完成', '将删除 ' + n + ' 条已完成的待办记录。', function () {
        state.todos = state.todos.filter(function (t) { return !t.done; });
        persist(); render(); toast('已清除 ' + n + ' 条');
      });
    });

    // 收藏
    $('#add-link').addEventListener('click', linkModal);

    $('#link-filters').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-cat]');
      if (!chip) return;
      ui.linkFilter = chip.dataset.cat;
      renderLinks();
    });

    $('#link-grid').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del-link]');
      if (!del) return;
      e.preventDefault();
      e.stopPropagation();
      var l = state.links.filter(function (x) { return x.id === del.dataset.delLink; })[0];
      if (!l) return;
      confirmModal('删除收藏', '将移除「' + l.title + '」。', function () {
        state.links = state.links.filter(function (x) { return x.id !== l.id; });
        persist(); render(); toast('收藏已移除');
      });
    });

    // 笔记
    $('#new-note').addEventListener('click', newNote);
    $('#save-note').addEventListener('click', saveNote);

    $('#notes-list').addEventListener('click', function (e) {
      var li = e.target.closest('[data-note]');
      if (!li) return;
      ui.activeNote = li.dataset.note;
      renderNotes();
    });

    $('#delete-note').addEventListener('click', function () {
      var cur = state.notes.filter(function (n) { return n.id === ui.activeNote; })[0];
      if (!cur) return;
      confirmModal('删除笔记', '将删除「' + (cur.title || '无标题笔记') + '」。', function () {
        state.notes = state.notes.filter(function (n) { return n.id !== cur.id; });
        ui.activeNote = null;
        persist(); render(); toast('笔记已删除');
      });
    });

    // 数据
    $('#export-btn').addEventListener('click', function () {
      S.exportJSON(state);
      toast('备份已导出');
    });

    $('#import-btn').addEventListener('click', function () { $('#import-file').click(); });

    $('#import-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          state = S.importJSON(String(reader.result));
          persist(); ui.activeNote = null; render();
          toast('数据导入成功');
        } catch (err) {
          toast('导入失败：' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('#seed-btn').addEventListener('click', function () {
      confirmModal('恢复示例数据', '当前数据将被示例数据替换，建议先导出备份。', function () {
        state = S.seed();
        persist(); ui.activeNote = null; render();
        toast('已恢复示例数据');
      });
    });

    $('#reset-btn').addEventListener('click', function () {
      confirmModal('清空全部数据', '将删除所有任务、待办、收藏与笔记，且无法撤销。', function () {
        state = { meta: { name: '个人工作台', version: 1 }, tasks: [], todos: [], links: [], notes: [] };
        persist(); ui.activeNote = null; render();
        toast('数据已清空');
      });
    });

    // 新建
    $('#quick-add').addEventListener('click', quickAdd);
  }

  /* ---------------- 初始化 ---------------- */

  function hasStore() {
    try { return !!localStorage.getItem(S.KEY); } catch (e) { return true; }
  }

  function init() {
    try {
      var saved = localStorage.getItem('workspace_theme');
      if (saved) document.documentElement.dataset.theme = saved;
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.dataset.theme = 'dark';
      }
    } catch (e) { /* noop */ }

    if (!hasStore()) persist();

    bind();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
