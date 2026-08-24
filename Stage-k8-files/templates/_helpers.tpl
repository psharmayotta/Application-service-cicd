{{- define "q0-uiapi.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | lower | replace "_" "-" | replace "." "-" | trunc 57 | trimSuffix "-" -}}
{{- else -}}
{{- $name := printf "%s-%s" .Release.Name .Chart.Name | lower | replace "_" "-" | replace "." "-" -}}
{{- $hash := include "q0-uiapi.shortHash" . -}}
{{- printf "%s-%s" ($name | trunc 52 | trimSuffix "-") $hash -}}
{{- end -}}
{{- end -}}

{{- define "q0-uiapi.shortHash" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | sha256sum | trunc 5 -}}
{{- end -}}
