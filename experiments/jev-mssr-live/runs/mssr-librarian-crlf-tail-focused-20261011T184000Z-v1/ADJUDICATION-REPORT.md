# Focused CRLF tail diagnostic — 2026-10-11

MSSR 0.2.126 through the isolated Bridge 0.6.169 adapter selected the exact
`Rule` child heading from a 99-CRLF document without candidate handles. Choice
was 1.00, `evidenceSufficiency` 0.88, latency 861 ms, and Jev reported 729 input
/ 67 output tokens. Exact fetch matched the selected fingerprint and returned
the complete 1,504-character range. A blind Luna review rated the range `full`:
it found the boundary and all five values, while marking repeated staging text
as substantial irrelevant overbreadth.

A deterministic provider-request capture, run against the same frozen source
through the package-level selector, isolates the intended code-path difference.
With MSSR 0.2.121, the 260-character option excerpt ends at `Sign…` before the
late rule and its fields. With 0.2.126, the excerpt includes the signed
activation and `prior`, `baseline`, `version`, `active`, and `archived count`
terms, with the final plural suffix clipped by the existing 260-character
budget. The live Jev result confirms the corrected package can select and fetch
the focused child on this fixture. The capture is deterministic and provider
off; it is not a second Jev call.

The related parent-heading case selected a 5,895-character ancestor instead of
the child, showing that heading precision/overbreadth remains a separate issue.
This small synthetic diagnostic does not establish general reliability or
confidence calibration. Production Bridge was not restarted or changed; after
the live call and package comparison, the isolated checkout was restored to
MSSR 0.2.121 and verified clean.
