import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __ACTIVE_OBJECT_URLS__?: string[]
  }
}

/**
 * Tracks URL.createObjectURL and URL.revokeObjectURL invocations
 * to detect object URL memory leaks across file upload and reset cycles.
 */
export async function setupObjectUrlTracker(page: Page) {
  await page.addInitScript(() => {
    const activeUrls = new Set<string>()
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL

    URL.createObjectURL = function (obj: Blob | MediaSource) {
      const url = originalCreate.call(URL, obj)
      activeUrls.add(url)
      window.__ACTIVE_OBJECT_URLS__ = Array.from(activeUrls)
      return url
    }

    URL.revokeObjectURL = function (url: string) {
      activeUrls.delete(url)
      window.__ACTIVE_OBJECT_URLS__ = Array.from(activeUrls)
      return originalRevoke.call(URL, url)
    }
  })
}

export async function getActiveObjectUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__ACTIVE_OBJECT_URLS__ || [])
}
