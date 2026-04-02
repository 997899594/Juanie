{{- define "juanie.secretName" -}}
{{- if .Values.secret.existingSecret -}}
{{- .Values.secret.existingSecret -}}
{{- else -}}
{{- printf "%s-secret" .Chart.Name -}}
{{- end -}}
{{- end -}}
