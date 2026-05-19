import { getState } from './state.js';

const RL_ALGOS = {
  DQN: { file: 'dqn.onnx', inputName: 'input' },
  DDQN: { file: 'ddqn.onnx', inputName: 'input' },
  DUELINGDQN: { file: 'dueling_dqn.onnx', inputName: 'input' },
  PPO: { file: 'ppo.onnx', inputName: 'input' },
  TRPO: { file: 'trpo.onnx', inputName: 'input' },
  A2C: { file: 'a2c.onnx', inputName: 'input' },
};

const sessionCache = new Map();
const loadingPromises = new Map();
const retryAfterTs = new Map();
const RETRY_DELAY_MS = 3000;

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function resolveModelUrlCandidates(fileName) {
  const baseCandidates = unique([
    (typeof import.meta !== 'undefined' && import.meta.url) || null,
    (typeof document !== 'undefined' && document.baseURI) || null,
    (typeof window !== 'undefined' && window.location?.href) || null,
  ]).map((base) => new URL('.', base).href);

  const pathCandidates = ['models/', './models/', '../models/', '/models/'];
  const urls = [];
  for (const base of baseCandidates) {
    for (const prefix of pathCandidates) {
      urls.push(new URL(`${prefix}${fileName}`, base).href);
    }
  }
  return unique(urls);
}

async function probeFirstModelUrl(fileName) {
  const candidates = resolveModelUrlCandidates(fileName);
  for (const url of candidates) {
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      if (resp.ok) return url;
    } catch (_) {
      // ignore and try next candidate
    }
  }
  return null;
}

async function loadSession(algoUpper) {
  if (sessionCache.has(algoUpper)) return sessionCache.get(algoUpper);
  if (loadingPromises.has(algoUpper)) return loadingPromises.get(algoUpper);

  const now = Date.now();
  const retryTs = retryAfterTs.get(algoUpper) || 0;
  if (now < retryTs) return null;

  const meta = RL_ALGOS[algoUpper];
  if (!meta) return null;
  if (typeof ort === 'undefined') {
    console.warn('ONNX Runtime Web 未加载');
    return null;
  }

  const promise = (async () => {
    try {
      const modelUrl = await probeFirstModelUrl(meta.file);
      if (!modelUrl) {
        retryAfterTs.set(algoUpper, Date.now() + RETRY_DELAY_MS);
        console.warn(`无法找到 ONNX 模型文件 ${meta.file}，请确认已放在 models/ 目录`);
        return null;
      }

      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
      });
      const inputName = session.inputNames.includes(meta.inputName)
        ? meta.inputName
        : session.inputNames[0];
      const outputName = session.outputNames[0];

      if (!inputName || !outputName) {
        retryAfterTs.set(algoUpper, Date.now() + RETRY_DELAY_MS);
        console.warn(`ONNX 模型 ${meta.file} 缺少有效输入/输出定义`);
        return null;
      }

      const loaded = {
        session,
        meta: { ...meta, inputName, outputName },
      };
      sessionCache.set(algoUpper, loaded);
      return loaded;
    } catch (e) {
      retryAfterTs.set(algoUpper, Date.now() + RETRY_DELAY_MS);
      console.warn(`无法加载 ONNX 模型 ${meta.file}:`, e);
      return null;
    } finally {
      loadingPromises.delete(algoUpper);
    }
  })();

  loadingPromises.set(algoUpper, promise);
  return promise;
}

export async function preloadOnnxModels() {
  await Promise.all(Object.keys(RL_ALGOS).map((k) => loadSession(k)));
}

export function createOnnxController(algoName) {
  const algoUpper = algoName.toUpperCase();
  loadSession(algoUpper).catch(() => {});

  return {
    async nextAction(gameLike) {
      try {
        const loaded = await loadSession(algoUpper);
        if (!loaded) return [1, 0, 0];

        const state = getState(gameLike);
        const input = new Float32Array(state);
        const tensor = new ort.Tensor('float32', input, [1, 11]);
        const feeds = { [loaded.meta.inputName]: tensor };
        const results = await loaded.session.run(feeds);
        const output = results[loaded.meta.outputName]?.data;
        if (!output || output.length < 3) return [1, 0, 0];

        let move = 0;
        let maxVal = output[0];
        for (let i = 1; i < Math.min(3, output.length); i++) {
          if (output[i] > maxVal) {
            maxVal = output[i];
            move = i;
          }
        }
        const act = [0, 0, 0];
        act[move] = 1;
        return act;
      } catch (e) {
        sessionCache.delete(algoUpper);
        console.warn(`${algoUpper} 推理失败，回退到默认动作:`, e);
        return [1, 0, 0];
      }
    },
  };
}
