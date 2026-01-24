
# Diagnostic script for PlateRecogniser integration
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  GateScan Diagnostic Check" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check backend running
Write-Host "1️⃣ Checking Backend..." -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "http://localhost:5000" -TimeoutSec 2 -ErrorAction SilentlyContinue
  Write-Host "   ✅ Backend running on http://localhost:5000" -ForegroundColor Green
} catch {
  Write-Host "   ❌ Backend NOT running. Start with: cd backend && npm run dev" -ForegroundColor Red
}

# Check ANPR route
Write-Host ""
Write-Host "2️⃣ Checking /anpr/scan route..." -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "http://localhost:5000/anpr/scan" -Method POST -ContentType "multipart/form-data" -TimeoutSec 5 -ErrorAction SilentlyContinue
  if ($response -match "image") {
    Write-Host "   ✅ /anpr/scan route responding" -ForegroundColor Green
  }
} catch {
  if ($_.Exception.Message -match "400" -or $_.Exception.Message -match "No image") {
    Write-Host "   ✅ /anpr/scan route responding (expected 400 for missing image)" -ForegroundColor Green
  } else {
    Write-Host "   ⚠️  /anpr/scan error: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

# Check API key
Write-Host ""
Write-Host "3️⃣ Checking PLATE_RECOGNISER_API_KEY..." -ForegroundColor Yellow
$envFile = "backend\.env"
if (Test-Path $envFile) {
  $content = Get-Content $envFile | Select-String "PLATE_RECOGNISER_API_KEY"
  if ($content) {
    $key = $content -replace "PLATE_RECOGNISER_API_KEY=" , ""
    if ([string]::IsNullOrWhiteSpace($key) -or $key -eq "your_api_key_here") {
      Write-Host "   ⚠️  API key not set or placeholder value" -ForegroundColor Yellow
    } else {
      Write-Host "   ✅ API key configured ($($key.Substring(0,[Math]::Min(10, $key.Length)))...)" -ForegroundColor Green
    }
  } else {
    Write-Host "   ❌ PLATE_RECOGNISER_API_KEY not found in .env" -ForegroundColor Red
  }
} else {
  Write-Host "   ❌ .env file not found" -ForegroundColor Red
}

# Check frontend running
Write-Host ""
Write-Host "4️⃣ Checking Frontend..." -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -ErrorAction SilentlyContinue
  Write-Host "   ✅ Frontend running on http://localhost:5173" -ForegroundColor Green
} catch {
  Write-Host "   ❌ Frontend NOT running. Start with: cd frontend && npm run dev" -ForegroundColor Red
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Diagnostics Complete" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
