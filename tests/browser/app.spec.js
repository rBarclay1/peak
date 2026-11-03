import { test, expect } from '@playwright/test'

async function setup(page) {
  await page.clock.setFixedTime(new Date('2026-11-03T13:00:00Z'))
  const database = {
    schedule_overrides: [],
    nutrition_logs: [],
    saved_meals: [],
    garmin_data: [],
    weight_log: [],
  }
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://peak-test.supabase.co/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      table = url.pathname.split('/').at(-1)
    const rows = database[table] || []
    if (req.method() === 'POST') {
      const body = req.postDataJSON(),
        incoming = Array.isArray(body) ? body : [body]
      for (const row of incoming) {
        const field = table === 'schedule_overrides' ? 'user_id' : 'id'
        const index = rows.findIndex((old) => old[field] === row[field])
        if (index >= 0) rows[index] = row
        else rows.push(row)
      }
      database[table] = rows
      return route.fulfill({ status: 201, json: incoming })
    }
    if (req.method() === 'DELETE') {
      database[table] = rows.filter(
        (r) => r.id !== url.searchParams.get('id')?.replace('eq.', ''),
      )
      return route.fulfill({ status: 204 })
    }
    let filtered = rows
    if (url.searchParams.get('date')?.startsWith('eq.'))
      filtered = rows.filter(
        (r) => r.date === url.searchParams.get('date').slice(3),
      )
    return route.fulfill({ json: filtered })
  })
  await page.route('**/api/estimate', (route) =>
    route.fulfill({
      json: {
        name: 'Yogurt and oats',
        calories: 400,
        protein_g: 30,
        carbs_g: 50,
        fat_g: 9,
        assumptions: 'One serving',
      },
    }),
  )
  await page.goto('/')
  return { database, errors }
}

test('daily checklist shows training drills without meals or times', async ({ page }) => {
  await setup(page)
  await expect(page.getByRole('progressbar', { name: 'Progress toward November 20' })).toHaveAttribute('aria-valuenow', '6')
  await expect(page.getByRole('button', { name: 'Complete todo: Driving range', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Complete todo: Breakfast|Complete todo: Lunch|Complete todo: Easy run/ })).toHaveCount(0)
  await page.getByRole('button', {name: 'Details: Driving range', exact: true}).click()
  await expect(page.getByText('10 easy wedge shots · balanced finish', {exact:true})).toBeVisible()
  await page.getByRole('button', {name: 'Complete todo: Driving range', exact:true}).click()
  await expect(page.getByRole('button', {name: 'Complete todo: Driving range', exact:true})).toHaveCount(0)
  await page.getByRole('button', {name:'Undo', exact:true}).click()
  await page.getByRole('button', {name:'Next checklist day'}).click()
  await expect(page.getByRole('button', {name:'Complete todo: nCino work', exact:true})).toBeVisible()
  await expect(page.getByRole('button', {name:'Complete todo: Schoolwork', exact:true})).toBeVisible()
})

