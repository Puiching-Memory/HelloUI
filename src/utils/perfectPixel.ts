/**
 * Perfect Pixel - TypeScript 原生实现 (浏览器端)
 * 自动检测像素风格图片的网格大小，并将其精确对齐到完美的像素网格。
 *
 * 移植自 Python 项目 engines/perfectPixel (MIT License)
 * 此实现无需任何原生依赖，完全基于 TypeScript + Canvas API。
 */

export type SampleMethod = 'center' | 'median' | 'majority'

export interface PerfectPixelOptions {
  sampleMethod?: SampleMethod
  /** 手动指定网格大小 [gridW, gridH], 为 null 则自动检测 */
  gridSize?: [number, number] | null
  /** 最小像素尺寸 (默认 4) */
  minSize?: number
  /** FFT 峰值检测的最小宽度 (默认 6) */
  peakWidth?: number
  /** 网格线细化强度, 推荐 0-0.5 (默认 0.25) */
  refineIntensity?: number
  /** 检测到近正方形时强制修正为正方形 (默认 true) */
  fixSquare?: boolean
}

export interface PerfectPixelResult {
  /** 像素网格宽度 */
  width: number
  /** 像素网格高度 */
  height: number
  /** 输出像素数据 (RGB Uint8Array, 每像素 3 字节) */
  data: Uint8Array
}

// ─── 色彩转换 / 归一化 ──────────────────────────────────────────────────

function rgbToGray(data: Uint8Array, W: number, H: number): Float32Array {
  const gray = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const off = i * 3
    gray[i] = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]
  }
  return gray
}

function normalizeMinMax(arr: Float32Array, a = 0, b = 1): Float32Array {
  let mn = Infinity, mx = -Infinity
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < mn) mn = arr[i]
    if (arr[i] > mx) mx = arr[i]
  }
  const out = new Float32Array(arr.length)
  const range = mx - mn
  if (range < 1e-8) {
    out.fill(a)
    return out
  }
  const scale = (b - a) / range
  for (let i = 0; i < arr.length; i++) {
    out[i] = a + (arr[i] - mn) * scale
  }
  return out
}

// ─── FFT (Cooley-Tukey radix-2) ───────────────────────────────────────

function nextPow2(v: number): number {
  let p = 1
  while (p < v) p <<= 1
  return p
}

function fft1d(re: Float64Array, im: Float64Array, n: number): void {
  let j = 0
  for (let i = 0; i < n; i++) {
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t
      t = im[i]; im[i] = im[j]; im[j] = t
    }
    let m = n >> 1
    while (m >= 1 && j >= m) { j -= m; m >>= 1 }
    j += m
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const angle = -2 * Math.PI / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0
      for (let k = 0; k < half; k++) {
        const idk = i + k
        const idkh = i + k + half
        const tRe = curRe * re[idkh] - curIm * im[idkh]
        const tIm = curRe * im[idkh] + curIm * re[idkh]
        re[idkh] = re[idk] - tRe
        im[idkh] = im[idk] - tIm
        re[idk] += tRe
        im[idk] += tIm
        const newWRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = newWRe
      }
    }
  }
}

