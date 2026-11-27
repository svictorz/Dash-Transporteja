/** Curva suave entre pontos sem ultrapassar seus valores. */
export function smoothChartPath(points: { x: number; y: number }[]): string {
  if (!points.length) return ''
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const third = (point.x - previous.x) / 3
    return `${path} C ${previous.x + third} ${previous.y}, ${point.x - third} ${point.y}, ${point.x} ${point.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}
