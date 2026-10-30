import { describe, expect, it } from 'vitest'
import {
  extractJsonFromText,
  extractOpenAiResponseContent,
  parseByokVisionResponse,
} from './byokResponseParser'
describe('extractJsonFromText', () => {
  it('extracts raw JSON directly without extra formatting', () => {
    const raw = '{"nik": "3171010101900001", "nama": "BUDI SANTOSO"}'
    expect(extractJsonFromText(raw)).toBe('{"nik": "3171010101900001", "nama": "BUDI SANTOSO"}')
  })

  it('strips markdown ```json ... ``` wrapper', () => {
    const raw = `\`\`\`json
{
  "nik": "3171010101900001",
  "nama": "BUDI SANTOSO"
}
\`\`\``
    const extracted = extractJsonFromText(raw)
    expect(JSON.parse(extracted)).toEqual({
      nik: '3171010101900001',
      nama: 'BUDI SANTOSO',
    })
  })

  it('extracts JSON surrounded by conversational text before and after', () => {
    const raw = `Tentu! Berikut hasil ekstraksi dari gambar e-KTP yang Anda kirimkan:

\`\`\`json
{
  "nik": "3201015510920002",
  "nama": "SITI AMINAH"
}
\`\`\`

Catatan: KTP dalam kondisi baik dan terbaca jelas.`
    const extracted = extractJsonFromText(raw)
    expect(JSON.parse(extracted)).toEqual({
      nik: '3201015510920002',
      nama: 'SITI AMINAH',
    })
  })

  it('handles trailing commas defensively', () => {
    const raw = `{"nik": "3171010101900001", "nama": "BUDI",}`
    const extracted = extractJsonFromText(raw)
    expect(JSON.parse(extracted)).toEqual({
      nik: '3171010101900001',
      nama: 'BUDI',
    })
  })
})

describe('extractOpenAiResponseContent', () => {
  it('extracts content from standard OpenAI JSON response', () => {
    const rawJson = JSON.stringify({
      id: 'chatcmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: '{"nik": "3171010101900001"}',
          },
        },
      ],
    })

    expect(extractOpenAiResponseContent(rawJson)).toBe('{"nik": "3171010101900001"}')
  })

  it('extracts and concatenates content from SSE streaming chunks (data: {...})', () => {
    const sseResponse = [
      'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":"{\\"nik\\": "}}]}',
      '',
      'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":"\\"3171010101900001\\", "}}]}',
      '',
      'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":"\\"nama\\": \\"BUDI\\"}"}}]}',
      '',
      'data: [DONE]',
    ].join('\n')

    const extracted = extractOpenAiResponseContent(sseResponse)
    expect(JSON.parse(extracted)).toEqual({
      nik: '3171010101900001',
      nama: 'BUDI',
    })
  })

  it('handles direct JSON payload without choices wrapper', () => {
    const direct = '{"nik": "3171010101900001", "nama": "BUDI"}'
    expect(extractOpenAiResponseContent(direct)).toBe(direct)
  })
})