function computeFFTMagnitude(gray: Float32Array, W: number, H: number): { mag: Float32Array; magW: number; magH: number } {
  const M = nextPow2(H)
  const N = nextPow2(W)

  const re = new Float64Array(M * N)
  const im = new Float64Array(M * N)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      re[y * N + x] = gray[y * W + x]
    }
  }

  // FFT 行
  const rowRe = new Float64Array(N)
  const rowIm = new Float64Array(N)
  for (let y = 0; y < M; y++) {
    const off = y * N
    for (let x = 0; x < N; x++) { rowRe[x] = re[off + x]; rowIm[x] = im[off + x] }
    fft1d(rowRe, rowIm, N)
    for (let x = 0; x < N; x++) { re[off + x] = rowRe[x]; im[off + x] = rowIm[x] }
  }

  // FFT 列
  const colRe = new Float64Array(M)
  const colIm = new Float64Array(M)
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < M; y++) { colRe[y] = re[y * N + x]; colIm[y] = im[y * N + x] }
    fft1d(colRe, colIm, M)
    for (let y = 0; y < M; y++) { re[y * N + x] = colRe[y]; im[y * N + x] = colIm[y] }
  }

  // magnitude + fftshift
  const mag = new Float32Array(M * N)
  const halfM = M >> 1
  const halfN = N >> 1
  for (let y = 0; y < M; y++) {
    for (let x = 0; x < N; x++) {
      const sy = (y + halfM) % M
      const sx = (x + halfN) % N
      const idx = sy * N + sx
      const r = re[y * N + x]
      const i = im[y * N + x]
      mag[idx] = 1 - Math.log1p(Math.sqrt(r * r + i * i))
    }
  }

  return { mag: normalizeMinMax(mag), magW: N, magH: M }
}

// ─── 1D 平滑 ────────────────────────────────────────────────────────────

function smooth1d(v: Float32Array, k = 17): Float32Array {
  k = Math.round(k)
  if (k < 3) return v
  if (k % 2 === 0) k++
  const sigma = k / 6
  const half = k >> 1
  const kernel = new Float32Array(k)
  let sum = 0
  for (let i = 0; i < k; i++) {
    const x = i - half
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma))
    sum += kernel[i]
  }
  for (let i = 0; i < k; i++) kernel[i] /= sum + 1e-8

  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) {
    let s = 0
    for (let j = 0; j < k; j++) {
      let idx = i + j - half
      if (idx < 0) idx = 0
      if (idx >= v.length) idx = v.length - 1
      s += kernel[j] * v[idx]
    }
    out[i] = s
  }
  return out
}

// ─── 峰值检测 ────────────────────────────────────────────────────────────

function detectPeak(proj: Float32Array, peakWidth = 6, relThr = 0.35, minDist = 6): number | null {
  const center = proj.length >> 1
  let mx = -Infinity
  for (let i = 0; i < proj.length; i++) if (proj[i] > mx) mx = proj[i]
  if (mx < 1e-6) return null
  const thr = mx * relThr

  interface Candidate { index: number; score: number }
  const candidates: Candidate[] = []

  for (let i = 1; i < proj.length - 1; i++) {
    let isPeak = true
    for (let j = 1; j < peakWidth; j++) {
      if (i - j < 0 || i + j >= proj.length) continue
      if (proj[i - j + 1] < proj[i - j] || proj[i + j - 1] < proj[i + j]) {
        isPeak = false
        break
      }
    }
    if (!isPeak || proj[i] < thr) continue

    let leftClimb = 0
    for (let k = i; k > 0; k--) {
      if (proj[k] > proj[k - 1]) leftClimb = Math.abs(proj[i] - proj[k - 1])
      else break
    }
    let rightFall = 0
    for (let k = i; k < proj.length - 1; k++) {
      if (proj[k] > proj[k + 1]) rightFall = Math.abs(proj[i] - proj[k + 1])
      else break
    }

    candidates.push({ index: i, score: Math.max(leftClimb, rightFall) })
  }

  if (candidates.length === 0) return null

  const left = candidates
    .filter(c => c.index < center - minDist && c.index > center * 0.25)
    .sort((a, b) => b.score - a.score)
  const right = candidates
    .filter(c => c.index > center + minDist && c.index < center * 1.75)
    .sort((a, b) => b.score - a.score)

  if (left.length === 0 || right.length === 0) return null
  return Math.abs(right[0].index - left[0].index) / 2
}

// ─── Sobel 算子 ──────────────────────────────────────────────────────────

