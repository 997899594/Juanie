{{- define "juanie.effectiveSecretName" -}}
{{- if .Values.externalSecret.enabled -}}
{{- .Values.externalSecret.targetName | default (printf "%s-secret" .Chart.Name) -}}
{{- else if .Values.secret.existingSecret -}}
{{- .Values.secret.existingSecret -}}
{{- else -}}
{{- printf "%s-secret" .Chart.Name -}}
{{- end -}}
{{- end -}}

{{- define "juanie.secretEnv" -}}
{{- $root := .root -}}
{{- range .keys }}
- name: {{ . }}
  valueFrom:
    secretKeyRef:
      name: {{ include "juanie.effectiveSecretName" $root }}
      key: {{ . }}
      optional: true
{{- end }}
{{- end -}}

{{- define "juanie.image" -}}
{{- if .digest -}}
{{- printf "%s@%s" .repository .digest -}}
{{- else -}}
{{- printf "%s:%s" .repository .tag -}}
{{- end -}}
{{- end -}}
