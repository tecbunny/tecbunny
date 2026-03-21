$root = "C:\Users\Tecbunny Solutions\Desktop\tecbunny-master1-main\tecbunny-master\src\app"
$files = Get-ChildItem -Path $root -Recurse -Filter "page.tsx"

foreach ($file in $files) {
    $parent = $file.Directory
    $params = @{}
    
    # Walk up until src/app
    while ($parent.FullName.Length -ge $root.Length) {
        if ($parent.Name -match "^\[(.*)\]$") {
            $paramName = $matches[1]
            if ($paramName.StartsWith("...")) {
                 # Catch-all [...slug] -> slug: ['1']
                 $key = $paramName.Substring(3)
                 $params[$key] = "['1']" 
            } else {
                 $params[$paramName] = "'1'"
            }
        }
        $parent = $parent.Parent
    }
    
    if ($params.Count -gt 0) {
        Write-Host "Updating $($file.FullName)"
        $paramString = $params.Keys | ForEach-Object { "${_}: $($params[$_])" }
        $paramString = $paramString -join ", "
        $newReturn = "return [{ $paramString }]"
        Write-Host "  $newReturn"
        
        $content = Get-Content -LiteralPath $file.FullName -Raw
        
        # Regex to match return [ ] or return [ { ... } ]
        # We need to escape brackets in regex
        if ($content -match "return\s*\[.*?\]") {
             $content = $content -replace "return\s*\[.*?\]", $newReturn
             Set-Content -LiteralPath $file.FullName -Value $content -Encoding UTF8
        }
    }
}