function sobelXY(gray: Float32Array, W: number, H: number): { gx: Float32Array; gy: Float32Array } {
  const gx = new Float32Array(W * H)
  const gy = new Float32Array(W * H)

  const kx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
  const ky = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]

  // reflect padding to match Python's np.pad(..., mode='reflect')
  const getPixel = (x: number, y: number): number => {
    if (x < 0) x = -x
    else if (x >= W) x = 2 * (W - 1) - x
    if (y < 0) y = -y
    else if (y >= H) y = 2 * (H - 1) - y
    x = Math.max(0, Math.min(W - 1, x))
    y = Math.max(0, Math.min(H - 1, y))
    return gray[y * W + x]
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sx = 0, sy = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = getPixel(x + dx, y + dy)
          sx += v * kx[dy + 1][dx + 1]
          sy += v * ky[dy + 1][dx + 1]
        }
      }
      const idx = y * W + x
      gx[idx] = sx
      gy[idx] = sy
    }
  }

  return { gx, gy }
}

// ─── 网格检测核心 ─────────────────────────────────────────────────────────

function findBestGrid(origin: number, rangeMin: number, rangeMax: number, gradMag: Float32Array | Float64Array): number {
  let best = Math.round(origin)
  let bestVal = -Infinity
  let mx = -Infinity
  for (let i = 0; i < gradMag.length; i++) if (gradMag[i] > mx) mx = gradMag[i]
  if (mx < 1e-6) return best

  for (let i = -Math.round(rangeMin); i <= Math.round(rangeMax); i++) {
    const candidate = Math.round(origin + i)
    if (candidate <= 0 || candidate >= gradMag.length - 1) continue
    if (
      gradMag[candidate] > gradMag[candidate - 1] &&
      gradMag[candidate] > gradMag[candidate + 1]
    ) {
      if (gradMag[candidate] > bestVal) {
        bestVal = gradMag[candidate]
        best = candidate
      }
    }
  }
  return best
}

function arrayMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function estimateGridFFT(gray: Float32Array, W: number, H: number, peakWidth = 6): [number, number] | null {
  const { mag, magW, magH } = computeFFTMagnitude(gray, W, H)

  const halfW = magW >> 1
  const halfH = magH >> 1

  const rowSum = new Float32Array(magH)
  for (let y = 0; y < magH; y++) {
    let s = 0
    for (let x = 0; x < magW; x++) s += mag[y * magW + x]
    rowSum[y] = s
  }

  const colSum = new Float32Array(magW)
  for (let x = 0; x < magW; x++) {
    let s = 0
    const y0 = Math.max(0, halfH - (magH >> 1))
    const y1 = Math.min(magH, halfH + (magH >> 1))
    for (let y = y0; y < y1; y++) s += mag[y * magW + x]
    colSum[x] = s
  }

  const nRowSum = smooth1d(normalizeMinMax(rowSum), 17)
  const nColSum = smooth1d(normalizeMinMax(colSum), 17)

  const scaleRow = detectPeak(nRowSum, peakWidth)
  const scaleCol = detectPeak(nColSum, peakWidth)

  if (scaleRow == null || scaleCol == null || scaleCol <= 0) return null
  return [scaleCol, scaleRow]
}

