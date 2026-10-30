Write-Output "copying web component files to public dir for downlaod"
Remove-item  "./public/lib" -Force  -Recurse -ErrorAction SilentlyContinue
Copy-Item -Path "src/components/lib/" -Destination "./public/lib" -Recurse 
Write-Output "web component files copied to public/lib" 