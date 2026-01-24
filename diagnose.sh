#!/bin/bash
# Diagnostic script for PlateRecogniser integration

echo "========================================="
echo "  GateScan Diagnostic Check"
echo "========================================="
echo ""

# Check backend running
echo "1️⃣ Checking Backend..."
if curl -s http://localhost:5000 > /dev/null 2>&1; then
  echo "   ✅ Backend running on http://localhost:5000"
else
  echo "   ❌ Backend NOT running. Start with: cd backend && npm run dev"
  exit 1
fi

# Check ANPR route
echo ""
echo "2️⃣ Checking /anpr/scan route..."
RESPONSE=$(curl -s -X POST http://localhost:5000/anpr/scan -H "Content-Type: multipart/form-data" 2>&1)
if echo "$RESPONSE" | grep -q "No image provided"; then
  echo "   ✅ /anpr/scan route responding"
else
  echo "   ⚠️  /anpr/scan returned: $RESPONSE"
fi

# Check API key
echo ""
echo "3️⃣ Checking PLATE_RECOGNISER_API_KEY..."
if grep -q "PLATE_RECOGNISER_API_KEY=" backend/.env; then
  KEY=$(grep "PLATE_RECOGNISER_API_KEY=" backend/.env | cut -d'=' -f2)
  if [ -z "$KEY" ] || [ "$KEY" = "your_api_key_here" ]; then
    echo "   ⚠️  API key not set or placeholder value"
  else
    echo "   ✅ API key configured (${KEY:0:10}...)"
  fi
else
  echo "   ❌ PLATE_RECOGNISER_API_KEY not found in .env"
fi

# Check frontend running
echo ""
echo "4️⃣ Checking Frontend..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "   ✅ Frontend running on http://localhost:5173"
else
  echo "   ❌ Frontend NOT running. Start with: cd frontend && npm run dev"
fi

echo ""
echo "========================================="
echo "  Diagnostics Complete"
echo "========================================="
