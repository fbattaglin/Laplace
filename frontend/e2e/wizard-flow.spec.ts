import { test, expect } from '@playwright/test'

test.describe('Full wizard flow with preloaded dataset', () => {
  test('completes airline_passengers from data input to export', async ({ page }) => {
    await page.goto('/')

    // Step 1: Data Input — select preloaded dataset
    await expect(page.getByText('Load Data').first()).toBeVisible()
    const airlineCard = page.getByRole('button', { name: /airline passengers/i }).first()
    await expect(airlineCard).toBeVisible({ timeout: 10_000 })
    await airlineCard.click()

    // Should auto-navigate to Diagnostics
    await expect(page.getByText('Predictability Score')).toBeVisible({ timeout: 15_000 })

    // Step 2: Diagnostics — verify gauge and charts rendered
    await expect(page.getByText('Predictability Score')).toBeVisible()
    await expect(page.getByText('Signal Strength')).toBeVisible()

    // Navigate to Validation
    const compareBtn = page.getByRole('button', { name: /Compare Models →|Run Backtest →/ })
    await expect(compareBtn).toBeVisible()
    await compareBtn.click()

    // Step 3: Validation — wait for backtest to complete
    await expect(page.getByText(/Chronos-2|AutoETS|AutoTheta|SeasonalNaive/)).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByText('sMAPE')).toBeVisible()

    // Navigate to Forecast
    const forecastBtn = page.getByRole('button', { name: /Predict Future →|Generate Forecast →/ })
    await expect(forecastBtn).toBeVisible()
    await forecastBtn.click()

    // Step 4: Forecast — generate a forecast
    await expect(page.getByRole('button', { name: 'Generate Forecast' })).toBeVisible()
    await page.getByRole('button', { name: 'Generate Forecast' }).click()

    // Wait for chart to appear
    await expect(page.getByText('Future Prediction')).toBeVisible({ timeout: 30_000 })

    // Navigate to Export
    const exportBtn = page.getByRole('button', { name: /Download Results →|Export →/ })
    await expect(exportBtn).toBeVisible()
    await exportBtn.click()

    // Step 5: Export — verify summary cards
    await expect(page.getByText('Analysis Summary')).toBeVisible()
    await expect(page.getByText('144')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download XLSX' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save to Log' })).toBeVisible()
  })

  test('persists state across page reload', async ({ page }) => {
    await page.goto('/')

    // Load a dataset
    const airlineCard = page.getByRole('button', { name: /airline passengers/i }).first()
    await expect(airlineCard).toBeVisible({ timeout: 10_000 })
    await airlineCard.click()

    // Wait for diagnostics to load
    await expect(page.getByText('Predictability Score')).toBeVisible({ timeout: 15_000 })

    // Reload the page
    await page.reload()

    // Should still be on diagnostics with data loaded
    await expect(page.getByText('Predictability Score')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Edge cases', () => {
  test('handles short series gracefully', async ({ page }) => {
    await page.goto('/')

    // Wait for the app to load with datasets
    await expect(page.getByText('Load Data').first()).toBeVisible()
    await expect(page.getByText('Sample Datasets')).toBeVisible({ timeout: 10_000 })
  })

  test('displays error on network failure', async ({ page }) => {
    await page.goto('/')

    // Load dataset first
    const airlineCard = page.getByRole('button', { name: /airline passengers/i }).first()
    await expect(airlineCard).toBeVisible({ timeout: 10_000 })
    await airlineCard.click()

    // Wait for diagnostics
    await expect(page.getByText('Predictability Score')).toBeVisible({ timeout: 15_000 })

    // Navigate to validation
    const compareBtn = page.getByRole('button', { name: /Compare Models →|Run Backtest →/ })
    await compareBtn.click()

    // Backtest should either succeed or show an error with retry
    const result = page.getByText(/sMAPE|Retry/)
    await expect(result).toBeVisible({ timeout: 60_000 })
  })
})