test('simple checklist adds, hides completed tasks, undoes and survives reload', async ({ page }) => {
  const { errors } = await setup(page)
  // The checklist works directly on the dashboard without opening another tile.
  await expect(page.getByRole('button', { name: 'Open calendar', exact: true })).toHaveCount(0)
  for (const title of ['Pick up groceries', 'Read a chapter']) {
    await page.getByLabel('Task', { exact: true }).fill(title)
    await page.getByRole('button', { name: 'Add task', exact: true }).click()
  }
  await page.getByLabel('Task', { exact: true }).fill('Finish assignment')
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await page.getByRole('button', { name: 'Complete todo: Finish assignment', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Complete todo: Finish assignment', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Open checklist', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Complete todo: Finish assignment', exact: true })).toBeVisible()
  await expect(page.getByLabel('Due date · optional')).toHaveCount(0)
  await page.getByRole('button', { name: 'Complete todo: Finish assignment', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Complete todo: Finish assignment', exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('food estimate remains editable, logs persist, targets and manual sleep work', async ({
  page,
}) => {
  const { database, errors } = await setup(page)
  await page.getByRole('button', { name: 'Open fuel', exact: true }).click()
  await page.getByRole('button', { name: 'Add food', exact: true }).click()
  await page
    .getByPlaceholder('e.g. "2 eggs, toast & butter"')
    .fill('A large bowl of plain Greek yogurt, half a cup of oats, and a handful of berries')
  await page.getByRole('button', { name: 'Estimate', exact: true }).click()
  await expect(page.getByPlaceholder('Food name (optional)')).toHaveValue(
    'Yogurt and oats',
  )
  await page.getByRole('button', { name: 'Log food · 400 kcal' }).click()
  await expect(page.getByText('Yogurt and oats', { exact: true })).toBeVisible()
  await expect.poll(() => database.nutrition_logs.length).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'Open fuel', exact: true }).click()
  await expect(page.getByText('Yogurt and oats', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Mark all food logged for this day' })
    .click()
  await expect(
    page.getByText(/90 g protein and 2150 kcal below target/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Open sleep', exact: true }).click()
  await page.getByLabel('Hours slept').fill('8.2')
  await page.getByRole('button', { name: 'Save sleep' }).click()
  await expect(page.getByRole('status')).toContainText(
    '8.2 hours logged manually',
  )
  expect(errors).toEqual([])
})

test('offline food and todo saves survive reload then sync once connection returns', async ({
  page,
}) => {
  const { database, errors } = await setup(page)
  await page.route('https://peak-test.supabase.co/**', (route) => route.abort())
  await page
    .getByRole('button', { name: 'Open checklist', exact: true })
    .click()
  await page.getByLabel('Task', { exact: true }).fill('Offline task')
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await page.reload()
  await page
    .getByRole('button', { name: 'Open checklist', exact: true })
    .click()
  await expect(page.getByText('Offline task', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Open fuel', exact: true }).click()
  await page.getByRole('button', { name: 'Add food', exact: true }).click()
  await page.getByPlaceholder('Food name (optional)').fill('Offline lunch')
  await page.getByLabel('Calories', { exact: false }).fill('600')
  await page.getByRole('button', { name: 'Log food · 600 kcal' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Open fuel', exact: true }).click()
  await expect(page.getByText('Offline lunch', { exact: true })).toBeVisible()
  // Remove just the most recently registered offline handler.
  await page.unroute('https://peak-test.supabase.co/**')
  await page.route('https://peak-test.supabase.co/**', async (route) => {
    const table = new URL(route.request().url()).pathname.split('/').at(-1)
    if (route.request().method() === 'POST') {
      const row = route.request().postDataJSON()
      database[table] ||= []
      const id = row.id || row.user_id
      database[table] = [
        ...database[table].filter((r) => (r.id || r.user_id) !== id),
        row,
      ]
      return route.fulfill({ status: 201, json: [row] })
    }
    return route.fulfill({ json: database[table] || [] })
  })
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => database.nutrition_logs.length).toBe(1)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect
    .poll(() =>
      database.schedule_overrides.some(
        (r) => r.day_overrides.record.title === 'Offline task',
      ),
    )
    .toBe(true)
  expect(database.nutrition_logs).toHaveLength(1)
  expect(errors).toEqual([])
})

test.describe('installed app', () => {
  test.use({ serviceWorkers: 'allow' })
  test('production shell opens offline and retains a new todo', async ({
    page,
    context,
  }) => {
    await setup(page)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true)
    await page.route('https://peak-test.supabase.co/**', (route) =>
      route.abort(),
    )
    await context.setOffline(true)
    await page.reload()
    await page
      .getByRole('button', { name: 'Open checklist', exact: true })
      .click()
    await page.getByLabel('Task', { exact: true }).fill('Offline PWA task')
    await page.getByRole('button', { name: 'Add task', exact: true }).click()
    await page.reload()
    await page
      .getByRole('button', { name: 'Open checklist', exact: true })
      .click()
    await expect(
      page.getByText('Offline PWA task', { exact: true }),
    ).toBeVisible()
  })
})

test('long saved food names stay inside the iPhone viewport and the form scrolls vertically', async ({ page }) => {
  const { database } = await setup(page)
  database.saved_meals.push(...Array.from({ length: 10 }, (_, i) => ({
    id: `saved-${i}`, name: 'Very long breakfast with yogurt and oats and berries '.repeat(5),
    calories: 400, protein_g: 30, carbs_g: 50, fat_g: 9,
  })))
  await page.reload()
  await page.getByRole('button', { name: 'Open fuel', exact: true }).click()
  const targets = page.getByText('120 g protein · four meals or snacks', { exact: true })
  const meals = page.getByRole('heading', { name: "Today's meals" })
  expect((await targets.boundingBox()).y).toBeGreaterThan((await meals.boundingBox()).y)
  await page.getByRole('button', { name: 'Add food', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log this food', exact: true })).toHaveCount(10)
  const scroller = page.locator('[aria-hidden="false"]').filter({ has: page.getByRole('heading', { name: 'Add food', exact: true }) }).last()
  const dimensions = await scroller.evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth, height: el.clientHeight, contentHeight: el.scrollHeight }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1)
  expect(dimensions.contentHeight).toBeGreaterThan(dimensions.height)
  await page.getByPlaceholder('Food name (optional)').fill('A test meal')
  await page.getByLabel('Calories', { exact: false }).fill('350')
  await page.getByRole('button', { name: 'Log food · 350 kcal' }).click()
  await expect(page.getByText('A test meal', { exact: true })).toBeVisible()
})