function estimateGridGradient(gray: Float32Array, W: number, H: number, relThr = 0.2): [number | null, number | null] {
  const { gx, gy } = sobelXY(gray, W, H)

  const gradXSum = new Float64Array(W)
  const gradYSum = new Float64Array(H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      gradXSum[x] += Math.abs(gx[y * W + x])
      gradYSum[y] += Math.abs(gy[y * W + x])
    }
  }

  const peakX: number[] = []
  const peakY: number[] = []
  let thrX = -Infinity
  for (let i = 0; i < gradXSum.length; i++) if (gradXSum[i] > thrX) thrX = gradXSum[i]
  thrX *= relThr
  let thrY = -Infinity
  for (let i = 0; i < gradYSum.length; i++) if (gradYSum[i] > thrY) thrY = gradYSum[i]
  thrY *= relThr
  const minInterval = 4

  for (let i = 1; i < gradXSum.length - 1; i++) {
    if (gradXSum[i] > gradXSum[i - 1] && gradXSum[i] > gradXSum[i + 1] && gradXSum[i] >= thrX) {
      if (peakX.length === 0 || i - peakX[peakX.length - 1] >= minInterval) peakX.push(i)
    }
  }
  for (let i = 1; i < gradYSum.length - 1; i++) {
    if (gradYSum[i] > gradYSum[i - 1] && gradYSum[i] > gradYSum[i + 1] && gradYSum[i] >= thrY) {
      if (peakY.length === 0 || i - peakY[peakY.length - 1] >= minInterval) peakY.push(i)
    }
  }

  if (peakX.length < 4 || peakY.length < 4) return [null, null]

  const intervalsX: number[] = [], intervalsY: number[] = []
  for (let i = 1; i < peakX.length; i++) intervalsX.push(peakX[i] - peakX[i - 1])
  for (let i = 1; i < peakY.length; i++) intervalsY.push(peakY[i] - peakY[i - 1])

  return [Math.round(W / arrayMedian(intervalsX)), Math.round(H / arrayMedian(intervalsY))]
}

function detectGridScale(
  data: Uint8Array, W: number, H: number,
  peakWidth = 6, maxRatio = 1.5, minSize = 4,
): [number | null, number | null] {
  const gray = rgbToGray(data, W, H)

  let result = estimateGridFFT(gray, W, H, peakWidth)
  let gridW: number | null = result ? result[0] : null
  let gridH: number | null = result ? result[1] : null

  if (gridW != null && gridH != null) {
    const psx = W / gridW
    const psy = H / gridH
    if (
      Math.min(psx, psy) < minSize ||
      Math.max(psx, psy) > 20 ||
      psx / psy > maxRatio ||
      psy / psx > maxRatio
    ) {
      const gr = estimateGridGradient(gray, W, H)
      gridW = gr[0]; gridH = gr[1]
    }
  } else {
    const gr = estimateGridGradient(gray, W, H)
    gridW = gr[0]; gridH = gr[1]
  }

  if (gridW == null || gridH == null) return [null, null]

  const psx = W / gridW
  const psy = H / gridH
  const pixelSize = (psx / psy > maxRatio || psy / psx > maxRatio)
    ? Math.min(psx, psy)
    : (psx + psy) / 2

  return [Math.round(W / pixelSize), Math.round(H / pixelSize)]
}

// ─── 网格细化 ─────────────────────────────────────────────────────────────

function refineGrids(
  data: Uint8Array, W: number, H: number,
  gridX: number, gridY: number, refineIntensity = 0.25,
): { xCoords: number[]; yCoords: number[] } {
  const cellW = W / gridX
  const cellH = H / gridY
  const gray = rgbToGray(data, W, H)
  const { gx, gy } = sobelXY(gray, W, H)

  // Use Float64Array for gradient accumulation to reduce precision loss
  const gradXSum = new Float64Array(W)
  const gradYSum = new Float64Array(H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      gradXSum[x] += Math.abs(gx[y * W + x])
      gradYSum[y] += Math.abs(gy[y * W + x])
    }
  }

  const xCoords: number[] = []
  const yCoords: number[] = []

  let x = findBestGrid(W / 2, cellW, cellW, gradXSum)
  while (x < W + cellW / 2) {
    x = findBestGrid(x, cellW * refineIntensity, cellW * refineIntensity, gradXSum)
    xCoords.push(x)
    x += cellW
  }
  x = findBestGrid(W / 2, cellW, cellW, gradXSum) - cellW
  while (x > -cellW / 2) {
    x = findBestGrid(x, cellW * refineIntensity, cellW * refineIntensity, gradXSum)
    xCoords.push(x)
    x -= cellW
  }

  let y = findBestGrid(H / 2, cellH, cellH, gradYSum)
  while (y < H + cellH / 2) {
    y = findBestGrid(y, cellH * refineIntensity, cellH * refineIntensity, gradYSum)
    yCoords.push(y)
    y += cellH
  }
  y = findBestGrid(H / 2, cellH, cellH, gradYSum) - cellH
  while (y > -cellH / 2) {
    y = findBestGrid(y, cellH * refineIntensity, cellH * refineIntensity, gradYSum)
    yCoords.push(y)
    y -= cellH
  }

  xCoords.sort((a, b) => a - b)
  yCoords.sort((a, b) => a - b)
  return { xCoords, yCoords }
}

