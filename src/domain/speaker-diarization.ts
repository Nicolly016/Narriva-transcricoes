const SPEAKER_LABELS = ["A", "B", "C", "D", "E", "F"] as const
const MIN_SLICE_SECONDS = 0.35
const PITCH_WEIGHT = 1.7
const CENTROID_WEIGHT = 0.45
const MATCH_DISTANCE = 0.38

type VoicePrint = {
  pitchHz: number | null
  centroidHz: number
}

type SpeakerCluster = VoicePrint & {
  label: string
  count: number
}

export function assignSpeakerLabels<T extends { startSeconds: number; endSeconds: number }>(
  pcm: Float32Array,
  sampleRate: number,
  segments: readonly T[],
): Array<T & { speakerLabel: string }> {
  const clusters: SpeakerCluster[] = []
  const labels = segments.map((segment) => {
    const print = voicePrint(sliceFor(pcm, sampleRate, segment.startSeconds, segment.endSeconds), sampleRate)
    if (!print) {
      return clusters[clusters.length - 1]?.label ?? "A"
    }
    const nearest = nearestCluster(clusters, print)
    if (nearest && distance(nearest, print) <= MATCH_DISTANCE) {
      absorb(nearest, print)
      return nearest.label
    }
    if (clusters.length >= SPEAKER_LABELS.length && nearest) {
      absorb(nearest, print)
      return nearest.label
    }
    const label = SPEAKER_LABELS[clusters.length] ?? "A"
    clusters.push({ label, pitchHz: print.pitchHz, centroidHz: print.centroidHz, count: 1 })
    return label
  })

  for (let index = 1; index < labels.length - 1; index += 1) {
    const segment = segments[index]
    if (!segment || segment.endSeconds - segment.startSeconds >= 0.6) {
      continue
    }
    const previous = labels[index - 1]
    const next = labels[index + 1]
    if (previous && next && previous === next && labels[index] !== previous) {
      labels[index] = previous
    }
  }

  return segments.map((segment, index) => ({
    ...segment,
    speakerLabel: labels[index] ?? "A",
  }))
}

function sliceFor(pcm: Float32Array, sampleRate: number, startSeconds: number, endSeconds: number): Float32Array {
  const start = Math.max(0, Math.floor(startSeconds * sampleRate))
  const end = Math.min(pcm.length, Math.ceil(Math.max(startSeconds, endSeconds) * sampleRate))
  if (end - start < sampleRate * MIN_SLICE_SECONDS) {
    return new Float32Array()
  }
  return pcm.subarray(start, end)
}

function voicePrint(samples: Float32Array, sampleRate: number): VoicePrint | null {
  if (samples.length < sampleRate * MIN_SLICE_SECONDS) {
    return null
  }
  const frame = loudestFrame(samples, 4096)
  if (!frame || frameEnergy(frame) < 0.0008) {
    return null
  }
  return {
    pitchHz: estimatePitchHz(frame, sampleRate),
    centroidHz: spectralCentroid(frame.subarray(0, Math.min(frame.length, 1024)), sampleRate),
  }
}

function loudestFrame(samples: Float32Array, size: number): Float32Array | null {
  if (samples.length <= size) {
    return samples
  }
  const hop = 512
  let bestStart = 0
  let bestEnergy = -1
  for (let start = 0; start + hop <= samples.length; start += hop) {
    const energy = frameEnergy(samples.subarray(start, start + hop))
    if (energy > bestEnergy) {
      bestEnergy = energy
      bestStart = start
    }
  }
  return samples.subarray(bestStart, Math.min(samples.length, bestStart + size))
}

function frameEnergy(samples: Float32Array): number {
  let energy = 0
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0
    energy += sample * sample
  }
  return samples.length === 0 ? 0 : energy / samples.length
}

function estimatePitchHz(samples: Float32Array, sampleRate: number): number | null {
  const minLag = Math.floor(sampleRate / 350)
  const maxLag = Math.min(Math.floor(sampleRate / 70), samples.length - 1)
  if (maxLag <= minLag) {
    return null
  }
  let energy = 0
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0
    energy += sample * sample
  }
  if (energy <= 0) {
    return null
  }
  let best = 0
  let bestLag = 0
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0
    const limit = samples.length - lag
    for (let index = 0; index < limit; index += 1) {
      correlation += (samples[index] ?? 0) * (samples[index + lag] ?? 0)
    }
    const score = correlation / energy
    if (score >= 0.55) {
      return sampleRate / lag
    }
    if (score > best) {
      best = score
      bestLag = lag
    }
  }
  if (best < 0.28 || bestLag === 0) {
    return null
  }
  return sampleRate / bestLag
}

function spectralCentroid(samples: Float32Array, sampleRate: number): number {
  const size = samples.length
  if (size < 32) {
    return 0
  }
  let magnitudeSum = 0
  let weighted = 0
  const half = Math.floor(size / 2)
  for (let bin = 1; bin < half; bin += 1) {
    let real = 0
    let imaginary = 0
    for (let index = 0; index < size; index += 1) {
      const angle = (2 * Math.PI * bin * index) / size
      const sample = samples[index] ?? 0
      real += sample * Math.cos(angle)
      imaginary -= sample * Math.sin(angle)
    }
    const magnitude = Math.hypot(real, imaginary)
    const frequency = (bin * sampleRate) / size
    magnitudeSum += magnitude
    weighted += magnitude * frequency
  }
  return magnitudeSum === 0 ? 0 : weighted / magnitudeSum
}

function nearestCluster(clusters: readonly SpeakerCluster[], print: VoicePrint): SpeakerCluster | null {
  let best: SpeakerCluster | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const cluster of clusters) {
    const gap = distance(cluster, print)
    if (gap < bestDistance) {
      bestDistance = gap
      best = cluster
    }
  }
  return best
}

function distance(cluster: VoicePrint, print: VoicePrint): number {
  const centroidGap = Math.abs(cluster.centroidHz - print.centroidHz) / 2500
  if (cluster.pitchHz == null || print.pitchHz == null) {
    return centroidGap / CENTROID_WEIGHT
  }
  const pitchGap = Math.abs(cluster.pitchHz - print.pitchHz) / 180
  return Math.hypot(pitchGap * PITCH_WEIGHT, centroidGap * CENTROID_WEIGHT)
}

function absorb(cluster: SpeakerCluster, print: VoicePrint): void {
  const count = cluster.count + 1
  cluster.centroidHz = (cluster.centroidHz * cluster.count + print.centroidHz) / count
  if (cluster.pitchHz != null && print.pitchHz != null) {
    cluster.pitchHz = (cluster.pitchHz * cluster.count + print.pitchHz) / count
  } else if (cluster.pitchHz == null) {
    cluster.pitchHz = print.pitchHz
  }
  cluster.count = count
}
