import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminGate } from './components/AdminPortal'
import { PublicLayout } from './components/Storefront'
import { getCachedStoreSettings, getStoreSettings } from './services/store'
import type { StoreSettings } from './types/database'

export default function App() {
  const [settings, setSettings] = useState<StoreSettings>(() => getCachedStoreSettings())

  useEffect(() => {
    void getStoreSettings().then(setSettings)
    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<StoreSettings>
      if (custom.detail) setSettings(custom.detail)
    }
    window.addEventListener('nook-settings-updated', onSettingsUpdated)
    return () => window.removeEventListener('nook-settings-updated', onSettingsUpdated)
  }, [])

  useEffect(() => {
    document.title = `${settings.store_name} — ${settings.tagline}`
  }, [settings.store_name, settings.tagline])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminGate settings={settings} onSettingsChange={setSettings} />} />
        <Route path="/*" element={<PublicLayout settings={settings} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
