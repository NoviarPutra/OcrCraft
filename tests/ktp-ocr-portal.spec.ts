import path from 'node:path'
import { expect, test } from '@playwright/test'
import { getActiveObjectUrls, setupObjectUrlTracker } from './helpers/leakTracker'
import { setupTesseractMock } from './helpers/mockTesseract'

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures')
const SAMPLE_KTP_FILE = path.join(FIXTURES_DIR, 'ktp-sample.jpg')
const INVALID_DOC_FILE = path.join(FIXTURES_DIR, 'invalid-doc.pdf')
const INVALID_TEXT_FILE = path.join(FIXTURES_DIR, 'invalid-text.txt')
const EMPTY_BYTE_FILE = path.join(FIXTURES_DIR, 'empty-0byte.jpg')

test.describe('Client-Side KTP OCR & Candidate Portal E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Daftarkan leak tracker & fast mock tesseract worker sebelum navigasi
    await setupObjectUrlTracker(page)
    await setupTesseractMock(page)
    await page.goto('/')

    // Masuk ke workspace jika berada di Demo Selector Hub
    const demoCard = page.getByTestId('demo-card-client-side-tesseract')
    if (await demoCard.isVisible()) {
      await demoCard.click()
    }

    // Pastikan halaman dan panel utama telah termuat penuh
    await expect(page.getByRole('heading', { name: /KTP OCR & JSON Extractor/i })).toBeVisible()
  })

  test.describe('Skenario 1: Validasi Input & Keamanan File (Negative Test)', () => {
    test('menolak file non-gambar (PDF dan TXT) dengan pesan error aksesibel role="alert"', async ({
      page,
    }) => {
      const fileInput = page.locator('input[type="file"]')
      const alert = page.getByRole('alert')

      // 1. Uji file PDF
      await fileInput.setInputFiles(INVALID_DOC_FILE)
      await expect(alert).toBeVisible()
      await expect(alert).toContainText('Format file tidak didukung')
      await expect(alert).toContainText('JPG, JPEG, PNG, atau WEBP')

      // 2. Uji file TXT
      await fileInput.setInputFiles(INVALID_TEXT_FILE)
      await expect(alert).toBeVisible()
      await expect(alert).toContainText('Format file tidak didukung')

      // 3. Pastikan memilih file valid setelahnya akan menghapus pesan error
      await fileInput.setInputFiles(SAMPLE_KTP_FILE)
      await expect(alert).not.toBeVisible()
      await expect(page.getByAltText('Foto KTP Asli')).toBeVisible()
    })

    test('menolak file kosong 0-byte dengan pesan error spesifik', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]')
      const alert = page.getByRole('alert')

      await fileInput.setInputFiles(EMPTY_BYTE_FILE)
      await expect(alert).toBeVisible()
      await expect(alert).toContainText('0 byte')
      await expect(alert).toContainText('kosong atau korup')
    })

    test('menolak file gambar yang melebihi batas ukuran 10 MB', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]')
      const alert = page.getByRole('alert')

      // Buat simulated buffer gambar 11 MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024)
      await fileInput.setInputFiles({
        name: 'oversized-ktp.jpg',
        mimeType: 'image/jpeg',
        buffer: largeBuffer,
      })

      await expect(alert).toBeVisible()
      await expect(alert).toContainText('10 MB')
    })
  })

  test.describe('Skenario 2: Interaksi Canvas Preprocessing & Threshold Slider', () => {
    test('menampilkan Before vs After dan memperbarui canvas saat threshold/mode/rotasi diubah', async ({
      page,
    }) => {
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(SAMPLE_KTP_FILE)

      // 1. Verifikasi tampilan Before (Asli) dan After (Canvas Preprocessed)
      const originalImage = page.getByAltText('Foto KTP Asli')
      const preprocessedImage = page.getByAltText('Hasil Preprocessed Canvas KTP')

      await expect(originalImage).toBeVisible()
      await expect(preprocessedImage).toBeVisible()

      // Catat src awal canvas preprocessed
      const initialSrc = await preprocessedImage.getAttribute('src')
      expect(initialSrc).toBeTruthy()

      // 2. Ubah mode preprocessing ke "Manual Global"
      const manualGlobalTab = page.getByRole('tab', { name: /Manual Global/i })
      await manualGlobalTab.click()
      await expect(manualGlobalTab).toHaveAttribute('aria-selected', 'true')

      // Slider threshold harus muncul
      const thresholdSlider = page.locator('#threshold-slider')
      await expect(thresholdSlider).toBeVisible()

      // Geser slider ke nilai baru (misal 180)
      await thresholdSlider.fill('180')
      await thresholdSlider.dispatchEvent('change')

      // Verifikasi bahwa gambar after memperbarui dataURL-nya
      await expect
        .poll(async () => {
          return preprocessedImage.getAttribute('src')
        })
        .not.toBe(initialSrc)

      // 3. Uji fitur rotasi gambar 90 derajat searah jarum jam
      const rotateCwBtn = page.getByTitle('Putar 90° searah jarum jam')
      await rotateCwBtn.click()

      // Indikator reset rotasi harus menampilkan (90°)
      const resetRotationBtn = page.getByTitle('Kembalikan orientasi ke 0°')
      await expect(resetRotationBtn).toBeVisible()
      await expect(resetRotationBtn).toContainText('90°')

      // Reset orientasi kembali ke 0°
      await resetRotationBtn.click()
      await expect(resetRotationBtn).not.toBeVisible()
    })
  })

  test.describe('Skenario 3: Alur OCR, Pemetaan JSON, & Auto-Fill Form', () => {
    test('menjalankan proses OCR, menampilkan progres real-time, dan mengisikan data ke JSON & Form', async ({
      page,
    }) => {
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(SAMPLE_KTP_FILE)

      const scanBtn = page.getByRole('button', {
        name: /Ekstrak Teks & Data KTP dengan OCR/i,
      })
      await expect(scanBtn).toBeEnabled()

      // Klik tombol mulai scan
      await scanBtn.click()

      // Verifikasi status progress bar muncul dan aktif
      const progressBar = page.getByRole('progressbar')
      await expect(progressBar).toBeVisible()

      // Tunggu hingga tombol scan kembali ke kondisi normal (selesai)
      await expect(scanBtn).toBeEnabled()
      await expect(page.getByText('Formulir terisi otomatis dari hasil ekstraksi')).toBeVisible()

      // Verifikasi Panel 2: Output JSON & Skor Confidence
      const jsonTab = page.getByTestId('tab-json-raw')
      if (await jsonTab.isVisible()) {
        await jsonTab.click()
      }
      const jsonPre = page.locator('pre')
      await expect(jsonPre).toBeVisible()
      await expect(jsonPre).toContainText('"nik": "3171012304950001"')
      await expect(jsonPre).toContainText('"nama": "BUDI SANTOSO"')
      await expect(jsonPre).toContainText('"kewarganegaraan": "WNI"')
      await expect(page.getByText('95%')).toBeVisible()

      // Verifikasi Panel 3: Simulasi Auto-Fill Form terisi otomatis
      const formTab = page.getByTestId('tab-auto-fill')
      if (await formTab.isVisible()) {
        await formTab.click()
      }
      await expect(page.locator('#field-nik')).toHaveValue('3171012304950001')
      await expect(page.locator('#field-nama')).toHaveValue('BUDI SANTOSO')
      await expect(page.locator('#field-tempat-lahir')).toHaveValue('JAKARTA')
      await expect(page.locator('#field-tanggal-lahir')).toHaveValue('23-04-1995')
      await expect(page.locator('#field-jenis-kelamin')).toHaveValue('LAKI-LAKI')
      await expect(page.locator('#field-gol-darah')).toHaveValue('O')
      await expect(page.locator('#field-alamat')).toHaveValue('JL. KEBON SIRIH NO. 45')
      await expect(page.locator('#field-rt-rw')).toHaveValue('005/002')
      await expect(page.locator('#field-kel-desa')).toHaveValue('GAMBIR')
      await expect(page.locator('#field-kecamatan')).toHaveValue('GAMBIR')
      await expect(page.locator('#field-agama')).toHaveValue('ISLAM')
      await expect(page.locator('#field-status')).toHaveValue('BELUM KAWIN')
      await expect(page.locator('#field-pekerjaan')).toHaveValue('KARYAWAN SWASTA')
      await expect(page.getByRole('radio', { name: /Warga Negara Indonesia/i })).toBeChecked()

      // Verifikasi interaktivitas koreksi pengguna dan tombol "Kembalikan ke Hasil OCR"
      const nameInput = page.locator('#field-nama')
      await nameInput.fill('BUDI SANTOSO, M.KOM')
      await expect(nameInput).toHaveValue('BUDI SANTOSO, M.KOM')

      const restoreBtn = page.getByRole('button', { name: /Kembalikan ke Hasil OCR/i })
      await expect(restoreBtn).toBeVisible()
      await restoreBtn.click()

      // Harus kembali ke nilai awal hasil scan
      await expect(nameInput).toHaveValue('BUDI SANTOSO')
    })
  })

  test.describe('Skenario 4: Pengujian Anti-Memory Leak & Lifecycle Cleanup', () => {
    test('memastikan ObjectURL di-revoke dan tidak menumpuk saat ganti file atau reset berulang', async ({
      page,
    }) => {
      const fileInput = page.locator('input[type="file"]')

      // Siklus 1: Unggah berkas
      await fileInput.setInputFiles(SAMPLE_KTP_FILE)
      await expect(page.getByAltText('Foto KTP Asli')).toBeVisible()

      // Pastikan ada ObjectURL aktif untuk preview
      const urlsAfterUpload = await getActiveObjectUrls(page)
      expect(urlsAfterUpload.length).toBeGreaterThan(0)

      // Tekan tombol Reset
      const resetBtn = page.getByRole('button', { name: /^Reset$/i })
      await resetBtn.click()

      // Tunggu hingga tombol reset hilang (kembali ke state awal kosong)
      await expect(resetBtn).not.toBeVisible()

      // Verifikasi seluruh ObjectURL telah di-revoke secara deterministik
      await expect
        .poll(async () => {
          const urls = await getActiveObjectUrls(page)
          return urls.length
        })
        .toBe(0)

      // Siklus 2 & 3: Unggah dan Reset berulang secara berturut-turut
      for (let i = 0; i < 2; i++) {
        await fileInput.setInputFiles(SAMPLE_KTP_FILE)
        await expect(page.getByAltText('Foto KTP Asli')).toBeVisible()

        const activeResetBtn = page.getByRole('button', { name: /^Reset$/i })
        await activeResetBtn.click()
        await expect(activeResetBtn).not.toBeVisible()
      }

      // Pastikan nol memory leak pada ObjectURL registry
      const finalActiveUrls = await getActiveObjectUrls(page)
      expect(finalActiveUrls.length).toBe(0)
    })
  })

  test.describe('Skenario 5: Alur Sampel KTP Demo (Zero-Upload Flow)', () => {
    test('menghasilkan sampel KTP otomatis dan berhasil diekstrak tanpa unggahan berkas eksternal', async ({
      page,
    }) => {
      const demoBtn = page.getByRole('button', { name: /Muat Sampel KTP Demo/i })
      await expect(demoBtn).toBeVisible()
      await demoBtn.click()

      // Verifikasi gambar sampel demo berhasil ter-render pada kedua kanvas
      await expect(page.getByAltText('Foto KTP Asli')).toBeVisible()
      await expect(page.getByAltText('Hasil Preprocessed Canvas KTP')).toBeVisible()

      // Jalankan OCR
      const scanBtn = page.getByRole('button', {
        name: /Ekstrak Teks & Data KTP dengan OCR/i,
      })
      await scanBtn.click()

      // Tunggu selesai dan pastikan form terisi
      await expect(page.getByText('Formulir terisi otomatis dari hasil ekstraksi')).toBeVisible()
      const nikInput = page.locator('#field-nik')
      await expect(nikInput).not.toBeEmpty()
    })
  })

  test.describe('Skenario 6: Integrasi Nyata Tesseract.js WASM (Opt-in Lokal)', () => {
    test('memproses gambar fixture asli menggunakan engine neural network Tesseract.js riil', async ({
      page,
    }) => {
      test.skip(
        process.env['TEST_REAL_OCR'] !== 'true',
        'Jalankan dengan TEST_REAL_OCR=true untuk eksekusi model WASM neural network lokal'
      )
      test.setTimeout(90_000)

      await page.goto('/')
      await expect(page.getByRole('heading', { name: /KTP OCR & JSON Extractor/i })).toBeVisible()

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(SAMPLE_KTP_FILE)

      const scanBtn = page.getByRole('button', {
        name: /Ekstrak Teks & Data KTP dengan OCR/i,
      })
      await expect(scanBtn).toBeEnabled()
      await scanBtn.click()

      await expect(page.getByText('Formulir terisi otomatis dari hasil ekstraksi'), {
        timeout: 60_000,
      }).toBeVisible()

      const nikInput = page.locator('#field-nik')
      await expect(nikInput).not.toBeEmpty()
    })
  })
})
