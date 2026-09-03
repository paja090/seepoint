param(
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [Parameter(Mandatory = $true)][string]$ClientId,
  [switch]$AllowPreviewTestData
)

$ErrorActionPreference = 'Stop'

if (-not $AllowPreviewTestData) {
  throw 'Je vyžadován přepínač -AllowPreviewTestData.'
}

$uri = [Uri]$BaseUrl
if ($uri.Scheme -ne 'https' -or -not $uri.Host.EndsWith('.vercel.app')) {
  throw 'Skript lze spustit pouze proti HTTPS Vercel Preview URL.'
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginPayload = @{ email = $Email; password = $Password } | ConvertTo-Json
Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body $loginPayload -WebSession $session | Out-Null

$carrierResponse = Invoke-RestMethod -Uri "$BaseUrl/api/carriers?page=1&pageSize=100" -WebSession $session
$priceItems = Invoke-RestMethod -Uri "$BaseUrl/api/price-list-items" -WebSession $session
$priceItem = $null
foreach ($candidate in $priceItems) {
  if ($candidate.isActive -and $candidate.mediaType -eq 'PROMO_BENCH' -and $candidate.name -match 'Lavičky') {
    $priceItem = $candidate
    break
  }
}

if (-not $priceItem) {
  throw 'V Preview nebyla nalezena aktivní ceníková položka pro PROMO_BENCH.'
}

$available = @()
foreach ($carrier in $carrierResponse.carriers) {
  foreach ($surface in $carrier.surfaces) {
    if ($surface.status -eq 'AVAILABLE' -and $surface.mediaType -eq 'PROMO_BENCH' -and $carrier.city -ne '1') {
      $available += [pscustomobject]@{
        surfaceId = $surface.id
        dateFrom = '2026-10-01'
        dateTo = '2026-10-31'
        quantity = '1'
        unit = 'plocha'
        unitPrice = [string]$priceItem.rentalPrice
        discountPercent = '0'
        discountAmount = '0'
        note = 'PREVIEW E2E'
        groupLabel = 'PROMO_BENCH'
        customTitle = ''
        clientDescription = 'Preview testovací plocha'
      }
    }
  }
}

$minimumQuantity = [int]($priceItem.minQuantity)
$items = @($available | Select-Object -First $minimumQuantity)
if ($items.Count -ne $minimumQuantity) {
  throw "Ceník vyžaduje $($priceItem.minQuantity) ploch, ale dostupných je pouze $($items.Count)."
}

$payload = @{
  clientId = $ClientId
  title = 'PREVIEW E2E standardní nabídka 2026-08-26'
  campaignName = 'PREVIEW E2E říjen 2026'
  contactPerson = 'Testovací Klient'
  contactEmail = 'preview-e2e@seepoint.invalid'
  contactPhone = '+420 000 000 000'
  campaignGoal = 'PREVIEW E2E ověření celého toku bez reálného klienta.'
  budget = '40000'
  validUntil = '2026-09-15'
  internalNote = 'Pouze izolovaný Preview E2E test. Neodesílat e-mailem.'
  clientMessage = 'Toto je automatizovaná testovací nabídka v izolovaném Preview.'
  taxRate = '21'
  confirmNegotiation = $false
  pricingTier = 'komerce'
  items = $items
  chargeSelections = @()
  intent = 'draft'
}
$json = $payload | ConvertTo-Json -Depth 8

$availability = Invoke-RestMethod -Uri "$BaseUrl/api/offers/availability" -Method Post -ContentType 'application/json' -Body $json -WebSession $session
$blocking = @($availability.conflicts | Where-Object { $_.severity -eq 'block' })
if ($blocking.Count -gt 0) {
  throw 'Dostupnost obsahuje blokující kolizi; nabídka nebyla vytvořena.'
}

$created = Invoke-RestMethod -Uri "$BaseUrl/api/offers" -Method Post -ContentType 'application/json' -Body $json -WebSession $session
[pscustomobject]@{
  offerId = $created.offer.id
  status = $created.offer.status
  clientId = $created.offer.clientId
  title = $created.offer.title
  items = @($created.offer.items).Count
  conflicts = @($created.conflicts).Count
  priceListItem = $priceItem.id
} | ConvertTo-Json -Compress
