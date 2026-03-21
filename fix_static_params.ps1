$root = "C:\Users\Tecbunny Solutions\Desktop\tecbunny-master1-main\tecbunny-master\src\app"
$files = Get-ChildItem -Path $root -Recurse -Filter "page.tsx"

foreach ($file in $files) {
    if ($file.Directory.Name -match "^\[(.*)\]$") {
        $paramName = $matches[1]
        Write-Host "Updating $($file.FullName) with param '$paramName'"
        
        $content = Get-Content -LiteralPath $file.FullName -Raw
        
        # Replace empty array with dummy param
        # We assume the content has "return []" exactly or with whitespace
        if ($content -match "return\s*\[\s*\]") {
            $newReturn = "return [{ $paramName`: '1' }]"
            $content = $content -replace "return\s*\[\s*\]", $newReturn
            Set-Content -LiteralPath $file.FullName -Value $content -Encoding UTF8
            Write-Host "  -> Fixed"
        } else {
             Write-Host "  -> 'return []' not found or already fixed"
        }
    }
}
