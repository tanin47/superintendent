import {
  type ChartType as ChartJsType,
  Chart as ChartJs,
  BarController,
  LineController,
  PieController,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  BarElement,
  Legend,
  Tooltip,
  Title,
  SubTitle,
  Filler,
  Decimation,
  ArcElement,
  Colors
} from 'chart.js'
import { type Result, type ChartOptions, type ChartType, type LabelTimestampFormat, LabelTimestampFormats } from './types'
import React from 'react'
import './Chart.scss'
import { StateChangeApi, useDispatch } from './WorkspaceContext'
import { type ColumnType } from '../../types'
import { DateTime } from 'luxon'

ChartJs.register(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  Colors,
  BarController,
  LineController,
  PieController,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Title,
  SubTitle,
  Filler,
  Decimation,
  ArcElement
)

const MAX_ROWS = 1000

function formatTimestamp (value: Date, format: LabelTimestampFormat): string {
  const dateTime = DateTime.fromJSDate(value).setZone('utc')

  switch (format) {
    case 'hour':
      return dateTime.toFormat('d MMM y H:mm')
    case 'day':
      return dateTime.toFormat('d MMM y')
    case 'month':
      return dateTime.toFormat('MMM y')
    case 'year':
      return dateTime.toFormat('y')
    default:
      throw new Error()
  }
}

function format (value: any, tpe: ColumnType, timestampFormat: LabelTimestampFormat): any {
  if (tpe === 'bigint') {
    return Number(value)
  } else if (tpe === 'timestamp') {
    return formatTimestamp(value as Date, timestampFormat)
  } else {
    return value
  }
}

function computeLabelColumnTimestamp (result: Result, labelColumnIndex: number): LabelTimestampFormat {
  let duplicateDay = false
  let duplicateMonth = false
  let duplicateYear = false

  for (let i = 1; i < result.rows.length; i++) {
    const diffMillis = result.rows[i][labelColumnIndex] - result.rows[i - 1][labelColumnIndex]
    if (diffMillis < 86400 * 1000) {
      duplicateDay = true
    }

    const next = DateTime.fromJSDate(result.rows[i][labelColumnIndex] as Date).setZone('utc')
    const previous = DateTime.fromJSDate(result.rows[i - 1][labelColumnIndex] as Date).setZone('utc')

    if (next.year === previous.year) {
      if (next.month === previous.month && next.year === previous.year) {
        duplicateMonth = true
      } else {
        duplicateYear = true
      }
    }
  }

  if (duplicateDay) {
    return 'hour'
  } else if (duplicateMonth) {
    return 'day'
  } else if (duplicateYear) {
    return 'month'
  } else {
    return 'year'
  }
}

function Canvas ({
  result
}: {
  result: Result
}): JSX.Element {
  const chartRef = React.useRef<HTMLCanvasElement | null>(null)
  const instance = React.useRef<ChartJs | null>(null)

  React.useEffect(
    () => {
      const ctx = chartRef.current?.getContext('2d')
      if (!ctx) { return }

      instance.current?.destroy()

      const options = result.chartOptions
      if (!options) { return }

      const labelColumnIndex = options.labelColumnIndex
      if (labelColumnIndex === null) { return }

      let type: ChartJsType
      let stacked: boolean = false

      if (options.type === 'stacked_bar') {
        type = 'bar'
        stacked = true
      } else {
        type = options.type as ChartJsType
      }

      const labels: any[] = []

      for (let i = 0; i < Math.max(MAX_ROWS, result.rows.length); i++) {
        labels.push(format(result.rows[i][labelColumnIndex], result.columns[labelColumnIndex].tpe, options.labelColumnTimestampFormat))
      }

      const config = {
        type,
        data: {
          labels,
          datasets: options.datasetColumnIndices
            .filter((columnIndex) => columnIndex !== null)
            .map((columnIndex) => {
              const data: any[] = []

              for (let i = 0; i < Math.max(MAX_ROWS, result.rows.length); i++) {
                data.push(format(result.rows[i][columnIndex!], result.columns[columnIndex!].tpe, options.labelColumnTimestampFormat))
              }

              return {
                label: result.columns[columnIndex!].name,
                data
              }
            })
        },
        options: {
          animation: {
            duration: 0
          },
          maintainAspectRatio: false,
          normalized: true,
          scales: {
            y: {
              beginAtZero: true,
              stacked
            },
            x: {
              stacked
            }
          }
        }
      }

      instance.current = new ChartJs(ctx, config)
    },
    [result, result.chartOptions]
  )

  return (
    <canvas ref={chartRef} />
  )
}

