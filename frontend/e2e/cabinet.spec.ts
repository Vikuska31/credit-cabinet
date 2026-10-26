import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, profile = 'ООО с историей') {
  await page.goto('/login');
  await page.getByRole('button', { name: profile, exact: true }).click();
  await expect(page.getByRole('heading', { name: /Привет/ })).toBeVisible();
}

test('employee answers a real goal inquiry and client sees the answer', async ({ page }) => {
  await login(page);
  await page.goto('/credits');
  await page.getByLabel('Другое', { exact: false }).check();
  const question = 'Новая бизнес-задача ' + Date.now();
  await page.getByLabel('Опишите бизнес-задачу').fill(question);
  await page.getByRole('button', { name: 'Передать вопрос сотруднику' }).click();
  await expect(page.getByText('Вопрос передан сотруднику.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.getByLabel('Логин', { exact: true }).fill('employee');
  await page.getByLabel('Пароль', { exact: true }).fill('employee1234');
  await page.getByRole('button', { name: 'Войти как сотрудник' }).click();
  await expect(page.getByRole('heading', { name: 'Кабинет сотрудника' })).toBeVisible();
  await page.getByLabel('Предложить категорию').selectOption('GOODS');
  const inquiry = page.locator('article').filter({ hasText: question });
  await inquiry.getByRole('button', { name: 'Ответить на вопрос' }).click();
  await expect(inquiry).toHaveCount(0);
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.getByRole('button', { name: 'ООО с историей', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Привет/ })).toBeVisible();
  await page.goto('/applications');
  await expect(page.getByText(question + ' · Получен ответ')).toBeVisible();
});

test('real server calculation, draft restoration, submission and disabled AI', async ({ page }) => {
  await login(page);
  await page.goto('/credits');
  await page.getByLabel('Товары и сырьё', { exact: false }).check();
  await page.getByRole('button', { name: 'Показать расчёты' }).click();
  await expect(page.getByRole('heading', { name: 'По вашему запросу' })).toBeVisible();
  await expect(page.getByText('21%', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/credits-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Начать оформление' }).first().click();
  await expect(page).toHaveURL(/wizard\?applicationId=/);
  const url = page.url();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Данные компании' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Данные компании' })).toBeVisible();
  expect(page.url()).toBe(url);
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await page.getByRole('button', { name: 'Приложить найденные документы' }).click();
  await expect(page.getByText(/Приложен:/)).toBeVisible();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  // Чекбокс Альфа-Банка: настоящий input перекрыт «коробочкой», человек кликает по тексту
  await page.getByText('Я подтверждаю данные', { exact: false }).click();
  await expect(page.getByLabel('Я подтверждаю данные', { exact: false })).toBeChecked();
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click();
  await expect(page).toHaveURL(/applications\?applicationId=/);
  await expect(page.getByRole('button', { name: 'Принять условия — демо' })).toBeVisible();
  // Карточка заявки открыта поверх страницы — закрываем её, как это сделал бы человек
  await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
  await page.getByText('Помощник по кредиту', { exact: true }).click();
  await expect(page.getByText('Помощник отключён.', { exact: false })).toBeVisible();
});

