#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

utilities='(accent|bg|border(-[a-z]+)?|caret|decoration|divide|drop-shadow|fill|from|inset-ring|inset-shadow|outline|placeholder|ring(-offset)?|shadow|stroke|text(-shadow)?|to|via)'
families='(amber|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|mauve|mist|neutral|olive|orange|pink|purple|red|rose|sky|slate|stone|taupe|teal|violet|yellow|zinc)'
colors="($families-(50|[1-9]00|950)|black|white)"
pattern="(^|[^[:alnum:]_-])$utilities-$colors([^[:alnum:]_-]|$)"

if git grep --untracked -nE "$pattern" -- 'ui/src/*.ts' 'ui/src/*.tsx' ':(exclude)ui/src/*.gen.ts'; then
  printf '%s\n' 'Use semantic color tokens from ui/src/styles.css in UI source.' >&2
  exit 1
else
  status=$?
  if [[ "$status" != 1 ]]; then
    exit "$status"
  fi
fi