// ─── 采样方法 ─────────────────────────────────────────────────────────────

function sampleCenter(data: Uint8Array, W: number, H: number, xCoords: number[], yCoords: number[]): { out: Uint8Array; outW: number; outH: number } {
  const nx = xCoords.length - 1
  const ny = yCoords.length - 1
  const out = new Uint8Array(nx * ny * 3)

  for (let j = 0; j < ny; j++) {
    // Use Math.trunc to match Python's int() / np.int32 cast (truncation toward zero)
    const cy = Math.min(H - 1, Math.max(0, Math.trunc((yCoords[j] + yCoords[j + 1]) * 0.5)))
    for (let i = 0; i < nx; i++) {
      const cx = Math.min(W - 1, Math.max(0, Math.trunc((xCoords[i] + xCoords[i + 1]) * 0.5)))
      const srcOff = (cy * W + cx) * 3
      const dstOff = (j * nx + i) * 3
      out[dstOff] = data[srcOff]
      out[dstOff + 1] = data[srcOff + 1]
      out[dstOff + 2] = data[srcOff + 2]
    }
  }
  return { out, outW: nx, outH: ny }
}

function sampleMedian(data: Uint8Array, W: number, H: number, xCoords: number[], yCoords: number[]): { out: Uint8Array; outW: number; outH: number } {
  const nx = xCoords.length - 1
  const ny = yCoords.length - 1
  const out = new Uint8Array(nx * ny * 3)

  for (let j = 0; j < ny; j++) {
    let y0 = Math.max(0, Math.min(H, Math.round(yCoords[j])))
    let y1 = Math.max(0, Math.min(H, Math.round(yCoords[j + 1])))
    if (y1 <= y0) y1 = Math.min(y0 + 1, H)

    for (let i = 0; i < nx; i++) {
      let x0 = Math.max(0, Math.min(W, Math.round(xCoords[i])))
      let x1 = Math.max(0, Math.min(W, Math.round(xCoords[i + 1])))
      if (x1 <= x0) x1 = Math.min(x0 + 1, W)

      const cellValues: number[][] = [[], [], []]
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const off = (yy * W + xx) * 3
          cellValues[0].push(data[off])
          cellValues[1].push(data[off + 1])
          cellValues[2].push(data[off + 2])
        }
      }

      const dstOff = (j * nx + i) * 3
      if (cellValues[0].length === 0) {
        out[dstOff] = out[dstOff + 1] = out[dstOff + 2] = 0
      } else {
        for (let c = 0; c < 3; c++) {
          out[dstOff + c] = Math.round(arrayMedian(cellValues[c]))
        }
      }
    }
  }
  return { out, outW: nx, outH: ny }
}

