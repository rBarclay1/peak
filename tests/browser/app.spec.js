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

test('mobile dashboard, timeline completion/undo and calendar navigation', async ({
  page,
}) => {
  const { errors } = await setup(page)
  await expect(
    page.getByRole('heading', { name: 'Peak · November' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Open timeline', exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/dashboard.png' })
  await page.getByRole('button', { name: 'Open timeline', exact: true }).click()
  await page
    .getByRole('button', {
      name: 'Complete: Easy morning run / run-walk',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Undo completion: Easy morning run / run-walk',
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: 'Complete: Easy morning run / run-walk',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Open calendar', exact: true }).click()
  await page.getByRole('button', { name: 'View Nov 17', exact: true }).click()
  await page.getByRole('button', { name: 'Open this day →' }).click()
  await expect(
    page.getByRole('heading', { name: 'Short climbing primer' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('todo add, schedule, complete, reopen, edit and delete undo survive reload', async ({
  page,
}) => {
  const { errors } = await setup(page)
  await page
    .getByRole('button', { name: 'Open to-do list', exact: true })
    .click()
  await page.getByLabel('Task', { exact: true }).fill('Finish assignment')
  await page.getByLabel('Due date · optional').fill('2026-11-06')
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const item = page
    .getByRole('article')
    .filter({ hasText: 'Finish assignment' })
  await item.getByRole('button', { name: 'Find a time' }).click()
  await expect(item).toContainText('7:45 pm')
  await page.reload()
  await page
    .getByRole('button', { name: 'Open to-do list', exact: true })
    .click()
  await item
    .getByRole('button', { name: 'Complete todo: Finish assignment' })
    .click()
  await page.getByRole('button', { name: 'Show completed' }).click()
  await item
    .getByRole('button', { name: 'Reopen todo: Finish assignment' })
    .click()
  await item.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Task', { exact: true }).fill('Finish lab report')
  await page.getByRole('button', { name: 'Save task' }).click()
  const edited = page
    .getByRole('article')
    .filter({ hasText: 'Finish lab report' })
  await edited.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Undo delete' }).click()
  await expect(edited).toBeVisible()
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
    .fill('Yogurt and oats')
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
    .getByRole('button', { name: 'Open to-do list', exact: true })
    .click()
  await page.getByLabel('Task', { exact: true }).fill('Offline task')
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await page.reload()
  await page
    .getByRole('button', { name: 'Open to-do list', exact: true })
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
      .getByRole('button', { name: 'Open to-do list', exact: true })
      .click()
    await page.getByLabel('Task', { exact: true }).fill('Offline PWA task')
    await page.getByRole('button', { name: 'Add task', exact: true }).click()
    await page.reload()
    await page
      .getByRole('button', { name: 'Open to-do list', exact: true })
      .click()
    await expect(
      page.getByText('Offline PWA task', { exact: true }),
    ).toBeVisible()
  })
})

test('activities can be created, edited, completed and deleted without routine checkboxes', async ({
  page,
}) => {
  await setup(page)
  await page.getByRole('button', { name: 'Open timeline', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: /Complete: Wake up|Complete: Shower|Complete: Class/,
    }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Add activity', exact: true }).click()
  await page
    .getByLabel('Activity name', { exact: true })
    .fill('Stretching session')
  await page.getByLabel('Activity time', { exact: true }).fill('18:00')
  await page.getByRole('button', { name: 'Save activity', exact: true }).click()
  let activity = page
    .getByRole('article')
    .filter({ hasText: 'Stretching session' })
  await expect(activity).toBeVisible()
  await activity
    .getByRole('button', { name: 'Edit activity', exact: true })
    .click()
  await page
    .getByLabel('Activity name', { exact: true })
    .fill('Evening stretching')
  await page.getByLabel('Duration in minutes').fill('20')
  await page.getByRole('button', { name: 'Save activity', exact: true }).click()
  activity = page.getByRole('article').filter({ hasText: 'Evening stretching' })
  await activity
    .getByRole('button', { name: 'Complete: Evening stretching', exact: true })
    .click()
  await expect(
    activity.getByRole('button', {
      name: 'Undo completion: Evening stretching',
      exact: true,
    }),
  ).toBeVisible()
  await activity
    .getByRole('button', { name: 'Delete activity', exact: true })
    .click()
  await expect(activity).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(activity).toBeVisible()
  // Built-in activity deletion must also be reversible.
  const run = page
    .getByRole('article')
    .filter({ hasText: 'Easy morning run / run-walk' })
  await run
    .getByRole('button', { name: 'Delete activity', exact: true })
    .click()
  await expect(run).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(run).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Open timeline', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: 'Undo completion: Evening stretching',
      exact: true,
    }),
  ).toBeVisible()
})
