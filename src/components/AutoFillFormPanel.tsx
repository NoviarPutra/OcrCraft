import {
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  Edit3,
  FileCheck2,
  RotateCcw,
} from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useState } from 'react'
import type { KtpData, KtpExtractionResult } from '../types/ktp'

interface AutoFillFormPanelProps {
  result: KtpExtractionResult | null
  onUpdateData: (updated: KtpData) => void
}

const INITIAL_FORM_DATA: KtpData = {
  nik: '',
  nama: '',
  tempatLahir: '',
  tanggalLahir: '',
  jenisKelamin: '',
  golonganDarah: '',
  alamat: '',
  rtRw: '',
  kelDesa: '',
  kecamatan: '',
  agama: '',
  statusPerkawinan: '',
  pekerjaan: '',
  kewarganegaraan: '',
}

export function AutoFillFormPanel({ result, onUpdateData }: AutoFillFormPanelProps) {
  const [prevResult, setPrevResult] = useState<KtpExtractionResult | null>(result)
  const [originalOcrData, setOriginalOcrData] = useState<KtpData | null>(
    result ? { ...result.data } : null
  )
  const [formData, setFormData] = useState<KtpData>(() =>
    result ? { ...result.data } : INITIAL_FORM_DATA
  )
  const [isCopied, setIsCopied] = useState(false)

  // Sinkronkan form saat ada hasil run OCR baru atau saat reset
  if (result !== prevResult) {
    setPrevResult(result)
    if (!result) {
      setOriginalOcrData(null)
      setFormData(INITIAL_FORM_DATA)
    } else if (!result.meta.isUserEdited) {
      // Scan OCR baru: simpan snapshot data murni OCR untuk fitur restore
      setOriginalOcrData({ ...result.data })
      setFormData({ ...result.data })
    }
  }
  const handleFieldChange = (field: keyof KtpData, value: string) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onUpdateData(updated)
  }

  // Mengembalikan form ke data murni hasil scan OCR Tesseract sebelum diedit pengguna
  const handleResetToOcr = () => {
    if (originalOcrData) {
      const original = { ...originalOcrData }
      setFormData(original)
      onUpdateData(original)
    } else {
      setFormData(INITIAL_FORM_DATA)
    }
  }
  const handleCopyFormJson = async () => {
    const exportData = {
      meta: {
        ...(result?.meta ?? {
          confidence: 100,
          processingTimeMs: 0,
          nikValid: formData.nik.length === 16 && /^\d{16}$/.test(formData.nik),
        }),
        nikValid: formData.nik.length === 16 && /^\d{16}$/.test(formData.nik),
        isUserEdited: true,
      },
      data: formData,
      rawText: result?.rawText ?? '',
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setIsCopied(false)
    }
  }

  // Pengecekan status validasi field
  const isNikLengthValid = formData.nik.length === 16 && /^\d{16}$/.test(formData.nik)
  const isLowConfidence = (result?.meta.confidence ?? 100) < 70

  // Helper styling untuk input dengan highlight kuning bila mencurigakan/belum valid
  const getInputClass = (isWarning: boolean) =>
    `w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border outline-hidden ${
      isWarning
        ? 'bg-amber-500/10 border-amber-500/50 text-amber-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
        : 'bg-slate-950/80 border-slate-800 text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
    }`

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2.5">
      {/* Subheader Form Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/60 shrink-0">
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Simulasi Form e-KTP</span>
        </div>

        <div className="flex items-center gap-2">
          {result && (
            <button
              type="button"
              onClick={handleResetToOcr}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Kembalikan ke Hasil OCR
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyFormJson}
            disabled={!formData.nik && !formData.nama}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>JSON Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-white" />
                <span>Salin Data Form</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Banner Informasi Sinkronisasi & Peringatan Highlight Kuning */}
      {result ? (
        <div className="flex flex-col gap-2">
          {(!isNikLengthValid || isLowConfidence) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-amber-200">
                  Perhatian: Tinjau Bidang dengan Highlight Kuning
                </p>
                <div className="flex flex-col gap-0.5 text-amber-300/90">
                  {!isNikLengthValid && (
                    <p>
                      • NIK saat ini berjumlah <strong>{formData.nik.length} digit</strong> (standar
                      resmi e-KTP adalah tepat 16 digit angka).
                    </p>
                  )}
                  {isLowConfidence && (
                    <p>
                      • Skor keyakinan OCR rendah ({result.meta.confidence}%), disarankan memeriksa
                      kembali kejelasan karakter nama dan alamat.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              Formulir terisi otomatis dari hasil ekstraksi
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Edit3 className="w-3 h-3 text-slate-400" />
              Dapat diedit langsung untuk mengoreksi bacaan OCR
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 flex items-center gap-2">
          <span>
            ℹ️ Jalankan proses OCR pada gambar KTP untuk mengisi form ini secara otomatis. Anda juga
            dapat mengisinya secara manual.
          </span>
        </div>
      )}

      {/* Grid Formulir Input Berbaris KTP (Aligned Colons via CSS Grid) */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-[minmax(130px,max-content)_14px_1fr] items-center gap-y-2 gap-x-2"
      >
        {/* 1. NIK */}
        <label htmlFor="field-nik" className="text-xs font-semibold text-slate-300">
          NIK
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="flex flex-col gap-1 w-full">
          <div className="relative">
            <input
              id="field-nik"
              type="text"
              value={formData.nik}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleFieldChange('nik', e.target.value.replace(/\D/g, '').slice(0, 16))
              }
              placeholder="Contoh: 3171010101900001"
              maxLength={16}
              className={`${getInputClass(!isNikLengthValid && formData.nik.length > 0)} font-mono pr-24`}
            />
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] pointer-events-none ${
                isNikLengthValid ? 'text-emerald-400' : 'text-amber-400 font-bold'
              }`}
            >
              {formData.nik.length}/16 Digit
            </span>
          </div>
        </div>

        {/* 2. Nama Lengkap */}
        <label htmlFor="field-nama" className="text-xs font-semibold text-slate-300">
          Nama Lengkap
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <input
            id="field-nama"
            type="text"
            value={formData.nama}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFieldChange('nama', e.target.value.toUpperCase())
            }
            placeholder="Contoh: BUDI SANTOSO"
            className={getInputClass(isLowConfidence && !formData.nama)}
          />
        </div>

        {/* 3. Tempat Lahir */}
        <label htmlFor="field-tempat-lahir" className="text-xs font-semibold text-slate-300">
          Tempat Lahir
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <input
            id="field-tempat-lahir"
            type="text"
            value={formData.tempatLahir}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFieldChange('tempatLahir', e.target.value.toUpperCase())
            }
            placeholder="Contoh: JAKARTA"
            className={getInputClass(isLowConfidence && !formData.tempatLahir)}
          />
        </div>

        {/* 4. Tanggal Lahir */}
        <label htmlFor="field-tanggal-lahir" className="text-xs font-semibold text-slate-300">
          Tanggal Lahir
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <input
            id="field-tanggal-lahir"
            type="text"
            value={formData.tanggalLahir}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFieldChange('tanggalLahir', e.target.value)
            }
            placeholder="DD-MM-YYYY (Contoh: 15-08-1990)"
            className={`${getInputClass(isLowConfidence && !formData.tanggalLahir)} font-mono`}
          />
        </div>

        {/* 5. Jenis Kelamin */}
        <label htmlFor="field-jenis-kelamin" className="text-xs font-semibold text-slate-300">
          Jenis Kelamin
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <select
            id="field-jenis-kelamin"
            value={formData.jenisKelamin}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              handleFieldChange('jenisKelamin', e.target.value)
            }
            className={getInputClass(isLowConfidence && !formData.jenisKelamin)}
          >
            <option value="" className="bg-slate-900">
              -- Pilih Jenis Kelamin --
            </option>
            <option value="LAKI-LAKI" className="bg-slate-900">
              LAKI-LAKI
            </option>
            <option value="PEREMPUAN" className="bg-slate-900">
              PEREMPUAN
            </option>
          </select>
        </div>

        {/* 6. Golongan Darah */}
        <label htmlFor="field-gol-darah" className="text-xs font-semibold text-slate-300">
          Golongan Darah
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <select
            id="field-gol-darah"
            value={formData.golonganDarah}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              handleFieldChange('golonganDarah', e.target.value)
            }
            className={getInputClass(isLowConfidence && !formData.golonganDarah)}
          >
            <option value="" className="bg-slate-900">
              -- Pilih Gol. Darah --
            </option>
            <option value="A" className="bg-slate-900">
              A
            </option>
            <option value="B" className="bg-slate-900">
              B
            </option>
            <option value="AB" className="bg-slate-900">
              AB
            </option>
            <option value="O" className="bg-slate-900">
              O
            </option>
            <option value="-" className="bg-slate-900">
              - (Tidak Tahu / Kosong)
            </option>
          </select>
        </div>

        {/* 7. Alamat Lengkap */}
        <label htmlFor="field-alamat" className="text-xs font-semibold text-slate-300">
          Alamat
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <input
            id="field-alamat"
            type="text"
            value={formData.alamat}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFieldChange('alamat', e.target.value.toUpperCase())
            }
            placeholder="Contoh: JL. JENDERAL SUDIRMAN KAV. 5"
            className={getInputClass(isLowConfidence && !formData.alamat)}
          />
        </div>

        {/* 8. RT / RW */}
        <label htmlFor="field-rt-rw" className="text-xs font-semibold text-slate-300">
          RT / RW
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <input
            id="field-rt-rw"
            type="text"
            value={formData.rtRw}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFieldChange('rtRw', e.target.value)
            }
            placeholder="Contoh: 005/002"
            className={`${getInputClass(isLowConfidence && !formData.rtRw)} font-mono`}
          />
        </div>

        {/* 9. Kelurahan / Desa */}
        <label htmlFor="field-kel-desa" className="text-xs font-semibold text-slate-300">
          Kelurahan / Desa
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <input
            id="field-kel-desa"
            type="text"
            value={formData.kelDesa}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFieldChange('kelDesa', e.target.value.toUpperCase())
            }
            placeholder="Contoh: GELORA"
            className={getInputClass(isLowConfidence && !formData.kelDesa)}
          />
        </div>

        {/* 10. Kecamatan */}
        <label htmlFor="field-kecamatan" className="text-xs font-semibold text-slate-300">
          Kecamatan
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <input
            id="field-kecamatan"
            type="text"
            value={formData.kecamatan}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFieldChange('kecamatan', e.target.value.toUpperCase())
            }
            placeholder="Contoh: TANAH ABANG"
            className={getInputClass(isLowConfidence && !formData.kecamatan)}
          />
        </div>

        {/* 11. Agama */}
        <label htmlFor="field-agama" className="text-xs font-semibold text-slate-300">
          Agama
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <select
            id="field-agama"
            value={formData.agama}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              handleFieldChange('agama', e.target.value)
            }
            className={getInputClass(isLowConfidence && !formData.agama)}
          >
            <option value="" className="bg-slate-900">
              -- Pilih Agama --
            </option>
            <option value="ISLAM" className="bg-slate-900">
              ISLAM
            </option>
            <option value="KRISTEN" className="bg-slate-900">
              KRISTEN
            </option>
            <option value="KATOLIK" className="bg-slate-900">
              KATOLIK
            </option>
            <option value="HINDU" className="bg-slate-900">
              HINDU
            </option>
            <option value="BUDDHA" className="bg-slate-900">
              BUDDHA
            </option>
            <option value="KONGHUCU" className="bg-slate-900">
              KONGHUCU
            </option>
            <option value="PENGHAYAT KEPERCAYAAN" className="bg-slate-900">
              PENGHAYAT KEPERCAYAAN
            </option>
          </select>
        </div>

        {/* 12. Status Perkawinan */}
        <label htmlFor="field-status" className="text-xs font-semibold text-slate-300">
          Status Perkawinan
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <select
            id="field-status"
            value={formData.statusPerkawinan}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              handleFieldChange('statusPerkawinan', e.target.value)
            }
            className={getInputClass(isLowConfidence && !formData.statusPerkawinan)}
          >
            <option value="" className="bg-slate-900">
              -- Pilih Status --
            </option>
            <option value="BELUM KAWIN" className="bg-slate-900">
              BELUM KAWIN
            </option>
            <option value="KAWIN" className="bg-slate-900">
              KAWIN
            </option>
            <option value="CERAI HIDUP" className="bg-slate-900">
              CERAI HIDUP
            </option>
            <option value="CERAI MATI" className="bg-slate-900">
              CERAI MATI
            </option>
          </select>
        </div>

        {/* 13. Pekerjaan */}
        <label htmlFor="field-pekerjaan" className="text-xs font-semibold text-slate-300">
          Pekerjaan
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="w-full">
          <input
            id="field-pekerjaan"
            type="text"
            value={formData.pekerjaan}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFieldChange('pekerjaan', e.target.value.toUpperCase())
            }
            placeholder="Contoh: KARYAWAN SWASTA"
            className={getInputClass(isLowConfidence && !formData.pekerjaan)}
          />
        </div>

        {/* 14. Kewarganegaraan */}
        <label htmlFor="field-kewarganegaraan" className="text-xs font-semibold text-slate-300">
          Kewarganegaraan
        </label>
        <span className="text-slate-500 font-bold select-none text-center hidden sm:inline">:</span>
        <div className="flex items-center gap-4 pt-1 w-full">
          <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
            <input
              id="field-kewarganegaraan"
              type="radio"
              name="kewarganegaraan"
              value="WNI"
              checked={formData.kewarganegaraan === 'WNI' || !formData.kewarganegaraan}
              onChange={() => handleFieldChange('kewarganegaraan', 'WNI')}
              className="accent-indigo-500"
            />
            Warga Negara Indonesia (WNI)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
            <input
              type="radio"
              name="kewarganegaraan"
              value="WNA"
              checked={formData.kewarganegaraan === 'WNA'}
              onChange={() => handleFieldChange('kewarganegaraan', 'WNA')}
              className="accent-indigo-500"
            />
            Warga Negara Asing (WNA)
          </label>
        </div>
      </form>
    </div>
  )
}