function isEqual (a: Array<number | null>, b: Array<number | null>): boolean {
  if (a.length !== b.length) { return false }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) { return false }
  }

  return true
}

const VALID_LABEL_TYPES_FOR_LINE = new Set<ColumnType>(['bigint', 'double', 'timestamp'])

export default function Chart ({
  result
}: {
  result: Result
}): JSX.Element {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [form, setForm] = React.useState<ChartOptions>({
    type: 'line',
    labelColumnIndex: 0,
    labelColumnTimestampFormat: 'month',
    datasetColumnIndices: [1],
    minDatasetRange: null,
    maxDatasetRange: null
  })

  React.useEffect(
    () => {
      if (result.chartOptions === null) {
        const labelColumnIndex = 0
        let type: ChartType = 'line'
        let labelColumnTimestampFormat: LabelTimestampFormat = 'month'
        const datasetColumnIndices: Array<number | null> = []

        if (result.columns.length >= 1 && !VALID_LABEL_TYPES_FOR_LINE.has(result.columns[0].tpe)) {
          type = 'bar'
        }

        if (result.columns.length >= 1 && result.rows.length >= 1 && result.columns[labelColumnIndex].tpe === 'timestamp') {
          labelColumnTimestampFormat = computeLabelColumnTimestamp(result, labelColumnIndex)
        }

        for (let i = 1; i < result.columns.length; i++) {
          datasetColumnIndices.push(i)
        }

        stateChangeApi.setChartOptions(
          result,
          {
            type,
            labelColumnIndex,
            labelColumnTimestampFormat,
            datasetColumnIndices,
            minDatasetRange: null,
            maxDatasetRange: null
          }
        )
      } else {
        let changed = false
        const options = result.chartOptions

        if (result.chartOptions.type !== form.type) {
          form.type = options.type
          changed = true
        }

        if (options.labelColumnIndex !== form.labelColumnIndex) {
          form.labelColumnIndex = options.labelColumnIndex
          changed = true
        }

        if (options.labelColumnTimestampFormat !== form.labelColumnTimestampFormat) {
          form.labelColumnTimestampFormat = options.labelColumnTimestampFormat
          changed = true
        }

        if (!isEqual(options.datasetColumnIndices, form.datasetColumnIndices)) {
          form.datasetColumnIndices = [...options.datasetColumnIndices]
          changed = true
        }

        if (options.minDatasetRange !== form.minDatasetRange) {
          form.minDatasetRange = options.minDatasetRange
          changed = true
        }

        if (options.maxDatasetRange !== form.maxDatasetRange) {
          form.maxDatasetRange = options.maxDatasetRange
          changed = true
        }

        if (changed) {
          setForm({ ...form })
        }
      }
    },
    [form, result, result.chartOptions, stateChangeApi]
  )

  return (
    <div className="chart-container">
      <div className="config-container">
        <div className="config-scroll">
          <div className="config-area">
            <table>
              <tbody>
                {result.count > MAX_ROWS && (
                  <tr className="control">
                    <td className="value" colSpan={2}>
                      <div className="warning">
                        The chart only shows the data from the first 1,000 rows, but the sheet has 2,340 rows.
                        Please reduce the number of rows of the sheet.
                      </div>
                    </td>
                  </tr>
                )}
                <tr className="control">
                  <td className="label">
                    Type
                  </td>
                  <td className="value">
                    <div className="select-box">
                      <select
                        value={form.type}
                        onChange={(event) => { stateChangeApi.setChartOptions(result, { ...form, type: event.target.value as ChartType }) }}
                      >
                        <option value="line">Line</option>
                        <option value="bar">Bar</option>
                        <option value="stacked_bar">Stacked bar</option>
                        <option value="pie">Pie</option>
                      </select>
                    </div>
                  </td>
                </tr>
                <tr className="control">
                  <td className="label">
                    X
                  </td>
                  <td className="value">
                    <div className="line">
                      <div className="select-box">
                        <select
                          value={form.labelColumnIndex ?? 'none'}
                          onChange={(event) => {
                            const value = event.target.value
                            stateChangeApi.setChartOptions(
                              result,
                              {
                                ...form,
                                labelColumnIndex: value === 'none' ? null : Number(value)
                              }
                            )
                          }}
                        >
                          <option value="none">-- Select --</option>
                          {result.columns.map((col, index) => {
                            return (
                              <option key={index} value={index}>{col.name}</option>
                            )
                          })}
                        </select>
                      </div>
                    </div>
                    <div className="line">
                      <div className="select-box">
                        <select
                          value={form.labelColumnTimestampFormat}
                          onChange={(event) => {
                            stateChangeApi.setChartOptions(
                              result,
                              {
                                ...form,
                                labelColumnTimestampFormat: event.target.value as LabelTimestampFormat
                              }
                            )
                          }}
                        >
                          {LabelTimestampFormats.map((format) => {
                            return (
                              <option key={format} value={format}>Formatted to {format} (UTC)</option>
                            )
                          })}
                        </select>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr className="control">
                  <td className="label">
                    Y
                  </td>
                  <td className="value">
                    {form.datasetColumnIndices.map((datasetColumnIndex, index) => {
                      return (
                        <div key={index} className="line">
                          <div className="select-box">
                            <select
                              value={datasetColumnIndex ?? 'none'}
                              onChange={(event) => {
                                const value = event.target.value
                                form.datasetColumnIndices[index] = value === 'none' ? null : Number(value)
                                form.datasetColumnIndices = [...form.datasetColumnIndices]
                                stateChangeApi.setChartOptions(result, { ...form })
                              }}
                            >
                              <option value="none">-- Select --</option>
                              {result.columns.map((col, index) => {
                                return (
                                  <option key={index} value={`${index}`}>{col.name}</option>
                                )
                              })}
                            </select>
                          </div>
                          <i
                            className="fas fa-trash-alt"
                            onClick={() => {
                              form.datasetColumnIndices.splice(index, 1)
                              form.datasetColumnIndices = [...form.datasetColumnIndices]
                              stateChangeApi.setChartOptions(result, { ...form })
                            }}
                          ></i>
                        </div>
                      )
                    })}
                    <div>
                      <span
                        className="add-dataset-button"
                        onClick={() => {
                          form.datasetColumnIndices.push(null)
                          form.datasetColumnIndices = [...form.datasetColumnIndices]
                          stateChangeApi.setChartOptions(result, { ...form })
                        }}
                      >
                        + Add a dataset
                      </span>
                    </div>
                  </td>
                </tr>
                {/* <tr className="control">
                  <td className="label">
                    Min Y
                  </td>
                  <td className="value">
                    <input
                      type="text"
                      placeholder="min"
                      value={form.minDatasetRange ?? ''}
                      onChange={(event) => {
                        const value = event.target.value
                        stateChangeApi.setChartOptions(
                          result,
                          {
                            ...form,
                            minDatasetRange: value === '' ? null : Number(value)
                          }
                        )
                      }}
                    />
                  </td>
                </tr>
                <tr className="control">
                  <td className="label">
                    Max Y
                  </td>
                  <td className="value">
                    <input
                      type="text"
                      placeholder="max"
                      value={form.maxDatasetRange ?? ''}
                      onChange={(event) => {
                        const value = event.target.value
                        stateChangeApi.setChartOptions(
                          result,
                          {
                            ...form,
                            maxDatasetRange: value === '' ? null : Number(value)
                          }
                        )
                      }}
                    />
                  </td>
                </tr> */}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="canvas-container">
        <Canvas result={result} />
      </div>
    </div>
  )
}
