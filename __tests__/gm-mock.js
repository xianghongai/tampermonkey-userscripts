// Tampermonkey API 的测试替身，供各脚本的测试页在扩展之外运行脚本本体。
// 只实现日常用到的接口，不追求完整覆盖；只面向最新版浏览器，不做兼容处理。
//
// 用法：以普通脚本在脚本本体之前引入，data-* 属性填写 GM_info.script 的字段，省略时 name 取页面标题。
//   <script src="../../__tests__/gm-mock.js" data-name="Copy it 🚀" data-version="1.6.0"></script>
//   <script src="../copy-it.user.js"></script>
//
// 测试页通过 GM_mock 读取记录、预置数据、模拟网络响应，详见下方 GMMock 的注释。
// 新增接口时保持 GM_* 与 GM.* 两套写法一致：GM_* 同步返回，GM.* 返回 Promise。
// 官方文档：https://www.tampermonkey.net/documentation.php

(() => {
  'use strict';

  const config = document.currentScript?.dataset ?? {};

  // ---------- 记录 ----------

  /**
   * 测试页操作替身的入口，挂在全局的 GM_mock 上。
   * 每次 GM_* 调用都记下来并派发 call 事件，测试页可以断言，也可以实时显示在页面上；
   * 菜单命令增删时派发 menuchange 事件。
   */
  class GMMock extends EventTarget {
    /** 全部调用，按时间顺序：{ name, args, time } */
    calls = [];
    /** GM_setClipboard 复制过的内容 */
    clipboard = [];
    /** GM_*Value 的存储，测试页可以直接写入来预置数据 */
    values = new Map();
    /** 已注册的菜单命令，键为命令 id */
    menu = new Map();
    /** GM_notification 收到的通知选项 */
    notifications = [];
    /** GM_openInTab 返回的标签页对象 */
    openedTabs = [];
    #interceptors = [];

    /**
     * 记录一次调用并派发 call 事件，供各 GM_* 实现调用。
     * @param {string} name 接口名，例如 'GM_setClipboard'
     * @param {unknown[]} args 调用参数
     */
    record(name, args) {
      const call = { name, args, time: Date.now() };
      this.calls.push(call);
      this.dispatchEvent(new CustomEvent('call', { detail: call }));
    }

    /**
     * 取某个接口每次被调用时的参数。
     * @param {string} name 接口名，例如 'GM_setClipboard'
     * @returns {unknown[][]}
     */
    callsOf(name) {
      return this.calls.filter((call) => call.name === name).map((call) => call.args);
    }

    /**
     * 最近一次复制的内容，没有复制过时为 undefined。
     * @returns {string | undefined}
     */
    get lastCopied() {
      return this.clipboard.at(-1);
    }

    /**
     * 清空记录、存储与模拟响应，用于每个用例之前。
     * 已注册的菜单命令属于脚本加载时的状态，默认保留。
     * @param {{ menu?: boolean }} [options] menu 为 true 时一并清空菜单命令
     */
    reset({ menu = false } = {}) {
      this.calls.length = 0;
      this.clipboard.length = 0;
      this.notifications.length = 0;
      this.openedTabs.length = 0;
      this.values.clear();
      this.#interceptors.length = 0;
      if (menu) this.menu.clear();
    }

    /**
     * 模拟 GM_xmlhttpRequest 的响应。按注册顺序询问，handler 返回响应对象时采用，返回 undefined 时交给下一个。
     * 都不处理时用 fetch 发出真实请求；file:// 页面上跨域请求通常会被拦下，测试里应当拦截。
     * @param {(details: object) => object | undefined | Promise<object | undefined>} handler
     *   响应对象可含 status、statusText、responseText、response、responseHeaders、finalUrl
     */
    intercept(handler) {
      this.#interceptors.push(handler);
    }

    /**
     * 依次询问已注册的 handler，返回第一个给出的响应，供 GM_xmlhttpRequest 内部使用。
     * @param {object} details GM_xmlhttpRequest 的参数
     * @returns {Promise<object | undefined>}
     */
    async resolveRequest(details) {
      for (const handler of this.#interceptors) {
        const result = await handler(details);
        if (result !== undefined) return result;
      }
      return undefined;
    }

    /**
     * 执行一条菜单命令，相当于在 Tampermonkey 菜单里点击它。
     * @param {string} name 注册时的标题
     * @returns {unknown} 命令回调的返回值
     */
    runMenuCommand(name) {
      const command = [...this.menu.values()].find((item) => item.name === name);
      if (!command) throw new Error(`Menu command not found: ${name}`);
      return command.callback(new MouseEvent('click'));
    }
  }

  const mock = new GMMock();
  const valueListeners = new Map();
  let nextId = 1;

  // ---------- 脚本信息 ----------

  /**
   * 脚本与脚本管理器的信息，字段取自引入本文件的 <script> 上的 data-* 属性。
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_info
   */
  const GM_info = {
    scriptHandler: 'GM mock',
    version: '0.0.0',
    script: {
      name: config.name ?? document.title,
      version: config.version ?? '0.0.0',
      namespace: config.namespace ?? '',
      description: config.description ?? '',
    },
  };

  // ---------- 剪贴板 ----------

  /**
   * 复制到剪贴板。只记录不写入系统剪贴板：真实写入需要页面获得焦点，读回又要授权，测试里两头都不可靠。
   * @param {string} data 要复制的内容
   * @param {string | { type?: string, mimetype?: string }} [info] 内容类型，例如 'text'
   * @param {() => void} [callback] 复制完成后调用
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_setClipboard
   */
  function GM_setClipboard(data, info, callback) {
    mock.record('GM_setClipboard', [data, info]);
    mock.clipboard.push(data);
    callback?.();
  }

  // ---------- 存储 ----------

  /**
   * 读取存储的值。用 structuredClone 取出，模拟真实存储的序列化：取出的对象与存入的不是同一个引用。
   * @param {string} key
   * @param {unknown} [defaultValue] 键不存在时返回
   * @returns {unknown}
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_values#api:GM_getValue
   */
  function GM_getValue(key, defaultValue) {
    mock.record('GM_getValue', [key, defaultValue]);
    return mock.values.has(key) ? structuredClone(mock.values.get(key)) : defaultValue;
  }

  /**
   * 写入存储，并通知该键的变化监听器。
   * @param {string} key
   * @param {unknown} value 需可被 structuredClone
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_values#api:GM_setValue
   */
  function GM_setValue(key, value) {
    mock.record('GM_setValue', [key, value]);
    const oldValue = mock.values.get(key);
    mock.values.set(key, structuredClone(value));
    notifyValueChange(key, oldValue, value);
  }

  /**
   * 删除存储的值，并通知该键的变化监听器。
   * @param {string} key
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_values#api:GM_deleteValue
   */
  function GM_deleteValue(key) {
    mock.record('GM_deleteValue', [key]);
    const oldValue = mock.values.get(key);
    mock.values.delete(key);
    notifyValueChange(key, oldValue, undefined);
  }

  /**
   * 列出存储中的全部键。
   * @returns {string[]}
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_values#api:GM_listValues
   */
  function GM_listValues() {
    mock.record('GM_listValues', []);
    return [...mock.values.keys()];
  }

  /**
   * 监听某个键的变化。
   * @param {string} key
   * @param {(key: string, oldValue: unknown, newValue: unknown, remote: boolean) => void} callback
   * @returns {number} 监听器 id，用于移除
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_values#api:GM_addValueChangeListener
   */
  function GM_addValueChangeListener(key, callback) {
    mock.record('GM_addValueChangeListener', [key]);
    const id = nextId++;
    valueListeners.set(id, { key, callback });
    return id;
  }

  /**
   * 移除变化监听器。
   * @param {number} id GM_addValueChangeListener 的返回值
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_values#api:GM_removeValueChangeListener
   */
  function GM_removeValueChangeListener(id) {
    mock.record('GM_removeValueChangeListener', [id]);
    valueListeners.delete(id);
  }

  /**
   * 通知某个键的变化监听器。测试页内的修改都来自本标签页，remote 恒为 false。
   * @param {string} key
   * @param {unknown} oldValue
   * @param {unknown} newValue
   */
  function notifyValueChange(key, oldValue, newValue) {
    for (const listener of valueListeners.values()) {
      if (listener.key === key) listener.callback(key, oldValue, newValue, false);
    }
  }

  // ---------- 样式与元素 ----------

  /**
   * 向页面添加样式，真实插入 <style>。
   * @param {string} css
   * @returns {HTMLStyleElement}
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_addStyle
   */
  function GM_addStyle(css) {
    mock.record('GM_addStyle', [css]);
    const style = document.createElement('style');
    style.textContent = css;
    (document.head ?? document.documentElement).append(style);
    return style;
  }

  /**
   * 创建元素并插入页面，支持 GM_addElement(tag, attrs) 与 GM_addElement(parent, tag, attrs) 两种写法。
   * attrs 中的 textContent 设为文字内容，其余设为属性。
   * @param {...unknown} args [parent,] tag, attrs
   * @returns {Element}
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_addElement
   */
  function GM_addElement(...args) {
    mock.record('GM_addElement', args);
    const [parent, tag, attrs = {}] = typeof args[0] === 'string'
      ? [document.head ?? document.documentElement, ...args]
      : args;
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (name === 'textContent') el.textContent = value;
      else el.setAttribute(name, value);
    }
    parent.append(el);
    return el;
  }

  // ---------- 菜单命令 ----------

  /**
   * 注册菜单命令，测试页用 GM_mock.runMenuCommand 执行。
   * @param {string} name 标题
   * @param {(event: MouseEvent) => unknown} callback
   * @param {string | { id?: number | string, accessKey?: string, autoClose?: boolean, title?: string }} [options]
   *   字符串视为 accessKey；带 id 时视为更新同一条命令
   * @returns {number | string} 命令 id
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_registerMenuCommand#api:GM_registerMenuCommand
   */
  function GM_registerMenuCommand(name, callback, options) {
    mock.record('GM_registerMenuCommand', [name, options]);
    const opts = typeof options === 'string' ? { accessKey: options } : (options ?? {});
    const id = opts.id ?? nextId++;
    mock.menu.set(id, { id, name, callback, ...opts });
    mock.dispatchEvent(new CustomEvent('menuchange'));
    return id;
  }

  /**
   * 移除菜单命令。
   * @param {number | string} id GM_registerMenuCommand 的返回值
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_registerMenuCommand#api:GM_unregisterMenuCommand
   */
  function GM_unregisterMenuCommand(id) {
    mock.record('GM_unregisterMenuCommand', [id]);
    mock.menu.delete(id);
    mock.dispatchEvent(new CustomEvent('menuchange'));
  }

  // ---------- 网络 ----------

  /**
   * 发出跨域请求。先查 GM_mock.intercept 设置的模拟响应，没有命中再用 fetch 发真实请求。
   * 回调与返回值按 Tampermonkey 的形状提供：onload、onerror、onabort、onloadend 收到响应对象，返回值带 abort()。
   * @param {{ url: string, method?: string, headers?: object, data?: BodyInit, responseType?: string,
   *   onload?: Function, onerror?: Function, onabort?: Function, onloadend?: Function }} details
   * @returns {{ abort: () => void }}
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_xmlhttpRequest
   */
  function GM_xmlhttpRequest(details) {
    mock.record('GM_xmlhttpRequest', [details]);
    const controller = new AbortController();
    const request = sendRequest(details, controller.signal);
    request.then(
      (response) => {
        details.onload?.(response);
        details.onloadend?.(response);
      },
      (error) => {
        const response = { status: 0, statusText: '', responseText: '', response: null, responseHeaders: '', finalUrl: details.url, error: error.message };
        (error.name === 'AbortError' ? details.onabort : details.onerror)?.(response);
        details.onloadend?.(response);
      },
    );
    return { abort: () => controller.abort() };
  }

  /**
   * 取得请求的响应：优先用模拟响应，否则用 fetch 发真实请求。
   * @param {object} details GM_xmlhttpRequest 的参数
   * @param {AbortSignal} signal
   * @returns {Promise<object>} 整理后的响应对象
   */
  async function sendRequest(details, signal) {
    const mocked = await mock.resolveRequest(details);
    if (mocked !== undefined) return normalizeResponse(details, mocked);

    const res = await fetch(details.url, {
      method: details.method ?? 'GET',
      headers: details.headers,
      body: details.data,
      signal,
    });
    const responseText = await res.text();
    return normalizeResponse(details, {
      status: res.status,
      statusText: res.statusText,
      responseText,
      responseHeaders: [...res.headers].map(([name, value]) => `${name}: ${value}`).join('\r\n'),
      finalUrl: res.url,
    });
  }

  /**
   * 把模拟或真实的响应整理成 Tampermonkey 响应对象的形状，缺省字段补默认值。
   * 按 responseType 补出 response 字段，模拟响应只写 responseText 也能用。
   * @param {object} details GM_xmlhttpRequest 的参数
   * @param {object} raw 原始响应
   * @returns {object}
   */
  function normalizeResponse(details, raw) {
    const responseText = raw.responseText ?? (typeof raw.response === 'string' ? raw.response : JSON.stringify(raw.response ?? ''));
    let response = raw.response;
    if (response === undefined) {
      response = details.responseType === 'json' ? JSON.parse(responseText || 'null') : responseText;
    }
    return {
      status: raw.status ?? 200,
      statusText: raw.statusText ?? 'OK',
      readyState: 4,
      responseHeaders: raw.responseHeaders ?? '',
      finalUrl: raw.finalUrl ?? details.url,
      responseText,
      response,
    };
  }

  // ---------- 其他 ----------

  /**
   * 显示桌面通知。只记录并输出到 Console，不真正弹出。
   * 支持 GM_notification(details, ondone) 与 GM_notification(text, title, image, onclick) 两种写法。
   * @param {string | { text: string, title?: string, image?: string, onclick?: Function, ondone?: Function }} details
   * @param {Function} [ondone] 对象写法下的关闭回调
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_notification
   */
  function GM_notification(details, ondone) {
    const opts = typeof details === 'string' ? { text: details, title: arguments[1], image: arguments[2], onclick: arguments[3] } : details;
    mock.record('GM_notification', [opts]);
    mock.notifications.push(opts);
    console.info('[GM_notification]', opts.title ?? '', opts.text);
    if (typeof details !== 'string') ondone?.();
  }

  /**
   * 在新标签页打开链接。只记录不打开，避免测试时弹出标签页；返回值的形状与 Tampermonkey 一致。
   * @param {string} url
   * @param {boolean | { active?: boolean, insert?: boolean, setParent?: boolean, incognito?: boolean }} [options]
   * @returns {{ url: string, closed: boolean, onclose: Function | null, close: () => void }}
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_openInTab
   */
  function GM_openInTab(url, options) {
    mock.record('GM_openInTab', [url, options]);
    const tab = { url, options, closed: false, onclose: null, close() { this.closed = true; this.onclose?.(); } };
    mock.openedTabs.push(tab);
    return tab;
  }

  /**
   * 输出日志到 Console。
   * @param {...unknown} args
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_log
   */
  function GM_log(...args) {
    mock.record('GM_log', args);
    console.log(...args);
  }

  // ---------- 导出 ----------
  const api = {
    GM_info,
    GM_setClipboard,
    GM_getValue,
    GM_setValue,
    GM_deleteValue,
    GM_listValues,
    GM_addValueChangeListener,
    GM_removeValueChangeListener,
    GM_addStyle,
    GM_addElement,
    GM_registerMenuCommand,
    GM_unregisterMenuCommand,
    GM_xmlhttpRequest,
    GM_notification,
    GM_openInTab,
    GM_log,
  };

  /**
   * Greasemonkey 4 风格的异步写法，Tampermonkey 同样提供，每个方法对应同名的 GM_* 并返回 Promise。
   * 官方文档在各 GM_* 条目中一并说明 GM.* 写法，链接见对应的 GM_* 函数。
   */
  const GM = {
    info: GM_info,
    setClipboard: async (...args) => GM_setClipboard(...args),
    getValue: async (...args) => GM_getValue(...args),
    setValue: async (...args) => GM_setValue(...args),
    deleteValue: async (...args) => GM_deleteValue(...args),
    listValues: async () => GM_listValues(),
    addStyle: async (...args) => GM_addStyle(...args),
    addElement: async (...args) => GM_addElement(...args),
    registerMenuCommand: async (...args) => GM_registerMenuCommand(...args),
    unregisterMenuCommand: async (...args) => GM_unregisterMenuCommand(...args),
    notification: async (...args) => GM_notification(...args),
    openInTab: async (...args) => GM_openInTab(...args),

    /**
     * GM_xmlhttpRequest 的 Promise 写法。与 Tampermonkey 一致：onload 时兑现，网络错误、中止时拒绝。
     * @param {object} details 同 GM_xmlhttpRequest
     * @returns {Promise<object>} 响应对象
     * @see https://www.tampermonkey.net/documentation.php?locale=en&q=GM_xmlhttpRequest
     */
    xmlHttpRequest: (details) => new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        ...details,
        onload: (res) => { details.onload?.(res); resolve(res); },
        onerror: (res) => { details.onerror?.(res); reject(res); },
        onabort: (res) => { details.onabort?.(res); reject(res); },
      });
    }),
  };

  /**
   * 页面的 window。测试页里脚本与页面在同一环境中运行，直接指向 globalThis。
   * @see https://www.tampermonkey.net/documentation.php?locale=en&q=unsafeWindow
   */
  const unsafeWindow = globalThis;

  Object.assign(globalThis, api, { GM, GM_mock: mock, unsafeWindow });
})();
