import { ipcRenderer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

console.log('Worker process started');
console.log('Environment check:', {
  userAgent: navigator.userAgent,
  hasGpu: !!navigator.gpu,
  isSecureContext: window.isSecureContext
});

// 全局错误捕获，帮助调试 WASM 异常
window.addEventListener('unhandledrejection', event => {
  console.error('[Worker] Unhandled Rejection:', event.reason);
});

window.onerror = function(message, source, lineno, colno, error) {
  console.error('[Worker] Global Error:', { message, source, lineno, colno, error });
  return false;
};

ipcRenderer.on('sdcpp:run', async (_event, { exePath, args, id }) => {
  console.log(`Worker received run request for ${id}`, { exePath, args });
  
  // 1. 首先统一处理路径分隔符
  const normalizedArgs = args.map((arg: string) => {
    if (typeof arg === 'string' && (arg.includes('\\') || (arg.includes(':') && path.isAbsolute(arg)))) {
      return arg.replace(/\\/g, '/');
    }
    return arg;
  });

  // Diagnostic: Check if we can read the model files
  for (let i = 0; i < normalizedArgs.length; i++) {
    if (normalizedArgs[i] === '--diffusion-model' || normalizedArgs[i] === '--vae' || normalizedArgs[i] === '--t5xxl' || normalizedArgs[i] === '--llm') {
      const modelPath = args[i + 1];
      if (modelPath && fs.existsSync(modelPath)) {
        try {
          const stats = fs.statSync(modelPath);
          console.log(`[Worker] Diagnostic: Model file exists: ${modelPath}, size: ${stats.size} bytes`);
        } catch (e) {}
      }
    }
  }

  // 等待一小段时间确保 GPU 进程就绪
  await new Promise(resolve => setTimeout(resolve, 100));

  // 检查 WebGPU 支持情况
  if (!navigator.gpu) {
    const errorMsg = 'WebGPU is not available in this environment.';
    console.error(errorMsg);
    ipcRenderer.send(`sdcpp:error:${id}`, errorMsg);
    return;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      const errorMsg = 'WebGPU adapter not found.';
      ipcRenderer.send(`sdcpp:error:${id}`, errorMsg);
      return;
    }
    console.log('WebGPU adapter found:', adapter.name || 'Unknown Adapter');

    const scriptDir = path.dirname(exePath);
    const virtualMap: Record<string, string> = {};
    const outputFiles: string[] = [];
    
    const finalArgs = normalizedArgs.map((arg: string, index: number) => {
      if (typeof arg !== 'string') return arg;
      if (index > 0) {
        const prevArg = normalizedArgs[index - 1];
        if (['--diffusion-model', '--vae', '--t5xxl', '--llm', '--clip_l', '--clip_v', '--init-img', '-i', '-r', '--high-noise-diffusion-model', '--clip_vision'].includes(prevArg)) {
          const originalPath = args[index]; 
          if (fs.existsSync(originalPath)) {
            const vPath = `/input_${path.basename(originalPath)}`;
            virtualMap[vPath] = originalPath;
            return vPath;
          }
        }
      }
      if (index > 0 && (normalizedArgs[index - 1] === '--output' || normalizedArgs[index - 1] === '--preview-path')) {
        const vPath = `/${normalizedArgs[index - 1].replace('--', '')}_${path.basename(arg)}`;
        virtualMap[vPath] = args[index];
        outputFiles.push(vPath);
        return vPath;
      }
      return arg;
    });

    console.log('[Worker] Virtual path mapping:', virtualMap);

    // 3. 使用 fetch 获取文件 Blob（支持大文件）
    const fileBlobs: Record<string, { name: string, blob: Blob }> = {};
    for (const [vPath, rPath] of Object.entries(virtualMap)) {
      if (outputFiles.includes(vPath)) continue;
      try {
        console.log(`[Worker] Fetching blob for ${vPath} (${rPath})`);
        const response = await fetch(`file://${rPath.replace(/\\/g, '/')}`);
        const blob = await response.blob();
        fileBlobs[vPath] = {
          name: path.basename(vPath),
          blob: blob
        };
        console.log(`[Worker] Got blob for ${vPath}: ${blob.size} bytes`);
      } catch (e) {
        console.error(`[Worker] Failed to fetch blob for ${rPath}:`, e);
      }
    }

    // 4. 读取 WASM 二进制并创建 Blob URL
    const wasmPath = exePath.replace(/\.js$/, '.wasm');
    console.log(`[Worker] Loading WASM from: ${wasmPath}`);
    
    const wasmResponse = await fetch(`file://${wasmPath.replace(/\\/g, '/')}`);
    const wasmBlob = await wasmResponse.blob();
    const wasmBlobUrl = URL.createObjectURL(wasmBlob);
    console.log(`[Worker] WASM blob URL created: ${wasmBlobUrl}, size: ${wasmBlob.size} bytes`);

    // 读取 JS 文件内容
    const jsContent = fs.readFileSync(exePath, 'utf-8');
    const jsBlobUrl = URL.createObjectURL(new Blob([jsContent], { type: 'application/javascript' }));
    console.log(`[Worker] JS blob URL created: ${jsBlobUrl}`);

    // 5. 创建 Worker 代码（增强错误捕获、序列化异常并拦截 WASM 实例化）
    const workerCode = `
      let wasmBlobUrl = null;
      let fileBlobs = {};
      let outputFiles = [];
      let args = [];

      // 保存最近的 stdout/stderr 日志，方便在异常时发送出来
      const stdoutLogs = [];
      const stderrLogs = [];
      function pushStdout(line) { try { stdoutLogs.push({ t: Date.now(), text: String(line) }); if (stdoutLogs.length > 400) stdoutLogs.shift(); } catch(e){} }
      function pushStderr(line) { try { stderrLogs.push({ t: Date.now(), text: String(line) }); if (stderrLogs.length > 400) stderrLogs.shift(); } catch(e){} }

      function serializeErr(err) {
        try {
          const out = {
            name: err && err.name ? err.name : String(err),
            message: err && err.message ? err.message : String(err),
            toString: String(err)
          };
          try { Object.getOwnPropertyNames(err).forEach(k => { try { out[k] = String(err[k]); } catch(e) { out[k] = '<unserializable>'; } }); } catch(e) {}
          return out;
        } catch(e) { return { error: 'failed to serialize error', toString: String(err) }; }
      }

      // 全局错误捕获，转发给主线程以获取堆栈信息
      self.addEventListener('error', function(e) {
        try {
          const payload = { type: 'error', text: '[global error] ' + ((e && e.message) || String(e)), wasmLogs: { stdout: stdoutLogs.slice(-200), stderr: stderrLogs.slice(-200) } };
          if (e && e.error) payload.wasmException = serializeErr(e.error);
          self.postMessage(payload);
        } catch (err) { self.postMessage({ type: 'error', text: 'Error in error handler: ' + String(err) }); }
      });

      self.addEventListener('unhandledrejection', function(e) {
        try {
          const reason = e && e.reason ? e.reason : String(e);
          const payload = { type: 'error', text: '[unhandled rejection] ' + (reason && reason.message ? reason.message : String(reason)), wasmLogs: { stdout: stdoutLogs.slice(-200), stderr: stderrLogs.slice(-200) } };
          if (e && e.reason && typeof e.reason === 'object') payload.wasmException = serializeErr(e.reason);
          self.postMessage(payload);
        } catch (err) { self.postMessage({ type: 'error', text: 'Error in rejection handler: ' + String(err) }); }
      });

      self.onmessage = async function(e) {
        const { type } = e.data;

        if (type === 'init') {
          wasmBlobUrl = e.data.wasmBlobUrl;
          fileBlobs = e.data.fileBlobs;
          outputFiles = e.data.outputFiles;
          args = e.data.args;
          self.postMessage({ type: 'ready' });
          return;
        }

        if (type === 'run') {
          const jsBlobUrl = e.data.jsBlobUrl;

          // 配置 Module - 必须在 importScripts 之前设置
          self.Module = {
            arguments: args,
            locateFile: function(file) {
              try {
                if (file.endsWith('.wasm')) {
                  console.log('[WASM Worker] locateFile called for:', file, '-> returning:', wasmBlobUrl);
                  return wasmBlobUrl;
                }
                console.log('[WASM Worker] locateFile called for:', file);
                return file;
              } catch (err) {
                self.postMessage({ type: 'error', text: 'locateFile error: ' + String(err), stack: err && err.stack });
                return file;
              }
            },
            // 拦截 WASM 实例化以便更好地捕获错误
            instantiateWasm: function(imports, successCallback) {
              return fetch(wasmBlobUrl).then(r => r.arrayBuffer()).then(buf => {
                return WebAssembly.instantiate(buf, imports).then(res => {
                  successCallback(res.instance, res.module);
                  return res.instance;
                }).catch(err => {
                  self.postMessage({ type: 'error', text: 'instantiateWasm failed: ' + String(err), wasmError: serializeErr(err), wasmLogs: { stdout: stdoutLogs.slice(-200), stderr: stderrLogs.slice(-200) } });
                  throw err;
                });
              }).catch(err => { self.postMessage({ type: 'error', text: 'fetch wasm failed: ' + String(err), wasmError: serializeErr(err), wasmLogs: { stdout: stdoutLogs.slice(-200), stderr: stderrLogs.slice(-200) } }); throw err; });
            },
            preRun: [function() {
              const FS = self.FS;
              // 使用 WORKERFS 挂载大文件
              for (const vPath in fileBlobs) {
                const item = fileBlobs[vPath];
                const mountPoint = '/mnt_' + item.name.replace(/[^a-zA-Z0-9]/g, '_');
                try {
                  FS.mkdir(mountPoint);
                  FS.mount(FS.filesystems.WORKERFS, {
                    blobs: [{ name: item.name, data: item.blob }]
                  }, mountPoint);
                  // 创建符号链接到根目录
                  FS.symlink(mountPoint + '/' + item.name, vPath);
                  console.log('[WASM Worker] Mounted WORKERFS:', vPath, '->', mountPoint + '/' + item.name);
                } catch (err) {
                  console.error('[WASM Worker] Mount failed:', vPath, err);
                  self.postMessage({ type: 'stderr', text: '[WASM Worker] Mount failed: ' + String(err), stack: err && err.stack });
                }
              }

              // 预创建输出目录
              outputFiles.forEach(vPath => {
                try {
                  const dir = vPath.substring(0, vPath.lastIndexOf('/'));
                  if (dir && dir !== '/' && !FS.analyzePath(dir).exists) {
                    FS.mkdir(dir);
                  }
                } catch(e) {
                  // ignore
                }
              });
            }],
            print: function(text) { pushStdout(text); self.postMessage({ type: 'stdout', text: text }); },
            printErr: function(text) { pushStderr(text); self.postMessage({ type: 'stderr', text: text }); },
            onExit: function(code) {
              const outputs = {};
              if (code === 0) {
                outputFiles.forEach(vPath => {
                  try {
                    if (self.FS.analyzePath(vPath).exists) {
                      outputs[vPath] = self.FS.readFile(vPath);
                    }
                  } catch(e) {}
                });
              }
              self.postMessage({ type: 'exit', code: code, outputs: outputs });
            },
            onAbort: function(err) { self.postMessage({ type: 'error', text: 'WASM Aborted: ' + String(err), stack: err && err.stack, wasmError: serializeErr(err), wasmLogs: { stdout: stdoutLogs.slice(-200), stderr: stderrLogs.slice(-200) } }); }
          };

          // 使用 importScripts 加载 Emscripten 生成的 JS
          try {
            console.log('[WASM Worker] Importing scripts from:', jsBlobUrl);
            importScripts(jsBlobUrl);
          } catch (err) {
            const msg = err && err.message ? err.message : String(err);
            const stack = err && err.stack ? err.stack : null;
            self.postMessage({ type: 'error', text: 'Failed to import scripts: ' + msg, stack });
          }

          // 额外日志以便追踪运行状态
          try {
            self.postMessage({ type: 'stdout', text: '[WASM Worker] importScripts completed' });
            if (typeof Module !== 'undefined') self.postMessage({ type: 'stdout', text: '[WASM Worker] Module available' });
          } catch (err) {
            self.postMessage({ type: 'stderr', text: 'Post-import check failed: ' + String(err), stack: err && err.stack });
          }
        }
      };
    `;

    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    const wasmWorker = new Worker(workerUrl);

    wasmWorker.onmessage = (e) => {
      const { type, text, code, outputs } = e.data;
      if (type === 'ready') {
        // Worker 已准备好，发送运行命令
        console.log('[Worker] WASM Worker ready, sending run command');
        wasmWorker.postMessage({
          type: 'run',
          jsBlobUrl: jsBlobUrl
        });
      } else if (type === 'stdout') {
        ipcRenderer.send(`sdcpp:stdout:${id}`, text);
      } else if (type === 'stderr') {
        ipcRenderer.send(`sdcpp:stderr:${id}`, text);
      } else if (type === 'error') {
        // 如果错误包含序列化的 wasmException 对象，一并发送，便于主进程解析
        let extra = '';
        try {
          if (e.data && e.data.wasmException) extra = ' | wasmException: ' + JSON.stringify(e.data.wasmException);
          else if (e.data && e.data.stack) extra = ' | stack: ' + e.data.stack;

          if (e.data && e.data.wasmLogs) {
            try {
              const out = e.data.wasmLogs.stdout || [];
              const errL = e.data.wasmLogs.stderr || [];
              const lastOut = out.slice(-6).map(l => l.text).join('\n');
              const lastErr = errL.slice(-6).map(l => l.text).join('\n');
              extra += ` | wasmLogs stdout(last6): ${lastOut} | stderr(last6): ${lastErr}`;
            } catch(_e) { extra += ' | (failed to serialize wasmLogs)'; }
          }
        } catch(err) { extra = ' | (failed to serialize wasmException)'; }
        ipcRenderer.send(`sdcpp:error:${id}`, text + extra);
      } else if (type === 'exit') {
        // 将输出文件写回磁盘
        if (outputs) {
          for (const [vPath, data] of Object.entries(outputs)) {
            const rPath = virtualMap[vPath];
            if (rPath) {
              console.log(`[Worker] Writing output to disk: ${rPath}`);
              fs.writeFileSync(rPath, Buffer.from(data as Uint8Array));
            }
          }
        }
        ipcRenderer.send(`sdcpp:exit:${id}`, code);
        wasmWorker.terminate();
        URL.revokeObjectURL(workerUrl);
        URL.revokeObjectURL(wasmBlobUrl);
        URL.revokeObjectURL(jsBlobUrl);
      }
    };

    wasmWorker.onerror = (e) => {
      console.error('[Worker] WASM Worker error:', e);
      ipcRenderer.send(`sdcpp:error:${id}`, e.message || 'Worker error');
    };

    // 发送初始化消息
    wasmWorker.postMessage({
      type: 'init',
      wasmBlobUrl: wasmBlobUrl,
      fileBlobs: fileBlobs,
      outputFiles: outputFiles,
      args: finalArgs
    });

  } catch (error: any) {
    console.error('Worker execution error:', error);
    ipcRenderer.send(`sdcpp:error:${id}`, error.message);
  }
});