function sqDist(a: number[], b: number[]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

function sampleMajority(
  data: Uint8Array, W: number, H: number,
  xCoords: number[], yCoords: number[],
  maxSamples = 128, iters = 6,
): { out: Uint8Array; outW: number; outH: number } {
  const nx = xCoords.length - 1
  const ny = yCoords.length - 1
  const out = new Uint8Array(nx * ny * 3)

  let seed = 0
  const nextRand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  for (let j = 0; j < ny; j++) {
    let y0 = Math.max(0, Math.min(H, Math.round(yCoords[j])))
    let y1 = Math.max(0, Math.min(H, Math.round(yCoords[j + 1])))
    if (y1 <= y0) y1 = Math.min(y0 + 1, H)

    for (let i = 0; i < nx; i++) {
      let x0 = Math.max(0, Math.min(W, Math.round(xCoords[i])))
      let x1 = Math.max(0, Math.min(W, Math.round(xCoords[i + 1])))
      if (x1 <= x0) x1 = Math.min(x0 + 1, W)

      const cellW = x1 - x0
      const cellH = y1 - y0
      const n = cellW * cellH
      if (n === 0) { continue }

      const samples: number[][] = []
      if (n > maxSamples) {
        for (let s = 0; s < maxSamples; s++) {
          const sy = y0 + Math.floor(nextRand() * cellH)
          const sx = x0 + Math.floor(nextRand() * cellW)
          const off = (sy * W + sx) * 3
          samples.push([data[off], data[off + 1], data[off + 2]])
        }
      } else {
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const off = (yy * W + xx) * 3
            samples.push([data[off], data[off + 1], data[off + 2]])
          }
        }
      }

      // 2-means 聚类
      const c0 = [...samples[0]]
      let farthestDist = 0, farthestIdx = 0
      for (let s = 1; s < samples.length; s++) {
        const dist = sqDist(samples[s], c0)
        if (dist > farthestDist) { farthestDist = dist; farthestIdx = s }
      }
      const c1 = [...samples[farthestIdx]]

      let count0 = 0, count1 = 0
      for (let iter = 0; iter < iters; iter++) {
        const sum0 = [0, 0, 0], sum1 = [0, 0, 0]
        count0 = 0; count1 = 0
        for (const s of samples) {
          if (sqDist(s, c1) < sqDist(s, c0)) {
            sum1[0] += s[0]; sum1[1] += s[1]; sum1[2] += s[2]; count1++
          } else {
            sum0[0] += s[0]; sum0[1] += s[1]; sum0[2] += s[2]; count0++
          }
        }
        if (count0 > 0) { c0[0] = sum0[0] / count0; c0[1] = sum0[1] / count0; c0[2] = sum0[2] / count0 }
        if (count1 > 0) { c1[0] = sum1[0] / count1; c1[1] = sum1[1] / count1; c1[2] = sum1[2] / count1 }
      }

      const dstOff = (j * nx + i) * 3
      const winner = count1 >= count0 ? c1 : c0
      out[dstOff] = Math.round(Math.max(0, Math.min(255, winner[0])))
      out[dstOff + 1] = Math.round(Math.max(0, Math.min(255, winner[1])))
      out[dstOff + 2] = Math.round(Math.max(0, Math.min(255, winner[2])))
    }
  }
  return { out, outW: nx, outH: ny }
}

// ─── Fix Square ──────────────────────────────────────────────────────────

function fixToSquare(outData: Uint8Array, w: number, h: number): { data: Uint8Array; width: number; height: number } {
  if (w > h) {
    if (w % 2 === 1) {
      const nw = w - 1
      const nd = new Uint8Array(nw * h * 3)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < nw; x++) {
          const s = (y * w + x) * 3, d = (y * nw + x) * 3
          nd[d] = outData[s]; nd[d + 1] = outData[s + 1]; nd[d + 2] = outData[s + 2]
        }
      }
      return { data: nd, width: nw, height: h }
    } else {
      const nh = h + 1
      const nd = new Uint8Array(w * nh * 3)
      for (let x = 0; x < w; x++) {
        const s = x * 3, d = x * 3
        nd[d] = outData[s]; nd[d + 1] = outData[s + 1]; nd[d + 2] = outData[s + 2]
      }
      nd.set(outData, w * 3)
      return { data: nd, width: w, height: nh }
    }
  } else {
    if (h % 2 === 1) {
      const nh = h - 1
      const nd = new Uint8Array(w * nh * 3)
      nd.set(outData.subarray(0, w * nh * 3))
      return { data: nd, width: w, height: nh }
    } else {
      const nw = w + 1
      const nd = new Uint8Array(nw * h * 3)
      for (let y = 0; y < h; y++) {
        const srcRow = y * w * 3, dstRow = y * nw * 3
        nd[dstRow] = outData[srcRow]; nd[dstRow + 1] = outData[srcRow + 1]; nd[dstRow + 2] = outData[srcRow + 2]
        for (let x = 0; x < w; x++) {
          const sOff = srcRow + x * 3, dOff = dstRow + (x + 1) * 3
          nd[dOff] = outData[sOff]; nd[dOff + 1] = outData[sOff + 1]; nd[dOff + 2] = outData[sOff + 2]
        }
      }
      return { data: nd, width: nw, height: h }
    }
  }
}

