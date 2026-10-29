/**
 * Menghasilkan gambar simulasi e-KTP Indonesia berbasis Canvas
 * untuk keperluan demonstrasi langsung tanpa perlu mengunggah foto pribadi.
 */
export async function generateSampleKtpBlob(): Promise<Blob> {
  const width = 1200
  const height = 760

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Gagal mendapatkan 2D context')
  }

  // 1. Latar belakang KTP (Cyan / Light Blue khas e-KTP)
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#7ac9e8')
  gradient.addColorStop(0.5, '#68bedf')
  gradient.addColorStop(1, '#5bb1d4')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // 2. Simulasi tekstur garis batik halus e-KTP (noise latar)
  ctx.strokeStyle = 'rgba(70, 140, 180, 0.25)'
  ctx.lineWidth = 1.5
  for (let y = 10; y < height; y += 18) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x < width; x += 40) {
      ctx.quadraticCurveTo(x + 20, y + (x % 30 === 0 ? 8 : -8), x + 40, y)
    }
    ctx.stroke()
  }

  // 3. Header KTP
  ctx.fillStyle = '#0f172a'
  ctx.textAlign = 'center'
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText('PROVINSI DKI JAKARTA', width / 2, 50)
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText('JAKARTA PUSAT', width / 2, 85)

  // Garis pemisah header
  ctx.beginPath()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2.5
  ctx.moveTo(80, 102)
  ctx.lineTo(width - 80, 102)
  ctx.stroke()

  // 4. Data Baris KTP
  ctx.textAlign = 'left'
  const leftX = 60
  const colonX = 350
  const valueX = 370
  let startY = 155
  const lineSpacing = 37

  const rows: Array<[string, string]> = [
    ['NIK', '3171010101900001'],
    ['Nama', 'BUDI SANTOSO'],
    ['Tempat/Tgl Lahir', 'JAKARTA, 01-01-1990'],
    ['Jenis Kelamin', 'LAKI-LAKI        Gol. Darah : O'],
    ['Alamat', 'JL. SUDIRMAN NO. 45'],
    ['   RT/RW', '005/002'],
    ['   Kel/Desa', 'GELORA'],
    ['   Kecamatan', 'TANAH ABANG'],
    ['Agama', 'ISLAM'],
    ['Status Perkawinan', 'KAWIN'],
    ['Pekerjaan', 'KARYAWAN SWASTA'],
    ['Kewarganegaraan', 'WNI'],
    ['Berlaku Hingga', 'SEUMUR HIDUP'],
  ]

  for (const [label, val] of rows) {
    if (label === 'NIK') {
      ctx.font = 'bold 28px monospace'
      ctx.fillText(label, leftX, startY)
      ctx.fillText(':', colonX, startY)
      ctx.fillText(val, valueX, startY)
    } else {
      ctx.font = 'bold 21px sans-serif'
      ctx.fillText(label, leftX, startY)
      ctx.fillText(':', colonX, startY)
      ctx.font = '600 21px monospace'
      ctx.fillText(val, valueX, startY)
    }
    startY += lineSpacing
  }

  // 5. Kotak Pas Foto Simulasi di sisi kanan
  const photoX = width - 260
  const photoY = 140
  const photoW = 200
  const photoH = 270

  ctx.fillStyle = '#b91c1c' // Latar merah foto KTP (tahun genap)
  ctx.fillRect(photoX, photoY, photoW, photoH)
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 3
  ctx.strokeRect(photoX, photoY, photoW, photoH)

  // Siluet wajah pas foto
  ctx.fillStyle = '#fef08a'
  ctx.beginPath()
  ctx.arc(photoX + photoW / 2, photoY + 90, 50, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(photoX + photoW / 2, photoY + 220, 75, 70, 0, 0, Math.PI)
  ctx.fill()

  // 6. Tanggal Terbit & Tanda Tangan Simulasi
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('JAKARTA PUSAT', photoX + photoW / 2, photoY + photoH + 50)
  ctx.fillText('02-01-2015', photoX + photoW / 2, photoY + photoH + 75)

  // Simulasi goresan tanda tangan
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(photoX + 30, photoY + photoH + 130)
  ctx.bezierCurveTo(
    photoX + 70,
    photoY + photoH + 90,
    photoX + 110,
    photoY + photoH + 160,
    photoX + 170,
    photoY + photoH + 110
  )
  ctx.stroke()

  const { promise, resolve, reject } = Promise.withResolvers<Blob>()
  canvas.toBlob((b) => {
    // Bersihkan ukuran canvas offscreen
    canvas.width = 0
    canvas.height = 0
    if (b) resolve(b)
    else reject(new Error('Gagal mengekspor sample KTP canvas ke Blob.'))
  }, 'image/png')

  return promise
}