test('real PDF upload and download through Java authorization', async ({ page }) => {
  await login(page);
  await page.goto('/documents');
  const name = 'Тестовый счёт ' + Date.now();
  await page.getByLabel('Название', { exact: true }).fill(name);
  await page.getByLabel('Тип', { exact: true }).selectOption('PURCHASE_DOCUMENT');
  await page.getByLabel('PDF-файл до 20 МБ').setInputFiles({
    name: 'invoice.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await page.getByRole('button', { name: 'Сохранить в библиотеку' }).click();
  const card = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await card.getByRole('button', { name: 'Открыть документ' }).click();
  await expect(page).toHaveURL(/documentId=/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать файл' }).click();
  expect((await download).suggestedFilename()).toBe('document.pdf');
});

test('lower-payment offer keeps its actual term and mobile layout fits', async ({ page }) => {
  await login(page);
  await page.goto('/credits');
  await page.getByLabel('Товары и сырьё', { exact: false }).check();
  await page.getByRole('button', { name: 'Показать расчёты' }).click();
  await page.getByRole('button', { name: 'Начать оформление' }).nth(1).click();
  await expect(page).toHaveURL(/wizard\?applicationId=/);
  await expect(page.getByLabel('Выбранный расчёт')).toHaveValue('LOWER_PAYMENT');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.getByText(/36 месяцев/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/credits');
  await page.getByLabel('Товары и сырьё', { exact: false }).check();
  await page.getByLabel('Срок, месяцев', { exact: true }).fill('60');
  await page.getByRole('button', { name: 'Показать расчёты' }).click();
  await expect(page.getByRole('heading', { name: 'По вашему запросу' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Меньше платёж в месяц' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/credits-mobile.png', fullPage: true });
});

test('Other suggestions require confirmation and stale replies are ignored', async ({ page }) => {
  await login(page);
  await page.route('**/api/ai/capabilities', (route) =>
    route.fulfill({
      json: { enabled: true, features: { goalClassification: true, assistant: true } },
    }),
  );
  let analyze = 0;
  await page.route('**/api/ai/goals/classify', async (route) => {
    analyze++;
    if (analyze === 2) await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      json: {
        status: 'CLASSIFIED',
        goals: ['EQUIPMENT', 'ADVERTISING'],
        questionCode: null,
        clarifyingQuestion: null,
      },
    });
  });
  await page.goto('/credits');
  await page.getByLabel('Другое', { exact: false }).check();
  await page.getByLabel('Опишите бизнес-задачу').fill('Станок и реклама для мастерской');
  await page.getByRole('button', { name: 'Определить категории' }).click();
  await expect(page.getByRole('button', { name: 'Подтвердить категории' })).toBeVisible();
  await expect(page.getByLabel('Оборудование', { exact: false })).not.toBeChecked();
  await page.getByRole('button', { name: 'Подтвердить категории' }).click();
  await expect(page.getByLabel('Оборудование', { exact: false })).toBeChecked();
  await expect(page.getByLabel('Реклама и продвижение', { exact: false })).toBeChecked();
  await expect(page.getByLabel('Другое', { exact: false })).not.toBeChecked();
  await page.getByLabel('Другое', { exact: false }).check();
  await page.getByLabel('Опишите бизнес-задачу').fill('Первый текст');
  await page.getByRole('button', { name: 'Определить категории' }).click();
  await page.getByLabel('Опишите бизнес-задачу').fill('Совсем другая задача');
  await page.waitForTimeout(600);
  await expect(page.getByRole('button', { name: 'Подтвердить категории' })).toHaveCount(0);
});

test('assistant never writes applications and applies fields only on click', async ({ page }) => {
  await login(page);
  await page.route('**/api/ai/capabilities', (route) =>
    route.fulfill({
      json: { enabled: true, features: { goalClassification: true, assistant: true } },
    }),
  );
  let writes = 0;
  page.on('request', (r) => {
    if (/\/api\/applications/.test(r.url()) && r.method() !== 'GET') writes++;
  });
  await page.route('**/api/ai/assistant', (route) =>
    route.fulfill({
      json: {
        status: 'READY',
        intent: 'START_SELECTION',
        entities: {
          purposeText: 'оборудование пекарни',
          goals: ['EQUIPMENT'],
          amount: '1500000.00',
          currency: 'RUB',
          termMonths: 24,
        },
        clarifyingQuestion: null,
        reply: 'Проверьте параметры',
        actions: [
          { type: 'START_SELECTION', label: 'Начать подбор', requiresConfirmation: true },
          { type: 'SUBMIT', label: 'Недопустимое действие', requiresConfirmation: true },
        ],
        fieldErrors: [],
      },
    }),
  );
  await page.goto('/credits');
  await page.getByText('Помощник по кредиту', { exact: true }).click();
  await page.getByLabel('Ваше сообщение').fill('Оборудование пекарни');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(page.getByText('Проверьте параметры', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Недопустимое действие' }).click();
  expect(writes).toBe(0);
  await page.getByLabel('Ваше сообщение').fill('Оборудование пекарни');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await page.getByRole('button', { name: 'Начать подбор', exact: true }).click();
  await expect(page.getByLabel('Сумма, ₽', { exact: true })).toHaveValue('1500000');
  await expect(page.getByLabel('Оборудование', { exact: false })).toBeChecked();
  expect(writes).toBe(0);
});
