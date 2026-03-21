$root = "C:\Users\Tecbunny Solutions\Desktop\tecbunny-master1-main\tecbunny-master"
$apiPath = Join-Path $root "src\app\api"
Write-Host "Searching in $apiPath"

$files = Get-ChildItem -Path $apiPath -Recurse -File -Filter "route.ts"
foreach ($file in $files) {
    if ($file.FullName -match "\[") {
        Write-Host "Checking $($file.Name)"
        $content = Get-Content -LiteralPath $file.FullName | Out-String
        
        # Ensure we fix imports if needed? No, logic is fine.
        
        $newContent = $content -replace "export async function (PUT|DELETE|POST|PATCH)", "async function `$1"
        
        if ($newContent -ne $content) {
             Write-Host "  -> Removed export from non-GET methods"
             $content = $newContent
        }

        $hasParams = $content -match "generateStaticParams"
        $hasGet = $content -match "export\s+async\s+function\s+GET"
        
        if (-not $hasParams) {
            $content += "`nexport async function generateStaticParams() { return [] }`n"
            Write-Host "  -> Added generateStaticParams"
        }
        
        if (-not $hasGet) {
            $content += "`nexport async function GET() { return Response.json({}) }`n"
            Write-Host "  -> Added dummy GET"
        }
        
        # KEY FIX: Force UTF8
        Set-Content -LiteralPath $file.FullName -Value $content -Encoding UTF8
        Write-Host "  -> Saved $file.Name as UTF8"
    }
}
Write-Host "Done."