// ─── 网格坐标均衡（正方形输入保证正方形输出）────────────────────────────

/**
 * 当输入是正方形时，确保 xCoords 和 yCoords 长度相同。
 * 策略：从中心对称裁剪较长的坐标数组。
 */
function equalizeGridCoords(
  xCoords: number[], yCoords: number[],
): { xCoords: number[]; yCoords: number[] } {
  if (xCoords.length === yCoords.length) return { xCoords, yCoords }

  const targetLen = Math.min(xCoords.length, yCoords.length)

  const trimArr = (arr: number[], target: number): number[] => {
    if (arr.length <= target) return arr
    const excess = arr.length - target
    const trimStart = Math.floor(excess / 2)
    return arr.slice(trimStart, trimStart + target)
  }

  return {
    xCoords: trimArr(xCoords, targetLen),
    yCoords: trimArr(yCoords, targetLen),
  }
}

/**
 * 将坐标数组裁剪使输出像素数 (coords.length - 1) 为 2 的倍数。
 * 策略：若输出为奇数，从末尾去掉一个坐标。
 */
function alignCoordsToEven(coords: number[]): number[] {
  const outSize = coords.length - 1
  if (outSize <= 0 || outSize % 2 === 0) return coords
  // outSize 是奇数，去掉末尾一个坐标点使 outSize - 1 为偶数
  return coords.slice(0, -1)
}

// ─── 主函数 ──────────────────────────────────────────────────────────────

/**
 * Perfect Pixel 核心处理算法
 * @param rgbData - RGB Uint8Array (每像素 3 字节, row-major)
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param options - 处理参数
 * @returns 处理结果, 或 null (无法检测网格)
 */
export function getPerfectPixel(
  rgbData: Uint8Array,
  width: number,
  height: number,
  options: PerfectPixelOptions = {},
): PerfectPixelResult | null {
  const {
    sampleMethod = 'center',
    gridSize = null,
    minSize = 4,
    peakWidth = 6,
    refineIntensity = 0.25,
    fixSquare = true,
  } = options

  const isSquareInput = width === height

  let scaleCol: number | null, scaleRow: number | null

  if (gridSize) {
    [scaleCol, scaleRow] = gridSize
  } else {
    [scaleCol, scaleRow] = detectGridScale(rgbData, width, height, peakWidth, 1.5, minSize)
    if (scaleCol == null || scaleRow == null) return null
  }

  const sizeX = Math.round(scaleCol!)
  const sizeY = Math.round(scaleRow!)
  let { xCoords, yCoords } = refineGrids(rgbData, width, height, sizeX, sizeY, refineIntensity)

  // 正方形输入 → 强制 xCoords/yCoords 等长，保证输出也是正方形
  if (isSquareInput) {
    const eq = equalizeGridCoords(xCoords, yCoords)
    xCoords = eq.xCoords
    yCoords = eq.yCoords
  }

  // 强制输出尺寸为 2 的倍数（在采样前裁剪坐标）
  xCoords = alignCoordsToEven(xCoords)
  yCoords = alignCoordsToEven(yCoords)

  let result: { out: Uint8Array; outW: number; outH: number }
  switch (sampleMethod) {
    case 'majority':
      result = sampleMajority(rgbData, width, height, xCoords, yCoords)
      break
    case 'median':
      result = sampleMedian(rgbData, width, height, xCoords, yCoords)
      break
    default:
      result = sampleCenter(rgbData, width, height, xCoords, yCoords)
      break
  }

  let outData = result.out, outW = result.outW, outH = result.outH

  if (fixSquare && Math.abs(outW - outH) === 1) {
    const fixed = fixToSquare(outData, outW, outH)
    outData = fixed.data; outW = fixed.width; outH = fixed.height
  }

  return { width: outW, height: outH, data: outData }
}

