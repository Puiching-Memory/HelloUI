!macro NSIS_HOOK_POSTUNINSTALL
  RMDir /r "$INSTDIR\engines"
  RMDir /r "$INSTDIR\outputs"
!macroend
