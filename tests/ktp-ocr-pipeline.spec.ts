import path from 'node:path'
import { expect, test } from '@playwright/test'
import { getActiveObjectUrls, setupObjectUrlTracker } from './helpers/leakTracker'
import { setupTesseractMock } from './helpers/mockTesseract'

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures')
const SAMPLE_KTP_FILE = path.join(FIXTURES_DIR, 'ktp-sample.jpg')
const INVALID_DOC_FILE = path.join(FIXTURES_DIR, 'invalid-doc.pdf')
const INVALID_TEXT_FILE = path.join(FIXTURES_DIR, 'invalid-text.txt')
const EMPTY_BYTE_FILE = path.join(FIXTURES_DIR, 'empty-0byte.jpg')

test.describe('KTP OCR Complete Pipeline E2E Specification', () => {
  test.beforeEach(async ({ page }) => {
    await setupObjectUrlTracker(page)
    await setupTesseractMock(page)
    await page.goto('/')

    const demoCard = page.getByTestId('demo-card-client-side-tesseract')
    if (await demoCard.isVisible()) {
      await demoCard.click()
    }

    await expect(page.getByRole('heading', { name: /KTP OCR & JSON Extractor/i })).toBeVisible()
  })

  test('Pilar 1: Validasi Input File Ketat (MIME, Ekstensi, 0 Byte, >10MB, role="alert")', async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]')
    const alert = page.getByRole('alert')

    // 1. Ekstensi salah (PDF)
    await fileInput.setInputFiles(INVALID_DOC_FILE)
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Format file tidak didukung')

    // 2. Format teks (TXT)
    await fileInput.setInputFiles(INVALID_TEXT_FILE)
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Format file tidak didukung')

    // 3. File kosong 0 byte
    await fileInput.setInputFiles(EMPTY_BYTE_FILE)
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('0 byte')

    // 4. File > 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024)
    await fileInput.setInputFiles({
      name: 'oversized-ktp.png',
      mimeType: 'image/png',
      buffer: largeBuffer,
    })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('10 MB')

    // 5. Berkas valid memulihkan UI
    await fileInput.setInputFiles(SAMPLE_KTP_FILE)
    await expect(alert).not.toBeVisible()
    await expect(page.getByAltText('Foto KTP Asli')).toBeVisible()
  })

  test('Pilar 2: Canvas Preprocessing (Before vs After, Threshold Slider, Rotation, Mode Switch)', async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(SAMPLE_KTP_FILE)

    const originalImg = page.getByAltText('Foto KTP Asli')
    const preprocessedImg = page.getByAltText('Hasil Preprocessed Canvas KTP')

    await expect(originalImg).toBeVisible()
    await expect(preprocessedImg).toBeVisible()

    const initialSrc = await preprocessedImg.getAttribute('src')
    expect(initialSrc).toBeTruthy()

    // Rotasi 90 derajat searah jarum jam
    const rotateCwBtn = page.getByTitle('Putar 90° searah jarum jam')
    await rotateCwBtn.click()

    const resetRotBtn = page.getByTitle('Kembalikan orientasi ke 0°')
    await expect(resetRotBtn).toBeVisible()
    await expect(resetRotBtn).toContainText('90°')

    // Pindah ke mode Manual Global
    const manualTab = page.getByRole('tab', { name: /Manual Global/i })
    await manualTab.click()
    await expect(manualTab).toHaveAttribute('aria-selected', 'true')

    // Atur slider threshold
    const slider = page.locator('#threshold-slider')
    await expect(slider).toBeVisible()
    await slider.fill('160')
    await slider.dispatchEvent('change')

    // Verifikasi gambar canvas terupdate
    await expect
      .poll(async () => preprocessedImg.getAttribute('src'))
      .not.toBe(initialSrc)
  })

  test('Pilar 3 & 4: Eksekusi OCR, JSON Extractor, dan Form Alignment Titik Dua Vertikal', async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(SAMPLE_KTP_FILE)

    const scanBtn = page.getByRole('button', {
      name: /Ekstrak Teks & Data KTP dengan OCR/i,
    })
    await expect(scanBtn).toBeEnabled()
    await scanBtn.click()

    // Progress bar muncul
    await expect(page.getByRole('progressbar')).toBeVisible()

    // Selesai scan
    await expect(page.getByText('Formulir terisi otomatis dari hasil ekstraksi')).toBeVisible()

    // Verifikasi JSON Output & Copy button
    const jsonTab = page.getByTestId('tab-json-raw')
    if (await jsonTab.isVisible()) {
      await jsonTab.click()
    }
    const jsonPre = page.locator('pre')
    await expect(jsonPre).toBeVisible()
    await expect(jsonPre).toContainText('"nik": "3171012304950001"')
    await expect(jsonPre).toContainText('"nama": "BUDI SANTOSO"')

    // Pindah ke tab Form untuk Verifikasi Input Form
    const formTab = page.getByTestId('tab-auto-fill')
    if (await formTab.isVisible()) {
      await formTab.click()
    }
    await expect(page.locator('#field-nik')).toHaveValue('3171012304950001')
    await expect(page.locator('#field-nama')).toHaveValue('BUDI SANTOSO')
    await expect(page.locator('#field-tempat-lahir')).toHaveValue('JAKARTA')
    await expect(page.locator('#field-tanggal-lahir')).toHaveValue('23-04-1995')
    await expect(page.locator('#field-jenis-kelamin')).toHaveValue('LAKI-LAKI')
    await expect(page.locator('#field-alamat')).toHaveValue('JL. KEBON SIRIH NO. 45')

    // Verifikasi Kesejajaran Titik Dua (Colons `:`) secara vertikal melalui CSS Grid
    const colons = page.locator('form span:text-is(":")')
    const count = await colons.count()
    expect(count).toBeGreaterThanOrEqual(10)

    // Evaluasi koordinat X setiap titik dua untuk memastikan lurus sempurna
    const firstBox = await colons.first().boundingBox()
    expect(firstBox).not.toBeNull()
    if (firstBox) {
      for (let i = 1; i < count; i++) {
        const box = await colons.nth(i).boundingBox()
        if (box) {
          // Bounding box X harus sejajar pada kolom grid yang sama (selisih < 2px toleransi subpixel)
          expect(Math.abs(box.x - firstBox.x)).toBeLessThanOrEqual(2)
        }
      }
    }
  })

  test('Pilar 5: Manajemen Memori Ketat (Anti-Memory Leak URL.revokeObjectURL)', async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]')

    // 1. Upload
    await fileInput.setInputFiles(SAMPLE_KTP_FILE)
    await expect(page.getByAltText('Foto KTP Asli')).toBeVisible()
    const activeUrls = await getActiveObjectUrls(page)
    expect(activeUrls.length).toBeGreaterThan(0)

    // 2. Reset
    const resetBtn = page.getByRole('button', { name: /^Reset$/i })
    await resetBtn.click()
    await expect(resetBtn).not.toBeVisible()

    // 3. Pastikan semua ObjectURL telah di-revoke (length = 0)
    await expect
      .poll(async () => {
        const urls = await getActiveObjectUrls(page)
        return urls.length
      })
      .toBe(0)
  })
})