describe('parseByokVisionResponse', () => {
  it('parses structured JSON with object address and maps to KtpData', () => {
    const rawResponse = JSON.stringify({
      nik: '3171010101900001',
      nama: 'EKO PRASETYO',
      tempat_lahir: 'JAKARTA',
      tanggal_lahir: '01-01-1990',
      jenis_kelamin: 'LAKI-LAKI',
      golongan_darah: 'O',
      alamat: {
        jalan: 'JL. MERDEKA BARAT NO. 10',
        rt_rw: '003/004',
        kel_desa: 'GAMBIR',
        kecamatan: 'GAMBIR',
      },
      agama: 'ISLAM',
      status_perkawinan: 'BELUM KAWIN',
      pekerjaan: 'KARYAWAN SWASTA',
      kewarganegaraan: 'WNI',
      quality_check: {
        is_clear: true,
        blur_detected: false,
        glare_detected: false,
        issues: [],
      },
    })

    const parsed = parseByokVisionResponse(rawResponse, {
      modelUsed: 'gpt-4o-mini',
      baseUrlUsed: 'https://api.openai.com/v1',
      processingTimeMs: 850,
    })

    expect(parsed.data.nik).toBe('3171010101900001')
    expect(parsed.data.nama).toBe('EKO PRASETYO')
    expect(parsed.data.tempatLahir).toBe('JAKARTA')
    expect(parsed.data.tanggalLahir).toBe('01-01-1990')
    expect(parsed.data.jenisKelamin).toBe('LAKI-LAKI')
    expect(parsed.data.golonganDarah).toBe('O')
    expect(parsed.data.alamat).toBe('JL. MERDEKA BARAT NO. 10')
    expect(parsed.data.rtRw).toBe('003/004')
    expect(parsed.data.kelDesa).toBe('GAMBIR')
    expect(parsed.data.kecamatan).toBe('GAMBIR')
    expect(parsed.data.agama).toBe('ISLAM')
    expect(parsed.meta.nikValid).toBe(true)
    expect(parsed.qualityCheck.isClear).toBe(true)
  })

  it('performs cross-check on female date of birth (+40 days) in NIK', () => {
    // Siti Aminah, born 15-10-1992 (female) -> Day 15 + 40 = 55 -> 551092
    const rawResponse = `\`\`\`json
{
  "nik": "3201015510920002",
  "nama": "SITI AMINAH",
  "tempat_lahir": "BOGOR",
  "tanggal_lahir": "15-10-1992",
  "jenis_kelamin": "PEREMPUAN",
  "golongan_darah": "A",
  "alamat": "KP. RAWA BEBEK RT 01 RW 02",
  "rt_rw": "001/002",
  "kel_desa": "BABAKAN",
  "kecamatan": "BOGOR TENGAH",
  "agama": "ISLAM",
  "status_perkawinan": "KAWIN",
  "pekerjaan": "IBU RUMAH TANGGA",
  "kewarganegaraan": "WNI"
}
\`\`\``

    const parsed = parseByokVisionResponse(rawResponse, {
      modelUsed: 'qwen/qwen2.5-vl-72b-instruct',
      baseUrlUsed: 'https://openrouter.ai/api/v1',
      processingTimeMs: 1200,
    })

    expect(parsed.data.nik).toBe('3201015510920002')
    expect(parsed.data.jenisKelamin).toBe('PEREMPUAN')
    expect(parsed.data.tanggalLahir).toBe('15-10-1992')
    expect(parsed.meta.nikValid).toBe(true)
  })

  it('handles flat camelCase or snake_case fields seamlessly', () => {
    const rawResponse = JSON.stringify({
      nik: '3171010203850005',
      nama: 'HENDRA KUSUMA',
      tempatLahir: 'SURABAYA',
      tanggalLahir: '02-03-1985',
      jenisKelamin: 'LAKI-LAKI',
      golonganDarah: 'B',
      alamat: 'JL. PEMUDA NO 45',
      rtRw: '002/005',
      kelDesa: 'EMBONG KALIASIN',
      kecamatan: 'GENTENG',
      agama: 'KRISTEN',
      statusPerkawinan: 'KAWIN',
      pekerjaan: 'WIRASWASTA',
      kewarganegaraan: 'WNI',
    })

    const parsed = parseByokVisionResponse(rawResponse, {
      modelUsed: 'llama-3.2-11b-vision-preview',
      baseUrlUsed: 'https://api.groq.com/openai/v1',
      processingTimeMs: 600,
    })

    expect(parsed.data.tempatLahir).toBe('SURABAYA')
    expect(parsed.data.rtRw).toBe('002/005')
    expect(parsed.data.kelDesa).toBe('EMBONG KALIASIN')
    expect(parsed.data.kecamatan).toBe('GENTENG')
  })

  it('throws descriptive error if response contains no JSON', () => {
    const invalidText = 'Mohon maaf, saya tidak dapat melihat gambar yang Anda kirimkan.'
    expect(() =>
      parseByokVisionResponse(invalidText, {
        modelUsed: 'gpt-4o-mini',
        baseUrlUsed: 'https://api.openai.com/v1',
        processingTimeMs: 300,
      })
    ).toThrow(/JSON/)
  })
})
