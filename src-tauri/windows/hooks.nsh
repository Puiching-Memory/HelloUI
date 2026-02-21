!macro NSIS_HOOK_POSTUNINSTALL
  RMDir /r "$INSTDIR\engines"
  RMDir /r "$INSTDIR\outputs"
  RMDir /r "$INSTDIR\models"
  RMDir "$INSTDIR"
!macroend