/**
 * 调试用：导出网格坐标信息
 */
export function debugGetGridCoords(
  rgbData: Uint8Array,
  width: number,
  height: number,
  options: PerfectPixelOptions = {},
): { scaleCol: number; scaleRow: number; xCoords: number[]; yCoords: number[] } | null {
  const {
    gridSize = null,
    minSize = 4,
    peakWidth = 6,
    refineIntensity = 0.25,
  } = options

  let scaleCol: number | null, scaleRow: number | null
  if (gridSize) {
    [scaleCol, scaleRow] = gridSize
  } else {
    [scaleCol, scaleRow] = detectGridScale(rgbData, width, height, peakWidth, 1.5, minSize)
    if (scaleCol == null || scaleRow == null) return null
  }

  const sizeX = Math.round(scaleCol!)
  const sizeY = Math.round(scaleRow!)
  const { xCoords, yCoords } = refineGrids(rgbData, width, height, sizeX, sizeY, refineIntensity)
  return { scaleCol: scaleCol!, scaleRow: scaleRow!, xCoords, yCoords }
}

// ─── Canvas 辅助函数 (浏览器端) ──────────────────────────────────────────

/**
 * 从 HTMLImageElement 提取 RGB 数据
 */
export function imageToRGB(img: HTMLImageElement): { data: Uint8Array; width: number; height: number } {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const rgba = imageData.data
  const rgb = new Uint8Array(canvas.width * canvas.height * 3)
  for (let i = 0; i < canvas.width * canvas.height; i++) {
    rgb[i * 3] = rgba[i * 4]
    rgb[i * 3 + 1] = rgba[i * 4 + 1]
    rgb[i * 3 + 2] = rgba[i * 4 + 2]
  }
  return { data: rgb, width: canvas.width, height: canvas.height }
}

/**
 * 将 RGB 结果渲染到 Canvas 并返回 data URL (最近邻放大)
 */
export function resultToDataURL(result: PerfectPixelResult, scale = 1): string {
  const { width, height, data } = result
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!

  // 先绘制 1:1
  const imgData = ctx.createImageData(width, height)
  for (let i = 0; i < width * height; i++) {
    imgData.data[i * 4] = data[i * 3]
    imgData.data[i * 4 + 1] = data[i * 3 + 1]
    imgData.data[i * 4 + 2] = data[i * 3 + 2]
    imgData.data[i * 4 + 3] = 255
  }

  if (scale === 1) {
    ctx.putImageData(imgData, 0, 0)
  } else {
    // 最近邻放大: 先渲染到临时 canvas, 再缩放
    const tmp = document.createElement('canvas')
    tmp.width = width
    tmp.height = height
    tmp.getContext('2d')!.putImageData(imgData, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmp, 0, 0, width * scale, height * scale)
  }

  return canvas.toDataURL('image/png')
}

/**
 * 将 data URL 转换为 Blob 以供下载
 */
export function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',')
  const mime = parts[0].match(/:(.*?);/)![1]
  const raw = atob(parts[1])
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
