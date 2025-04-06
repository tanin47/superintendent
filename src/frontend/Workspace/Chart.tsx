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
import { StateChangeApi, useDispatch, type ObjectWrapper } from './WorkspaceContext'
import { type ColumnType } from '../../types'
import { DateTime } from 'luxon'

ChartJs.register(
   
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

const MAX_ROWS = 500

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

  for (let i = 1; i < Math.min(MAX_ROWS, result.rows.length); i++) {
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
  result: ObjectWrapper<Result>
}): JSX.Element {
  const chartRef = React.useRef<HTMLCanvasElement | null>(null)
  const instance = React.useRef<ChartJs | null>(null)

  const _result = result.base

  React.useEffect(
    () => {
      const ctx = chartRef.current?.getContext('2d')
      if (!ctx) { return }

      instance.current?.destroy()

      const options = _result.chartOptions
      if (!options) { return }

      const labelColumnIndex = _result.columns.findIndex((c) => c.name === options.labelColumnName)
      if (labelColumnIndex < 0) { return }

      let type: ChartJsType
      let stacked: boolean = false

      if (options.type === 'stacked_bar') {
        type = 'bar'
        stacked = true
      } else {
        type = options.type as ChartJsType
      }

      const labels: any[] = []

      for (let i = 0; i < Math.min(MAX_ROWS, _result.rows.length); i++) {
        labels.push(format(_result.rows[i][labelColumnIndex], _result.columns[labelColumnIndex].tpe, options.labelColumnTimestampFormat))
      }

      const datasetColumnIndices = options.datasetColumnNames.map((name) => _result.columns.findIndex((c) => c.name === name)).filter((index) => index >= 0)

      const config = {
        type,
        data: {
          labels,
          datasets: datasetColumnIndices
            .filter((columnIndex) => columnIndex !== null)
            .map((columnIndex) => {
              const data: any[] = []

              for (let i = 0; i < Math.min(MAX_ROWS, _result.rows.length); i++) {
                data.push(format(_result.rows[i][columnIndex], _result.columns[columnIndex].tpe, options.labelColumnTimestampFormat))
              }

              return {
                label: _result.columns[columnIndex].name,
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
    [_result.chartOptions, _result.columns, _result.rows, result]
  )

  return (
    <canvas ref={chartRef} />
  )
}

function isEqual (a: string[], b: string[]): boolean {
  if (a.length !== b.length) { return false }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) { return false }
  }

  return true
}

const VALID_LABEL_TYPES_FOR_LINE = new Set<ColumnType>(['bigint', 'double', 'timestamp'])
const VALID_DATASET_TYPES = new Set<ColumnType>(['bigint', 'double'])

export default function Chart ({
  result
}: {
  result: ObjectWrapper<Result>
}): JSX.Element {
  const dispatch = useDispatch()
  const stateChangeApi = React.useMemo(() => new StateChangeApi(dispatch), [dispatch])

  const [form, setForm] = React.useState<ChartOptions>({
    type: 'line',
    labelColumnName: '',
    labelColumnTimestampFormat: 'month',
    datasetColumnNames: [],
    processedColumnNames: []
  })

  const _result = result.base

  React.useEffect(
    () => {
      if (_result.chartOptions === null) {
        const labelColumnIndex = 0
        let type: ChartType = 'line'
        let labelColumnTimestampFormat: LabelTimestampFormat = 'month'
        const datasetColumnNames: string[] = []

        if (_result.columns.length >= 1 && !VALID_LABEL_TYPES_FOR_LINE.has(_result.columns[0].tpe)) {
          type = 'bar'
        }

        if (_result.columns.length >= 1 && _result.rows.length >= 1 && _result.columns[labelColumnIndex].tpe === 'timestamp') {
          labelColumnTimestampFormat = computeLabelColumnTimestamp(_result, labelColumnIndex)
        }

        for (let i = 1; i < _result.columns.length; i++) {
          if (VALID_DATASET_TYPES.has(_result.columns[i].tpe)) {
            datasetColumnNames.push(_result.columns[i].name)
          }
        }

        stateChangeApi.setChartOptions(
          _result.id,
          {
            type,
            labelColumnName: _result.columns[labelColumnIndex].name,
            labelColumnTimestampFormat,
            datasetColumnNames,
            processedColumnNames: _result.columns.map((c) => c.name)
          }
        )
      } else {
        const options = _result.chartOptions
        let changedOptions = false

        for (const column of _result.columns) {
          if (!options.processedColumnNames.includes(column.name) && column.name !== options.labelColumnName && VALID_DATASET_TYPES.has(column.tpe)) {
            options.datasetColumnNames.push(column.name)
            changedOptions = true
          }
        }

        options.processedColumnNames = _result.columns.map((c) => c.name)

        if (changedOptions) {
          stateChangeApi.setChartOptions(
            _result.id,
            {
              ...options
            }
          )
          return
        }

        let changedForm = false

        if (_result.columns.find((c) => c.name === form.labelColumnName) === null) {
          stateChangeApi.setChartOptions(_result.id, null)
          return
        }

        if (_result.chartOptions.type !== form.type) {
          form.type = options.type
          changedForm = true
        }

        if (options.labelColumnName !== form.labelColumnName) {
          form.labelColumnName = options.labelColumnName
          changedForm = true
        }

        if (options.labelColumnTimestampFormat !== form.labelColumnTimestampFormat) {
          form.labelColumnTimestampFormat = options.labelColumnTimestampFormat
          changedForm = true
        }

        if (!isEqual(options.datasetColumnNames, form.datasetColumnNames)) {
          form.datasetColumnNames = [...options.datasetColumnNames]
          changedForm = true
        }

        form.processedColumnNames = options.processedColumnNames

        if (changedForm) {
          setForm({ ...form })
        }
      }
    },
    [_result, form, result, stateChangeApi]
  )

  return (
    <div className="chart-container">
      <div className="config-container">
        <div className="config-scroll">
          <div className="config-area">
            <table>
              <tbody>
                {_result.count > MAX_ROWS && (
                  <tr className="control">
                    <td className="value" colSpan={2}>
                      <div className="warning">
                        The chart only shows the data from the first {MAX_ROWS} rows. Please reduce the number of rows of the sheet.
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
                        onChange={(event) => { stateChangeApi.setChartOptions(_result.id, { ...form, type: event.target.value as ChartType }) }}
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
                          value={form.labelColumnName}
                          onChange={(event) => {
                            stateChangeApi.setChartOptions(
                              _result.id,
                              {
                                ...form,
                                labelColumnName: event.target.value
                              }
                            )
                          }}
                        >
                          <option value="">-- Select --</option>
                          {_result.columns.map((col, index) => {
                            return (
                              <option key={index} value={col.name}>{col.name}</option>
                            )
                          })}
                        </select>
                      </div>
                    </div>
                    {_result.columns.find((c) => c.name === form.labelColumnName)?.tpe === 'timestamp' && (
                      <div className="line">
                        <div className="select-box">
                          <select
                            value={form.labelColumnTimestampFormat}
                            onChange={(event) => {
                              stateChangeApi.setChartOptions(
                                _result.id,
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
                    )}
                  </td>
                </tr>
                <tr className="control">
                  <td className="label">
                    Y
                  </td>
                  <td className="value">
                    {form.datasetColumnNames.map((datasetColumnName, index) => {
                      return (
                        <div key={index} className="line">
                          <div className="select-box">
                            <select
                              value={datasetColumnName}
                              onChange={(event) => {
                                form.datasetColumnNames[index] = event.target.value
                                form.datasetColumnNames = [...form.datasetColumnNames]
                                stateChangeApi.setChartOptions(_result.id, { ...form })
                              }}
                            >
                              <option value="">-- Select --</option>
                              {_result.columns.map((col, index) => {
                                return (
                                  <option key={index} value={col.name}>{col.name}</option>
                                )
                              })}
                            </select>
                          </div>
                          <i
                            className="fas fa-trash-alt"
                            onClick={() => {
                              form.datasetColumnNames = form.datasetColumnNames.filter((c) => c !== datasetColumnName)
                              stateChangeApi.setChartOptions(_result.id, { ...form })
                            }}
                          ></i>
                        </div>
                      )
                    })}
                    <div>
                      <span
                        className="add-dataset-button"
                        onClick={() => {
                          form.datasetColumnNames.push('')
                          form.datasetColumnNames = [...form.datasetColumnNames]
                          stateChangeApi.setChartOptions(_result.id, { ...form })
                        }}
                      >
                        + Add a dataset
                      </span>
                    </div>
                  </td>
                </tr>
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
