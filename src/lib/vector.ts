export function dotProduct(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += (left[index] || 0) * (right[index] || 0);
  }
  return sum;
}

export function vectorMagnitude(vector: number[]) {
  return Math.sqrt(dotProduct(vector, vector));
}

export function normalizeVector(vector: number[]) {
  const magnitude = vectorMagnitude(vector);
  if (!Number.isFinite(magnitude) || magnitude <= Number.EPSILON) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left?: number[] | null, right?: number[] | null) {
  if (!left?.length || !right?.length) return 0;
  const normalizedLeft = normalizeVector(left);
  const normalizedRight = normalizeVector(right);
  return dotProduct(normalizedLeft, normalizedRight);
}

export function averageVectors(vectors: number[][]) {
  const valid = vectors.filter((vector) => vector.length > 0);
  if (!valid.length) return null;

  const width = valid[0]!.length;
  const total = Array.from({ length: width }, () => 0);
  for (const vector of valid) {
    for (let index = 0; index < width; index += 1) {
      total[index] += vector[index] || 0;
    }
  }

  return normalizeVector(total.map((value) => value / valid.length));
}
