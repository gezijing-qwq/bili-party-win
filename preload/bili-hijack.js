// ========== 动态加载 PeerJS ==========
(function() {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/peerjs@1.5.1/dist/peerjs.min.js'; // 国内可能慢，可换成自己的镜像
  script.onload = () => console.log('[BiliSync] PeerJS loaded');
  script.onerror = () => console.error('[BiliSync] PeerJS 加载失败，检查网络喵');
  document.head.appendChild(script);
})();

// ========== 全局变量 ==========
let peer = null;
let conn = null;
let isHost = false;
let currentRoomId = '';
let video = null;
let lastSentUrl = '';
let isApplyingRemoteCommand = false; // 防止本地事件触发反向发送

// ========== 工具：向控制台发状态 ==========
function log(msg) {
  console.log(`[BiliSync] ${msg}`);
}

// ========== 劫持播放器 ==========
function hijackPlayer() {
  const observer = new MutationObserver(() => {
    const v = document.querySelector('video');
    if (v && v !== video) {
      video = v;
      bindVideoEvents();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // 如果页面已经有 video（例如 B站直接打开的视频页）
  const checkExist = setInterval(() => {
    const v = document.querySelector('video');
    if (v) {
      video = v;
      bindVideoEvents();
      clearInterval(checkExist);
    }
  }, 500);
}

function bindVideoEvents() {
  if (!video) return;

  // 仅房主发送命令
  if (!isHost) return;

  video.addEventListener('play', () => sendCommand({ type: 'play', currentTime: video.currentTime }));
  video.addEventListener('pause', () => sendCommand({ type: 'pause' }));
  video.addEventListener('seeked', () => sendCommand({ type: 'seek', currentTime: video.currentTime }));
  video.addEventListener('ratechange', () => sendCommand({ type: 'rate', playbackRate: video.playbackRate }));

  // 监听 URL 变化 (导航)
  lastSentUrl = location.href;
  setInterval(() => {
    if (location.href !== lastSentUrl) {
      sendCommand({ type: 'navigate', url: location.href });
      lastSentUrl = location.href;
    }
  }, 1000);
}

// ========== 发送同步指令 ==========
function sendCommand(cmd) {
  if (conn && conn.open) {
    conn.send(JSON.stringify(cmd));
    log(`发送指令: ${cmd.type}`);
  }
}

// ========== 接收同步指令 ==========
function handleRemoteCommand(cmd) {
  if (!video) return;
  isApplyingRemoteCommand = true;
  switch (cmd.type) {
    case 'play':
      video.currentTime = cmd.currentTime || video.currentTime;
      video.play().catch(() => {
        // 自动播放被阻止，提示用户
        alert('请点击屏幕任意位置允许自动播放喵');
      });
      break;
    case 'pause':
      video.pause();
      break;
    case 'seek':
      video.currentTime = cmd.currentTime;
      break;
    case 'rate':
      video.playbackRate = cmd.playbackRate;
      break;
    case 'navigate':
      if (cmd.url && location.href !== cmd.url) {
        location.href = cmd.url;
      }
      break;
  }
  setTimeout(() => { isApplyingRemoteCommand = false; }, 100);
}

// ========== 房客侧本地事件不做处理 ==========
// 房主发送命令时会触发本地事件，需要屏蔽
// 但是房客不需要绑定发送事件，所以直接不绑定即可。

// ========== P2P 初始化函数 ==========
window.initAsHost = function(roomId) {
  isHost = true;
  currentRoomId = roomId;
  if (peer) peer.destroy();
  peer = new Peer(roomId, { debug: 2 });
  peer.on('open', (id) => {
    log(`房主 Peer 已创建，房间号：${id}`);
    console.log(`[BiliSync] connected host`);
  });
  peer.on('connection', (incomingConn) => {
    if (conn) conn.close();
    conn = incomingConn;
    setupConnection(conn);
    log('房客已连接');
    console.log(`[BiliSync] connected`);
  });
  peer.on('disconnected', () => {
    log('Peer 断开');
    console.log(`[BiliSync] disconnected`);
  });
  // 等待页面加载，劫持播放器
  hijackPlayer();
};

window.initAsGuest = function(roomId) {
  isHost = false;
  currentRoomId = roomId;
  if (peer) peer.destroy();
  peer = new Peer();
  peer.on('open', (id) => {
    log(`房客 Peer ID: ${id}，正在连接房主...`);
    const c = peer.connect(roomId, { reliable: true });
    c.on('open', () => {
      conn = c;
      setupConnection(conn);
      log('已连接到房主');
      console.log(`[BiliSync] connected`);
    });
    c.on('error', (err) => {
      console.error('连接错误:', err);
      console.log(`[BiliSync] disconnected`);
    });
  });
  peer.on('disconnected', () => {
    console.log(`[BiliSync] disconnected`);
  });
  // 房客也要劫持播放器，可能页面还没加载视频（等到 navigate 时才加载）
  hijackPlayer();
};

function setupConnection(connection) {
  connection.on('data', (data) => {
    try {
      const cmd = JSON.parse(data);
      log(`收到指令: ${cmd.type}`);
      handleRemoteCommand(cmd);
    } catch (e) {
      console.error('指令解析失败:', e);
    }
  });
  connection.on('close', () => {
    log('连接关闭');
    console.log(`[BiliSync] disconnected`);
  });
}

window.disconnect = function() {
  if (conn) conn.close();
  if (peer) peer.destroy();
  conn = null;
  peer = null;
  log('已断开');
};

// ========== 页面卸载时清理 ==========
window.addEventListener('beforeunload', () => {
  window.disconnect();
});