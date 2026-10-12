# Run plan — mssr-librarian-publication-incident-facets-20261012T121314Z-v2

- Compare one live selection for each original compound question with live facet selections from the same frozen source.
- PUB-POS: one two-part baseline versus two atomic calls.
- INCIDENT-POS: one four-part baseline versus four atomic calls. The project-only prompt explicitly asks for the source's listed options.
- Freeze source text, labels and each search result before any Jev call. The provider does not receive labels.
- Fetch every selected range exactly. Assemble only the treatment facet ranges into one evidence pack per original question.
- Keep confidence and sufficiency descriptive and uncalibrated; change no policy or source metadata.
- Two Luna design review notes judged the publication split distinct and answerable, and flagged ambiguity in a singular project-only destination. The frozen query now asks for the listed record options.
- This run covers two linked document clusters in one repository. Labels are single-analyst, not owner-gold; this is not production calibration.

- Corrected one-based spans are explicitly checked against numbered frozen source snapshots before any live Jev call.
- The prior `...-v1` run is preserved but invalidated because its analyst label spans were off by four source lines; its labels were never sent to Jev.
