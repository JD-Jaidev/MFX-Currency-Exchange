/**
 * MFX - Chart & Historical Trends Module
 * Powers the interactive Chart.js line chart and statistics.
 */

import { getHistoricalRates } from './api.js';

let trendChartInstance = null;
let currentChartParams = {
  base: 'USD',
  target: 'INR',
  period: '1M'
};

/**
 * Helper to format date strings for chart labels.
 */
function formatChartDate(dateStr, period) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  if (period === '1Y' || period === '6M') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Format currency numbers with appropriate decimal precision.
 */
export function formatCurrencyValue(val, decimals = 4) {
  if (typeof val !== 'number' || isNaN(val)) return '--';
  if (val >= 1000) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (val >= 1) {
    return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  } else {
    return val.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }
}

/**
 * Create chart stroke and area gradients based on canvas context and theme.
 */
function getChartGradients(ctx, chartArea) {
  if (!chartArea) {
    return {
      lineGradient: '#3B82F6',
      fillGradient: 'rgba(59, 130, 246, 0.1)'
    };
  }

  // Horizontal stroke gradient: Electronic Blue -> Lavender -> Pale Purple
  const lineGradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  lineGradient.addColorStop(0, '#0052FF');    // Electronic Blue
  lineGradient.addColorStop(0.5, '#A78BFA');  // Lavender
  lineGradient.addColorStop(1, '#C084FC');    // Pale Purple

  // Vertical fill gradient
  const fillGradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  fillGradient.addColorStop(0, 'rgba(0, 82, 255, 0.35)');
  fillGradient.addColorStop(0.6, 'rgba(167, 139, 250, 0.12)');
  fillGradient.addColorStop(1, 'rgba(192, 132, 252, 0.00)');

  return { lineGradient, fillGradient };
}

/**
 * Update the UI statistics summary cards.
 */
function updateChartStatsUI(stats) {
  const { currentRate, highRate, lowRate, avgRate, pctChange, changeAmount, base, target, period } = stats;

  const currentRateEl = document.getElementById('stat-current-rate');
  const highRateEl = document.getElementById('stat-high-rate');
  const lowRateEl = document.getElementById('stat-low-rate');
  const avgRateEl = document.getElementById('stat-avg-rate');
  const pctChangeEl = document.getElementById('stat-pct-change');
  const chartSubtitleEl = document.getElementById('chart-pair-subtitle');

  if (chartSubtitleEl) {
    chartSubtitleEl.textContent = `${base} to ${target} • Last ${period === '1M' ? '1 Month' : period === '3M' ? '3 Months' : period === '6M' ? '6 Months' : '1 Year'}`;
  }

  if (currentRateEl) {
    currentRateEl.textContent = `${formatCurrencyValue(currentRate)} ${target}`;
  }
  if (highRateEl) {
    highRateEl.textContent = `${formatCurrencyValue(highRate)} ${target}`;
  }
  if (lowRateEl) {
    lowRateEl.textContent = `${formatCurrencyValue(lowRate)} ${target}`;
  }
  if (avgRateEl) {
    avgRateEl.textContent = `${formatCurrencyValue(avgRate)} ${target}`;
  }

  if (pctChangeEl) {
    const isPositive = pctChange >= 0;
    const sign = isPositive ? '+' : '';
    const arrow = isPositive ? '▲' : '▼';
    pctChangeEl.innerHTML = `<span class="${isPositive ? 'trend-up' : 'trend-down'}">${arrow} ${sign}${pctChange.toFixed(2)}% (${sign}${formatCurrencyValue(changeAmount, 3)})</span>`;
  }
}

/**
 * Initialize or update the Trend Chart.
 * @param {string} base - Base currency
 * @param {string} target - Target currency
 * @param {string} period - '1M' | '3M' | '6M' | '1Y'
 */
export async function renderTrendChart(base = 'USD', target = 'INR', period = '1M') {
  currentChartParams = { base, target, period };

  const canvas = document.getElementById('trend-chart-canvas');
  const chartLoader = document.getElementById('chart-loader');

  if (!canvas) return;

  if (chartLoader) {
    chartLoader.classList.remove('hidden');
  }

  try {
    const data = await getHistoricalRates(base, target, period);
    updateChartStatsUI(data);

    const ctx = canvas.getContext('2d');
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    const labels = data.dates.map(d => formatChartDate(d, period));
    const values = data.rates;

    // Calculate nice min and max with margin
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const padding = (maxVal - minVal) * 0.08 || minVal * 0.05;
    const suggestedMin = Math.max(0, minVal - padding);
    const suggestedMax = maxVal + padding;

    if (trendChartInstance) {
      trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${base}/${target} Exchange Rate`,
          data: values,
          borderWidth: 2.8,
          borderColor: function(context) {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return '#0052FF';
            return getChartGradients(ctx, chartArea).lineGradient;
          },
          backgroundColor: function(context) {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(0, 82, 255, 0.1)';
            return getChartGradients(ctx, chartArea).fillGradient;
          },
          fill: true,
          tension: 0.36,
          pointRadius: values.length > 50 ? 0 : 2.5,
          pointHoverRadius: 6,
          pointBackgroundColor: '#0052FF',
          pointHoverBackgroundColor: '#FFFFFF',
          pointHoverBorderColor: '#0052FF',
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            titleColor: isDark ? '#F8FAFC' : '#0F172A',
            bodyColor: isDark ? '#E2E8F0' : '#334155',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            cornerRadius: 10,
            titleFont: {
              family: "'Space Grotesk', sans-serif",
              size: 13,
              weight: '600'
            },
            bodyFont: {
              family: "'Inter', sans-serif",
              size: 13,
              weight: '500'
            },
            callbacks: {
              title: function(context) {
                const index = context[0].dataIndex;
                const rawDate = data.dates[index];
                const d = new Date(rawDate);
                return d.toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
              },
              label: function(context) {
                const val = context.parsed.y;
                return ` 1 ${base} = ${formatCurrencyValue(val)} ${target}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: true,
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Inter', sans-serif",
                size: 11
              },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            }
          },
          y: {
            suggestedMin: suggestedMin,
            suggestedMax: suggestedMax,
            grid: {
              display: true,
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Inter', sans-serif",
                size: 11
              },
              callback: function(value) {
                return formatCurrencyValue(value, 2);
              }
            }
          }
        }
      }
    });

  } catch (error) {
    console.error('Error rendering chart:', error);
    const currentRateEl = document.getElementById('stat-current-rate');
    if (currentRateEl) currentRateEl.textContent = 'Data unavailable';
  } finally {
    if (chartLoader) {
      chartLoader.classList.add('hidden');
    }
  }
}

/**
 * Switch period timeframe (1M, 3M, 6M, 1Y)
 */
export function setChartPeriod(period) {
  currentChartParams.period = period;
  return renderTrendChart(currentChartParams.base, currentChartParams.target, period);
}

/**
 * Switch chart currencies
 */
export function setChartCurrencies(base, target) {
  currentChartParams.base = base;
  currentChartParams.target = target;
  return renderTrendChart(base, target, currentChartParams.period);
}

/**
 * Get current chart parameters.
 */
export function getCurrentChartParams() {
  return { ...currentChartParams };
}
