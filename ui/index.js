// 获取 webview 元素
const webview = document.getElementById('biliWebview');
let currentRole = null; // 'host' or 'guest'
let roomId = '';

// 按钮状态切换
function setHostUI(show) {
  document.getElementById('hostInfo').style.display = show ? 'inline' : 'none';
  document.getElementById('guestInfo').style.display = show ? 'none' : 'inline';
}

// 通知 webview 里的脚本
function callBiliSyncFunction(funcName, ...args) {
  const js = `window.${funcName}(${args.map(a => JSON.stringify(a)).join(',')})`;
  webview.executeJavaScript(js).catch(err => console.warn('注入失败（页面可能未加载）:', err));
}

// 房主：创建房间
document.getElementById('btnHost').addEventListener('click', () => {
  // 生成随机房间 ID（8位字母数字）
  roomId = 'bili-' + Math.random().toString(36).substring(2, 10);
  document.getElementById('roomIdDisplay').textContent = roomId;
  setHostUI(true);
  document.getElementById('status').textContent = '等待房客连接...';

  // 加载 B站首页 or 空白，稍后由用户导航到视频
  webview.src = 'https://www.bilibili.com/';
  webview.addEventListener('dom-ready', () => {
    // 网页加载完成后，初始化房主
    callBiliSyncFunction('initAsHost', roomId);
  });
  currentRole = 'host';
});

// 房客：加入房间
document.getElementById('btnJoin').addEventListener('click', () => {
  roomId = document.getElementById('roomInput').value.trim();
  if (!roomId) return alert('请输入房间号喵');
  setHostUI(false);
  document.getElementById('status').textContent = '正在连接房主...';
  webview.src = 'about:blank'; // 房客先空白页面，等房主发送导航指令
  webview.addEventListener('dom-ready', () => {
    callBiliSyncFunction('initAsGuest', roomId);
  });
  currentRole = 'guest';
});

// 复制房间号
document.getElementById('btnCopy').addEventListener('click', () => {
  navigator.clipboard.writeText(roomId).then(() => alert('房间号已复制喵'));
});

// 断开连接按钮
document.getElementById('btnDisconnect').addEventListener('click', () => {
  callBiliSyncFunction('disconnect');
  setHostUI(false);
  document.getElementById('status').textContent = '未连接';
  webview.src = 'about:blank';
  currentRole = null;
});

// 监听 webview 传来的连接状态 (通过 console 或其他方式)
// 简单做法：在 bili-hijack.js 里调用 window.postMessage 到外层？
// 由于 webview 独立上下文，可以用 webview 的 'console-message' 事件接收状态
webview.addEventListener('console-message', (e) => {
  if (e.message.startsWith('[BiliSync] connected')) {
    document.getElementById('status').textContent = '已连接 喵！';
  } else if (e.message.startsWith('[BiliSync] disconnected')) {
    document.getElementById('status').textContent = '连接断开';
  }
});