import path from 'node:path'
import { expect, test } from '@playwright/test'
import { getActiveObjectUrls, setupObjectUrlTracker } from './helpers/leakTracker'
import { setupTesseractMock } from './helpers/mockTesseract'

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures')
const SAMPLE_KTP_FILE = path.join(FIXTURES_DIR, 'ktp-sample.jpg')

test.describe('OCR Demo Hub & Navigation Flow E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await setupObjectUrlTracker(page)
    await setupTesseractMock(page)
    await page.goto('/')
  })

  test('1. Hub Landing Awal: menampilkan OcrCraft Studio dan daftar kartu versi demo', async ({
    page,
  }) => {
    // 1. Verifikasi branding OcrCraft Studio di Hub
    await expect(page.getByRole('heading', { name: 'OcrCraft Studio' })).toBeVisible()
    await expect(page.getByText('Sandbox Hub')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /Eksplorasi Teknologi OCR/i })
    ).toBeVisible()

    // 2. Verifikasi kartu versi Stable: Client-Side Tesseract OCR
    const tesseractCard = page.getByTestId('demo-card-client-side-tesseract')
    await expect(tesseractCard).toBeVisible()
    await expect(tesseractCard).toContainText('Client-Side Tesseract OCR')
    await expect(tesseractCard).toContainText('Stable')
    await expect(tesseractCard).toContainText('v1.0')
    await expect(tesseractCard).toContainText('Coba Demo')
    // 3. Verifikasi kartu versi PaddleOCR ONNX (Local Neural Engine)
    const paddleCard = page.getByTestId('demo-card-paddleocr-onnx')
    await expect(paddleCard).toBeVisible()
    await expect(paddleCard).toContainText('PaddleOCR ONNX (Local Neural Engine)')
    await expect(paddleCard).toContainText('Local AI')
    await expect(paddleCard).toContainText('v2.1')
    await expect(paddleCard).toContainText('Coba Demo')

    // 4. Verifikasi kartu versi roadmap (Roadmap)
    const hybridCard = page.getByTestId('demo-card-serverless-hybrid-gateway')
    await expect(hybridCard).toBeVisible()
    await expect(hybridCard).toContainText('Serverless Hybrid Gateway')
    await expect(hybridCard).toContainText('Roadmap')
    await expect(hybridCard).toHaveAttribute('aria-disabled', 'true')
  })
  test('2. Transisi Masuk ke Workspace: membuka layout 3-kolom modern', async ({
    page,
  }) => {
    // Klik kartu versi Client-Side Tesseract OCR
    const tesseractCard = page.getByTestId('demo-card-client-side-tesseract')
    await tesseractCard.click()

    // Verifikasi masuk ke Workspace
    await expect(
      page.getByRole('heading', { name: /Client-Side KTP OCR & JSON Extractor/i })
    ).toBeVisible()

    // Tombol kembali ke hub harus terlihat
    const backBtn = page.getByTestId('back-to-hub-btn')
    await expect(backBtn).toBeVisible()
    await expect(backBtn).toContainText('Pilih Versi Demo')

    // Verifikasi 3 kolom layout modern
    await expect(page.getByRole('region', { name: /Panel Kontrol & Preprocessing/i })).toBeVisible()
    await expect(page.getByRole('region', { name: /Perbandingan Visual Canvas/i })).toBeVisible()
    await expect(page.getByRole('region', { name: /Panel Hasil Ekstraksi/i })).toBeVisible()
  })

  test('3. Navigasi Kembali ke Hub: lifecycle cleanup bersih & URL.revokeObjectURL terpanggil', async ({
    page,
  }) => {
    // 1. Masuk ke Workspace
    await page.getByTestId('demo-card-client-side-tesseract').click()
    await expect(page.getByTestId('back-to-hub-btn')).toBeVisible()

    // 2. Upload file gambar KTP
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(SAMPLE_KTP_FILE)
    await expect(page.getByAltText('Foto KTP Asli')).toBeVisible()

    // 3. Verifikasi bahwa ObjectURL teralokasi di memori
    const activeUrls = await getActiveObjectUrls(page)
    expect(activeUrls.length).toBeGreaterThan(0)

    // 4. Tekan tombol ← Ganti Versi Demo untuk kembali ke Hub
    const backBtn = page.getByTestId('back-to-hub-btn')
    await backBtn.click()

    // 5. Verifikasi kembali ke Landing Hub
    await expect(page.getByTestId('demo-card-client-side-tesseract')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /Eksplorasi Teknologi OCR/i })
    ).toBeVisible()

    // 6. Verifikasi strict lifecycle cleanup: semua ObjectURL telah di-revoke (length = 0)
    await expect
      .poll(async () => {
        const urls = await getActiveObjectUrls(page)
        return urls.length
      })
      .toBe(0)

    // 7. Masuk kembali ke workspace, pastikan state kanvas telah bersih (fresh state)
    await page.getByTestId('demo-card-client-side-tesseract').click()
    await expect(page.getByText('Kanvas Visual Belum Tersedia')).toBeVisible()
  })

  test('4. Navigasi Masuk & Keluar PaddleOCR Workspace', async ({ page }) => {
    await page.goto('/')
    const paddleCard = page.getByTestId('demo-card-paddleocr-onnx')
    await paddleCard.click()

    // Verifikasi masuk ke Workspace PaddleOCR
    await expect(page.getByText('PaddleOCR ONNX (Local Neural Engine)')).toBeVisible()
    await expect(page.getByText('WASM SIMD')).toBeVisible()
    await expect(page.getByText('WebGPU')).toBeVisible()

    // Klik kembali ke hub
    await page.getByTestId('back-to-hub-btn').click()
    await expect(page.getByRole('heading', { name: /Eksplorasi Teknologi OCR/i })).toBeVisible()
  })

  test('5. Tampilan Responsif Mobile & Desktop (Zero Overflow & Touch Target >= 44px)', async ({
    page,
  }) => {
    // --- 1. Verifikasi Mobile Viewport (iPhone SE / 375px) ---
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Cek header dan status indicator
    await expect(page.getByRole('heading', { name: 'OcrCraft Studio' })).toBeVisible()
    await expect(page.getByText('3 Versi Demo Tersedia')).toBeVisible()
    await expect(
      page.getByText(/Pilih arsitektur engine OCR kependudukan e-KTP berbasis browser/i)
    ).toBeVisible()

    // Pastikan tidak ada horizontal overflow di mobile
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalOverflow).toBe(false)

    // Verifikasi touch target minimal 44px pada tombol aksi kartu
    const tesseractCard = page.getByTestId('demo-card-client-side-tesseract')
    const tryDemoBtn = tesseractCard.getByRole('button', { name: /Coba Demo/i })
    const box = await tryDemoBtn.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44)
    }

    // --- 2. Verifikasi Desktop Viewport (1280px) ---
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.getByRole('heading', { name: 'OcrCraft Studio' })).toBeVisible()
    await expect(page.getByText('3 Versi Demo Tersedia')).toBeVisible()

    const hasDesktopOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasDesktopOverflow).toBe(false)
  })
})
