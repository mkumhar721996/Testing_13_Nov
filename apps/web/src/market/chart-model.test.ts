import { buildChartModel } from './chart-model'
import { formatChange, formatLevel } from './format'
import { overview } from './testData'

const allOn = { spx: true, ndx: true, dji: true, vix: true }

describe('buildChartModel', () => {
  it('reads VIX on its own scale (AC 13)', () => {
    const model = buildChartModel(overview({ vix: [14.5, 15.3], spx: [0, 0.84] }), allOn)
    expect(model.rightAxis!.ticks[0]).toBeGreaterThanOrEqual(13)
    expect(model.leftAxis.ticks).toContain(0)
    expect(model.leftAxis.max).toBeLessThan(5)
    expect(buildChartModel(overview(), { ...allOn, vix: false }).rightAxis).toBeNull()
  })

  it('tags symbol segments up or down (AC 14, 15)', () => {
    const { segments } = buildChartModel(overview({ symbol: [0, 1, 0.5] }), allOn)
    expect(segments.map((s) => s.direction)).toEqual(['up', 'down'])
  })

  it('draws only the visible index lines (AC 8, 9, 12)', () => {
    expect(buildChartModel(overview(), allOn).lines.map((l) => l.key).sort()).toEqual(['dji', 'ndx', 'spx', 'vix'])
    expect(buildChartModel(overview(), { ...allOn, ndx: false }).lines.map((l) => l.key)).not.toContain('ndx')
  })

  it('copes with no data', () => {
    const empty = overview()
    empty.indices.forEach((i) => (i.points = []))
    empty.symbol = null
    const model = buildChartModel(empty, allOn)
    expect(model.lines).toEqual([])
    expect(model.segments).toEqual([])
  })
})

describe('format', () => {
  it('formats change with arrow and true minus', () => {
    expect(formatChange(0.84)).toEqual({ text: '▲ +0.84%', tone: 'success' })
    expect(formatChange(-0.21)).toEqual({ text: '▼ −0.21%', tone: 'danger' })
    expect(formatChange(null)).toEqual({ text: '—', tone: 'neutral' })
  })
  it('formats levels', () => {
    expect(formatLevel(5412.3, 2)).toBe('5,412.30')
    expect(formatLevel(null, 2)).toBe('—')
  })
})
