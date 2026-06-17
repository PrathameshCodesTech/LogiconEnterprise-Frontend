# Asset Vault Frontend Integration Plan

## Overview

This is an **SSO integration** to embed/launch Asset Vault from enterprise-frontend.
The backend provides a signed login link; frontend displays it in iframe or provides open button.

**Backend endpoint:**
```
POST /api/integrations/asset-vault/login-link/

Response:
{
  url: string,
  expires_in: number,
  expires_at: string
}
```

---

## Implementation Tasks

### Task 1: Add Capability Constant

**File:** `src/lib/capabilities.ts`

```typescript
// Add to CAP object
ASSET_VAULT_ACCESS: 'asset_vault.access',
```

---

### Task 2: Create API Helper

**File:** `src/api/integrations.ts` (new file)

```typescript
import { api } from '@/api/client'

export interface AssetVaultLoginLinkResponse {
  url: string
  expires_in: number
  expires_at: string
}

/**
 * Request a signed login link for Asset Vault SSO.
 * Backend handles user context and role mapping.
 */
export async function getAssetVaultLoginLink(): Promise<AssetVaultLoginLinkResponse> {
  const res = await api.post('/api/integrations/asset-vault/login-link/')
  return res.data as AssetVaultLoginLinkResponse
}
```

---

### Task 3: Create Asset Vault Page

**File:** `src/features/integrations/AssetVaultPage.tsx`

**Behavior:**
1. On mount, call `getAssetVaultLoginLink()`
2. Show loading spinner while fetching
3. If error (403/400/503), show exact error message from backend
4. If success:
   - Try to load URL in iframe
   - If iframe fails (X-Frame-Options, etc.), show message + "Open in new tab" button
5. Provide refresh link button to get fresh token

```tsx
import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'
import { getAssetVaultLoginLink, type AssetVaultLoginLinkResponse } from '@/api/integrations'
import { parseApiError } from '@/lib/apiError'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'

export function AssetVaultPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkData, setLinkData] = useState<AssetVaultLoginLinkResponse | null>(null)
  const [iframeError, setIframeError] = useState(false)

  async function fetchLoginLink() {
    setLoading(true)
    setError(null)
    setIframeError(false)
    try {
      const res = await getAssetVaultLoginLink()
      setLinkData(res)
    } catch (e) {
      const parsed = parseApiError(e, 'Failed to get Asset Vault access')
      setError(parsed.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLoginLink()
  }, [])

  function handleIframeError() {
    setIframeError(true)
  }

  function openInNewTab() {
    if (linkData?.url) {
      window.open(linkData.url, '_blank', 'noopener,noreferrer')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Connecting to Asset Vault..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorState message={error} />
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={fetchLoginLink}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!linkData?.url) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorState message="No access URL returned from server." />
      </div>
    )
  }

  if (iframeError) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-panel border border-status-warning/40 bg-status-warning/5 p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-status-warning" />
          <h2 className="mt-4 text-lg font-semibold text-app-text">
            Asset Vault could not be embedded
          </h2>
          <p className="mt-2 text-sm text-app-secondary">
            The Asset Vault application cannot be displayed inline. Click below to open it in a new tab.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={openInNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Asset Vault
            </Button>
            <Button variant="secondary" onClick={fetchLoginLink}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Get fresh link
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-app-border bg-app-surface px-4 py-2">
        <h1 className="text-lg font-semibold text-app-text">Asset Vault</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={openInNewTab}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open in new tab
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchLoginLink}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>
      <iframe
        src={linkData.url}
        className="flex-1 border-0"
        title="Asset Vault"
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  )
}
```

---

### Task 4: Add Route

**File:** `src/app/routes.tsx`

```typescript
// Import
import { AssetVaultPage } from '@/features/integrations/AssetVaultPage'

// Add to ROUTES constant
ASSET_VAULT: '/asset-vault',

// Add route config
{
  path: 'asset-vault',
  element: (
    <RequireCapability anyOf={[CAP.ASSET_VAULT_ACCESS]}>
      <AssetVaultPage />
    </RequireCapability>
  ),
},
```

---

### Task 5: Add Navigation Item

**File:** `src/components/layout/navConfig.ts`

```typescript
// Import icon
import { Package } from 'lucide-react'

// Add to ITEMS constant
assetVault: {
  path: '/asset-vault',
  label: 'Asset Vault',
  icon: Package,
  requiredCapabilities: [CAP.ASSET_VAULT_ACCESS],
},

// Add to appropriate nav groups (internal only)
// In the full internal navGroups:
{
  label: 'Integrations',
  items: [ITEMS.assetVault],
},

// OR add to existing relevant group like "Operations" or "Tools"
```

---

## Key Principles

1. **No email/password handling** - Backend signs the token
2. **No role mapping in frontend** - Backend handles role mapping
3. **No hardcoded Asset Vault roles** - All role logic is backend-side
4. **Exact error messages** - Show what backend returns, no generic fallbacks
5. **Graceful iframe fallback** - If embedding fails, provide "Open" button
6. **Capability-gated** - Only users with `asset_vault.access` see it

---

## File Summary

| File | Action |
|------|--------|
| `src/lib/capabilities.ts` | Add `ASSET_VAULT_ACCESS` |
| `src/api/integrations.ts` | New file - `getAssetVaultLoginLink()` |
| `src/features/integrations/AssetVaultPage.tsx` | New file - Page component |
| `src/app/routes.tsx` | Add `/asset-vault` route |
| `src/components/layout/navConfig.ts` | Add nav item |

---

## Verification

```bash
npm run build
rg "asset_vault" src/
```

---

## Backend Prerequisite

Run migration:
```bash
python manage.py migrate
```

Ensure role with Asset Vault access has `asset_vault.access` capability assigned in DB.
