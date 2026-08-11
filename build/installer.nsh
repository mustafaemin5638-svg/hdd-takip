!macro customInstall
  ; OneDrive değil — kullanıcı profilindeki klasik Desktop
  CreateShortCut "$PROFILE\Desktop\HDD TAKIP Yonetici.lnk" "$INSTDIR\HDD TAKIP.exe" "--owner"
  CreateShortCut "$SMPROGRAMS\$StartMenuGroup\HDD TAKIP Yonetici.lnk" "$INSTDIR\HDD TAKIP.exe" "--owner"
!macroend
