$root = "C:\Users\Tecbunny Solutions\Desktop\tecbunny-master1-main\tecbunny-master"
$apiPath = Join-Path $root "src\app\api"
Write-Host "Disabling routes in $apiPath"

$files = Get-ChildItem -Path $apiPath -Recurse -File -Filter "route.ts"
foreach ($file in $files) {
    $newName = Join-Path $file.Directory.FullName "_route.ts"
    Rename-Item -LiteralPath $file.FullName -NewName "_route.ts" -Force
    Write-Host "Renamed $($file.Name) to _route.ts"
}
Write-Host "All API routes disabled."
