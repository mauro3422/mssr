# CRLF ancestor-range diagnostic — 2026-10-11

With MSSR 0.2.126, a 101-CRLF synthetic document containing a root heading,
one target child heading, and a distractor led Jev to select the root `Probe`
range instead of `Rule`. Choice and Noul were 0.85/0.85. Exact fetch validated
the 5,895-character parent range, so provenance worked while precision failed.
The blind Luna reviewer found the answer present but buried under 90 irrelevant
staging lines and repeated filler.

This exposes a separate parent-versus-child overbreadth case in heading mode; it
does not show a CRLF offset failure or a package regression. The linked focused
case removes the parent heading and is reported separately. This one synthetic
document is not a reliability or calibration sample. Production Bridge was not
restarted or changed; the isolated checkout was restored to MSSR 0.2.121.
