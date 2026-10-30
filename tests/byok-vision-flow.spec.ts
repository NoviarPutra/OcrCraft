import { expect, test } from '@playwright/test'

const mockAuthToken = ['mock', 'token', 'auth', 'val'].join('_')

test.describe('BYOK Vision OCR Hub & Studio E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('1. Hub menampilkan kartu BYOK Vision OCR dan navigasi ke Workspace v2', async ({
    page,
  }) => {
    // 1. Verifikasi kartu BYOK Vision OCR di Hub
    const byokCard = page.getByTestId('demo-card-byok-vision-ocr')
    await expect(byokCard).toBeVisible()
    await expect(byokCard).toContainText('BYOK Vision OCR (OpenAI-Compatible)')
    await expect(byokCard).toContainText('Baru / BYOK Vision')
    await expect(byokCard).toContainText('v2.0')
    await expect(byokCard).toContainText('Buka Workspace Demo')

    // 2. Klik kartu untuk membuka Workspace v2
    await byokCard.click()

    // 3. Verifikasi Workspace v2 terbuka
    await expect(page.getByText('BYOK Vision OCR Studio')).toBeVisible()
    await expect(page.getByText('v2.0 Beta (OpenAI-Compatible)')).toBeVisible()
    await expect(page.getByText('Visual e-KTP & Pre-Flight')).toBeVisible()
    await expect(page.getByText('Zero Binarization (True Color)')).toBeVisible()

    // 4. Buka Pengaturan BYOK
    const settingsBtn = page.getByTestId('byok-settings-btn')
    await expect(settingsBtn).toBeVisible()
    await settingsBtn.click()

    // 5. Verifikasi Drawer Pengaturan terbuka dengan field sesuai spesifikasi
    await expect(
      page.getByRole('heading', { name: 'Pengaturan Provider BYOK Vision OCR' })
    ).toBeVisible()
    await expect(page.getByLabel('Nama Label Provider')).toBeVisible()
    await expect(page.getByLabel('Base URL')).toBeVisible()
    await expect(page.getByLabel('API Key', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Model ID')).toBeVisible()
    await expect(page.getByText('Temperature: 0.0')).toBeVisible()
    await expect(page.getByText('Ingat API Key di perangkat ini')).toBeVisible()

    // 6. Tutup modal pengaturan
    await page.getByRole('button', { name: 'Batal' }).click()
    await expect(
      page.getByRole('heading', { name: 'Pengaturan Provider BYOK Vision OCR' })
    ).not.toBeVisible()

    // 7. Kembali ke Hub
    const backBtn = page.getByTestId('back-to-hub-btn')
    await backBtn.click()
    await expect(page.getByRole('heading', { name: 'OcrCraft Studio' })).toBeVisible()
  })

  test('2. Tombol Muat Contoh e-KTP menghasilkan gambar pre-flight teroptimasi', async ({
    page,
  }) => {
    // Buka BYOK Vision OCR
    await page.getByTestId('demo-card-byok-vision-ocr').click()

    // Klik tombol Muat Contoh e-KTP
    const loadSampleBtn = page.getByRole('button', { name: /Muat Contoh e-KTP/i })
    await expect(loadSampleBtn).toBeVisible()
    await loadSampleBtn.click()

    // Verifikasi preview gambar muncul dan tag dimensi teroptimasi ditampilkan
    const previewImg = page.getByAltText('Preview e-KTP')
    await expect(previewImg).toBeVisible()
    await expect(page.getByText(/1200×760px/)).toBeVisible()
  })

  test('3. Registrasi provider baru, simpan ke localStorage, dan persist setelah page.reload()', async ({
    page,
  }) => {
    // Buka BYOK Vision OCR
    await page.getByTestId('demo-card-byok-vision-ocr').click()

    // Buka Pengaturan
    await page.getByTestId('byok-settings-btn').click()

    // Klik Tambah Provider
    await page.getByTestId('add-new-provider-btn').click()

    // Isi formulir provider kustom
    await page.getByTestId('byok-provider-name').fill('Local vLLM Cluster')
    await page.getByTestId('byok-base-url').fill('http://127.0.0.1:8000/v1')
    await page.getByTestId('byok-api-key').fill(mockAuthToken)
    await page.getByTestId('byok-model-id').fill('qwen/qwen2.5-vl-72b-instruct')

    // Pastikan checkbox persist aktif
    const persistCheckbox = page.getByTestId('persist-api-key-checkbox')
    await expect(persistCheckbox).toBeChecked()

    // Simpan & Terapkan
    await page.getByTestId('byok-save-config-btn').click()

    // Verifikasi header studio langsung menampilkan provider baru
    const settingsBtn = page.getByTestId('byok-settings-btn')
    await expect(settingsBtn).toContainText('Local vLLM Cluster')
    await expect(settingsBtn).toContainText('qwen/qwen2.5-vl-72b-instruct')

    // Refresh halaman peramban (Simulasi user menutup tab atau refresh F5)
    await page.reload()

    // Masuk kembali ke BYOK Vision OCR
    await page.getByTestId('demo-card-byok-vision-ocr').click()

    // Header harus langsung terhidrasi dengan provider yang aktif sebelum refresh
    const refreshedSettingsBtn = page.getByTestId('byok-settings-btn')
    await expect(refreshedSettingsBtn).toContainText('Local vLLM Cluster')
    await expect(refreshedSettingsBtn).toContainText('qwen/qwen2.5-vl-72b-instruct')

    // Buka pengaturan dan verifikasi seluruh field tetap terisi
    await refreshedSettingsBtn.click()
    await expect(page.getByTestId('byok-provider-name')).toHaveValue('Local vLLM Cluster')
    await expect(page.getByTestId('byok-base-url')).toHaveValue('http://127.0.0.1:8000/v1')
    await expect(page.getByTestId('byok-api-key')).toHaveValue(mockAuthToken)
    await expect(page.getByTestId('byok-model-id')).toHaveValue('qwen/qwen2.5-vl-72b-instruct')
    await expect(page.getByTestId('persist-api-key-checkbox')).toBeChecked()

    // Tutup drawer
    await page.getByRole('button', { name: 'Batal' }).click()
  })

  test('4. Data localStorage yang korup/invalid tidak menyebabkan White Screen of Death', async ({
    page,
  }) => {
    // Injeksi data korup ke localStorage sebelum navigasi
    await page.addInitScript(() => {
      localStorage.setItem('ocrcraft:byok:providers:v1', 'CORRUPT_MALFORMED_{{{bad_json')
    })

    await page.goto('/')

    // Buka BYOK Vision OCR
    await page.getByTestId('demo-card-byok-vision-ocr').click()

    // Aplikasi tidak boleh crash, tetap menampilkan UI studio secara normal
    await expect(page.getByText('BYOK Vision OCR Studio')).toBeVisible()
    const settingsBtn = page.getByTestId('byok-settings-btn')
    await expect(settingsBtn).toBeVisible()

    // Fallback otomatis ke default OpenAI provider
    await expect(settingsBtn).toContainText('OpenAI')
  })

  test('5. Menghapus / Forget Provider membersihkan data dari localStorage secara tuntas', async ({
    page,
  }) => {
    // Setup provider kustom terlebih dahulu
    await page.getByTestId('demo-card-byok-vision-ocr').click()
    await page.getByTestId('byok-settings-btn').click()
    await page.getByTestId('add-new-provider-btn').click()

    await page.getByTestId('byok-provider-name').fill('Provider Untuk Dihapus')
    await page.getByTestId('byok-base-url').fill('https://delete-me.example.com/v1')
    await page.getByTestId('byok-api-key').fill(mockAuthToken)
    await page.getByTestId('byok-model-id').fill('delete-model')
    await page.getByTestId('byok-save-config-btn').click()

    // Buka kembali pengaturan
    await page.getByTestId('byok-settings-btn').click()

    // Konfirmasi dialog browser saat klik Hapus
    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })

    // Klik tombol Hapus / Forget Provider
    await page.getByTestId('forget-provider-btn').click()

    // Tutup drawer
    await page.getByRole('button', { name: 'Batal' }).click()

    // Verifikasi di localStorage browser bahwa provider tersebut sudah tidak ada
    const storedState = await page.evaluate(() => {
      return localStorage.getItem('ocrcraft:byok:providers:v1')
    })
    expect(storedState).not.toContain('Provider Untuk Dihapus')
    expect(storedState).not.toContain('https://delete-me.example.com/v1')
  })
})
